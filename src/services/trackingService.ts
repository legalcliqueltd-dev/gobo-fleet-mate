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

import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
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
  private androidWatcher: any = null;
  private androidWatcherId: string | null = null;
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
   * Real battery readings via the Battery Status API (Android WebView + web).
   * Without this, batteryLevel stayed at its default 100 forever on Android —
   * the Transistorsoft payload that used to feed it is iOS-only. Event-driven,
   * so the level stays current for every location update and heartbeat.
   */
  private batteryMonitorStarted = false;
  private async initBatteryMonitor(): Promise<void> {
    if (this.batteryMonitorStarted) return;
    this.batteryMonitorStarted = true;
    try {
      const nav = navigator as any;
      if (typeof nav.getBattery !== 'function') {
        console.log('[TrackingService] Battery Status API unavailable (iOS uses native payload)');
        return;
      }
      const battery = await nav.getBattery();
      const update = () => {
        const level = Math.round((battery.level ?? 1) * 100);
        if (level !== this.state.batteryLevel) {
          this.setState({ batteryLevel: level });
        }
      };
      update();
      battery.addEventListener('levelchange', update);
      battery.addEventListener('chargingchange', update);
      console.log('[TrackingService] Battery monitor active:', Math.round((battery.level ?? 1) * 100) + '%');
    } catch (e) {
      console.warn('[TrackingService] Battery monitor failed:', e);
    }
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

    this.initBatteryMonitor();

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

    if (this.androidWatcherId && this.androidWatcher) {
      try {
        await this.androidWatcher.removeWatcher({ id: this.androidWatcherId });
      } catch (e) {
        console.warn('[TrackingService] removeWatcher failed:', e);
      }
      this.androidWatcherId = null;
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

    // The capawesome foreground service no longer runs on the Android path —
    // @capacitor-community/background-geolocation owns that notification now.
    // Still stopped here because a device upgrading from an older build can
    // have the old service running, and nothing else would ever shut it down.
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
      this.BackgroundGeolocation = mod.default;
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

    await BG.ready({
      desiredAccuracy: BG.DESIRED_ACCURACY_NAVIGATION,
      distanceFilter: 3,
      stationaryRadius: 5,
      disableMotionActivityUpdates: true,
      stopOnTerminate: false,
      startOnBoot: true,
      stopTimeout: 3,
      activityRecognitionInterval: 5000,
      debug: false,
      logLevel: BG.LOG_LEVEL_WARNING,
      preventSuspend: true,
      pausesLocationUpdatesAutomatically: false,
      locationAuthorizationRequest: 'Always',
      showsBackgroundLocationIndicator: true,
      locationUpdateInterval: 10000,
      fastestLocationUpdateInterval: 5000,
      heartbeatInterval: 30,
      enableHeadless: true,
      url: SUPABASE_FUNCTIONS_URL,
      method: 'POST',
      autoSync: true,
      autoSyncThreshold: 5,
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
      notification: {
        title: 'FleetTrackMate',
        text: 'Tracking your location for your fleet manager',
      },
    });

    // If already configured and IDs changed, push update.
    await BG.setConfig({
      params: { action: 'update-location', driverId, adminCode, isBackground: true },
    }).catch(() => {});

    this.removeListeners();

    this.registerListener(BG.onLocation((loc: any) => this.onIOSLocation(loc), (err: any) => {
      console.warn('[TrackingService] iOS location error:', err);
    }));

    this.registerListener(BG.onHttp(async (response: any) => {
      if (response.success) {
        this.setState({ lastSyncTime: new Date() });
        await this.mirrorNativeQueue();
        await this.drainOfflineQueue();
      }
      await this.pollNativeCount();
    }));

    if (typeof BG.onConnectivityChange === 'function') {
      this.registerListener(BG.onConnectivityChange(async (event: any) => {
        if (event?.connected) {
          await this.forceNativeSync();
        }
      }));
    }

    await BG.start();

    // Verify what iOS ACTUALLY granted.
    //
    // locationAuthorizationRequest: 'Always' above is a request, not an
    // outcome. iOS offers "While Using" first and defers "Always" to a second
    // prompt it may show much later — so a driver who taps "While Using" gets
    // a plugin that starts cleanly, reports no error, and then stops
    // delivering the moment they leave the app. Nothing here noticed, which is
    // why iOS showed the same symptom as Android for a completely different
    // reason.
    //
    // Status 3 is AUTHORIZATION_STATUS_ALWAYS; 4 is WHEN_IN_USE.
    try {
      const providerState = await BG.getProviderState();
      const status = providerState?.status;
      if (status != null && status !== BG.AUTHORIZATION_STATUS_ALWAYS) {
        console.warn('[TrackingService] iOS granted', status, '— not Always');
        this.dispatchEvent(
          new CustomEvent('error', {
            detail: {
              code: 'NEEDS_ALWAYS_PERMISSION',
              message:
                'Location is set to "While Using the App". Tracking will stop when you leave FleetTrackMate — set it to "Always" to stay on duty.',
            },
          })
        );
      }
    } catch (e) {
      console.warn('[TrackingService] could not read provider state:', e);
    }

    this.startNativeCountPoll();
    await this.mirrorNativeQueue();
    await this.pollNativeCount();

    // If the app opens while already online, Transistorsoft may keep older
    // SQLite records queued until a later motion/connectivity event. Force a
    // flush on startup so "connected" immediately means "syncing".
    await this.forceNativeSync();
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
    // Capacitor's Geolocation.watchPosition used to drive this, and it is the
    // reason tracking "stopped when you left the app": that watcher delivers
    // into the WebView, and Android freezes WebView JS under Doze within
    // minutes of backgrounding. The setInterval backup died the same way. The
    // result was a fix at start, nothing during the journey, and another fix
    // when the app was reopened — two points, joined by a straight line.
    //
    // @capacitor-community/background-geolocation runs a real foreground
    // service instead, so the OS keeps delivering while the app is away. The
    // notification is not decoration: on Android it is what BUYS the
    // background permission, and it is also the honest disclosure that a
    // driver is being tracked.
    // This package ships no JS entry point — only native code and types — so
    // it is bound through Capacitor's registry rather than imported.
    const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
      'BackgroundGeolocation'
    );
    this.androidWatcher = BackgroundGeolocation;

    try {
      this.androidWatcherId = await BackgroundGeolocation.addWatcher(
        {
          // Defining backgroundMessage is what enables background delivery.
          // Without it the plugin only guarantees foreground updates.
          backgroundMessage: 'Sharing your location with your fleet manager.',
          backgroundTitle: 'FleetTrackMate — on duty',
          requestPermissions: true,
          // Never accept a cached fix: a stale point plotted as current is
          // worse than a gap, because it reads as the driver being somewhere
          // they are not.
          stale: false,
          // Every 15 m. Tight enough that the drawn line follows the road
          // rather than cutting corners, loose enough not to log a point per
          // second while stationary at a junction.
          distanceFilter: 15,
        },
        (position, error) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') {
              // Permission refused or location services off. The driver has to
              // fix this in Settings; nothing we retry here will help.
              this.dispatchEvent(
                new CustomEvent('error', {
                  detail: {
                    code: 'NOT_AUTHORIZED',
                    message:
                      'Location permission is off. Tracking cannot run until it is allowed all the time.',
                  },
                })
              );
            }
            console.warn('[TrackingService] background watcher error:', error);
            return;
          }
          if (!position) return;

          this.handlePosition({
            latitude: position.latitude,
            longitude: position.longitude,
            accuracy: position.accuracy,
            altitude: position.altitude,
            altitudeAccuracy: position.altitudeAccuracy,
            heading: position.bearing,
            speed: position.speed,
          });
        }
      );
      console.log('[TrackingService] background watcher active:', this.androidWatcherId);
    } catch (e) {
      console.error('[TrackingService] addWatcher failed:', e);
      throw e;
    }
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
      await this.drainOfflineQueue();
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
    if (this.syncRetryTimer) return;

    const sync = async () => {
      if (this.BackgroundGeolocation) {
        await this.forceNativeSync();
      } else {
        await this.drainOfflineQueue();
      }
    };

    sync();
    this.syncRetryTimer = setInterval(sync, SYNC_RETRY_INTERVAL_MS);
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
