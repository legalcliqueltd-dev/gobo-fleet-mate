import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type GeofenceType = 'circle' | 'polygon';

export type Geofence = {
  id: string;
  created_by: string;
  name: string;
  description: string | null;
  coordinates: any;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number | null;
  type: GeofenceType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function useGeofences() {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGeofences = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('geofences')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setGeofences((data || []) as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGeofences();
  }, []);

  const createGeofence = async (geofence: Omit<Geofence, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('geofences')
      .insert({
        name: geofence.name,
        description: geofence.description,
        type: geofence.type,
        center_lat: geofence.center_lat,
        center_lng: geofence.center_lng,
        radius_m: geofence.radius_m,
        coordinates: geofence.coordinates,
        is_active: geofence.is_active,
        created_by: userData.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    await fetchGeofences();
    return data;
  };

  const updateGeofence = async (id: string, updates: Partial<Geofence>) => {
    const { error } = await supabase
      .from('geofences')
      .update(updates as any)
      .eq('id', id);

    if (error) throw error;
    await fetchGeofences();
  };

  const deleteGeofence = async (id: string) => {
    const { error } = await supabase
      .from('geofences')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchGeofences();
  };

  return {
    geofences,
    loading,
    error,
    createGeofence,
    updateGeofence,
    deleteGeofence,
    refetch: fetchGeofences,
  };
}
