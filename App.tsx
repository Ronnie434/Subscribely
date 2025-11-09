import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { theme } from './constants/theme';
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
  }),
});

export default function App() {
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
          <AuthProvider>
            <StatusBar style="auto" />
            <AppNavigator />
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});

