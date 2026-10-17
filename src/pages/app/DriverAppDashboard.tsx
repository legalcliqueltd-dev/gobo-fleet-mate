import { useState, useEffect, useRef, useCallback } from 'react';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { trackingService } from '@/services/trackingService';
import { useTrackingService, useTrackingWarning } from '@/hooks/useTrackingService';
import { MapPin, AlertTriangle, Check, ChevronRight, Package, Navigation, ChevronDown, ChevronUp } from 'lucide-react';
import DriverGoogleMap from '@/components/map/google/DriverGoogleMap';
import { useTheme } from '@/contexts/ThemeContext';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import LocationBlocker from '@/components/driver/LocationBlocker';
import DriverOnboarding, { isOnboardingCompleted } from '@/components/driver/DriverOnboarding';
import PermissionsCarousel, { permissionsSetupDone } from '@/components/driver/PermissionsCarousel';
import { useStationWatcher } from '@/hooks/useStationWatcher';
import TaskNavigationMap from '@/components/map/TaskNavigationMap';
import DutyPanel from '@/components/driver/DutyPanel';

import { cn } from '@/lib/utils';
import { detectNativePlatform, isIOS, isAndroid } from '@/utils/platformDetection';

type Task = {
  id: string;
  title: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: string;
  due_at?: string | null;
};

type TrailPoint = {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number | null;
};

/** Metres between two points (haversine) — used to reject GPS jitter. */
function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

const TRAIL_STORAGE_KEY = 'driver_location_trail';
const MAX_TRAIL_AGE_MS = 24 * 60 * 60 * 1000;
/** How much of the trail the live map draws — enough to see the last turn. */
const LIVE_TRAIL_WINDOW_MS = 20 * 60 * 1000;
/** Hard cap, so a dense stretch of fixes cannot rebuild the spaghetti. */
const LIVE_TRAIL_MAX_POINTS = 120;

