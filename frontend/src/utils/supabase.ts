import { createClient, SupabaseClient } from '@supabase/supabase-js';

const defaultUrl = import.meta.env.VITE_SUPABASE_URL || '';
const defaultKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export let supabase: SupabaseClient = (defaultUrl && defaultKey)
  ? createClient(defaultUrl, defaultKey)
  : null as any;

export let ALLOWED_EMAILS: string[] = (import.meta.env.VITE_ALLOWED_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

export let ALLOWED_DOMAINS: string[] = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS || '')
  .split(',')
  .map((d: string) => d.trim().toLowerCase())
  .filter(Boolean);

export function initSupabase(url: string, key: string, emails?: string, domains?: string) {
  if (url && key) {
    try {
      supabase = createClient(url, key);
    } catch (err) {
      console.error('Failed to initialize Supabase client dynamically:', err);
    }
  }
  if (emails !== undefined) {
    ALLOWED_EMAILS = emails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  }
  if (domains !== undefined) {
    ALLOWED_DOMAINS = domains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
  }
}
