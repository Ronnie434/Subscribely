import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Image, Linking } from 'react-native';
import { StripeProvider } from '@stripe/stripe-react-native';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import * as Notifications from 'expo-notifications';
import { requestNotificationPermissions } from './utils/notificationService';
import { checkAndHandleTimezoneChange } from './utils/timezoneService';
import { stripeConfig } from './config/stripe';
import { initializeDomainDiscovery } from './utils/domainHelpers';
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

  // Initialize app services
  React.useEffect(() => {
    const initializeServices = async () => {
      // Initialize domain discovery service (loads cache into memory)
      try {
        await initializeDomainDiscovery();
        console.log('[App] Domain discovery service initialized');
      } catch (error) {
        console.error('[App] Error initializing domain discovery:', error);
      }

      // Request notification permissions on app start
      await requestNotificationPermissions();
      
      // Check and handle timezone changes after permissions are granted
      try {
        await checkAndHandleTimezoneChange();
      } catch (error) {
        console.error('Error checking timezone:', error);
      }
    };
    
    initializeServices();
    
    // Set up notification response listener (when user taps notification)
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response.notification.request.content);
      // Navigation to specific subscription could be added here in the future
    });
    
    return () => subscription.remove();
  }, []);

  // Handle deep links for password reset
  React.useEffect(() => {
    // Handle deep links when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (__DEV__) {
        console.log('[App] Deep link received:', url);
        // Log URL components for debugging
        try {
          const urlObj = new URL(url);
          console.log('[App] Deep link details:', {
            protocol: urlObj.protocol,
            host: urlObj.host,
            pathname: urlObj.pathname,
            search: urlObj.search,
            hash: urlObj.hash,
            fullURL: url
          });
        } catch (e) {
          console.log('[App] Could not parse URL:', e);
        }
      }
      // Deep link routing is handled by NavigationContainer's linking config
    });

    // Handle deep link that opened the app
    Linking.getInitialURL().then((url) => {
      if (url && __DEV__) {
        console.log('[App] Initial URL:', url);
        // Log URL components for debugging
        try {
          const urlObj = new URL(url);
          console.log('[App] Initial URL details:', {
            protocol: urlObj.protocol,
            host: urlObj.host,
            pathname: urlObj.pathname,
            search: urlObj.search,
            hash: urlObj.hash,
            fullURL: url
          });
        } catch (e) {
          console.log('[App] Could not parse initial URL:', e);
        }
      }
      // Deep link routing is handled by NavigationContainer's linking config
    });

    return () => subscription.remove();
  }, []);

  return (
    <ErrorBoundary>
      <StripeProvider
        publishableKey={stripeConfig.publishableKey}
        merchantIdentifier={stripeConfig.merchantIdentifier}
        urlScheme={stripeConfig.urlScheme}>
        <GestureHandlerRootView style={styles.container}>
          <SafeAreaProvider>
            <ThemeProvider>
              <AuthProvider>
                <AppNavigator />
              </AuthProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </StripeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});