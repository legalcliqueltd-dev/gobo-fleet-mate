export type Device = {
  id: string;
  user_id: string;
  name: string | null;
  imei: string | null;
  status: 'active' | 'idle' | 'offline' | null;
  created_at: string;
};

export type Location = {
  id: number;
  device_id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  timestamp: string; // ISO string
};

export type MarkerData = {
  id: string; // device id
  latitude: number;
  longitude: number;
  label?: string | null;
  speed?: number | null;
  timestamp?: string;
  status?: 'active' | 'idle' | 'offline';
};
