-- Add a flag to devices to mark temporary devices
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false;

-- Table to manage temporary tracking sessions
CREATE TABLE IF NOT EXISTS public.temp_track_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  label TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT CHECK (status IN ('active','expired','revoked','claimed')) DEFAULT 'active',
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  guest_nickname TEXT,
  claimed_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tts_owner_idx ON public.temp_track_sessions(owner_user_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS tts_token_idx ON public.temp_track_sessions(token);

ALTER TABLE public.temp_track_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: owners can see their sessions; nobody else can read
CREATE POLICY "tts_owner_read" ON public.temp_track_sessions
FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY "tts_owner_manage" ON public.temp_track_sessions
FOR UPDATE USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "tts_owner_insert" ON public.temp_track_sessions
FOR INSERT WITH CHECK (owner_user_id = auth.uid());