import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface UseInactivityTimerOptions {
  /**
   * Timeout duration in milliseconds for foreground inactivity
   * Default: 5 minutes (300000 ms)
   */
  timeout?: number;
  /**
   * Timeout duration in milliseconds for background (app goes to background)
   * Default: 2 minutes (120000 ms)
   * Set to 0 to disable background timeout
   */
  backgroundTimeout?: number;
  /**
   * Callback function called when timeout is reached
   */
  onTimeout: () => void;
  /**
   * Whether the timer is enabled
   * Default: true
   */
  enabled?: boolean;
}

/**
 * Default timeout: 5 minutes
 */
const DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Default background timeout: 2 minutes
 */
const DEFAULT_BACKGROUND_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds

/**
 * Hook to track user inactivity and trigger logout after timeout
 * 
 * Features:
 * - Monitors app state (foreground/background)
 * - Tracks last activity timestamp
 * - Automatically calls onTimeout when inactivity period exceeds timeout (foreground)
 * - Automatically calls onTimeout when app is in background for backgroundTimeout duration
 * - Provides reset function to reset timer on user activity
 * 
 * Security:
 * - Foreground: Logs out after 5 minutes of inactivity
 * - Background: Logs out after 2 minutes when app goes to background
 * - Timer resets when user returns to app before timeout
 * 
 * @param options Configuration options
 * @returns Object with reset function to manually reset the timer
 */
export function useInactivityTimer({
  timeout = DEFAULT_TIMEOUT,
  backgroundTimeout = DEFAULT_BACKGROUND_TIMEOUT,
  onTimeout,
  enabled = true,
}: UseInactivityTimerOptions) {
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backgroundTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const enabledRef = useRef(enabled);
  const backgroundStartTimeRef = useRef<number | null>(null);

  // Update enabled ref when prop changes
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  /**
   * Reset the inactivity timer
   * Call this function whenever user performs an action
   */
  const resetTimer = useCallback(() => {
    if (!enabledRef.current) return;
    lastActivityRef.current = Date.now();
  }, []);

  /**
   * Check if timeout has been reached and trigger logout if needed
   */
  const checkTimeout = useCallback(() => {
    if (!enabledRef.current) return;

    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;

    // Only check timeout when app is in foreground
    // Timer continues in background for security, but we only log out when app comes to foreground
    if (appStateRef.current === 'active' && timeSinceLastActivity >= timeout) {
      console.log('Inactivity timeout reached, logging out user');
      onTimeout();
    }
  }, [timeout, onTimeout]);

  /**
   * Clear background timeout timer
   */
  const clearBackgroundTimeout = useCallback(() => {
    if (backgroundTimeoutRef.current) {
      clearTimeout(backgroundTimeoutRef.current);
      backgroundTimeoutRef.current = null;
    }
    backgroundStartTimeRef.current = null;
  }, []);

  /**
   * Start background timeout timer
   */
  const startBackgroundTimeout = useCallback(() => {
    if (!enabledRef.current || !backgroundTimeout || backgroundTimeout <= 0) {
      return;
    }

    // Clear any existing background timeout
    clearBackgroundTimeout();

    // Record when app went to background
    backgroundStartTimeRef.current = Date.now();

    if (__DEV__) {
      console.log(`[InactivityTimer] App went to background, starting ${backgroundTimeout / 1000}s timeout`);
    }

    // Set timeout to sign out after background timeout
    backgroundTimeoutRef.current = setTimeout(() => {
      if (__DEV__) {
        console.log('[InactivityTimer] Background timeout reached, logging out user');
      }
      onTimeout();
    }, backgroundTimeout);
  }, [backgroundTimeout, onTimeout, clearBackgroundTimeout]);

  /**
   * Handle app state changes
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (!enabledRef.current) return;

      // When app goes to background, start background timeout
      if (previousAppState === 'active' && nextAppState.match(/inactive|background/)) {
        startBackgroundTimeout();
      }

      // When app comes to foreground, check if timeout was reached while in background
      if (previousAppState.match(/inactive|background/) && nextAppState === 'active') {
        // Clear background timeout since user is back
        clearBackgroundTimeout();
        
        // Check if foreground inactivity timeout was reached
        checkTimeout();
        // Reset timer when app comes to foreground (user is back)
        lastActivityRef.current = Date.now();
      }
    });

    return () => {
      subscription.remove();
      clearBackgroundTimeout();
    };
  }, [checkTimeout, startBackgroundTimeout, clearBackgroundTimeout]);

  /**
   * Set up interval to periodically check for timeout
   */
  useEffect(() => {
    if (!enabled) {
      // Clear any existing timeout if disabled
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Initial reset of timer
    lastActivityRef.current = Date.now();

    // Check for timeout every second
    timeoutRef.current = setInterval(() => {
      checkTimeout();
    }, 1000);

    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
      clearBackgroundTimeout();
    };
  }, [enabled, checkTimeout, clearBackgroundTimeout]);

  return {
    resetTimer,
  };
}

