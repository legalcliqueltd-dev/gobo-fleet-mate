/**
 * Persistent tracking singleton.
 *
 * Lives OUTSIDE the React lifecycle so navigation, unmount, and
 * tab-visibility changes never stop tracking. The only things that
 * stop tracking are:
 *   1. Explicit user "Off Duty" toggle in Settings
 *   2. Explicit disconnect / logout
 *
 * On iOS the underlying Transistorsoft plugin is configured with
 *   stopOnTerminate: false, startOnBoot: true, enableHeadless: true
 * so it survives app termination and device reboot.
 *
 * On Android we rely on the Capacitor Geolocation plugin combined
 * with a foreground service notification to keep the WebView alive.
 *
 * On the web/PWA we use navigator.geolocation.watchPosition.
 */

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '@/integrations/supabase/client';
import { detectNativePlatform, isAndroid, isIOS } from '@/utils/platformDetection';
import { isGeolocationPluginAvailable } from '@/utils/nativeGeolocation';
import { startAndroidForegroundService, stopAndroidForegroundService } from '@/utils/androidForegroundService';
import {
  addOfflineLocation,
  clearLocationsBySource,
  getPendingBatch,
  removeSyncedLocations,
  getPendingCount,
} from '@/utils/offlineLocationStore';

const SUPABASE_FUNCTIONS_URL = 'https://invbnyxieoyohahqhbir.supabase.co/functions/v1/connect-driver';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImludmJueXhpZW95b2hhaHFoYmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNTAxMDUsImV4cCI6MjA3NzgyNjEwNX0.bOHyM6iexSMj-EtMoyjMEm92ydF5Yy-J7DHgocn4AKI';

const STORAGE_KEYS = {
  IS_ON: 'ftm_tracking_on',
  DRIVER_ID: 'ftm_driver_id',
  ADMIN_CODE: 'ftm_admin_code',
};

const SYNC_RETRY_INTERVAL_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = 60_000;
const NATIVE_COUNT_POLL_MS = 10_000;
const SYNC_BATCH_SIZE = 50;

export interface TrackingLocation {
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number | null;
  heading: number | null;
  timestamp: Date;
}

export interface TrackingState {
  isTracking: boolean;
  lastLocation: TrackingLocation | null;
  lastSyncTime: Date | null;
  pendingOfflineCount: number;
  nativePendingCount: number;
  batteryLevel: number;
  driverId: string | null;
  adminCode: string | null;
}

type TrackingEvent =
  | 'state-changed'
  | 'location'
  | 'error';

class TrackingService extends EventTarget {
  private state: TrackingState = {
    isTracking: false,
    lastLocation: null,
    lastSyncTime: null,
    pendingOfflineCount: 0,
    nativePendingCount: 0,
    batteryLevel: 100,
    driverId: null,
    adminCode: null,
  };

  private BackgroundGeolocation: any = null;
  private listenerSubscriptions: Array<{ remove: () => void }> = [];
  private syncRetryTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private nativeCountTimer: ReturnType<typeof setInterval> | null = null;
  private androidPollTimer: ReturnType<typeof setInterval> | null = null;
  private webWatchId: number | null = null;
  private nativeWatchId: string | null = null;
  private lastSentAt = 0;
  private isStarting = false;
  private resumeAttempted = false;

  getState(): TrackingState {
    return { ...this.state };
  }

  on(event: TrackingEvent, handler: EventListener) {
    this.addEventListener(event, handler);
    return () => this.removeEventListener(event, handler);
  }

  private setState(patch: Partial<TrackingState>) {
    this.state = { ...this.state, ...patch };
    this.dispatchEvent(new CustomEvent('state-changed', { detail: this.state }));
  }