export default function DriverAppDashboard() {
  const { session } = useDriverSession();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  // Collapsed by default: the map is reassurance, not the job.
  const [mapOpen, setMapOpen] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [navigatingTask, setNavigatingTask] = useState<Task | null>(null);
  const [showTutorial, setShowTutorial] = useState(() => !isOnboardingCompleted());
  // Permissions come AFTER the tour: asking for background location before
  // explaining what the app does is how you get a refusal.
  const [showPermissions, setShowPermissions] = useState(() => !permissionsSetupDone());

  const isNativeIOS = detectNativePlatform() && isIOS();
  const isNativeAndroid = detectNativePlatform() && isAndroid();

  const [onDuty, setOnDuty] = useState(() => {
    const stored = localStorage.getItem('driverOnDuty');
    return stored === null ? true : stored === 'true';
  });

  // Duty is switchable from here now. It used to be readable here and
  // switchable only in Settings, which meant the one control a driver needs
  // at the end of a shift was two screens away from the one he was looking at.
  const goOnDuty = useCallback(() => {
    setOnDuty(true);
    if (session?.driverId && session?.adminCode) {
      trackingService.start(session.driverId, session.adminCode).catch((err) => {
        console.error('[Dashboard] start failed:', err);
      });
    }
  }, [session?.driverId, session?.adminCode]);

  const goOffDuty = useCallback(() => {
    setOnDuty(false);
    trackingService.stop().catch((err) => {
      console.error('[Dashboard] stop failed:', err);
    });
  }, []);

  // Task card starts expanded so a new assignment is unmissable, but the
  // driver can shrink it to a pill so it never blocks the map.
  const [taskCardCollapsed, setTaskCardCollapsed] = useState(false);

  useEffect(() => {
    localStorage.setItem('driverOnDuty', String(onDuty));
  }, [onDuty]);

  // Load trail from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TRAIL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as TrailPoint[];
        const now = Date.now();
        const fresh = parsed.filter(p => now - p.timestamp < MAX_TRAIL_AGE_MS);

        // Re-apply the movement filter to points saved by earlier builds,
        // otherwise yesterday's jitter starburst stays drawn for a day.
        const cleaned: TrailPoint[] = [];
        for (const point of fresh) {
          const last = cleaned[cleaned.length - 1];
          if (!last || metresBetween(last, point) >= 20) cleaned.push(point);
        }
        setTrail(cleaned);
      } catch (e) {
        console.error('Failed to parse stored trail:', e);
      }
    }
  }, []);

  // Save trail to localStorage when it changes
  useEffect(() => {
    if (trail.length > 0) {
      localStorage.setItem(TRAIL_STORAGE_KEY, JSON.stringify(trail));
    }
  }, [trail]);

  // ─── Persistent tracking via singleton service ─────────────
  // The service lives outside React's lifecycle. Calling start() is
  // idempotent — it will not restart an already-running tracker.
  // We never call stop() here; only the user's "Off Duty" toggle does.
  const trackingState = useTrackingService();
  const trackingWarning = useTrackingWarning();
  const isTracking = trackingState.isTracking;
  const batteryLevel = trackingState.batteryLevel;
  const lastUpdate = trackingState.lastSyncTime;
  const pendingOfflineCount = trackingState.pendingOfflineCount;

  useEffect(() => {
    if (!session?.driverId || !session?.adminCode) return;
    if (!onDuty || !locationPermissionGranted) return;
    trackingService.start(session.driverId, session.adminCode).catch((err) => {
      console.error('[Dashboard] trackingService.start failed:', err);
    });
  }, [session?.driverId, session?.adminCode, onDuty, locationPermissionGranted]);

  // Reflect singleton's last location into local map state
  useEffect(() => {
    const loc = trackingState.lastLocation;
    if (!loc) return;
    setCurrentLocation({ lat: loc.latitude, lng: loc.longitude });
    if (loc.speed !== null) setSpeed(loc.speed);
    if (loc.heading !== null) setHeading(loc.heading);
    if (loc.accuracy !== null) setAccuracy(loc.accuracy);
    setLastSyncTime(trackingState.lastSyncTime);

    // Only extend the trail when the driver has genuinely MOVED.
    //
    // A parked phone still reports a new position every few seconds, scattered
    // randomly inside its accuracy radius. Joining those with a line drew a
    // starburst of rubbish over the map — the vehicle appeared to tear around
    // a 40 m circle while sitting in a car park. The same jitter is already
    // filtered server-side for distance stats; the drawn trail needs it too.
    //
    // The gate is the accuracy radius itself, floored at 20 m: a fix can only
    // prove movement if it moved further than its own margin of error.
    if (onDuty && loc.accuracy !== null && loc.accuracy < 60) {
      setTrail(prev => {
        const now = Date.now();
        const lastPoint = prev[prev.length - 1];
        if (lastPoint && now - lastPoint.timestamp < 10000) return prev;

        if (lastPoint) {
          const moved = metresBetween(
            { lat: lastPoint.lat, lng: lastPoint.lng },
            { lat: loc.latitude, lng: loc.longitude }
          );
          const threshold = Math.max(20, loc.accuracy ?? 20);
          if (moved < threshold) return prev;
        }

        const newTrail = [
          ...prev.filter(p => now - p.timestamp < MAX_TRAIL_AGE_MS),
          { lat: loc.latitude, lng: loc.longitude, timestamp: now, speed: loc.speed }
        ];
        return newTrail.length > 500 ? newTrail.slice(-500) : newTrail;
      });
    }

  }, [trackingState.lastLocation, trackingState.lastSyncTime, onDuty]);

  // NOTE: All location watching is handled by trackingService (singleton).
  // The earlier React-scoped watch effects were removed because they
  // stopped tracking on component unmount, defeating persistence.

  // Load tasks
  const loadTasks = useCallback(async () => {
    if (!session?.driverId || !session?.adminCode) return;
    try {
      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'get-tasks',
          driverId: session.driverId,
          adminCode: session.adminCode,
          statuses: ['assigned', 'en_route'],
        },
      });
      if (error) throw error;
      if (data?.tasks) setTasks(data.tasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }, [session?.driverId, session?.adminCode]);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 30000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadTasks(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadTasks]);

  // Heartbeat
  useEffect(() => {
    if (!session?.driverId) return;
    const sendHeartbeat = async () => {
      try {
        await supabase.functions.invoke('connect-driver', {
          body: { action: 'update-status', driverId: session.driverId, status: 'active', batteryLevel: batteryLevel ?? undefined },
        });
      } catch (e) {
        console.warn('Heartbeat failed:', e);
      }
    };
    const heartbeatInterval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(heartbeatInterval);
  }, [session?.driverId, batteryLevel]);

  // Trail sync
  useEffect(() => {
    if (!session?.driverId || !session?.adminCode) return;
    const syncTrail = async () => {
      const stored = localStorage.getItem(TRAIL_STORAGE_KEY);
      if (!stored) return;
      try {
        const trailPoints: TrailPoint[] = JSON.parse(stored);
        const lastSyncTs = parseInt(localStorage.getItem('trail_last_sync_ts') || '0', 10);
        const unsyncedPoints = trailPoints.filter(p => p.timestamp > lastSyncTs);
        if (unsyncedPoints.length === 0) return;
        const { data, error } = await supabase.functions.invoke('connect-driver', {
          body: { action: 'sync-trail', driverId: session.driverId, adminCode: session.adminCode, trailPoints: unsyncedPoints },
        });
        if (!error && data?.success) {
          localStorage.setItem('trail_last_sync_ts', String(Date.now()));
        }
      } catch (e) {
        console.warn('Trail sync failed:', e);
      }
    };
    syncTrail();
    const handleVisibilityTrail = () => { if (document.visibilityState === 'visible') syncTrail(); };
    const handleOnline = () => syncTrail();
    document.addEventListener('visibilitychange', handleVisibilityTrail);
    window.addEventListener('online', handleOnline);
    const syncInterval = setInterval(syncTrail, 5 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityTrail);
      window.removeEventListener('online', handleOnline);
      clearInterval(syncInterval);
    };
  }, [session?.driverId, session?.adminCode]);

  const taskPins = tasks
    .filter((t): t is Task & { dropoff_lat: number; dropoff_lng: number } =>
      t.dropoff_lat != null && t.dropoff_lng != null
    )
    .map((t) => ({ id: t.id, lat: t.dropoff_lat, lng: t.dropoff_lng }));

  // Auto-zoom to show driver + active task dropoff
  // Station attendance: watches position against the manager's marked points
  // and records an arrival once the dwell requirement is met.
  const {
    stations,
    visitFor,
    refresh: refreshStations,
    insideStation,
    dwellRemaining,
  } = useStationWatcher(currentLocation, speed, accuracy, session);

  const stationPinsRaw = stations.map((s) => {
    const visit = visitFor(s.id);
    return {
      id: s.id,
      lat: s.latitude,
      lng: s.longitude,
      name: s.name,
      color: s.color,
      kind: s.kind,
      radius: s.radius_m,
      done: visit?.status === 'completed' || (Boolean(visit) && !s.requires_photo),
    };
  });

  // Exactly one station gets a geofence ring: the one being attended, or
  // failing that the nearest one still outstanding. Twelve translucent discs
  // on a city map hide the city.
  const focusStationId = (() => {
    if (insideStation) return insideStation.id;
    if (!currentLocation) return null;
    const outstanding = stationPinsRaw.filter((p) => !p.done);
    if (outstanding.length === 0) return null;
    return outstanding.reduce((closest, pin) =>
      metresBetween(currentLocation, { lat: pin.lat, lng: pin.lng }) <
      metresBetween(currentLocation, { lat: closest.lat, lng: closest.lng })
        ? pin
        : closest
    ).id;
  })();

  const stationPins = stationPinsRaw.map((p) => ({ ...p, focus: p.id === focusStationId }));

  const activeTask = tasks.find(t => t.status === 'en_route') || tasks[0] || null;

  // Jobs and stations, merged and ordered by what is still owed. To a driver
  // these are the same object — somewhere he has to be — and keeping them in
  // two separate cards made him look in two places to answer one question.
  const todayStops = [
    ...tasks
      .filter((t) => t.status !== 'delivered' && t.status !== 'cancelled')
      .map((t) => ({
        key: `job-${t.id}`,
        title: t.title,
        note: 'Job' + (t.status === 'en_route' ? ' · on the way' : ''),
        done: false,
        Icon: Package,
        onOpen: () =>
          t.dropoff_lat && t.dropoff_lng
            ? setNavigatingTask(t)
            : navigate('/app/tasks'),
      })),
    ...stations.map((st) => {
      const visit = visitFor(st.id);
      const done = visit?.status === 'completed' || (Boolean(visit) && !st.requires_photo);
      return {
        key: `station-${st.id}`,
        title: st.name,
        note: done
          ? 'Station · done'
          : visit
            ? 'Station · receipt still needed'
            : 'Station · not yet',
        done,
        Icon: Navigation,
        onOpen: () => navigate('/app/stations'),
      };
    }),
  ].sort((a, b) => Number(a.done) - Number(b.done));

  const stopsLeft = todayStops.filter((s) => !s.done).length;

  // A newly assigned task always re-expands the card so it can't be missed.
  const activeTaskId = activeTask?.id ?? null;
  useEffect(() => {
    setTaskCardCollapsed(false);
  }, [activeTaskId]);

  const getSignalQuality = () => {
    if (accuracy === null) return { label: 'Unknown', color: 'text-muted-foreground', icon: '○' };
    if (accuracy <= 10) return { label: 'Excellent', color: 'text-success', icon: '●' };
    if (accuracy <= 30) return { label: 'Good', color: 'text-success', icon: '●' };
    if (accuracy <= 100) return { label: 'Fair', color: 'text-warning', icon: '◐' };
    return { label: 'Poor', color: 'text-destructive', icon: '○' };
  };

  const signalQuality = getSignalQuality();

  // First-run tutorial comes before the permission ask so drivers know
  // why location is needed before Android prompts them.
  if (!showTutorial && showPermissions) {
    return <PermissionsCarousel onDone={() => setShowPermissions(false)} />;
  }

  if (showTutorial) {
    return <DriverOnboarding onComplete={() => setShowTutorial(false)} />;
  }

  if (!locationPermissionGranted) {
    return <LocationBlocker onPermissionGranted={() => setLocationPermissionGranted(true)} />;
  }

  return (
    <DriverAppLayout>
      {/* Full-screen navigation overlay */}
      {navigatingTask && navigatingTask.dropoff_lat && navigatingTask.dropoff_lng && (
        <TaskNavigationMap
          dropoffLat={navigatingTask.dropoff_lat}
          dropoffLng={navigatingTask.dropoff_lng}
          taskTitle={navigatingTask.title}
          onClose={() => setNavigatingTask(null)}
        />
      )}

      {/* A permission problem stops tracking silently — the app still looks
          on duty while recording nothing. Say so, loudly, above the map. */}
      {trackingWarning && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-destructive">Tracking is not running</p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">
                {trackingWarning.message}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* HOME IS NOT A MAP.
          The map is gone from this screen on purpose. A driver opening the
          app at 7am is answering two questions — am I on duty, and what do I
          owe today — and a live map of a city he is standing in answers
          neither. It is the MANAGER who needs to see where he is. The map
          returns the moment he taps a stop, which is the only moment it
          tells him something he does not already know. */}
      <div className="space-y-4 px-4 py-5">

        {/* Duty. The one piece of state he must be able to read at a glance,
            because everything else in the product depends on it being on —
            and now the one he can interrogate and switch without leaving. */}
        <DutyPanel
          onDuty={onDuty}
          isTracking={isTracking}
          lastSyncAt={lastUpdate}
          batteryLevel={batteryLevel}
          pendingCount={pendingOfflineCount}
          accuracy={accuracy}
          onGoOnDuty={goOnDuty}
          onGoOffDuty={goOffDuty}
        />

        {/* Standing inside a station — the thing his receipt depends on. */}
        {insideStation && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-success px-4 py-3 text-success-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              You are at {insideStation.name}
              {dwellRemaining != null && dwellRemaining > 0 && (
                <span className="ml-1 font-normal opacity-90">
                  · receipt in {dwellRemaining}s
                </span>
              )}
            </span>
          </div>
        )}

        {/* WHERE I AM. Back by request, but as a strip he opens — not the
            screen he lands on. Collapsed it is a glance that says the dot is
            moving and the station is near; expanded it is a real map. */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setMapOpen((o) => !o)}
            aria-expanded={mapOpen}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {insideStation ? `At ${insideStation.name}` : 'Where I am'}
            </span>
            {mapOpen ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
          <div
            className={cn(
              'relative w-full transition-all duration-200',
              mapOpen ? 'h-[52vh]' : 'h-[140px]'
            )}
          >
            <DriverGoogleMap
              position={currentLocation}
              heading={heading}
              accuracy={accuracy}
              isTracking={isTracking}
              trail={[]}
              tasks={[]}
              stations={stationPins}
              mapType="roadmap"
              isDark={isDark}
              follow
              onUserDrag={() => {}}
              onTaskClick={() => {}}
            />
            {/* Collapsed, it is a picture, not a control. */}
            {!mapOpen && <div className="absolute inset-0" aria-hidden="true" />}
          </div>
        </section>

        {/* TODAY. Jobs and stations are one list, because to a driver they
            are one thing: somewhere he has to be. Splitting them into two
            cards made him check two places to answer one question. */}
        <section>
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="font-heading text-xl font-bold tracking-tight">Today</h2>
            {todayStops.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {stopsLeft === 0 ? 'All done' : `${stopsLeft} left`}
              </span>
            )}
          </div>

          {todayStops.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing assigned yet today.
            </p>
          ) : (
            <ul className="space-y-2">
              {todayStops.map((stop) => (
                <li key={stop.key}>
                  <button
                    type="button"
                    onClick={stop.onOpen}
                    className={cn(
                      'flex w-full items-center gap-3.5 rounded-2xl border border-border bg-card px-3.5 py-3.5 text-left transition-colors active:bg-muted',
                      stop.done && 'opacity-60'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                        stop.done ? 'bg-success text-success-foreground' : 'bg-accent text-accent-foreground'
                      )}
                    >
                      {stop.done ? <Check className="h-5 w-5" /> : <stop.Icon className="h-5 w-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-heading text-base font-semibold">
                        {stop.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {stop.note}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

    </DriverAppLayout>
  );
}
