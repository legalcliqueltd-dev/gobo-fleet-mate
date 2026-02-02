-- Add trial and subscription fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
ADD COLUMN IF NOT EXISTS subscription_end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_provider TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.profiles.trial_started_at IS 'When the 7-day trial period started';
COMMENT ON COLUMN public.profiles.subscription_status IS 'trial, active, expired';
COMMENT ON COLUMN public.profiles.subscription_plan IS 'basic or pro';
COMMENT ON COLUMN public.profiles.subscription_end_at IS 'When the subscription ends';
COMMENT ON COLUMN public.profiles.payment_provider IS 'stripe or paystack';