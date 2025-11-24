import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Linking } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Subscription } from '../types';
import { hasSeenOnboarding } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import AddSubscriptionScreen from '../screens/AddSubscriptionScreen';
import EditSubscriptionScreen from '../screens/EditSubscriptionScreen';
import StatsScreen from '../screens/StatsScreen';
import PlanSelectionScreen from '../screens/PlanSelectionScreen';
import PaymentScreen from '../screens/PaymentScreen';
import SubscriptionManagementScreen from '../screens/SubscriptionManagementScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Type definitions for navigation
type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string; access_token?: string };
};

type SubscriptionsStackParamList = {
  Home: undefined;
  AddSubscription: { subscription?: Subscription };
  EditSubscription: { subscription: Subscription };
  PlanSelection: undefined;
  PaymentScreen: { plan: 'monthly' | 'yearly' };
  SubscriptionManagement: undefined;
};

type StatsStackParamList = {
  StatsHome: undefined;
};

type SettingsStackParamList = {
  SettingsHome: undefined;
};

type RootTabParamList = {
  Subscriptions: undefined;
  Stats: undefined;
  Settings: undefined;
};

const AuthStack = createStackNavigator<AuthStackParamList>();
const SubscriptionsStack = createStackNavigator<SubscriptionsStackParamList>();
const StatsStack = createStackNavigator<StatsStackParamList>();
const SettingsStack = createStackNavigator<SettingsStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

function AuthNavigator({ initialRoute = 'Login' }: { initialRoute?: 'Login' | 'SignUp' }) {
  const { theme } = useTheme();
  
  if (__DEV__) {
    console.log('[AuthNavigator] Rendering AuthStack Navigator');
  }

  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
      initialRouteName={initialRoute}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function SubscriptionsNavigator() {
  const { theme } = useTheme();
  
  return (
    <SubscriptionsStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerBackTitleVisible: false,
        cardStyle: {
          backgroundColor: theme.colors.background,
        },
      }}>
      <SubscriptionsStack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Subscriptions',
        }}
      />
      <SubscriptionsStack.Screen
        name="AddSubscription"
        component={AddSubscriptionScreen}
        options={{
          title: 'Add Subscription',
          headerShown: true,
        }}
      />
      <SubscriptionsStack.Screen
        name="EditSubscription"
        component={EditSubscriptionScreen}
        options={{
          title: 'Edit Subscription',
          headerShown: true,
        }}
      />
      <SubscriptionsStack.Screen
        name="PlanSelection"
        component={PlanSelectionScreen}
        options={{
          title: 'Choose Your Plan',
          headerShown: true,
        }}
      />
      <SubscriptionsStack.Screen
        name="PaymentScreen"
        component={PaymentScreen}
        options={{
          title: 'Complete Payment',
          headerShown: true,
        }}
      />
      <SubscriptionsStack.Screen
        name="SubscriptionManagement"
        component={SubscriptionManagementScreen}
        options={{
          title: 'Manage Subscription',
          headerShown: true,
        }}
      />
    </SubscriptionsStack.Navigator>
  );
}

function StatsNavigator() {
  const { theme } = useTheme();
  
  return (
    <StatsStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerBackTitleVisible: false,
        cardStyle: {
          backgroundColor: theme.colors.background,
        },
      }}>
      <StatsStack.Screen
        name="StatsHome"
        component={StatsScreen}
        options={{
          title: 'Statistics',
        }}
      />
    </StatsStack.Navigator>
  );
}

function SettingsNavigator() {
  const { theme } = useTheme();
  
  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerBackTitleVisible: false,
        cardStyle: {
          backgroundColor: theme.colors.background,
        },
      }}>
      <SettingsStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
    </SettingsStack.Navigator>
  );
}

