-- Notifications schema and device status change tracking

-- 1) Per-user notification tokens (web/android/ios)
CREATE TABLE IF NOT EXISTS public.notification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('web','android','ios')),
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
);

ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tokens_select_own" ON public.notification_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "tokens_insert_own" ON public.notification_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tokens_update_own" ON public.notification_tokens
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tokens_delete_own" ON public.notification_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- 2) Devices: track status changes + dedupe notifications
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_notified_offline_at timestamptz;

-- Trigger: set updated_at always; status_changed_at when status changes
CREATE OR REPLACE FUNCTION public.ftm_devices_status_change_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  IF TG_OP = 'INSERT' THEN
    NEW.status_changed_at = now();
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ftm_devices_status_change ON public.devices;
CREATE TRIGGER trg_ftm_devices_status_change
  BEFORE INSERT OR UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.ftm_devices_status_change_trg();