  /**
   * Idempotent. Safe to call multiple times — only starts the underlying
   * native plugin once. Updates IDs if they changed.
   */
  async start(driverId: string, adminCode: string): Promise<void> {
    if (!driverId || !adminCode) {
      console.warn('[TrackingService] start() called without driverId/adminCode');
      return;
    }

    // Persist intent so cold-starts can resume.
    localStorage.setItem(STORAGE_KEYS.IS_ON, 'true');
    localStorage.setItem(STORAGE_KEYS.DRIVER_ID, driverId);
    localStorage.setItem(STORAGE_KEYS.ADMIN_CODE, adminCode);

    // If IDs changed, push them down to the plugin and continue.
    if (this.state.driverId === driverId && this.state.adminCode === adminCode && this.state.isTracking) {
      console.log('[TrackingService] Already tracking with same IDs');
      return;
    }

    this.setState({ driverId, adminCode });

    if (this.isStarting) {
      console.log('[TrackingService] Start already in progress');
      return;
    }
    this.isStarting = true;

    try {
      if (detectNativePlatform() && isIOS()) {
        await this.startIOS(driverId, adminCode);
      } else if (detectNativePlatform() && isAndroid()) {
        await this.startAndroid();
      } else {
        await this.startWeb();
      }

      this.startSyncRetry();
      this.startHeartbeat();

      this.setState({ isTracking: true });
    } catch (err) {
      console.error('[TrackingService] start failed:', err);
      this.dispatchEvent(new CustomEvent('error', { detail: err }));
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Explicit stop — only call from user "Off Duty" toggle / disconnect.
   * Never call from React useEffect cleanup.
   */
  async stop(): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.IS_ON, 'false');

    // Stop native plugins
    if (this.BackgroundGeolocation) {
      try {
        await this.BackgroundGeolocation.stop();
      } catch (e) {
        console.warn('[TrackingService] BackgroundGeolocation.stop failed:', e);
      }
    }

    if (this.nativeWatchId) {
      try {
        await Geolocation.clearWatch({ id: this.nativeWatchId });
      } catch (e) {
        console.warn('[TrackingService] clearWatch failed:', e);
      }
      this.nativeWatchId = null;
    }

    if (this.webWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.webWatchId);
      this.webWatchId = null;
    }

    if (this.androidPollTimer) {
      clearInterval(this.androidPollTimer);
      this.androidPollTimer = null;
    }

    await stopAndroidForegroundService();

    this.removeListeners();
    this.stopSyncRetry();
    this.stopHeartbeat();
    this.stopNativeCountPoll();

