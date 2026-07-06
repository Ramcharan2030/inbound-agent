import React, { useState, useEffect } from 'react';
import { Mail, Lock, ShieldCheck, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { supabase, ALLOWED_EMAILS, ALLOWED_DOMAINS } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Allowed emails and domains are imported dynamically from utils/supabase

export const Login: React.FC = () => {
  const { error: contextError, setError: setContextError } = useAuth();
  const { success } = useToast();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLocalError('Configuration Error: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are missing. Please add them to your build environment variables (Build-time variables in Coolify).');
    }
  }, []);

  // Client-side quick check
  const validateEmailFormatAndAccess = (targetEmail: string): string | null => {
    const emailLower = targetEmail.trim().toLowerCase();
    if (!emailLower) return 'Email is required.';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      return 'Please enter a valid email address.';
    }

    if (ALLOWED_EMAILS.length > 0 || ALLOWED_DOMAINS.length > 0) {
      const isAllowedEmail = ALLOWED_EMAILS.includes(emailLower);
      const domain = emailLower.split('@')[1];
      const isAllowedDomain = domain && ALLOWED_DOMAINS.includes(domain);

      if (!isAllowedEmail && !isAllowedDomain) {
        return 'Access Denied: This email domain/address is not authorized to sign in.';
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setContextError(null);

    if (!supabase) {
      setLocalError('Configuration Error: Supabase client is not initialized. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Coolify.');
      return;
    }

    // Validate email
    const emailError = validateEmailFormatAndAccess(email);
    if (emailError) {
      setLocalError(emailError);
      return;
    }

    if (isSignUp) {
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        // If email confirmation is required, Supabase returns a user but session is null
        if (data.user && !data.session) {
          success('Sign up successful!', 'Please check your email for confirmation link.');
          setIsSignUp(false);
          setPassword('');
          setConfirmPassword('');
        } else if (data.session) {
          success('Sign up successful!', 'Account created and signed in successfully!');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
        success('Signed in successfully.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setLocalError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setLocalError(null);
    setContextError(null);
    setPassword('');
    setConfirmPassword('');
  };

  const activeError = localError || contextError;

  return (
    <div className="min-h-screen bg-[#08090c] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Glass Card */}
      <div className="w-full max-w-md bg-[#0c0d14]/70 backdrop-blur-xl rounded-2xl border border-[#1c1e27] shadow-2xl p-8 relative z-10">
        
        {/* Glow effect at top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L17 16H13.5L12 13H8L6.5 16H3L10 2Z" fill="white" opacity="0.9" />
              <path d="M8.8 10.5L10 7.5L11.2 10.5H8.8Z" fill="#08090c" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            A<span className="text-blue-500">Solutions</span> Console
          </h2>
          <p className="text-zinc-500 text-xs mt-2 flex items-center justify-center gap-1">
            <ShieldCheck size={12} className="text-emerald-500" />
            Secure Authentication Portal
          </p>
        </div>

        {/* Alert/Error Banner */}
        {activeError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/5 border border-red-500/15 flex items-start gap-3 text-red-400">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p className="text-xs font-medium leading-normal">{activeError}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500 pointer-events-none">
                <Mail size={16} />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@alloweddomain.com"
                className="w-full pl-10 pr-4 py-3 bg-[#0e1017] border border-[#1c1e27] rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500 pointer-events-none">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-[#0e1017] border border-[#1c1e27] rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                disabled={loading}
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500 pointer-events-none">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-[#0e1017] border border-[#1c1e27] rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {isSignUp ? 'Creating Account...' : 'Signing In...'}
              </>
            ) : (
              <>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </>
            )}
          </button>
        </form>

        {/* Toggle link */}
        <div className="mt-6 text-center text-xs">
          <button
            onClick={toggleMode}
            disabled={loading}
            className="text-zinc-400 hover:text-blue-400 font-medium transition-colors inline-flex items-center gap-1"
          >
            {isSignUp ? (
              <>
                Already have an account? <span className="text-blue-500 font-bold">Sign In</span>
              </>
            ) : (
              <>
                Need an account? <span className="text-blue-500 font-bold">Create one</span>
              </>
            )}
          </button>
        </div>

        {/* Footer Whitelist indicator */}
        {(ALLOWED_EMAILS.length > 0 || ALLOWED_DOMAINS.length > 0) && (
          <div className="mt-8 pt-4 border-t border-[#1c1e27]/50 flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
            <Sparkles size={10} className="text-blue-500" />
            Whitelisted Access Enabled
          </div>
        )}

      </div>
    </div>
  );
};