export default function AppNavigator() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, session, loading: authLoading, resetInactivityTimer, error, clearError, isHandlingDuplicate } = useAuth();
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [justCompletedOnboarding, setJustCompletedOnboarding] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  // Clear errors when user is logged out (on login screen)
  useEffect(() => {
    if (!user && error) {
      // Clear any errors when showing login screen
      clearError();
    }
  }, [user, error, clearError]);

  // Handle navigation state changes to reset inactivity timer
  const handleNavigationStateChange = () => {
    if (user) {
      // Reset inactivity timer on any navigation event when user is authenticated
      resetInactivityTimer();
    }
  };

  const checkOnboardingStatus = async () => {
    try {
      const hasCompleted = await hasSeenOnboarding();
      setShowOnboarding(!hasCompleted);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setShowOnboarding(true);
    } finally {
      setIsCheckingOnboarding(false);
    }
  };

  const handleOnboardingComplete = () => {
    setJustCompletedOnboarding(true);
    setShowOnboarding(false);
  };

  // Reset the flag after navigation is complete
  useEffect(() => {
    if (justCompletedOnboarding && !showOnboarding) {
      // Reset after a brief delay to ensure navigation has completed
      const timer = setTimeout(() => {
        setJustCompletedOnboarding(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [justCompletedOnboarding, showOnboarding]);

  // Show loading indicator while checking auth or onboarding status
  if (isCheckingOnboarding || authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Use a single NavigationContainer to preserve navigation state
  // This prevents remounting when switching between auth and main app
  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={handleNavigationStateChange}
      linking={{
        prefixes: ['renvo://'],
        config: {
          screens: {
            ResetPassword: {
              path: 'reset-password',
              parse: {
                // Parse all URL parameters (both query and hash)
                access_token: (access_token: string) => {
                  if (__DEV__) {
                    console.log('[AppNavigator] Parsing access_token:', access_token ? 'present' : 'missing');
                  }
                  return access_token;
                },
                refresh_token: (refresh_token: string) => refresh_token,
                type: (type: string) => type,
                token: (token: string) => token,
              },
            },
          },
        },
        // Custom URL subscriber to handle hash fragments
        subscribe(listener) {
          const onReceiveURL = ({ url }: { url: string }) => {
            if (__DEV__) {
              console.log('[AppNavigator] Deep link received in subscriber:', url);
            }
            
            // Parse hash fragment if present (Supabase sends tokens in hash)
            try {
              const urlObj = new URL(url);
              let finalUrl = url;
              
              // If URL has a hash fragment, convert it to query params
              if (urlObj.hash && urlObj.hash.length > 1) {
                if (__DEV__) {
                  console.log('[AppNavigator] Found hash fragment:', urlObj.hash);
                }
                
                // Remove the # and parse as query string
                const hashParams = urlObj.hash.substring(1);
                
                // If the URL already has query params, append with &, otherwise use ?
                const separator = urlObj.search ? '&' : '?';
                finalUrl = url.replace(urlObj.hash, '') + separator + hashParams;
                
                if (__DEV__) {
                  console.log('[AppNavigator] Converted URL:', finalUrl);
                }
              }
              
              listener(finalUrl);
            } catch (e) {
              if (__DEV__) {
                console.log('[AppNavigator] Error parsing URL:', e);
              }
              listener(url);
            }
          };

          // Subscribe to linking events
          const subscription = Linking.addEventListener('url', onReceiveURL);

          return () => {
            subscription.remove();
          };
        },
      }}>
      {showOnboarding ? (
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      ) : (!user || !session || isHandlingDuplicate) ? (
        // Show auth screens if user is not authenticated OR if there's no session
        // OR if we're handling a duplicate email (to prevent navigation reset)
        // This handles the case where a duplicate user is created but has no valid session
        // Use a stable key to prevent remounting when isHandlingDuplicate changes
        // Navigate to SignUp if user just completed onboarding
        <AuthNavigator 
          key="auth-navigator" 
          initialRoute={justCompletedOnboarding ? 'SignUp' : 'Login'}
        />
      ) : (
        // Show main app if user is authenticated AND has a valid session
        <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Subscriptions') {
              iconName = 'list';
            } else if (route.name === 'Stats') {
              iconName = 'stats-chart';
            } else if (route.name === 'Settings') {
              iconName = 'settings';
            } else {
              iconName = 'help';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.colors.card,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
            paddingTop: 8,
            height: 60 + (insets.bottom > 0 ? insets.bottom : 8),
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
          headerShown: false,
        })}>
        <Tab.Screen
          name="Subscriptions"
          component={SubscriptionsNavigator}
          options={{
            tabBarLabel: 'Subscriptions',
          }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              // Reset to Home screen when tab is pressed
              navigation.navigate('Subscriptions', { screen: 'Home' });
            },
          })}
        />
        <Tab.Screen
          name="Stats"
          component={StatsNavigator}
          options={{
            tabBarLabel: 'Stats',
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsNavigator}
          options={{
            tabBarLabel: 'Settings',
          }}
        />
      </Tab.Navigator>
      )}
    </NavigationContainer>
  );
}