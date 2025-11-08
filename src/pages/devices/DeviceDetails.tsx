import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { GoogleMap, Polyline, useJsApiLoader } from '@react-google-maps/api';
import DeviceMarker from '../../components/map/DeviceMarker';
import { Play, Pause, Pencil, Trash2, ChevronLeft, Gauge, Timer, Route as RouteIcon, AlertTriangle } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY } from '../../lib/googleMapsConfig';
import { useDeviceInsights } from '../../hooks/useDeviceInsights';

type DeviceRow = {
  id: string;
  name: string | null;
  imei: string | null;
  status: 'active' | 'idle' | 'offline' | null;
  created_at: string;
};

type Point = {
  id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  timestamp: string;
};

function fmtKm(n: number) {
  return `${(n || 0).toFixed(2)} km`;
}
function fmtSpeed(n: number) {
  return `${Math.round(n || 0)} km/h`;
}
function minutesSince(iso?: string | null) {
  if (!iso) return null;
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  return Math.max(0, Math.round(diff));
}

export default function DeviceDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [device, setDevice] = useState<DeviceRow | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [range, setRange] = useState<'24h' | '7d'>('24h');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);

  const { stats, loading: statsLoading, error: statsError } = useDeviceInsights(id, range);

  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const fetchDevice = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('devices')
      .select('id, name, imei, status, created_at')
      .eq('id', id)
      .single();
    if (error) setErr(error.message);
    else setDevice(data);
  };

  const fetchHistory = async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    const since = new Date();
    since.setDate(since.getDate() - (range === '24h' ? 1 : 7));
    const { data, error } = await supabase
      .from('locations')
      .select('id, latitude, longitude, speed, timestamp')
      .eq('device_id', id)
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: true });
    if (error) setErr(error.message);
    setPoints((data ?? []) as Point[]);
    setIdx(0);
    setLoading(false);
  };

  useEffect(() => { fetchDevice(); }, [id]);
  useEffect(() => { fetchHistory(); /* eslint-disable-next-line */ }, [id, range]);

  useEffect(() => {
    if (!playing) return;
    if (points.length < 2) return;
    const timer = setInterval(() => {
      setIdx((curr) => {
        const next = curr + 1;
        if (next >= points.length) return 0;
        return next;
      });
    }, 700);
    return () => clearInterval(timer);
  }, [playing, points.length]);

  const current = points[idx] ?? null;
  const lastUpdateIso = points.length ? points[points.length - 1].timestamp : null;
  const lastUpdateMin = minutesSince(lastUpdateIso);

  const path = useMemo(() => {
    if (points.length === 0) return [];
    return points.map((p) => ({ lat: p.latitude, lng: p.longitude }));
  }, [points]);

  useEffect(() => {
    if (!mapRef.current || !current) return;
    mapRef.current.panTo({ lat: current.latitude, lng: current.longitude });
    mapRef.current.setZoom(13);
  }, [idx, current]);

  const onDelete = async () => {
    if (!id) return;
    if (!confirm('Delete this device? This will remove all its locations.')) return;
    const { error } = await supabase.from('devices').delete().eq('id', id);
    if (error) {
      alert(error.message);
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  if (!device) {
    return loading ? <div>Loading…</div> : <div className="text-red-600">{err}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm hover:underline">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
          <h2 className="font-heading text-2xl font-semibold">{device.name ?? 'Unnamed device'}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/devices/${device.id}/edit`} className="rounded-lg border-2 border-slate-300 dark:border-slate-700 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 transition">
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <button onClick={onDelete} className="rounded-lg border-2 border-red-300 dark:border-red-700 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950 inline-flex items-center gap-1 text-red-600 transition">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <div className="nb-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-slate-500">IMEI:</span> <strong>{device.imei ?? '—'}</strong></div>
          <div><span className="text-slate-500">Status:</span> <strong>{device.status ?? '—'}</strong></div>
          <div><span className="text-slate-500">Created:</span> <strong>{new Date(device.created_at).toLocaleString()}</strong></div>
        </div>
      </div>

      {/* Insights panel */}
      <div className="nb-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold">Insights ({range})</h3>
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => setRange('24h')}
              className={`text-xs rounded-lg px-3 py-1.5 font-medium transition ${
                range === '24h' 
                  ? 'nb-button' 
                  : 'border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Last 24h
            </button>
            <button
              onClick={() => setRange('7d')}
              className={`text-xs rounded-lg px-3 py-1.5 font-medium transition ${
                range === '7d' 
                  ? 'nb-button' 
                  : 'border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Last 7d
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border-2 border-slate-300 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 text-muted-foreground"><RouteIcon className="h-4 w-4" /><span>Distance</span></div>
            <div className="mt-2 text-xl font-bold font-heading">{statsLoading ? '—' : fmtKm(stats?.distance_km ?? 0)}</div>
          </div>
          <div className="rounded-lg border-2 border-slate-300 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 text-muted-foreground"><Gauge className="h-4 w-4" /><span>Avg speed</span></div>
            <div className="mt-2 text-xl font-bold font-heading">{statsLoading ? '—' : fmtSpeed(stats?.avg_speed_kmh ?? 0)}</div>
          </div>
          <div className="rounded-lg border-2 border-slate-300 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 text-muted-foreground"><Gauge className="h-4 w-4" /><span>Max speed</span></div>
            <div className="mt-2 text-xl font-bold font-heading">{statsLoading ? '—' : fmtSpeed(stats?.max_speed_kmh ?? 0)}</div>
          </div>
          <div className="rounded-lg border-2 border-slate-300 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 text-muted-foreground"><Timer className="h-4 w-4" /><span>Idle time</span></div>
            <div className="mt-2 text-xl font-bold font-heading">{statsLoading ? '—' : `${stats?.idle_minutes ?? 0} min`}</div>
          </div>
        </div>
        {statsError && <div className="text-sm text-red-600 mt-2">{statsError}</div>}

        {lastUpdateMin !== null && lastUpdateMin > 10 && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border-2 border-amber-300 dark:border-amber-700 bg-amber-100/80 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 px-3 py-2 text-sm font-medium">
            <AlertTriangle className="h-5 w-5" />
            Inactivity alert: last update {lastUpdateMin} min ago. Device may be idle/offline.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-heading font-semibold">Location History</div>
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="rounded-lg border-2 border-slate-300 dark:border-slate-700 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 font-medium transition disabled:opacity-50"
              disabled={points.length < 2}
            >
              {playing ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Play</>}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(points.length - 1, 0)}
              value={idx}
              onChange={(e) => setIdx(parseInt(e.target.value))}
              className="w-32"
            />
          </div>
        </div>

        <div className="relative map-shell rounded-xl overflow-hidden border-2 border-slate-900 dark:border-white shadow-brutal">
          {!isLoaded ? (
            <div className="flex items-center justify-center h-full bg-white/60 dark:bg-slate-900/50">
              <p className="text-muted-foreground">Loading map...</p>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={
                current
                  ? { lat: current.latitude, lng: current.longitude }
                  : { lat: 20, lng: 0 }
              }
              zoom={current ? 12 : 2}
              onLoad={(map) => { mapRef.current = map; }}
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
              }}
            >
              {path.length > 0 && (
                <Polyline
                  path={path}
                  options={{
                    strokeColor: '#06b6d4',
                    strokeWeight: 3,
                    strokeOpacity: 0.8,
                  }}
                />
              )}

              {current && (
                <DeviceMarker
                  latitude={current.latitude}
                  longitude={current.longitude}
                  speed={current.speed ?? null}
                  name={device.name}
                  status={device.status}
                />
              )}
            </GoogleMap>
          )}
        </div>
      </div>
    </div>
  );
}
