import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { initSupabase } from './utils/supabase.ts';

async function bootstrap() {
  try {
    const response = await fetch('/api/auth/config');
    if (response.ok) {
      const data = await response.json();
      initSupabase(
        data.supabase_url,
        data.supabase_anon_key,
        data.allowed_emails,
        data.allowed_email_domains
      );
    } else {
      console.warn('Failed to fetch auth configuration from backend. Using default environment variables.');
    }
  } catch (err) {
    console.error('Error fetching auth configuration:', err);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

bootstrap();
