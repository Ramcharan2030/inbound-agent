export interface Config {
  first_line: string;
  agent_instructions: string;
  gemini_live_model: string;
  gemini_live_voice: string;
  gemini_live_temperature: number;
  gemini_live_language: string;
  gemini_live_preflight_enabled: boolean;
  gemini_live_preflight_timeout: number;
  gemini_live_connect_timeout: number;
  gemini_live_connect_retries: number;
  gemini_tts_model: string;
  lang_preset: string;
  max_turns: number;
  user_away_timeout: number;
  session_close_transcript_timeout: number;
  livekit_url: string;
  livekit_api_key: string;
  livekit_api_secret: string;
  sip_trunk_id: string;
  google_api_key: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  supabase_url: string;
  supabase_key: string;
  kb_enabled: boolean;
  kb_backend: string;
  kb_data_dir: string;
  kb_top_k: number;
  kb_similarity_threshold: number;
  kb_context_char_budget: number;
  kb_live_timeout_ms: number;
  kb_live_context_char_budget: number;
  kb_cache_ttl_seconds: number;
  kb_chunk_size: number;
  kb_chunk_overlap: number;
  kb_worker_poll_seconds: number;
  kb_embedding_provider: string;
  kb_embedding_model: string;
  kb_embedding_fallback_provider: string;
  kb_embedding_fallback_model: string;
  kb_index_kind: string;
  kb_rerank_enabled: boolean;
}

export interface CallLog {
  id: string;
  created_at: string;
  phone_number: string;
  caller_name: string;
  duration_seconds: number;
  summary: string;
  transcript: string;
  recording_url?: string;
  sentiment: string;
  was_booked: boolean;
  interrupt_count: number;
  estimated_cost_usd: number;
  cost_vobiz_inr?: number;
  cost_livekit_inr?: number;
  cost_gemini_inr?: number;
  cost_total_inr?: number;
  call_date: string;
  call_hour: number;
  call_day_of_week: string;
  call_room_id: string;
  latency_summary?: {
    turns: number;
    kb_used_turns: number;
    kb_ms: number;
    llm_first_token_ms: number;
    tts_first_audio_ms: number;
    tool_ms: number;
    total_turn_ms: number;
    slowest_turn?: {
      turn_index: number;
      total_turn_ms: number;
      kb_used: boolean;
      kb_skipped_reason: string | null;
    };
  };
}

export interface Stats {
  total_calls: number;
  total_bookings: number;
  avg_duration: number;
  booking_rate: number;
}

export interface Contact {
  phone_number: string;
  caller_name: string;
  total_calls: number;
  last_seen: string;
  is_booked: boolean;
  appointment_count: number;
}

export interface Appointment {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  contact_name: string;
  contact_phone: string;
  scheduled_start: string;
  scheduled_end: string;
  timezone: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  notes: string;
  source: string;
}

export interface KBStatus {
  status: string;
  kb_enabled: boolean;
  backend: string;
  runtime: string;
  embedding_provider: string;
  embedding_model: string;
  index_kind: string;
  data_dir: string;
  index_status: {
    vector_count: number;
    rebuilt_at: string;
  };
  vector_count: number;
  last_rebuild_at: string;
  counts: {
    sources: number;
    jobs: number;
    chunks: number;
  };
}

export interface KBSource {
  id: number;
  created_at: string;
  updated_at: string;
  source_type: 'web_url' | 'pdf_upload';
  title: string;
  source_url?: string | null;
  raw_text?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  checksum?: string | null;
  status: string;
  enabled: boolean;
  sync_error: string;
  last_synced_at: string;
  metadata: Record<string, any>;
}

export interface KBJob {
  id: number;
  created_at: string;
  updated_at: string;
  source_id: number;
  source_type: string;
  job_type: string;
  status: string;
  payload: any;
  last_result: any;
}

export interface KBSearchResult {
  status: string;
  result: {
    query: string;
    chunk_hits: {
      score: number;
      title: string;
      content: string;
      preview: string;
      source_type: string;
      source_url: string;
    }[];
  };
  grounding: {
    query: string;
    chunk_hits: any[];
    grounding_text: string;
  };
}

export interface ScheduleDay {
  id?: number;
  day_of_week: number;
  day_name: string;
  morning_start: string | null;
  morning_end: string | null;
  afternoon_start: string | null;
  afternoon_end: string | null;
  is_active: boolean;
}

export interface BlockedDay {
  id?: number;
  blocked_date: string; // YYYY-MM-DD
  reason: string;
  blocked_by: string;
  created_at?: string;
}

export interface AppointmentNotification {
  id: string | number;
  type: 'booking' | 'cancelled' | 'completed';
  contact_name: string;
  contact_phone: string;
  scheduled_start: string;
  scheduled_end: string;
  notes: string;
  source: string;
  created_at: string;
  updated_at: string;
}

