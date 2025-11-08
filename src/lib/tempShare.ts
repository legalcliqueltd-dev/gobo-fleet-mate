import { supabase } from '@/integrations/supabase/client';

function randomToken(len = 32) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: len }, () => 
    alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join('');
}

export async function createTempShareLink(
  ownerUserId: string, 
  hours = 3, 
  label?: string
) {
  const token = randomToken(40);
  const expires = new Date(Date.now() + hours * 3600_000).toISOString();
  
  const { data, error } = await supabase
    .from('temp_track_sessions')
    .insert([{ 
      owner_user_id: ownerUserId, 
      token, 
      expires_at: expires, 
      label 
    }])
    .select('id, token, expires_at')
    .single();
  
  if (error || !data) {
    throw new Error(error?.message || 'Failed to create temp link');
  }
  
  const url = `${window.location.origin}/share/${data.token}`;
  return { url, expires_at: data.expires_at };
}
