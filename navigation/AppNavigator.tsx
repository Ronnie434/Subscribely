import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef, useNavigationState, useNavigation } from '@react-navigation/native';
import {
  createStackNavigator,
  CardStyleInterpolators,
  TransitionSpecs,
  StackNavigationOptions
} from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Linking, Platform, TouchableOpacity, Text, StyleSheet } from 'react-native';
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
  PaymentScreen: { plan: 'monthly' | 'yearly'; origin?: 'Settings' | 'Home' };
  SubscriptionManagement: undefined;
};

type StatsStackParamList = {
  StatsHome: undefined;
};

type SettingsStackParamList = {
  SettingsHome: undefined;
  SubscriptionManagement: undefined;
  PlanSelection: undefined;
  PaymentScreen: { plan: 'monthly' | 'yearly'; origin?: 'Settings' | 'Home' };
};

type MainStackParamList = {
  Subscriptions: undefined;
  Stats: undefined;
  Settings: undefined;
};

const AuthStack = createStackNavigator<AuthStackParamList>();
const SubscriptionsStack = createStackNavigator<SubscriptionsStackParamList>();
const StatsStack = createStackNavigator<StatsStackParamList>();
const SettingsStack = createStackNavigator<SettingsStackParamList>();
const MainStack = createStackNavigator<MainStackParamList>();

// Modern transition configuration for stack navigators
const modernTransitionConfig: StackNavigationOptions = {
  // Use platform-specific animations
  cardStyleInterpolator: Platform.OS === 'ios'
    ? CardStyleInterpolators.forHorizontalIOS
    : CardStyleInterpolators.forFadeFromCenter,
  
  // Smooth transition timing
  transitionSpec: {
    open: TransitionSpecs.TransitionIOSSpec,
    close: TransitionSpecs.TransitionIOSSpec,
  },
  
  // Enable gesture handling for iOS-style swipe back
  gestureEnabled: true,
  gestureDirection: 'horizontal',
};

// Tab transition configuration - slide animations for tab switching
const tabSlideTransitionConfig: StackNavigationOptions = {
  // Use horizontal slide for tab switching
  cardStyleInterpolator: Platform.OS === 'ios'
    ? CardStyleInterpolators.forHorizontalIOS
    : CardStyleInterpolators.forHorizontalIOS, // Use iOS style on both platforms for consistent sliding
  
  transitionSpec: {
    open: TransitionSpecs.TransitionIOSSpec,
    close: TransitionSpecs.TransitionIOSSpec,
  },
  
  // Disable gesture for tabs to prevent accidental swipes
  gestureEnabled: false,
};

// Tab transition configuration - faster, smoother transitions for tab switching
const tabTransitionConfig: StackNavigationOptions = {
  // Use a faster fade transition for tabs
  cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 250,
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 200,
      },
    },
  },
};

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
        ...modernTransitionConfig,
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
        // Use faster tab transition config for the root screen
        ...tabTransitionConfig,
      }}>
      <SubscriptionsStack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          headerShown: true,
          headerLeft: () => null,  // Remove back button
        }}
      />
      <SubscriptionsStack.Screen
        name="AddSubscription"
        component={AddSubscriptionScreen}
        options={{
          title: 'Add Recurring Item',
          headerShown: true,
          // Use modern transitions for modal-like screens
          ...modernTransitionConfig,
        }}
      />
      <SubscriptionsStack.Screen
        name="EditSubscription"
        component={EditSubscriptionScreen}
        options={{
          title: 'Edit Recurring Item',
          headerShown: true,
          ...modernTransitionConfig,
        }}
      />
      <SubscriptionsStack.Screen
        name="PlanSelection"
        component={PlanSelectionScreen}
        options={{
          title: 'Choose Your Plan',
          headerShown: true,
          ...modernTransitionConfig,
        }}
      />
      <SubscriptionsStack.Screen
        name="PaymentScreen"
        component={PaymentScreen}
        options={{
          title: 'Complete Payment',
          headerShown: true,
          ...modernTransitionConfig,
        }}
      />
      <SubscriptionsStack.Screen
        name="SubscriptionManagement"
        component={SubscriptionManagementScreen}
        options={{
          title: 'Manage Plan',
          headerShown: true,
          ...modernTransitionConfig,
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
        // Use faster tab transition config
        ...tabTransitionConfig,
      }}>
      <StatsStack.Screen
        name="StatsHome"
        component={StatsScreen}
        options={{
          title: 'Statistics',
          headerShown: true,
          headerLeft: () => null,  // Remove back button
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
        // Use faster tab transition config
        ...tabTransitionConfig,
      }}>
      <SettingsStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerShown: true,
          headerLeft: () => null,  // Remove back button
        }}
      />
      <SettingsStack.Screen
        name="SubscriptionManagement"
        component={SubscriptionManagementScreen}
        options={{
          title: 'Manage Plan',
          headerShown: true,
          ...modernTransitionConfig
        }}
      />
      <SettingsStack.Screen
        name="PlanSelection"
        component={PlanSelectionScreen}
        options={{
          title: 'Choose Your Plan',
          headerShown: true,
          ...modernTransitionConfig
        }}
      />
      <SettingsStack.Screen
        name="PaymentScreen"
        component={PaymentScreen}
        options={{
          title: 'Complete Payment',
          headerShown: true,
          ...modernTransitionConfig,
        }}
      />
    </SettingsStack.Navigator>
  );
}

// Custom Tab Bar Component
function CustomTabBar() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  
  // Get current route name
  const currentRoute = useNavigationState(state => {
    if (!state) return 'Subscriptions';
    const route = state.routes[state.index];
    return route.name;
  });

  const tabs = [
    { name: 'Subscriptions', label: 'Home', icon: 'list' as const },
    { name: 'Stats', label: 'Stats', icon: 'stats-chart' as const },
    { name: 'Settings', label: 'Settings', icon: 'settings' as const },
  ];

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          height: 60 + (insets.bottom > 0 ? insets.bottom : 8),
        },
      ]}>
      {tabs.map((tab) => {
        const isActive = currentRoute === tab.name;
        const color = isActive ? theme.colors.primary : theme.colors.textSecondary;

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabButton}
            onPress={() => {
              if (tab.name === 'Subscriptions') {
                // Reset to Home screen when Items tab is pressed
                navigation.navigate('Subscriptions', { screen: 'Home' });
              } else {
                navigation.navigate(tab.name);
              }
            }}
            activeOpacity={0.7}>
            <Ionicons name={tab.icon} size={24} color={color} />
            <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});

// Main Stack Navigator with Custom Tab Bar
function MainNavigator() {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <MainStack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: {
            backgroundColor: theme.colors.background,
          },
          ...tabSlideTransitionConfig,
        }}>
        <MainStack.Screen name="Subscriptions" component={SubscriptionsNavigator} />
        <MainStack.Screen name="Stats" component={StatsNavigator} />
        <MainStack.Screen name="Settings" component={SettingsNavigator} />
      </MainStack.Navigator>
      <CustomTabBar />
    </View>
  );
}

export default function AppNavigator() {
  const { theme } = useTheme();
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
        // Navigate to Login if user just completed onboarding
        <AuthNavigator
          key="auth-navigator"
          initialRoute={justCompletedOnboarding ? 'Login' : 'Login'}
        />
      ) : (
        // Show main app if user is authenticated AND has a valid session
        <MainNavigator />
      )}
    </NavigationContainer>
  );
}