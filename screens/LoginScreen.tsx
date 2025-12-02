import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import OAuthButton from '../components/OAuthButton';
import { useAuth } from '../contexts/AuthContext';

interface LoginScreenProps {
  // Props are optional now since we use useNavigation
  onNavigateToSignUp?: () => void;
}

export default function LoginScreen({
  onNavigateToSignUp
}: LoginScreenProps) {
  const { theme } = useTheme();
  const { signInWithGoogle, signInWithApple, loading: authLoading } = useAuth();
  const navigation = useNavigation<any>();
  
  // Use React Navigation's navigate function, fallback to prop if provided
  const navigateToSignUp = () => {
    if (__DEV__) {
      console.log('[LoginScreen] navigateToSignUp called');
    }
    try {
      if (navigation?.navigate) {
        if (__DEV__) {
          console.log('[LoginScreen] Using React Navigation to navigate to SignUp');
        }
        navigation.navigate('SignUp');
      } else if (onNavigateToSignUp) {
        if (__DEV__) {
          console.log('[LoginScreen] Using prop callback to navigate');
        }
        onNavigateToSignUp();
      } else {
        if (__DEV__) {
          console.error('[LoginScreen] No navigation method available!');
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[LoginScreen] Navigation error:', error);
      }
    }
  };
  
  const navigateToEmailLogin = () => {
    if (__DEV__) {
      console.log('[LoginScreen] navigateToEmailLogin called');
    }
    try {
      if (navigation?.navigate) {
        if (__DEV__) {
          console.log('[LoginScreen] Using React Navigation to navigate to EmailLogin');
        }
        navigation.navigate('EmailLogin');
      } else {
        if (__DEV__) {
          console.error('[LoginScreen] No navigation method available!');
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[LoginScreen] Navigation error:', error);
      }
    }
  };
  
  const [oauthLoading, setOAuthLoading] = useState<'google' | 'apple' | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Preload logo image to prevent flickering
  useEffect(() => {
    // For local assets, they should be available immediately from the bundle
    // Set loaded to true after a minimal delay to ensure smooth rendering
    const timer = setTimeout(() => {
      setLogoLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleGoogleSignIn = async () => {
    setOAuthLoading('google');

    try {
      const response = await signInWithGoogle();

      if (response.success) {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        // Navigation handled by AuthContext state change
      } else {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        // Only show alert if not cancelled
        if (response.message !== 'Sign in cancelled') {
          Alert.alert('Google Sign In Failed', response.message || 'Please try again.');
        }
      }
    } catch (error) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setOAuthLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    setOAuthLoading('apple');

    try {
      const response = await signInWithApple();

      if (response.success) {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        // Navigation handled by AuthContext state change
      } else {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        // Only show alert if not cancelled
        if (response.message !== 'Sign in cancelled') {
          Alert.alert('Apple Sign In Failed', response.message || 'Please try again.');
        }
      }
    } catch (error) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setOAuthLoading(null);
    }
  };

  const isProcessing = authLoading || oauthLoading !== null;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: 120,
      paddingBottom: 40,
    },
    header: {
      alignItems: 'center',
      marginBottom: theme.spacing.xxl,
    },
    logoContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    logoImage: {
      width: 100,
      height: 100,
      borderRadius: 18,
      resizeMode: 'contain' as const,
    },
    appName: {
      fontSize: 36,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
      lineHeight: 44,
    },
    tagline: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      lineHeight: 22,
    },
    formContainer: {
      flex: 1,
      paddingTop: theme.spacing.lg,
    },
    continueWithEmailButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 26,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: theme.spacing.lg,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    continueWithEmailButtonDisabled: {
      opacity: 0.6,
    },
    continueWithEmailButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    footer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: theme.spacing.xl,
    },
    footerButton: {
      paddingVertical: theme.spacing.sm,
    },
    footerText: {
      color: theme.colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: theme.spacing.lg,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      marginHorizontal: theme.spacing.md,
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Logo and Branding */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/app-logo.png')}
              style={[styles.logoImage, !logoLoaded && { opacity: 0 }]}
              resizeMode="contain"
              onLoad={() => setLogoLoaded(true)}
              fadeDuration={0}
            />
          </View>
          <Text style={styles.appName}>Renvo</Text>
          {/* <Text style={styles.tagline}>Know every charge before it hits</Text> */}
          <Text style={styles.tagline}>Take control of your charges</Text>
        </View>

        {/* OAuth Buttons */}
        <View style={styles.formContainer}>
          <OAuthButton
            provider="apple"
            onPress={handleAppleSignIn}
            disabled={isProcessing}
            loading={oauthLoading === 'apple'}
          />
          
          <OAuthButton
            provider="google"
            onPress={handleGoogleSignIn}
            disabled={isProcessing}
            loading={oauthLoading === 'google'}
          />

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Continue with Email Button */}
          <TouchableOpacity
            style={[styles.continueWithEmailButton, isProcessing && styles.continueWithEmailButtonDisabled]}
            onPress={navigateToSignUp}
            disabled={isProcessing}
            activeOpacity={0.8}>
            <Text style={styles.continueWithEmailButtonText}>Continue with Email</Text>
          </TouchableOpacity>

          {/* Already have account link */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.footerButton}
              onPress={navigateToEmailLogin}
              disabled={isProcessing}
              activeOpacity={0.7}>
              <Text style={styles.footerText}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}