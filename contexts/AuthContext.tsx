import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLocalSubscriptions } from '../services/subscriptionService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, name?: string) => Promise<{ success: boolean; message?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing session on mount
    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const initializeAuth = async () => {
    try {
      // Get the current session from Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        setError(error.message);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Trigger migration if user is authenticated
        if (session?.user) {
          performMigration();
        }
      }
    } catch (err) {
      console.error('Error initializing auth:', err);
      setError('Failed to initialize authentication');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Perform one-time migration of local subscriptions to Supabase
   * Runs in the background without blocking the UI
   */
  const performMigration = async () => {
    try {
      const result = await migrateLocalSubscriptions();
      
      if (result.success && result.migratedCount > 0) {
        console.log(`Successfully migrated ${result.migratedCount} subscriptions to Supabase`);
      } else if (result.error) {
        console.error('Migration error:', result.error);
      }
    } catch (err) {
      console.error('Error during migration:', err);
      // Don't block user experience if migration fails
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name?: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      setError(null);
      setLoading(true);

      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || '',
          },
        },
      });

      if (error) {
        setError(error.message);
        return { 
          success: false, 
          message: getReadableErrorMessage(error)
        };
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        return {
          success: true,
          message: 'Please check your email to confirm your account.',
        };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      setError(null);
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return {
          success: false,
          message: getReadableErrorMessage(error)
        };
      }

      if (!data.session) {
        return {
          success: false,
          message: 'Failed to create session. Please try again.'
        };
      }

      // Trigger migration after successful sign in
      performMigration();

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setError(null);
      setLoading(true);

      // Clear local subscription data
      await AsyncStorage.removeItem('subscriptions');

      const { error } = await supabase.auth.signOut();
      
      if (error) {
        setError(error.message);
        console.error('Error signing out:', error);
      }

      // Reset state
      setUser(null);
      setSession(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out';
      setError(message);
      console.error('Error signing out:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (
    email: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      setError(null);
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'subscribely://reset-password',
      });

      if (error) {
        setError(error.message);
        return { 
          success: false, 
          message: getReadableErrorMessage(error)
        };
      }

      return { 
        success: true, 
        message: 'Password reset email sent. Please check your inbox.' 
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    resetPassword,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Convert Supabase auth errors to user-friendly messages
 */
function getReadableErrorMessage(error: AuthError): string {
  const errorMessage = error.message.toLowerCase();

  if (errorMessage.includes('invalid login credentials')) {
    return 'Invalid email or password. Please try again.';
  }
  
  if (errorMessage.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }
  
  if (errorMessage.includes('user already registered')) {
    return 'An account with this email already exists.';
  }
  
  if (errorMessage.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }
  
  if (errorMessage.includes('password')) {
    return 'Password must be at least 6 characters long.';
  }

  if (errorMessage.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Return original message if no specific mapping found
  return error.message;
}