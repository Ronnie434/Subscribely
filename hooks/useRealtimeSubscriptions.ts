import { useEffect, useState, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { Subscription } from '../types';
import { dbToApp } from '../services/subscriptionService';

interface RealtimeCallbacks {
  onInsert?: (subscription: Subscription) => void;
  onUpdate?: (subscription: Subscription) => void;
  onDelete?: (subscriptionId: string) => void;
}

interface UseRealtimeSubscriptionsReturn {
  isConnected: boolean;
  error: string | null;
}

/**
 * Custom hook to subscribe to real-time changes in the subscriptions table
 * Listens to INSERT, UPDATE, and DELETE events for the current user's subscriptions
 */
export function useRealtimeSubscriptions(
  userId: string | null | undefined,
  callbacks: RealtimeCallbacks
): UseRealtimeSubscriptionsReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbacksRef = useRef(callbacks);

  // Keep callbacks ref up to date
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    // Don't subscribe if no user ID
    if (!userId) {
      setIsConnected(false);
      return;
    }

    // Create unique channel name for this user
    const channelName = `subscriptions:user_id=${userId}`;
    
    // Create the real-time channel
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (__DEV__) {
            console.log('Real-time event received:', payload.eventType);
          }

          try {
            switch (payload.eventType) {
              case 'INSERT':
                if (payload.new && callbacksRef.current.onInsert) {
                  const newSubscription = dbToApp(payload.new as any);
                  callbacksRef.current.onInsert(newSubscription);
                }
                break;
                
              case 'UPDATE':
                if (payload.new && callbacksRef.current.onUpdate) {
                  const updatedSubscription = dbToApp(payload.new as any);
                  callbacksRef.current.onUpdate(updatedSubscription);
                }
                break;
                
              case 'DELETE':
                if (payload.old && callbacksRef.current.onDelete) {
                  const deletedId = (payload.old as any).id;
                  callbacksRef.current.onDelete(deletedId);
                }
                break;
            }
          } catch (err) {
            console.error('Error processing real-time event:', err);
            setError(err instanceof Error ? err.message : 'Failed to process real-time event');
          }
        }
      )
      .subscribe((status) => {
        if (__DEV__) {
          console.log('Real-time subscription status:', status);
        }

        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
          // Don't show alarming errors - real-time is nice-to-have, not critical
          // The app still works perfectly with force refresh on focus
          if (__DEV__) {
            console.log('⚠️ Real-time connection issue (app still functional, will retry)');
          }
          setError(null); // Clear error - not critical
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          setError(null);
        }
      });

    // Store channel reference
    channelRef.current = channel;

    // Cleanup function
    return () => {
      if (__DEV__) {
        console.log('Cleaning up real-time subscription');
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [userId]);

  return { isConnected, error };
}