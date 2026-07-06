import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Parse environment configuration for allowed emails and domains
const ALLOWED_EMAILS = (import.meta.env.VITE_ALLOWED_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

const ALLOWED_DOMAINS = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS || '')
  .split(',')
  .map((d: string) => d.trim().toLowerCase())
  .filter(Boolean);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validate if a user's email is allowed
  const isEmailAllowed = (email: string | undefined): boolean => {
    if (!email) return false;
    const emailLower = email.toLowerCase();
    
    // If no whitelists are configured, allow by default
    if (ALLOWED_EMAILS.length === 0 && ALLOWED_DOMAINS.length === 0) {
      return true;
    }

    // Check specific email whitelist
    if (ALLOWED_EMAILS.includes(emailLower)) {
      return true;
    }

    // Check domain whitelist
    const domain = emailLower.split('@')[1];
    if (domain && ALLOWED_DOMAINS.includes(domain)) {
      return true;
    }

    return false;
  };

  const handleSession = async (currentSession: Session | null) => {
    if (currentSession?.user) {
      const email = currentSession.user.email;
      if (!isEmailAllowed(email)) {
        setError(`Access Denied: ${email} is not authorized to access this console.`);
        if (supabase) {
          await supabase.auth.signOut();
        }
        setUser(null);
        setSession(null);
        localStorage.removeItem('auth_token');
        setLoading(false);
        return;
      }

      setUser(currentSession.user);
      setSession(currentSession);
      localStorage.setItem('auth_token', currentSession.access_token);
      setError(null);
    } else {
      setUser(null);
      setSession(null);
      localStorage.removeItem('auth_token');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!supabase) {
      setError('Configuration Error: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY environment variables are missing. Please add them to your build environment variables (Build-time variables in Coolify).');
      setLoading(false);
      return;
    }

    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      handleSession(initialSession);
    }).catch((err) => {
      console.error('Error fetching Supabase session:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      handleSession(currentSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      localStorage.removeItem('auth_token');
      setError(null);
    } catch (err) {
      console.error('Error during sign out:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, error, setError, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
