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
  removeLocationBySyncKey,
  clearLocationsBySource,
  getPendingBatch,
  removeSyncedLocations,
  getPendingCount,
} from '@/utils/offlineLocationStore';

/** TrackMate's own Android tracker (android/app/.../tracking). */
interface NativeTrackerPlugin {
  start(options: { driverId: string; adminCode: string; functionUrl: string; anonKey: string }): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<{
    active: boolean;
    running: boolean;
    queued: number;
    lastSentAt: number;
    lastFixAt: number;
    lastError: string | null;
  }>;
  addListener(
    event: 'location',
    handler: (fix: { latitude: number; longitude: number; accuracy: number; speed: number; heading: number | null; fixAt: number }) => void
  ): Promise<{ remove: () => void }>;
}
const NativeTracker = registerPlugin<NativeTrackerPlugin>('NativeTracker');

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
/** One point per this much GPS time. Measured on the FIX clock, not ours. */
const RECORD_INTERVAL_MS = 30_000;
/**
 * A fix older than this when it reaches us was buffered (Android froze the
 * WebView and released a backlog on wake). It goes to history through
 * sync-trail, which keeps its real time — the live endpoint stamps the
 * server's clock, which would file it under the moment of delivery.
 */
const LIVE_MAX_AGE_MS = 60_000;
/**
 * Parked, the watcher is silent by design (15 m distance filter), and a
 * silent stretch longer than the history's 12-minute gap threshold read as
 * "No signal". While tracking is healthy, re-record where he is this often
 * so a stop reads as a stop.
 */
const STATIONARY_KEEPALIVE_MS = 5 * 60_000;
/**
 * The server only files live fixes of 30 m or better in history; anything
 * looser was shown on the live map and then lost for good. Up to this, the
 * point is kept and delivered through sync-trail instead. Beyond it a fix
 * is a guess at the neighbourhood and would only scatter the trail.
 */
