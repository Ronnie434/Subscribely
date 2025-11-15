import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Image } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import ActivityTracker from './components/ActivityTracker';
import * as Notifications from 'expo-notifications';
import { requestNotificationPermissions } from './utils/notificationService';
// Import dev tools (only loads in development)
import './utils/devTools';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  // Preload app logo at startup to prevent flickering on auth screens
  React.useEffect(() => {
    const preloadLogo = () => {
      try {
        const logoSource = require('./assets/app-logo.png');
        const resolvedSource = Image.resolveAssetSource(logoSource);
        // Preload the image by creating a temporary Image component
        // This ensures the image is cached before screens need it
        if (resolvedSource?.uri) {
          Image.prefetch(resolvedSource.uri).catch(() => {
            // Ignore prefetch errors for local assets
          });
        }
      } catch (error) {
        // Ignore preload errors
        if (__DEV__) {
          console.warn('Failed to preload app logo:', error);
        }
      }
    };
    preloadLogo();
  }, []);

  // Initialize notifications
  React.useEffect(() => {
    // Request notification permissions on app start
    requestNotificationPermissions();
    
    // Set up notification response listener (when user taps notification)
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response.notification.request.content);
      // Navigation to specific subscription could be added here in the future
    });
    
    return () => subscription.remove();
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <ActivityTracker>
                <AppNavigator />
              </ActivityTracker>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

