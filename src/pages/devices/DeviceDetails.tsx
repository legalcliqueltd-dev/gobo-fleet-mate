import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Map, { Layer, MapRef, NavigationControl, Source } from 'react-map-gl';
import DeviceMarker from '../../components/map/DeviceMarker';
import { Play, Pause, Pencil, Trash2, ChevronLeft } from 'lucide-react';
import { MAPBOX_TOKEN } from '../../lib/mapboxConfig';

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

  const mapRef = useRef<MapRef | null>(null);

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
  const path = useMemo(() => {
    if (points.length === 0) return null;
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: points.map((p) => [p.longitude, p.latitude]),
      },
      properties: {},
    };
  }, [points]);

  useEffect(() => {
    if (!mapRef.current || !current) return;
    mapRef.current.flyTo({ center: [current.longitude, current.latitude], zoom: 13, duration: 600 });
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <h2 className="text-2xl font-semibold">{device.name ?? 'Unnamed device'}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/devices/${device.id}/edit`} className="rounded-md border px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1">
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <button onClick={onDelete} className="rounded-md border px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 text-red-600">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-slate-500">IMEI:</span> {device.imei ?? '—'}</div>
          <div><span className="text-slate-500">Status:</span> {device.status ?? '—'}</div>
          <div><span className="text-slate-500">Created:</span> {new Date(device.created_at).toLocaleString()}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => setRange('24h')}
              className={`text-xs rounded-md border px-2 py-1 ${range === '24h' ? 'bg-cyan-600 text-white border-cyan-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              Last 24h
            </button>
            <button
              onClick={() => setRange('7d')}
              className={`text-xs rounded-md border px-2 py-1 ${range === '7d' ? 'bg-cyan-600 text-white border-cyan-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              Last 7d
            </button>
          </div>
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="rounded-md border px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
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

        <div className="relative h-[70vh] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={
              current
                ? { longitude: current.longitude, latitude: current.latitude, zoom: 12 }
                : { longitude: 0, latitude: 20, zoom: 1.5 }
            }
            mapStyle="mapbox://styles/mapbox/streets-v12"
            style={{ width: '100%', height: '100%' }}
          >
            <NavigationControl position="bottom-right" />

            {path && (
              <Source id="route" type="geojson" data={path}>
                <Layer
                  id="route-line"
                  type="line"
                  paint={{ 'line-color': '#06b6d4', 'line-width': 3 }}
                />
              </Source>
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
          </Map>
        </div>
      </div>
    </div>
  );
}
