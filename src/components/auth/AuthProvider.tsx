import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only set up auth if Supabase is available
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);

        // When user signs in (after email confirmation), check for pending invitation code
        if (event === 'SIGNED_IN' && session?.user) {
          const pendingCode = localStorage.getItem('pending_invitation_code');
          
          if (pendingCode) {
            // Redeem the invitation code
            setTimeout(async () => {
              try {
                const { data } = await supabase.rpc('redeem_invitation_code', {
                  _code: pendingCode,
                  _user_id: session.user.id
                });
                
                if (data?.success) {
                  localStorage.removeItem('pending_invitation_code');
                  console.log('Invitation code redeemed successfully');
                  window.location.reload();
                } else {
                  console.error('Failed to redeem code:', data?.error);
                  localStorage.removeItem('pending_invitation_code');
                }
              } catch (error) {
                console.error('Error redeeming invitation code:', error);
                localStorage.removeItem('pending_invitation_code');
              }
            }, 0);
          } else {
            // No invitation code: assign owner role if needed
            setTimeout(async () => {
              try {
                await supabase.rpc('assign_default_owner_role', { 
                  _user_id: session.user.id 
                });
              } catch (error) {
                console.error('Error assigning owner role:', error);
              }
            }, 0);
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase no disponible');
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase no disponible');
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!supabase) return;
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}