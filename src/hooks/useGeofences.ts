import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type GeofenceType = 'circle' | 'polygon';

export type Geofence = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  geometry: any;
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  type: GeofenceType;
  active: boolean;
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

  const createGeofence = async (geofence: Omit<Geofence, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('geofences')
      .insert({
        ...geofence,
        created_by: userData.user.id,
      } as any)
      .select()
      .single();

    if (error) throw error;
    await fetchGeofences();
    return data;
  };

  const updateGeofence = async (id: string, updates: Partial<Geofence>) => {
    const { error } = await supabase
      .from('geofences')
      .update(updates)
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