    this.setState({ isTracking: false });
  }

  /**
   * Called once at app boot. Re-arms the plugin if user was tracking
   * before the app was closed/restarted.
   */
  async resumeFromStorage(): Promise<void> {
    if (this.resumeAttempted) return;
    this.resumeAttempted = true;

    const isOn = localStorage.getItem(STORAGE_KEYS.IS_ON) === 'true';
    const driverId = localStorage.getItem(STORAGE_KEYS.DRIVER_ID);
    const adminCode = localStorage.getItem(STORAGE_KEYS.ADMIN_CODE);

    if (!isOn || !driverId || !adminCode) {
      console.log('[TrackingService] No previous tracking session to resume');
      return;
    }

    console.log('[TrackingService] Resuming tracking from storage:', { driverId });
    await this.start(driverId, adminCode);
  }

  // ─── iOS (Transistorsoft) ─────────────────────────────────────
  private async startIOS(driverId: string, adminCode: string) {
    try {
      const mod = await import('@transistorsoft/capacitor-background-geolocation');
      this.BackgroundGeolocation = (mod as any).default ?? mod;
    } catch (e) {
      console.warn('[TrackingService] Transistorsoft not available, falling back to Capacitor Geolocation:', e);
      await this.startAndroid(); // Use the Capacitor watch path
      return;
    }

    if (!this.BackgroundGeolocation) {
      console.warn('[TrackingService] Transistorsoft module empty');
      await this.startAndroid();
      return;
    }

    const BG = this.BackgroundGeolocation;

    const config = {
      reset: true,
      geolocation: {
        desiredAccuracy: BG.DESIRED_ACCURACY_NAVIGATION,
        distanceFilter: 3,
        stationaryRadius: 5,
        stopTimeout: 1,
        disableStopDetection: true,
        disableElasticity: true,
        pausesLocationUpdatesAutomatically: false,
        locationAuthorizationRequest: 'Always',
        showsBackgroundLocationIndicator: true,
        locationUpdateInterval: 10000,
        fastestLocationUpdateInterval: 5000,
        allowIdenticalLocations: false,
      },
      app: {
        stopOnTerminate: false,
        startOnBoot: true,
        preventSuspend: true,
        heartbeatInterval: 60,
      },
      activity: {
        disableMotionActivityUpdates: true,
        activityRecognitionInterval: 5000,
      },
      http: {
        url: SUPABASE_FUNCTIONS_URL,
        method: 'POST',
        autoSync: true,
        autoSyncThreshold: 3,
        batchSync: true,
        maxBatchSize: 50,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        params: {
          action: 'update-location',
          driverId,
          adminCode,
          isBackground: true,
        },
      },
      persistence: {
        maxRecordsToPersist: 10000,
      },
      logger: {
        debug: false,
        logLevel: BG.LOG_LEVEL_INFO ?? BG.LOG_LEVEL_WARNING,
      },
      // Legacy flat keys retained for v8 compatibility.
      desiredAccuracy: BG.DESIRED_ACCURACY_NAVIGATION,
      distanceFilter: 3,
      stationaryRadius: 5,
      stopTimeout: 1,
      disableStopDetection: true,
      disableElasticity: true,
      stopOnTerminate: false,
      startOnBoot: true,
      preventSuspend: true,
      pausesLocationUpdatesAutomatically: false,
      locationAuthorizationRequest: 'Always',
      showsBackgroundLocationIndicator: true,
      locationUpdateInterval: 10000,
      fastestLocationUpdateInterval: 5000,
      heartbeatInterval: 60,
      url: SUPABASE_FUNCTIONS_URL,
      method: 'POST',
      autoSync: true,
      autoSyncThreshold: 3,
      batchSync: true,
      maxBatchSize: 50,
      maxRecordsToPersist: 10000,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      params: {
        action: 'update-location',
        driverId,
        adminCode,
        isBackground: true,
      },
    };

    const readyState = await BG.ready(config);
    console.log('[TrackingService] iOS BG ready:', {
      enabled: readyState?.enabled,
      isMoving: readyState?.isMoving,
      authorization: readyState?.authorization,
    });

    try {
      await BG.requestPermission();
    } catch (permissionError) {
      console.warn('[TrackingService] iOS Always permission request failed:', permissionError);
    }

    try {
      const provider = await BG.getProviderState();
      console.log('[TrackingService] iOS provider state:', provider);
      const status = String(provider?.status ?? provider?.authorizationStatus ?? '').toLowerCase();
      if (status && !status.includes('always') && !status.includes('authorized_always')) {
        console.warn('[TrackingService] iOS background tracking needs Location permission set to Always:', provider);
      }
    } catch (providerError) {
      console.warn('[TrackingService] iOS provider state unavailable:', providerError);
    }

    // If already configured and IDs changed, push update.
    await BG.setConfig({
      http: { params: { action: 'update-location', driverId, adminCode, isBackground: true } },
      params: { action: 'update-location', driverId, adminCode, isBackground: true },
    }).catch(() => {});

    this.removeListeners();

    this.registerListener(BG.onLocation((loc: any) => this.onIOSLocation(loc), (err: any) => {
      console.warn('[TrackingService] iOS location error:', err);
    }));

    this.registerListener(BG.onHttp(async (response: any) => {
      console.log('[TrackingService] iOS native HTTP:', {
        success: response?.success,
        status: response?.status,
        responseText: response?.responseText,
      });
      if (response.success) {
        this.setState({ lastSyncTime: new Date() });
        await this.mirrorNativeQueue();
        await this.drainOfflineQueue();
      }
      await this.pollNativeCount();
    }));

    if (typeof BG.onProviderChange === 'function') {
      this.registerListener(BG.onProviderChange((event: any) => {
        console.log('[TrackingService] iOS provider change:', event);
      }));
    }

    if (typeof BG.onMotionChange === 'function') {
      this.registerListener(BG.onMotionChange((event: any) => {
        console.log('[TrackingService] iOS motion change:', {
          isMoving: event?.isMoving,
          location: event?.location?.coords,
        });
      }));
    }

    if (typeof BG.onHeartbeat === 'function') {
      this.registerListener(BG.onHeartbeat(async () => {
        try {
          await BG.getCurrentPosition({ samples: 1, persist: true, timeout: 30 });
        } catch (heartbeatError) {
          console.warn('[TrackingService] iOS heartbeat position failed:', heartbeatError);
        }
      }));
    }

    if (typeof BG.onConnectivityChange === 'function') {
      this.registerListener(BG.onConnectivityChange(async (event: any) => {
        if (event?.connected) {
          await this.forceNativeSync();
        }
      }));
    }

    await BG.start();
    if (typeof BG.changePace === 'function') {
      await BG.changePace(true).catch((paceError: any) => {
        console.warn('[TrackingService] iOS changePace failed:', paceError);
      });
    }

    try {
      const state = await BG.getState();
      console.log('[TrackingService] iOS BG started:', {
        enabled: state?.enabled,
        isMoving: state?.isMoving,
        trackingMode: state?.trackingMode,
      });
      if (!state?.enabled) throw new Error('Transistorsoft BackgroundGeolocation did not enable');
    } catch (stateError) {
      console.warn('[TrackingService] iOS BG state check failed:', stateError);
      throw stateError;
    }

    this.startNativeCountPoll();
    await this.mirrorNativeQueue();
    await this.pollNativeCount();
  }

  private onIOSLocation(location: any) {
    const driverId = this.state.driverId;
    const adminCode = this.state.adminCode;
    if (!driverId || !adminCode) return;

    // Native GPS may return -1 for speed/heading when unavailable.
    // Coerce to 0/null so server-side validation (speed >= 0) passes.
    const rawSpeed = location.coords.speed;
    const safeSpeed = rawSpeed != null && rawSpeed >= 0 ? rawSpeed * 3.6 : 0;
    const rawHeading = location.coords.heading;
    const safeHeading = rawHeading != null && rawHeading >= 0 ? rawHeading : null;
    const rawAccuracy = location.coords.accuracy;
    const safeAccuracy = rawAccuracy != null && rawAccuracy >= 0 ? rawAccuracy : 0;

    const loc: TrackingLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      speed: safeSpeed,
      accuracy: safeAccuracy,
      heading: safeHeading,
      timestamp: new Date(location.timestamp),
    };

    this.setState({
      lastLocation: loc,
      lastSyncTime: new Date(),
      batteryLevel: location.battery?.level != null
        ? Math.round(location.battery.level * 100)
        : this.state.batteryLevel,
    });

    this.dispatchEvent(new CustomEvent('location', { detail: loc }));

    const timestamp = loc.timestamp.toISOString();
    const syncKey = `${driverId}:${timestamp}:${loc.latitude.toFixed(6)}:${loc.longitude.toFixed(6)}`;

    addOfflineLocation({
      syncKey,
      driverId,
      adminCode,
      source: 'js',
      latitude: loc.latitude,
      longitude: loc.longitude,
      speed: loc.speed ?? 0,
      accuracy: loc.accuracy ?? 0,
      batteryLevel: this.state.batteryLevel,
      timestamp,
      createdAt: Date.now(),
    }).then(() => this.refreshOfflineCount());
  }

  // ─── Android (Capacitor Geolocation + Foreground Service) ────────
  private async startAndroid() {
    if (!isGeolocationPluginAvailable()) {
      console.warn('[TrackingService] Capacitor Geolocation plugin unavailable');
      return;
    }

    const permission = await Geolocation.checkPermissions();
    if (permission.location !== 'granted') {
      const req = await Geolocation.requestPermissions();
      if (req.location !== 'granted') {
        throw new Error('Location permission denied');
      }
    }

    await startAndroidForegroundService();

    // Initial fix
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
      if (pos) this.handlePosition(pos.coords);
    } catch (e) {
      console.warn('[TrackingService] Initial fix failed:', e);
    }

    // Polling — more resilient than watchPosition on Android WebView
    this.androidPollTimer = setInterval(async () => {
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        });
        if (pos) this.handlePosition(pos.coords);
      } catch (e) {
        console.warn('[TrackingService] Android poll failed:', e);
      }
    }, 30_000);
  }

  // ─── Web / PWA ────────────────────────────────────────────────
  private async startWeb() {
    if (!navigator.geolocation) {
      throw new Error('Geolocation not supported');
    }

    this.webWatchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos.coords),
      (err) => console.warn('[TrackingService] web watch error:', err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // ─── Common position handler (Android + Web) ──────────────────
  private handlePosition(coords: GeolocationCoordinates | any) {
    // Native/web GPS can report -1 for unavailable speed/heading.
    // Sanitize before passing to the edge function (speed must be >= 0).
    const rawSpeed = coords.speed;
    const safeSpeed = rawSpeed != null && rawSpeed >= 0 ? rawSpeed * 3.6 : 0;
    const rawHeading = coords.heading;
    const safeHeading = rawHeading != null && rawHeading >= 0 ? rawHeading : null;
    const rawAccuracy = coords.accuracy;
    const safeAccuracy = rawAccuracy != null && rawAccuracy >= 0 ? rawAccuracy : 0;

    const loc: TrackingLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed: safeSpeed,
      accuracy: safeAccuracy,
      heading: safeHeading,
      timestamp: new Date(),
    };

    this.setState({ lastLocation: loc });
    this.dispatchEvent(new CustomEvent('location', { detail: loc }));

    // Throttle sends to once per 30s
    const now = Date.now();
    if (now - this.lastSentAt < 30_000) return;
    this.lastSentAt = now;

    this.sendLocationUpdate(loc);
  }

  private async sendLocationUpdate(loc: TrackingLocation) {
    const driverId = this.state.driverId;
    const adminCode = this.state.adminCode;
    if (!driverId || !adminCode) return;

    try {
      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'update-location',
          driverId,
          adminCode,
          latitude: loc.latitude,
          longitude: loc.longitude,
          speed: loc.speed ?? 0,
          accuracy: loc.accuracy ?? 0,
          batteryLevel: this.state.batteryLevel,
        },
      });
      if (error) throw error;
      if (data?.requiresRelogin) {
        console.warn('[TrackingService] Server says relogin required');
        return;
      }
      this.setState({ lastSyncTime: new Date() });
    } catch (err) {
      console.warn('[TrackingService] send failed, persisting offline:', err);
      const timestamp = loc.timestamp.toISOString();
      await addOfflineLocation({
        syncKey: `${driverId}:${timestamp}:${loc.latitude.toFixed(6)}:${loc.longitude.toFixed(6)}`,
        driverId,
        adminCode,
        source: 'js',
        latitude: loc.latitude,
        longitude: loc.longitude,
        speed: loc.speed ?? 0,
        accuracy: loc.accuracy ?? 0,
        batteryLevel: this.state.batteryLevel,
        timestamp,
        createdAt: Date.now(),
      });
      this.refreshOfflineCount();
    }
  }

  // ─── Offline queue ────────────────────────────────────────────
  private async drainOfflineQueue() {
    const driverId = this.state.driverId;
    const adminCode = this.state.adminCode;
    if (!driverId || !adminCode) return;

    try {
      const batch = await getPendingBatch(SYNC_BATCH_SIZE, { excludeSources: ['native_mirror'] });
      if (batch.length === 0) return;

      const trailPoints = batch.map((loc) => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
        speed: loc.speed,
        accuracy: loc.accuracy,
        batteryLevel: loc.batteryLevel,
        timestamp: loc.timestamp,
      }));

      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: { action: 'sync-trail', driverId, adminCode, trailPoints },
      });

      if (!error && data?.success) {
        const ids = batch.map((l) => l.id!).filter(Boolean);
        await removeSyncedLocations(ids);
        console.log(`[TrackingService] Drained ${ids.length} offline locations`);
      }
    } catch (err) {
      console.warn('[TrackingService] drain failed:', err);
    }

    this.refreshOfflineCount();
  }

  private async refreshOfflineCount() {
    const count = await getPendingCount();
    this.setState({ pendingOfflineCount: count });
    window.dispatchEvent(new CustomEvent('offline-queue-updated'));
  }

  private startSyncRetry() {
    this.drainOfflineQueue();
    this.syncRetryTimer = setInterval(() => this.drainOfflineQueue(), SYNC_RETRY_INTERVAL_MS);
  }

  private stopSyncRetry() {
    if (this.syncRetryTimer) {
      clearInterval(this.syncRetryTimer);
      this.syncRetryTimer = null;
    }
  }

  // ─── Heartbeat ────────────────────────────────────────────────
  private startHeartbeat() {
    const beat = async () => {
      const driverId = this.state.driverId;
      if (!driverId) return;
      try {
        await supabase.functions.invoke('connect-driver', {
          body: {
            action: 'update-status',
            driverId,
            status: 'active',
            batteryLevel: this.state.batteryLevel,
          },
        });
      } catch (err) {
        console.warn('[TrackingService] heartbeat failed:', err);
      }
    };
    beat();
    this.heartbeatTimer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ─── Native (Transistorsoft) helpers ──────────────────────────
  private async pollNativeCount() {
    if (!this.BackgroundGeolocation) return;
    try {
      const count = await this.BackgroundGeolocation.getCount();
      this.setState({ nativePendingCount: typeof count === 'number' ? count : 0 });
    } catch (e) {
      // ignore
    }
  }

  private async forceNativeSync() {
    if (!this.BackgroundGeolocation) return;
    try {
      await this.BackgroundGeolocation.sync();
      await this.pollNativeCount();
      await this.drainOfflineQueue();
    } catch (e) {
      console.warn('[TrackingService] force sync failed:', e);
    }
  }

  private async mirrorNativeQueue() {
    if (!this.BackgroundGeolocation) return;
    const driverId = this.state.driverId;
    const adminCode = this.state.adminCode;
    if (!driverId || !adminCode) return;

    try {
      const native = await this.BackgroundGeolocation.getLocations();
      await clearLocationsBySource('native_mirror');

      if (Array.isArray(native) && native.length > 0) {
        await Promise.all(native.map((location: any) => {
          const lat = location.coords?.latitude;
          const lng = location.coords?.longitude;
          if (typeof lat !== 'number' || typeof lng !== 'number') return Promise.resolve();
          const timestamp = new Date(location.timestamp).toISOString();
          return addOfflineLocation({
            syncKey: `${driverId}:${timestamp}:${lat.toFixed(6)}:${lng.toFixed(6)}`,
            driverId,
            adminCode,
            source: 'native_mirror',
            latitude: lat,
            longitude: lng,
            speed: location.coords?.speed != null ? location.coords.speed * 3.6 : 0,
            accuracy: location.coords?.accuracy ?? 0,
            batteryLevel: location.battery?.level != null ? Math.round(location.battery.level * 100) : 100,
            timestamp,
            createdAt: new Date(location.timestamp).getTime() || Date.now(),
          });
        }));
      }
      this.refreshOfflineCount();
    } catch (e) {
      console.warn('[TrackingService] mirror failed:', e);
    }
  }

  private startNativeCountPoll() {
    if (this.nativeCountTimer) return;
    this.nativeCountTimer = setInterval(() => this.pollNativeCount(), NATIVE_COUNT_POLL_MS);
  }

  private stopNativeCountPoll() {
    if (this.nativeCountTimer) {
      clearInterval(this.nativeCountTimer);
      this.nativeCountTimer = null;
    }
  }

  private registerListener(candidate: any) {
    if (!candidate) return;
    if (typeof candidate.then === 'function') {
      Promise.resolve(candidate).then((resolved) => {
        if (resolved && typeof resolved.remove === 'function') {
          this.listenerSubscriptions.push(resolved);
        }
      }).catch(() => {});
      return;
    }
    if (typeof candidate.remove === 'function') {
      this.listenerSubscriptions.push(candidate);
    }
  }

  private removeListeners() {
    for (const sub of this.listenerSubscriptions) {
      try { sub.remove(); } catch { /* ignore */ }
    }
    this.listenerSubscriptions = [];
  }
}

// Singleton instance
export const trackingService = new TrackingService();

// Expose globally for debugging in Xcode console
if (typeof window !== 'undefined') {
  (window as any).__trackingService = trackingService;
}
