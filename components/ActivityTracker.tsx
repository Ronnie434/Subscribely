import React, { useRef } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

/**
 * Component that tracks user activity and resets the inactivity timer
 * on any touch interaction. Wraps the app content to capture all touches.
 */
interface ActivityTrackerProps {
  children: React.ReactNode;
}

export default function ActivityTracker({ children }: ActivityTrackerProps) {
  const { user, resetInactivityTimer } = useAuth();
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // Reset inactivity timer on any touch start
        if (user) {
          resetInactivityTimer();
        }
        // Return false to allow child components to handle the touch
        return false;
      },
      onMoveShouldSetPanResponder: () => {
        // Reset inactivity timer on any touch move (scroll, drag, etc.)
        if (user) {
          resetInactivityTimer();
        }
        // Return false to allow child components to handle the touch
        return false;
      },
    })
  ).current;

  // Only track activity when user is authenticated
  if (!user) {
    return <>{children}</>;
  }

  return (
    <View 
      style={styles.container} 
      {...panResponder.panHandlers}
      pointerEvents="box-none"
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