const HISTORY_MAX_ACCURACY_M = 100;

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
  /** Teardown for the event-driven drain triggers. */
  private drainTriggerCleanup: (() => void) | null = null;
  /**
   * syncKeys currently being delivered by the live path.
   *
   * A point is queued BEFORE its send is attempted, so between the write and
   * the success there is a window where the queue holds a point that is
   * already on its way. A drain firing in that window — and drains now fire on
   * `online`, resume and visibility, not just a timer — would post it a second
   * time and put two identical fixes in the history. Holding the key here
   * keeps the drain off it until its fate is known.
   */
  private inFlightKeys = new Set<string>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private nativeCountTimer: ReturnType<typeof setInterval> | null = null;
  private androidPollTimer: ReturnType<typeof setInterval> | null = null;
  private webWatchId: number | null = null;
  private nativeWatchId: string | null = null;
  /** GPS time of the last fix written to the record. */
  private lastRecordedFixAt = 0;
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

    if (detectNativePlatform() && isAndroid()) {
      try {
        await NativeTracker.stop();
      } catch (e) {
        console.warn('[TrackingService] native tracker stop failed:', e);
      }
      this.nativeFixSubscription?.remove();
      this.nativeFixSubscription = null;
      this.nativeTracking = false;
      this.stopNativeStatusPoll();
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
        title: 'TrackMate',
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
                'Location is set to "While Using the App". Tracking will stop when you leave TrackMate — set it to "Always" to stay on duty.',
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
    // RECORDING AND SENDING ARE NATIVE NOW. They used to run here, in JS,
    // fed by @capacitor-community/background-geolocation — and Android
    // freezes the WebView once the screen is off, so on a TECNO (HiOS) the
    // fixes sat in a queue until the driver next opened the app: nothing live
    // for the manager, and long dark stretches in history. TrackingService
    // (android/app/src/main/java/app/fleettrackmate/driver/tracking) owns
    // GPS, the queue and the upload inside the foreground service the OS
    // keeps alive. JS only starts it, and listens for fixes to draw the UI.
    const driverId = this.state.driverId;
    const adminCode = this.state.adminCode;
    if (!driverId || !adminCode) return;

    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        const asked = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (asked.location !== 'granted') {
          this.dispatchEvent(
            new CustomEvent('error', {
              detail: {
                code: 'NOT_AUTHORIZED',
                message:
                  'Location permission is off. Tracking cannot run until it is allowed all the time.',
              },
            })
          );
          return;
        }
      }
    } catch (e) {
      console.warn('[TrackingService] permission check failed:', e);
    }

    // A build that ran the old JS watcher may still have it registered.
    await this.removeLegacyAndroidWatcher();

    if (!this.nativeFixSubscription) {
      this.nativeFixSubscription = await NativeTracker.addListener('location', (fix) => {
        this.handleNativeFix(fix);
      });
    }

    await NativeTracker.start({
      driverId,
      adminCode,
      functionUrl: SUPABASE_FUNCTIONS_URL,
      anonKey: SUPABASE_ANON_KEY,
    });
    this.nativeTracking = true;
    this.startNativeStatusPoll();
    console.log('[TrackingService] native tracker started');
  }

  private nativeFixSubscription: { remove: () => void } | null = null;
  /** True once the native service owns recording and upload (Android). */
  private nativeTracking = false;
  private nativeStatusTimer: ReturnType<typeof setInterval> | null = null;

  /** UI only: the service has already recorded and sent this fix. */
  private handleNativeFix(fix: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number;
    heading: number | null;
    fixAt: number;
  }) {
    const loc: TrackingLocation = {
      latitude: fix.latitude,
      longitude: fix.longitude,
      speed: fix.speed ?? 0,
      accuracy: fix.accuracy ?? 0,
      heading: fix.heading ?? null,
      timestamp: new Date(fix.fixAt || Date.now()),
    };
    this.logDelivery(fix.fixAt || Date.now(), Date.now());
    this.setState({ lastLocation: loc });
    this.dispatchEvent(new CustomEvent('location', { detail: loc }));
  }

  /** The service's queue and last delivery, for the duty panel. */
  private startNativeStatusPoll() {
    if (this.nativeStatusTimer) return;
    const poll = async () => {
      try {
        const status = await NativeTracker.getStatus();
        this.setState({
          pendingOfflineCount: status.queued,
          ...(status.lastSentAt ? { lastSyncTime: new Date(status.lastSentAt) } : {}),
        });
        window.dispatchEvent(new CustomEvent('offline-queue-updated'));
      } catch {
        /* plugin missing on an old build — nothing to show */
      }
    };
    void poll();
    this.nativeStatusTimer = setInterval(poll, 10_000);
  }

  private stopNativeStatusPoll() {
    if (this.nativeStatusTimer) {
      clearInterval(this.nativeStatusTimer);
      this.nativeStatusTimer = null;
    }
  }

  private async removeLegacyAndroidWatcher() {
    if (!this.androidWatcherId || !this.androidWatcher) return;
    try {
      await this.androidWatcher.removeWatcher({ id: this.androidWatcherId });
    } catch {
      /* already gone */
    }
    this.androidWatcherId = null;
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

    // The fix's own time, when the platform gives one. THE BUG THIS FIXES:
    // every point used to be stamped `new Date()` — the moment JS received
    // it. Android freezes the WebView in the background and hands over a
    // backlog on wake, so a whole drive arrived as a burst and was filed at
    // the moment the phone was next unlocked, in the wrong place on the map.
    const now = Date.now();
    const fixTime = Number(coords.time ?? coords.timestamp);
    const fixAt =
      Number.isFinite(fixTime) && fixTime > now - 7 * 86_400_000 && fixTime < now + 60_000
        ? fixTime
        : now;

    this.logDelivery(fixAt, now);

    const loc: TrackingLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed: safeSpeed,
      accuracy: safeAccuracy,
      heading: safeHeading,
      timestamp: new Date(fixAt),
    };

    this.setState({ lastLocation: loc });
    this.dispatchEvent(new CustomEvent('location', { detail: loc }));

    // Record on a 30 s cadence, then try to send.
    //
    // THE BUG THIS FIXES: this used to `return` here when throttled, throwing
    // the position away, and the ONLY thing that ever wrote to the offline
    // queue was the catch block of a failed send. So the queue was fed purely
    // by network failures — at most one point per 30 s, and only if a fix
    // happened to arrive at the moment the throttle opened AND the request
    // then failed. With no signal, `functions.invoke` can hang for a long
    // while before it rejects, so a driver could be offline for an hour and
    // come back with two points. That is exactly what was reported.
    //
    // Now the queue is the system of record: every 30 s a point is written to
    // IndexedDB first and unconditionally, whatever the network is doing. The
    // send is an optimisation on top, and a successful one removes its own
    // point again so history never gets it twice.
    //
    // The cadence is measured on the FIX clock. Measured on ours, a backlog
    // delivered in one burst kept its first point and threw the rest away.
    if (fixAt - this.lastRecordedFixAt < RECORD_INTERVAL_MS && fixAt >= this.lastRecordedFixAt) return;
    this.lastRecordedFixAt = fixAt;

    void this.recordThenSend(loc);
  }

  /**
   * The last 60 fix deliveries — [fix time, received time] — kept on the
   * phone. When a driver reports a dark stretch, this tells us straight away
   * which kind it was: no fixes at all (GPS or service stopped), or fixes
   * that arrived late (JS frozen and released on wake). Read over the
   * WebView debugger; costs one small localStorage write per fix.
   */
  private deliveryLog: Array<[number, number]> = [];
  private logDelivery(fixAt: number, receivedAt: number) {
    this.deliveryLog.push([fixAt, receivedAt]);
    if (this.deliveryLog.length > 60) this.deliveryLog.shift();
    // Write at most every 10 s; the in-memory copy has the rest.
    if (receivedAt - this.lastDeliveryLogWrite < 10_000) return;
    this.lastDeliveryLogWrite = receivedAt;
    try {
      localStorage.setItem('ftm_fix_delivery_log', JSON.stringify(this.deliveryLog));
    } catch {
      /* storage full or blocked — diagnostics only */
    }
  }
  private lastDeliveryLogWrite = 0;

  /**
   * Queue the fix, then try to deliver it.
   *
   * Order matters: written before the attempt, a point survives a crash, a
   * kill, a hang, or a failure. Written after, it is lost in every one of
   * those cases — which is the whole reason offline tracking looked broken.
   */
  private async recordThenSend(loc: TrackingLocation) {
    const driverId = this.state.driverId;
    const adminCode = this.state.adminCode;
    if (!driverId || !adminCode) return;

    const timestamp = loc.timestamp.toISOString();
    const syncKey = `${driverId}:${timestamp}:${loc.latitude.toFixed(6)}:${loc.longitude.toFixed(6)}`;

    await addOfflineLocation({
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
    });
    this.refreshOfflineCount();

    // A buffered fix goes straight to sync-trail with its real time; only a
    // fresh one takes the live path (which also moves the marker on the
    // manager's map).
    if (Date.now() - loc.timestamp.getTime() > LIVE_MAX_AGE_MS) {
      await this.drainOfflineQueue();
      return;
    }

    this.inFlightKeys.add(syncKey);
    try {
      await this.sendLocationUpdate(loc, syncKey);
    } finally {
      this.inFlightKeys.delete(syncKey);
    }
  }

  private async sendLocationUpdate(loc: TrackingLocation, syncKey?: string) {
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
      // Retire our copy only if the live path actually filed it in history.
      // It answers `accurate: false` when it did not (worse than 30 m) —
      // and that point was then deleted here anyway, which is why a phone
      // indoors showed live on the map but left an empty history. Kept, it
      // goes out through sync-trail in the drain below. Hopelessly vague
      // fixes are still dropped rather than scattered across the trail.
      const filed = data?.accurate !== false;
      const tooVague = (loc.accuracy ?? 0) > HISTORY_MAX_ACCURACY_M;
      if (syncKey && (filed || tooVague)) await removeLocationBySyncKey(syncKey);
      await this.drainOfflineQueue();
    } catch (err) {
      // Nothing to persist here any more: recordThenSend queued this point
      // before the attempt, so a failure simply leaves it queued.
      console.warn('[TrackingService] send failed, point stays queued:', err);
      this.refreshOfflineCount();
    }
  }

  // ─── Offline queue ────────────────────────────────────────────
  /** One drain at a time. Overlapping drains posted the same batch twice
   *  or four times over — the duplicates the history was drawing. */
  private draining = false;

  private async drainOfflineQueue() {
    const driverId = this.state.driverId;
    const adminCode = this.state.adminCode;
    if (!driverId || !adminCode) return;
    if (this.draining) return;
    this.draining = true;

    try {
      const queued = await getPendingBatch(SYNC_BATCH_SIZE, {
        excludeSources: ['native_mirror'],
      });
      // Skip anything the live path is delivering right now; it will retire
      // its own copy on success, or leave it here on failure for the next run.
      const batch = queued.filter((l) => !l.syncKey || !this.inFlightKeys.has(l.syncKey));
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
    } finally {
      this.draining = false;
      // THE BUG THIS FIXES: the count used to be refreshed after the try
      // block, which the `batch.length === 0` early return skipped entirely.
      // So the normal online path — write a point, send it live, retire it by
      // syncKey, then drain and find nothing left — left the badge showing
      // "1 queued" forever on a driver who was perfectly online. The queue was
      // empty; only the number was stale. A finally runs on every path.
      this.refreshOfflineCount();
    }
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

    // THE BUG THIS FIXES: the interval above was the ONLY thing that drained
    // the queue, and Chromium freezes timers in a backgrounded WebView — which
    // is precisely the state a driver's phone is in while they drive. Signal
    // would come back, the timer would still be frozen, and nothing uploaded
    // until the driver happened to open the app again. To the manager the
    // driver simply stayed missing.
    //
    // These fire on the events that actually coincide with regained
    // connectivity, and they are delivered even when a timer would not be.
    const drain = () => {
      void sync();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') drain();
    };

    window.addEventListener('online', drain);
    document.addEventListener('visibilitychange', onVisible);

    let removeResume: (() => void) | null = null;
    if (detectNativePlatform()) {
      void import('@capacitor/app')
        .then(({ App }) => App.addListener('resume', drain))
        .then((handle) => {
          removeResume = () => void handle.remove();
        })
        .catch(() => {
          /* @capacitor/app absent on web — the web listeners above cover it */
        });
    }

    this.drainTriggerCleanup = () => {
      window.removeEventListener('online', drain);
      document.removeEventListener('visibilitychange', onVisible);
      removeResume?.();
    };
  }

  private stopSyncRetry() {
    if (this.syncRetryTimer) {
      clearInterval(this.syncRetryTimer);
      this.syncRetryTimer = null;
    }
    this.drainTriggerCleanup?.();
    this.drainTriggerCleanup = null;
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
        // A successful heartbeat proves the link is alive. Without this, a
        // PARKED driver — who by design sends no location fixes — was shown
        // "Connection stale", which is alarming and untrue.
        this.setState({ lastSyncTime: new Date() });

        // Parked: the watcher is silent, so put "still here" on the record.
        const last = this.state.lastLocation;
        // Not on Android: the native service records and sends there, and a
        // JS copy would put every parked minute into history twice.
        if (
          !this.nativeTracking &&
          last &&
          this.state.isTracking &&
          Date.now() - this.lastRecordedFixAt >= STATIONARY_KEEPALIVE_MS
        ) {
          const at = Date.now();
          this.lastRecordedFixAt = at;
          void this.recordThenSend({ ...last, speed: 0, timestamp: new Date(at) });
        }
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
