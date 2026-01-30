-- Add otp_salt column to tasks table for secure OTP hashing
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS otp_salt TEXT;