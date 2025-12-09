import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLocalSubscriptions } from '../services/subscriptionService';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import {
  evaluateSession,
  saveSessionMetadata,
  clearSessionMetadata,
  SessionEnforcementReason,
  getDefaultReasonMessage,
} from '../utils/sessionManager';

// Complete auth session for web platform
WebBrowser.maybeCompleteAuthSession();

const ACCESS_TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000; // 2 minutes
const MIN_REFRESH_DELAY_MS = 5 * 1000; // 5 seconds fallback

interface DeletedAccountInfo {
  deletedAt: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  isHandlingDuplicate: boolean;
  deletedAccountInfo: DeletedAccountInfo | null;
  signUp: (email: string, password: string, name?: string) => Promise<{ success: boolean; message?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; message?: string }>;
  signInWithApple: () => Promise<{ success: boolean; message?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; message?: string }>;
  clearError: () => void;
  clearDuplicateFlag: () => void;
  clearDeletedAccountInfo: () => void;
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
  
  // Ref to track if we're handling a duplicate email (to prevent navigation)
  const isHandlingDuplicateRef = useRef(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshFailureCountRef = useRef(0);
  const performSessionRefreshRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const scheduleAccessTokenRefreshRef = useRef<((activeSession: Session | null) => void) | undefined>(undefined);
  
  // State to track if we're handling a duplicate (for AppNavigator to show auth screens)
  const [isHandlingDuplicate, setIsHandlingDuplicate] = useState(false);
  
  // State to track deleted account info (for recovery flow)
  const [deletedAccountInfo, setDeletedAccountInfo] = useState<DeletedAccountInfo | null>(null);
  
  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleAccessTokenRefresh = useCallback(
    (activeSession: Session | null) => {
      clearRefreshTimer();

      if (!activeSession?.expires_at) {
        return;
      }

      const expiresAtMs = activeSession.expires_at * 1000;
      const now = Date.now();
      const triggerAt = expiresAtMs - ACCESS_TOKEN_REFRESH_BUFFER_MS;
      const delay = Math.max(triggerAt - now, MIN_REFRESH_DELAY_MS);

      refreshTimerRef.current = setTimeout(() => {
        if (__DEV__) {
          console.log('[AuthContext] Proactively refreshing session before expiry');
        }
        if (performSessionRefreshRef.current) {
          performSessionRefreshRef.current();
        }
      }, delay);
    },
    [clearRefreshTimer],
  );

  useEffect(() => {
    scheduleAccessTokenRefreshRef.current = scheduleAccessTokenRefresh;
  }, [scheduleAccessTokenRefresh]);

  useEffect(() => {
    return () => {
      clearRefreshTimer();
    };
  }, [clearRefreshTimer]);

  const persistSessionState = useCallback(async (activeSession: Session) => {
    await saveSessionMetadata(activeSession);
    scheduleAccessTokenRefreshRef.current?.(activeSession);
  }, []);

  // Expose a function to clear the duplicate flag (for manual navigation)
  const clearDuplicateFlag = useCallback(() => {
    if (__DEV__) {
      console.log('[AuthContext] Manually clearing duplicate flag for navigation');
    }
    isHandlingDuplicateRef.current = false;
    setIsHandlingDuplicate(false);
    // Also clear user/session since we're done handling the duplicate
    setSession(null);
    setUser(null);
  }, []);

  // Clear deleted account info after recovery or sign out
  const clearDeletedAccountInfo = useCallback(() => {
    if (__DEV__) {
      console.log('[AuthContext] Clearing deleted account info');
    }
    setDeletedAccountInfo(null);
  }, []);

  /**
   * Perform one-time migration of local subscriptions to Supabase
   * Runs in the background without blocking the UI
   */
  const performMigration = useCallback(async () => {
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
  }, []);

  const performSignOut = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}): Promise<void> => {
      try {
        if (!silent) {
          setError(null);
        }
        setLoading(true);

        clearRefreshTimer();
        await clearSessionMetadata();

        // Clear local subscription data
        await AsyncStorage.removeItem('subscriptions');

        // Sign out from Supabase - this should clear the session from SecureStore
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          // Only set error if it's not a silent logout and not an expected auth error
          // AuthSessionMissingError is expected during auto-logout when session is already expired
          const isExpectedAuthError = error.message.includes('AuthSessionMissingError') ||
                                       error.message.includes('session');
          
          if (!silent && !isExpectedAuthError) {
            setError(error.message);
          }
          // Log expected errors at debug level, unexpected errors as warnings
          if (isExpectedAuthError) {
            if (__DEV__) {
              console.log('Expected auth error during sign out (session already expired):', error.message);
            }
          } else {
            console.warn('Error signing out:', error);
          }
        }

        // Manually ensure session is cleared from SecureStore/AsyncStorage
        // Supabase's signOut should handle this, but we ensure it's cleared even if signOut had errors
        try {
          // Get the project reference from URL
          const url = (supabase as any).supabaseUrl as string;
          const projectRef = url.split('.')[0].replace('https://', '').replace('http://', '');
          
          // List of all possible Supabase auth storage keys
          const storageKeys = [
            `sb-${projectRef}-auth-token`,
            `sb-${projectRef}-auth-token-code-verifier`,
          ];
          
          // Clear all possible keys from storage
          if (Platform.OS !== 'web') {
            // Clear from SecureStore (iOS/Android)
            for (const key of storageKeys) {
              try {
                await SecureStore.deleteItemAsync(key);
                if (__DEV__) {
                  console.log(`[AuthContext] Cleared storage key: ${key}`);
                }
              } catch (e) {
                // Ignore if key doesn't exist - this is expected
              }
            }
          } else {
            // Clear from AsyncStorage (Web)
            for (const key of storageKeys) {
              try {
                await AsyncStorage.removeItem(key);
                if (__DEV__) {
                  console.log(`[AuthContext] Cleared storage key: ${key}`);
                }
              } catch (e) {
                // Ignore if key doesn't exist - this is expected
              }
            }
          }
          
          if (__DEV__) {
            console.log('[AuthContext] Session cleared from storage, user logged out');
          }
        } catch (storageError) {
          if (__DEV__) {
            console.warn('[AuthContext] Error clearing session storage:', storageError);
          }
        }

        // Reset state
        setUser(null);
        setSession(null);
        setDeletedAccountInfo(null);
      } catch (err) {
        // Only set error if it's not a silent logout
        if (!silent) {
          const message = err instanceof Error ? err.message : 'Failed to sign out';
          setError(message);
        }
        console.error('Error signing out:', err);
        
        // Reset state even if there was an error
        setUser(null);
        setSession(null);
        setDeletedAccountInfo(null);
      } finally {
        setLoading(false);
      }
    },
    [clearRefreshTimer],
  );

  const signOut = useCallback(async (): Promise<void> => {
    await performSignOut({ silent: false });
    setError(null);
  }, [performSignOut]);

  const handleForcedLogout = useCallback(
    async (reason: SessionEnforcementReason, message?: string) => {
      if (__DEV__) {
        console.log('[AuthContext] Forcing logout due to', reason);
      }
      setError(message ?? getDefaultReasonMessage(reason));
      await performSignOut({ silent: true });
    },
    [performSignOut],
  );

  const initializeAuth = useCallback(async () => {
    try {
      // Clear any existing errors at the start of initialization
      setError(null);
      
      const {
        data: { session: existingSession },
        error,
      } = await supabase.auth.getSession();
      
      if (error) {
        // "Refresh Token Not Found" is expected on first launch when there's no stored session
        const isExpectedError = error.message.includes('Refresh Token Not Found') ||
                               error.message.includes('Invalid Refresh Token') ||
                               error.message.includes('session_not_found');
        
        if (isExpectedError) {
          if (__DEV__) {
            console.log('[AuthContext] No stored session found (expected on first launch)');
          }
          // Don't set error state for expected cases
        } else {
          // Only log and set error for unexpected errors
          console.error('Error getting session:', error);
          setError(error.message);
        }
        
        setSession(null);
        setUser(null);
        await clearSessionMetadata();
        clearRefreshTimer();
        return;
      }

      if (existingSession) {
        const enforcement = await evaluateSession(existingSession);
        if (enforcement) {
          await handleForcedLogout(enforcement.reason, enforcement.message);
          return;
        }

        setSession(existingSession);
        setUser(existingSession.user ?? null);
        await persistSessionState(existingSession);

        if (existingSession.user) {
          performMigration();
        }
      } else {
        setSession(null);
        setUser(null);
        await clearSessionMetadata();
        clearRefreshTimer();
      }
    } catch (err) {
      console.error('Error initializing auth:', err);
      setSession(null);
      setUser(null);
      await clearSessionMetadata();
      clearRefreshTimer();
    } finally {
      setLoading(false);
    }
  }, [clearRefreshTimer, handleForcedLogout, performMigration, persistSessionState]);

  useEffect(() => {
    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (isHandlingDuplicateRef.current) {
        if (__DEV__) {
          console.log('[AuthContext] Ignoring auth state change - handling duplicate email');
        }
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (nextSession) {
        try {
          await persistSessionState(nextSession);
        } catch (metadataError) {
          console.warn('[AuthContext] Failed to persist session metadata:', metadataError);
        }

        if (event === 'SIGNED_IN' && nextSession.user) {
          performMigration();
        }
      } else {
        await clearSessionMetadata();
        clearRefreshTimer();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initializeAuth, performMigration, clearRefreshTimer, persistSessionState]);

  const signUp = async (
    email: string,
    password: string,
    name?: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      setError(null);
      setLoading(true);
      
      // Reset duplicate handling flag at start of signup
      // This ensures each signup attempt starts fresh
      isHandlingDuplicateRef.current = false;
      
      if (__DEV__) {
        console.log('[SignUp] Starting signup for:', email);
        console.log('[SignUp] Reset isHandlingDuplicateRef to false');
      }

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

      // Debug logging for testing duplicate email scenario
      if (__DEV__) {
        console.log('[SignUp] Email:', email);
        console.log('[SignUp] Error:', error);
        console.log('[SignUp] Data:', {
          hasUser: !!data?.user,
          hasSession: !!data?.session,
          emailConfirmed: data?.user?.email_confirmed_at,
          createdAt: data?.user?.created_at,
        });
      }

      if (error) {
        setError(error.message);
        const readableMessage = getReadableErrorMessage(error);
        
        // Check if it's a duplicate email error - check both original and readable message
        const errorLower = error.message.toLowerCase();
        const readableLower = readableMessage.toLowerCase();
        const isDuplicateEmail = 
          errorLower.includes('user already registered') ||
          errorLower.includes('email already registered') ||
          errorLower.includes('already exists') ||
          errorLower.includes('already been registered') ||
          errorLower.includes('duplicate') ||
          readableLower.includes('already exists') ||
          readableLower.includes('already registered') ||
          error.status === 422; // HTTP 422 Unprocessable Entity
        
        if (__DEV__) {
          console.log('[SignUp] Is duplicate email:', isDuplicateEmail);
          console.log('[SignUp] Error message:', error.message);
          console.log('[SignUp] Readable message:', readableMessage);
        }
        
        return { 
          success: false, 
          message: isDuplicateEmail 
            ? 'An account with this email already exists. Please sign in instead.'
            : readableMessage
        };
      }

      // Check if user already exists (Supabase might return user without error for existing emails)
      if (data.user) {
        // Check if this is a new user or existing user trying to sign up again
        // If user has email_confirmed_at, they already have an account
        if (data.user.email_confirmed_at) {
          if (__DEV__) {
            console.log('[SignUp] User already confirmed - duplicate email detected');
          }
          return {
            success: false,
            message: 'An account with this email already exists. Please sign in instead.',
          };
        }
        
        // Check if email already exists in auth.users using database function
        // This is the most reliable way to detect duplicate emails
        try {
          // First check: Use database function to check if email exists in auth.users
          const { data: emailCheck, error: emailCheckError } = await supabase
            .rpc('check_email_exists', { check_email: email.trim() });
          
          if (__DEV__) {
            console.log('[SignUp] Email exists check:', { emailCheck, emailCheckError });
          }
          
          // If function doesn't exist, skip this check and use fallback methods
          if (emailCheckError && emailCheckError.code === 'PGRST202') {
            if (__DEV__) {
              console.warn('[SignUp] check_email_exists function not found. Please run database/check_email_exists_function.sql in Supabase SQL Editor');
            }
            // Continue to fallback checks below
          } else if (emailCheckError) {
            if (__DEV__) {
              console.warn('[SignUp] Error checking email existence:', emailCheckError);
            }
            // Continue to fallback checks below
          } else if (emailCheck && emailCheck.length > 0 && emailCheck[0].email_exists) {
            // Function exists and returned results
            const existingUser = emailCheck[0];
            
            // If the existing user ID is different from the current user ID, it's a duplicate
            if (existingUser.user_id && existingUser.user_id !== data.user.id) {
              if (__DEV__) {
                console.log('[SignUp] Email exists with different user ID - duplicate detected');
              }
              
              // Set flag IMMEDIATELY to prevent any auth state changes from updating user state
              isHandlingDuplicateRef.current = true;
              
              // DON'T set isHandlingDuplicate state immediately - this causes AppNavigator to remount
              // Instead, set it after a delay to allow the alert to show first
              // The ref flag will prevent auth state changes in the meantime
              if (__DEV__) {
                console.log('[SignUp] Signing out duplicate user (delaying state update to preserve navigation)');
              }
              
              // Sign out the newly created user since it's a duplicate
              // Do this asynchronously so it doesn't block error display
              // The flag will prevent the auth state change from updating user/session
              setTimeout(async () => {
                try {
                  await supabase.auth.signOut();
                  if (__DEV__) {
                    console.log('[SignUp] Signed out duplicate user');
                  }
                  
                  // Set the state flag AFTER sign-out to show auth screens
                  // But delay it to allow alert to be displayed first
                  setTimeout(() => {
                    setIsHandlingDuplicate(true);
                    if (__DEV__) {
                      console.log('[SignUp] Set isHandlingDuplicate state (after delay)');
                    }
                  }, 1000); // Delay to allow alert to show and user to interact
                } catch (signOutError) {
                  if (__DEV__) {
                    console.warn('[SignUp] Error signing out duplicate user:', signOutError);
                  }
                  // Set state even if sign-out fails
                  setTimeout(() => {
                    setIsHandlingDuplicate(true);
                  }, 1000);
                }
              }, 200); // Small delay to allow error to be set first
              
              return {
                success: false,
                message: 'An account with this email already exists. Please sign in instead.',
              };
            }
            
            // If email exists with same user ID but was created significantly earlier, it's a duplicate signup
            if (existingUser.user_id === data.user.id && existingUser.created_at) {
              const existingCreatedAt = new Date(existingUser.created_at);
              const userCreatedAt = new Date(data.user.created_at);
              const timeDiffSeconds = (userCreatedAt.getTime() - existingCreatedAt.getTime()) / 1000;
              
              if (__DEV__) {
                console.log('[SignUp] Email exists check time diff:', timeDiffSeconds.toFixed(2));
              }
              
              // If existing user was created more than 2 seconds before current user, it's a duplicate
              // (accounting for the fact that the function might return the newly created user)
              if (timeDiffSeconds < -2) {
                if (__DEV__) {
                  console.log('[SignUp] Existing user created before current - duplicate detected');
                }
                
                // Set flag IMMEDIATELY to prevent any auth state changes from updating user state
                isHandlingDuplicateRef.current = true;
                
                // DON'T set isHandlingDuplicate state immediately - this causes AppNavigator to remount
                // Instead, set it after a delay to allow the alert to show first
                // The ref flag will prevent auth state changes in the meantime
                if (__DEV__) {
                  console.log('[SignUp] Signing out duplicate user (delaying state update to preserve navigation)');
                }
                
                // Sign out the newly created user since it's a duplicate
                // Do this asynchronously so it doesn't block error display
                // The flag will prevent the auth state change from updating user/session
                setTimeout(async () => {
                  try {
                    await supabase.auth.signOut();
                    if (__DEV__) {
                      console.log('[SignUp] Signed out duplicate user');
                    }
                    
                    // Set the state flag AFTER sign-out to show auth screens
                    // But delay it to allow alert to be displayed first
                    setTimeout(() => {
                      setIsHandlingDuplicate(true);
                      if (__DEV__) {
                        console.log('[SignUp] Set isHandlingDuplicate state (after delay)');
                      }
                    }, 1000); // Delay to allow alert to show and user to interact
                  } catch (signOutError) {
                    if (__DEV__) {
                      console.warn('[SignUp] Error signing out duplicate user:', signOutError);
                    }
                    // Set state even if sign-out fails
                    setTimeout(() => {
                      setIsHandlingDuplicate(true);
                    }, 1000);
                  }
                }, 200); // Small delay to allow error to be set first
                
                return {
                  success: false,
                  message: 'An account with this email already exists. Please sign in instead.',
                };
              }
            }
          }
          
          // Fallback check: Look for profiles with this email (case-insensitive)
          // This is used when the database function doesn't exist or fails
          const { data: existingProfiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, created_at')
            .ilike('email', email.trim());
          
          if (__DEV__) {
            console.log('[SignUp] Profile check (email):', { existingProfiles, profileError, count: existingProfiles?.length });
          }
          
          // If multiple profiles exist for this email, it's definitely a duplicate
          if (existingProfiles && existingProfiles.length > 1) {
            if (__DEV__) {
              console.log('[SignUp] Multiple profiles found - duplicate email detected');
            }
            return {
              success: false,
              message: 'An account with this email already exists. Please sign in instead.',
            };
          }
          
          // If a profile exists, check if it's older than this signup attempt
          if (existingProfiles && existingProfiles.length === 1) {
            const existingProfile = existingProfiles[0];
            const profileCreatedAt = new Date(existingProfile.created_at);
            const userCreatedAt = new Date(data.user.created_at);
            const timeDiffSeconds = (userCreatedAt.getTime() - profileCreatedAt.getTime()) / 1000;
            
            if (__DEV__) {
              console.log('[SignUp] Profile found:', {
                profileId: existingProfile.id,
                userId: data.user.id,
                profileCreated: existingProfile.created_at,
                userCreated: data.user.created_at,
                timeDiffSeconds: timeDiffSeconds.toFixed(2)
              });
            }
            
            // If profile ID doesn't match user ID, it's definitely a duplicate (different user)
            if (existingProfile.id !== data.user.id) {
              if (__DEV__) {
                console.log('[SignUp] Profile ID mismatch - duplicate email detected');
              }
              return {
                success: false,
                message: 'An account with this email already exists. Please sign in instead.',
              };
            }
            
            // If profile was created more than 5 seconds before user, it's an existing account
            // (accounting for trigger delay which should be < 1 second)
            if (timeDiffSeconds > 5) {
              if (__DEV__) {
                console.log('[SignUp] Profile significantly older than user - duplicate email detected');
              }
              return {
                success: false,
                message: 'An account with this email already exists. Please sign in instead.',
              };
            }
          }
          
          // Second check: Wait a moment and re-check for profiles with this email
          // This handles the case where the trigger hasn't run yet, or we need to check again
          if (existingProfiles && existingProfiles.length === 0) {
            // Wait 500ms for trigger to potentially complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Re-check for profiles with this email (in case original profile exists)
            const { data: retryProfiles, error: retryError } = await supabase
              .from('profiles')
              .select('id, email, created_at')
              .ilike('email', email.trim());
            
            if (__DEV__) {
              console.log('[SignUp] Profile re-check (email after delay):', { retryProfiles, retryError, count: retryProfiles?.length });
            }
            
            // If we now find a profile with this email but different user ID, it's a duplicate
            if (retryProfiles && retryProfiles.length > 0 && data.user) {
              const currentUserId = data.user.id;
              const foundProfile = retryProfiles.find(p => p.id !== currentUserId);
              if (foundProfile) {
                if (__DEV__) {
                  console.log('[SignUp] Found existing profile with different ID - duplicate email detected');
                }
                return {
                  success: false,
                  message: 'An account with this email already exists. Please sign in instead.',
                };
              }
              
              // If profile exists with same ID, check creation time
              const sameIdProfile = retryProfiles.find(p => p.id === currentUserId);
              if (sameIdProfile) {
                const profileCreatedAt = new Date(sameIdProfile.created_at);
                const userCreatedAt = new Date(data.user.created_at);
                const timeDiffSeconds = (userCreatedAt.getTime() - profileCreatedAt.getTime()) / 1000;
                
                if (__DEV__) {
                  console.log('[SignUp] Profile time diff (after delay):', timeDiffSeconds.toFixed(2));
                }
                
                // If profile is more than 2 seconds older, it's likely a duplicate
                if (timeDiffSeconds > 2) {
                  if (__DEV__) {
                    console.log('[SignUp] Profile older than user (after delay) - duplicate email detected');
                  }
                  return {
                    success: false,
                    message: 'An account with this email already exists. Please sign in instead.',
                  };
                }
              }
            }
          }
        } catch (profileCheckError) {
          if (__DEV__) {
            console.warn('[SignUp] Error checking profile:', profileCheckError);
          }
          // If profile check fails, fall back to timestamp check
        }
        
        // Fallback: Check if user was created more than 10 seconds ago (likely an existing user)
        // New signups will have a very recent created_at timestamp (within 1-2 seconds)
        const userCreatedAt = new Date(data.user.created_at);
        const now = new Date();
        const secondsSinceCreation = (now.getTime() - userCreatedAt.getTime()) / 1000;
        
        if (__DEV__) {
          console.log('[SignUp] User created:', data.user.created_at);
          console.log('[SignUp] Seconds since creation:', secondsSinceCreation);
        }
        
        // If user was created more than 10 seconds ago and has no session, it's likely a duplicate
        // Using 10 seconds to be safe (account for network delays, etc.)
        if (secondsSinceCreation > 10 && !data.session) {
          if (__DEV__) {
            console.log('[SignUp] Old user without session - duplicate email detected');
          }
          return {
            success: false,
            message: 'An account with this email already exists. Please sign in instead.',
          };
        }
        
        // If no session and email not confirmed, it's waiting for confirmation (new user)
        if (!data.session) {
          if (__DEV__) {
            console.log('[SignUp] New user - waiting for email confirmation');
          }
        return {
          success: true,
          message: 'Please check your email to confirm your account.',
        };
        }
      }

      if (__DEV__) {
        console.log('[SignUp] Success - user signed up and logged in');
      }

      if (data?.session) {
        await persistSessionState(data.session);
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      setError(message);
      if (__DEV__) {
        console.error('[SignUp] Exception:', err);
      }
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

      // Check if user's account is marked for deletion using Edge Function
      // We must use Edge Function because RLS policies block reading deleted accounts
      if (data.user && data.session) {
        try {
          if (__DEV__) {
            console.log('[AuthContext.signIn] Checking account deletion status via Edge Function');
          }

          // Call check-account-status Edge Function with service role access
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
          const functionUrl = `${supabaseUrl}/functions/v1/check-account-status`;
          const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${data.session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            if (__DEV__) {
              console.warn('[AuthContext.signIn] Edge Function error:', errorText);
            }
            // Continue with login if check fails (non-blocking)
          } else {
            const accountStatus = await response.json();
            
            if (__DEV__) {
              console.log('[AuthContext.signIn] Account status:', accountStatus);
            }

            // If account is marked for deletion, store info for recovery flow
            if (accountStatus.deleted && accountStatus.deletedAt) {
              if (__DEV__) {
                console.log('[AuthContext.signIn] ✅ Deleted account detected, setting info for recovery');
              }
              
              setDeletedAccountInfo({
                deletedAt: accountStatus.deletedAt,
                email: accountStatus.email || data.user.email || email,
              });
              
              // Don't clear the session yet - let AppNavigator handle the redirect
              await persistSessionState(data.session);
              
              return { success: true };
            } else {
              if (__DEV__) {
                console.log('[AuthContext.signIn] Account is active (not deleted)');
              }
            }
          }
        } catch (checkError) {
          if (__DEV__) {
            console.warn('[AuthContext.signIn] Error checking account status:', checkError);
          }
          // Continue with login if check fails (non-blocking)
        }
      }

      await persistSessionState(data.session);

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

  const performSessionRefresh = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        throw error;
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user ?? null);
        await persistSessionState(data.session);
      }

      refreshFailureCountRef.current = 0;
    } catch (err) {
      refreshFailureCountRef.current += 1;
      console.error('[AuthContext] Session refresh failed:', err);

      if (refreshFailureCountRef.current >= 2) {
        refreshFailureCountRef.current = 0;
        await handleForcedLogout(
          SessionEnforcementReason.SuspiciousActivity,
          getDefaultReasonMessage(SessionEnforcementReason.SuspiciousActivity),
        );
      }
    }
  }, [session, handleForcedLogout, persistSessionState]);

  useEffect(() => {
    performSessionRefreshRef.current = async () => {
      await performSessionRefresh();
    };
  }, [performSessionRefresh]);

  const resetPassword = async (
    email: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      setError(null);
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'renvo://reset-password',
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

  const updatePassword = async (
    newPassword: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      setError(null);
      setLoading(true);

      if (__DEV__) {
        console.log('[AuthContext.updatePassword] === PASSWORD UPDATE DEBUG ===');
        console.log('[AuthContext.updatePassword] Password length:', newPassword?.length || 0);
      }

      // Check current session before attempting update
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (__DEV__) {
        console.log('[AuthContext.updatePassword] Current session check:', {
          hasSession: !!currentSession,
          hasUser: !!currentSession?.user,
          sessionError: sessionError?.message,
          expiresAt: currentSession?.expires_at,
          accessToken: currentSession?.access_token ? 'present' : 'missing'
        });
      }

      if (!currentSession) {
        if (__DEV__) {
          console.log('[AuthContext.updatePassword] ERROR: No active session found!');
        }
        return {
          success: false,
          message: 'No active session. Please use the password reset link from your email.'
        };
      }

      if (__DEV__) {
        console.log('[AuthContext.updatePassword] Attempting password update...');
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        if (__DEV__) {
          console.log('[AuthContext.updatePassword] Update failed:', {
            errorMessage: error.message,
            errorStatus: error.status,
            errorName: error.name
          });
        }
        setError(error.message);
        return {
          success: false,
          message: getReadableErrorMessage(error)
        };
      }

      if (__DEV__) {
        console.log('[AuthContext.updatePassword] Password updated successfully');
      }

      return {
        success: true,
        message: 'Password updated successfully'
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update password';
      if (__DEV__) {
        console.log('[AuthContext.updatePassword] Exception:', err);
      }
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Extract OAuth tokens from callback URL hash
   * Supabase returns tokens in the URL hash fragment
   */
  const extractParamsFromUrl = (url: string) => {
    try {
      const parsedUrl = new URL(url);
      const hash = parsedUrl.hash.substring(1); // Remove the leading '#'
      const params = new URLSearchParams(hash);
      
      return {
        access_token: params.get('access_token'),
        refresh_token: params.get('refresh_token'),
        expires_in: params.get('expires_in'),
        token_type: params.get('token_type'),
        provider_token: params.get('provider_token'),
      };
    } catch (err) {
      if (__DEV__) {
        console.error('[OAuth] Error extracting params from URL:', err);
      }
      return {
        access_token: null,
        refresh_token: null,
        expires_in: null,
        token_type: null,
        provider_token: null,
      };
    }
  };

  /**
   * Sign in with Google using Supabase OAuth
   * Uses expo-web-browser to open OAuth flow in browser
   */
  const signInWithGoogle = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      setError(null);
      setLoading(true);

      if (__DEV__) {
        console.log('[OAuth] Starting Google sign-in');
      }

      // Generate redirect URL for the current platform
      const redirectTo = makeRedirectUri({
        scheme: 'renvo',
        path: 'oauth-callback',
      });

      if (__DEV__) {
        console.log('[OAuth] Redirect URL:', redirectTo);
      }

      // Initiate OAuth flow with Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true, // We'll handle the redirect manually
          queryParams: {
            prompt: 'consent', // Force consent screen to appear
            access_type: 'offline', // Request refresh token
          },
        },
      });

      if (error) {
        setError(error.message);
        if (__DEV__) {
          console.error('[OAuth] Error initiating Google OAuth:', error);
        }
        return {
          success: false,
          message: getReadableErrorMessage(error),
        };
      }

      if (!data?.url) {
        const errorMsg = 'Failed to get OAuth URL from Supabase';
        setError(errorMsg);
        if (__DEV__) {
          console.error('[OAuth]', errorMsg);
        }
        return {
          success: false,
          message: errorMsg,
        };
      }

      if (__DEV__) {
        console.log('[OAuth] Opening browser for Google OAuth');
      }

      // Open OAuth URL in browser
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
        { showInRecents: true }
      );

      if (__DEV__) {
        console.log('[OAuth] Browser result:', result.type);
      }

      // Handle the result
      if (result.type === 'success') {
        if (__DEV__) {
          console.log('[OAuth] OAuth success, extracting tokens');
        }

        const params = extractParamsFromUrl(result.url);

        if (!params.access_token || !params.refresh_token) {
          const errorMsg = 'Failed to extract tokens from OAuth callback';
          setError(errorMsg);
          if (__DEV__) {
            console.error('[OAuth]', errorMsg);
          }
          return {
            success: false,
            message: errorMsg,
          };
        }

        // Set the session with the tokens
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });

        if (sessionError) {
          setError(sessionError.message);
          if (__DEV__) {
            console.error('[OAuth] Error setting session:', sessionError);
          }
          return {
            success: false,
            message: getReadableErrorMessage(sessionError),
          };
        }

        if (__DEV__) {
          console.log('[OAuth] Session set successfully');
        }

        // Refresh profile data to get updated avatar_url from OAuth
        // This ensures the UI has the latest profile data immediately
        try {
          if (sessionData.session) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, email, full_name, avatar_url')
              .eq('id', sessionData.session.user.id)
              .single();
          
            if (__DEV__ && profile) {
              console.log('[OAuth] Profile refreshed:', {
                hasAvatar: !!profile.avatar_url,
                avatarUrl: profile.avatar_url,
                fullName: profile.full_name
              });
            }
          }
        } catch (err) {
          // Non-critical - profile will be loaded on next screen anyway
          if (__DEV__) {
            console.warn('[OAuth] Failed to refresh profile:', err);
          }
        }

        if (sessionData.session) {
          await persistSessionState(sessionData.session);
        }

        // Trigger migration after successful OAuth sign-in
        performMigration();

        return { success: true };
      } else if (result.type === 'cancel') {
        if (__DEV__) {
          console.log('[OAuth] User cancelled OAuth');
        }
        return {
          success: false,
          message: 'Sign in cancelled',
        };
      } else {
        if (__DEV__) {
          console.log('[OAuth] OAuth failed or was dismissed');
        }
        return {
          success: false,
          message: 'Sign in failed. Please try again.',
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in with Google';
      setError(message);
      if (__DEV__) {
        console.error('[OAuth] Exception during Google sign-in:', err);
      }
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign in with Apple using Supabase OAuth
   * Uses expo-web-browser to open OAuth flow in browser
   */
  const signInWithApple = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      setError(null);
      setLoading(true);

      if (__DEV__) {
        console.log('[OAuth] Starting Apple sign-in');
      }

      // Generate redirect URL for the current platform
      const redirectTo = makeRedirectUri({
        scheme: 'renvo',
        path: 'oauth-callback',
      });

      if (__DEV__) {
        console.log('[OAuth] Redirect URL:', redirectTo);
      }

      // Initiate OAuth flow with Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo,
          skipBrowserRedirect: true, // We'll handle the redirect manually
        },
      });

      if (error) {
        setError(error.message);
        if (__DEV__) {
          console.error('[OAuth] Error initiating Apple OAuth:', error);
        }
        return {
          success: false,
          message: getReadableErrorMessage(error),
        };
      }

      if (!data?.url) {
        const errorMsg = 'Failed to get OAuth URL from Supabase';
        setError(errorMsg);
        if (__DEV__) {
          console.error('[OAuth]', errorMsg);
        }
        return {
          success: false,
          message: errorMsg,
        };
      }

      if (__DEV__) {
        console.log('[OAuth] Opening browser for Apple OAuth');
      }

      // Open OAuth URL in browser
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
        { showInRecents: true }
      );

      if (__DEV__) {
        console.log('[OAuth] Browser result:', result.type);
      }

      // Handle the result
      if (result.type === 'success') {
        if (__DEV__) {
          console.log('[OAuth] OAuth success, extracting tokens');
        }

        const params = extractParamsFromUrl(result.url);

        if (!params.access_token || !params.refresh_token) {
          const errorMsg = 'Failed to extract tokens from OAuth callback';
          setError(errorMsg);
          if (__DEV__) {
            console.error('[OAuth]', errorMsg);
          }
          return {
            success: false,
            message: errorMsg,
          };
        }

        // Set the session with the tokens
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });

        if (sessionError) {
          setError(sessionError.message);
          if (__DEV__) {
            console.error('[OAuth] Error setting session:', sessionError);
          }
          return {
            success: false,
            message: getReadableErrorMessage(sessionError),
          };
        }

        if (__DEV__) {
          console.log('[OAuth] Session set successfully');
        }

        // Refresh profile data to get updated avatar_url from OAuth
        // This ensures the UI has the latest profile data immediately
        if (sessionData.session) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, email, full_name, avatar_url')
              .eq('id', sessionData.session.user.id)
              .single();
            
            if (__DEV__ && profile) {
              console.log('[OAuth] Profile refreshed:', {
                hasAvatar: !!profile.avatar_url,
                avatarUrl: profile.avatar_url,
                fullName: profile.full_name
              });
            }
          } catch (err) {
            // Non-critical - profile will be loaded on next screen anyway
            if (__DEV__) {
              console.warn('[OAuth] Failed to refresh profile:', err);
            }
          }

          await persistSessionState(sessionData.session);
        }

        // Trigger migration after successful OAuth sign-in
        performMigration();

        return { success: true };
      } else if (result.type === 'cancel') {
        if (__DEV__) {
          console.log('[OAuth] User cancelled OAuth');
        }
        return {
          success: false,
          message: 'Sign in cancelled',
        };
      } else {
        if (__DEV__) {
          console.log('[OAuth] OAuth failed or was dismissed');
        }
        return {
          success: false,
          message: 'Sign in failed. Please try again.',
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in with Apple';
      setError(message);
      if (__DEV__) {
        console.error('[OAuth] Exception during Apple sign-in:', err);
      }
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
    isHandlingDuplicate,
    deletedAccountInfo,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signOut,
    resetPassword,
    updatePassword,
    clearError,
    clearDuplicateFlag,
    clearDeletedAccountInfo,
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
  const errorCode = error.status?.toString() || '';

  // Check for duplicate email/account errors
  if (
    errorMessage.includes('user already registered') ||
    errorMessage.includes('email already registered') ||
    errorMessage.includes('already exists') ||
    errorMessage.includes('already been registered') ||
    errorMessage.includes('duplicate') ||
    errorCode === '422' // Unprocessable Entity - often used for duplicate entries
  ) {
    return 'An account with this email already exists. Please sign in instead.';
  }

  if (errorMessage.includes('invalid login credentials')) {
    return 'Invalid email or password. Please try again.';
  }
  
  if (errorMessage.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.';
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