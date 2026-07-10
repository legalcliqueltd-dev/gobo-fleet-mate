import { useState, useEffect, useRef, useCallback } from 'react';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { trackingService } from '@/services/trackingService';
import { useTrackingService } from '@/hooks/useTrackingService';
import { MapContainer, Polyline } from 'react-leaflet';
import type { Map as LeafletMapType } from 'leaflet';
import { AppTileLayer, DriverMarker, TaskMarker, FollowController, AccuracyCircle, MapAttribution, DEFAULT_CENTER } from '@/components/map/leaflet/LeafletMap';
import { Crosshair, Wifi, Signal, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { getRouteStrokeColor } from '@/lib/mapStyles';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import DriverStatusCard from '@/components/driver/DriverStatusCard';
import DebugStatusPanel from '@/components/driver/DebugStatusPanel';
import LocationBlocker from '@/components/driver/LocationBlocker';
import DriverOnboarding, { isOnboardingCompleted } from '@/components/driver/DriverOnboarding';
import ActiveTaskCard from '@/components/driver/ActiveTaskCard';
import TaskNavigationMap from '@/components/map/TaskNavigationMap';

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

const TRAIL_STORAGE_KEY = 'driver_location_trail';
const MAX_TRAIL_AGE_MS = 24 * 60 * 60 * 1000;

export default function DriverAppDashboard() {
  const { session } = useDriverSession();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const mapRef = useRef<LeafletMapType | null>(null);
  const hasInitialCentered = useRef(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [navigatingTask, setNavigatingTask] = useState<Task | null>(null);
  const [followMode, setFollowMode] = useState(true);
  const [showTutorial, setShowTutorial] = useState(() => !isOnboardingCompleted());

  const isNativeIOS = detectNativePlatform() && isIOS();
  const isNativeAndroid = detectNativePlatform() && isAndroid();

  const [onDuty] = useState(() => {
    const stored = localStorage.getItem('driverOnDuty');
    return stored === null ? true : stored === 'true';
  });

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
        const validTrail = parsed.filter(p => now - p.timestamp < MAX_TRAIL_AGE_MS);
        setTrail(validTrail);
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

    if (onDuty && loc.accuracy !== null && loc.accuracy < 100) {
      setTrail(prev => {
        const now = Date.now();
        const lastPoint = prev[prev.length - 1];
        if (lastPoint && now - lastPoint.timestamp < 10000) return prev;
        const newTrail = [
          ...prev.filter(p => now - p.timestamp < MAX_TRAIL_AGE_MS),
          { lat: loc.latitude, lng: loc.longitude, timestamp: now, speed: loc.speed }
        ];
        return newTrail.length > 500 ? newTrail.slice(-500) : newTrail;
      });
    }

    if (!hasInitialCentered.current && mapRef.current) {
      mapRef.current.setView({ lat: loc.latitude, lng: loc.longitude }, 16);
      hasInitialCentered.current = true;
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

  const centerOnLocation = useCallback(() => {
    if (mapRef.current && currentLocation) {
      mapRef.current.panTo(currentLocation);
      mapRef.current.setZoom(16);
      setFollowMode(true);
    }
  }, [currentLocation]);

  const toggleMapType = useCallback(() => {
    setMapType(prev => prev === 'roadmap' ? 'satellite' : 'roadmap');
  }, []);

  const trailPath = trail.map(p => ({ lat: p.lat, lng: p.lng }));

  // Auto-zoom to show driver + active task dropoff
  const activeTask = tasks.find(t => t.status === 'en_route') || tasks[0] || null;

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

      <div className="relative h-full w-full flex flex-col min-h-0">
        <div className="flex-1 relative min-h-0">
          <MapContainer
            ref={mapRef}
            center={currentLocation ? [currentLocation.lat, currentLocation.lng] : DEFAULT_CENTER}
            zoom={16}
            zoomControl={false}
            attributionControl={false}
            style={{ width: '100%', height: '100%' }}
          >
            <MapAttribution />
            <AppTileLayer isDark={isDark} mapType={mapType} />

            <FollowController
              center={currentLocation}
              follow={followMode}
              onUserDrag={() => setFollowMode(false)}
            />

            {/* Trail polyline — vivid so the journey reads at a glance */}
            {trailPath.length > 1 && (
              <Polyline
                positions={trailPath.map(p => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: getRouteStrokeColor(isDark), opacity: 0.9, weight: 6 }}
              />
            )}

            {/* GPS accuracy ring + driver marker */}
            {currentLocation && (
              <>
                <AccuracyCircle position={currentLocation} accuracy={accuracy} isTracking={isTracking} />
                <DriverMarker position={currentLocation} isTracking={isTracking} heading={heading} />
              </>
            )}

            {/* Task dropoff markers */}
            {tasks.map((task) =>
              task.dropoff_lat && task.dropoff_lng ? (
                <TaskMarker
                  key={task.id}
                  position={{ lat: task.dropoff_lat, lng: task.dropoff_lng }}
                  onClick={() => setNavigatingTask(task)}
                />
              ) : null
            )}
          </MapContainer>

          {/* Top bar: tracking status + GPS quality */}
          <div className="absolute top-3 left-3 right-3 z-[1000] pointer-events-auto flex items-center justify-between gap-2">
            <div className={cn(
              'flex h-10 items-center gap-2 rounded-full border px-3.5 shadow-lg backdrop-blur-md',
              isTracking
                ? 'border-success/40 bg-success/90 text-success-foreground'
                : 'border-border bg-background/90 text-muted-foreground'
            )}>
              {isTracking ? <Wifi className="h-4 w-4 animate-pulse" /> : <Signal className="h-4 w-4" />}
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em]">
                {isTracking ? 'Live' : 'Off'}
              </span>
              {speed !== null && speed > 0 && (
                <span className="telemetry ml-0.5 text-sm font-semibold">{Math.round(speed)} km/h</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {pendingOfflineCount > 0 && (
                <div className="flex h-10 items-center rounded-full bg-warning/95 px-3.5 shadow-lg backdrop-blur-md">
                  <span className="telemetry text-xs font-semibold text-warning-foreground">
                    {pendingOfflineCount} queued
                  </span>
                </div>
              )}
              <div className="flex h-10 items-center gap-1.5 rounded-full border border-border bg-background/90 px-3.5 shadow-lg backdrop-blur-md">
                <Signal className={cn('h-3.5 w-3.5', signalQuality.color)} />
                <span className={cn('text-xs font-semibold', signalQuality.color)}>
                  {signalQuality.label}
                </span>
                {accuracy !== null && (
                  <span className="telemetry text-xs text-muted-foreground">±{Math.round(accuracy)}m</span>
                )}
              </div>
            </div>
          </div>


          {/* Map controls - right side. Bottom offset adapts so the buttons
              always sit ABOVE the bottom card stack — ActiveTaskCard is ~180px
              tall, plain DriverStatusCard is ~80px. */}
          <div
            className={cn(
              'absolute right-3 z-[1000] flex flex-col items-end gap-2 pointer-events-auto transition-[bottom] duration-200',
              activeTask ? (taskCardCollapsed ? 'bottom-24' : 'bottom-56') : 'bottom-36'
            )}
          >
            {followMode ? (
              <Button
                size="icon"
                variant="secondary"
                onClick={centerOnLocation}
                className="h-12 w-12 rounded-full border border-border shadow-lg ring-2 ring-primary"
                aria-label="Following your location"
              >
                <Crosshair className="h-5 w-5 text-primary" />
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={centerOnLocation}
                className="h-12 rounded-full border border-border px-4 shadow-lg"
                aria-label="Re-center map on you"
              >
                <Crosshair className="h-5 w-5 text-primary" />
                Re-center
              </Button>
            )}
            <Button
              size="icon"
              variant="secondary"
              onClick={toggleMapType}
              className="h-12 w-12 rounded-full border border-border shadow-lg"
              aria-label={mapType === 'roadmap' ? 'Switch to satellite view' : 'Switch to road view'}
            >
              <Layers className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Bottom card area */}
        <div className="absolute bottom-0 left-0 right-0 z-[1000] p-3 pointer-events-auto">
          {import.meta.env.DEV && (
            <DebugStatusPanel
              isTracking={isTracking}
              lastUpdate={lastUpdate}
              pendingOfflineCount={pendingOfflineCount}
            />
          )}
          {activeTask ? (
            <ActiveTaskCard
              task={activeTask}
              driverLocation={currentLocation}
              onNavigate={() => setNavigatingTask(activeTask)}
              collapsed={taskCardCollapsed}
              onToggleCollapse={() => setTaskCardCollapsed(prev => !prev)}
            />
          ) : (
            <DriverStatusCard
              isTracking={isTracking}
              batteryLevel={batteryLevel}
              lastSyncTime={lastUpdate}
              speed={speed}
              accuracy={accuracy}
            />
          )}
        </div>
      </div>
    </DriverAppLayout>
  );
}
