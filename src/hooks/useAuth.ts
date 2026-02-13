import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let retryCount = 0;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        retryCount = 0;
      }
    );

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || (!session && localStorage.getItem(`sb-euhevsyahruqehiqgway-auth-token`))) {
        // Stale token detected — clear it and reset state
        console.warn('Stale session detected, clearing local auth data');
        localStorage.removeItem(`sb-euhevsyahruqehiqgway-auth-token`);
        supabase.auth.signOut().catch(() => {});
        setSession(null);
        setUser(null);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    // Listen for fetch failures on token refresh and auto-clear
    const interval = setInterval(async () => {
      const { error } = await supabase.auth.getSession();
      if (error) {
        retryCount++;
        if (retryCount >= 2) {
          console.warn('Persistent auth failure detected, clearing stale session');
          localStorage.removeItem(`sb-euhevsyahruqehiqgway-auth-token`);
          await supabase.auth.signOut().catch(() => {});
          setSession(null);
          setUser(null);
          setLoading(false);
          retryCount = 0;
        }
      } else {
        retryCount = 0;
      }
    }, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { data, error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };
};
