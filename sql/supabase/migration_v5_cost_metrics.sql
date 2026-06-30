-- Add detailed cost tracking columns in INR to the call_logs table
ALTER TABLE call_logs 
  ADD COLUMN IF NOT EXISTS cost_vobiz_inr numeric,
  ADD COLUMN IF NOT EXISTS cost_livekit_inr numeric,
  ADD COLUMN IF NOT EXISTS cost_gemini_inr numeric,
  ADD COLUMN IF NOT EXISTS cost_total_inr numeric;
