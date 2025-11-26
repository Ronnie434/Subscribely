import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import AuthInput from '../components/AuthInput';
import { useAuth } from '../contexts/AuthContext';

interface LoginScreenProps {
  // Props are optional now since we use useNavigation
  onNavigateToSignUp?: () => void;
  onNavigateToForgotPassword?: () => void;
}

export default function LoginScreen({
  onNavigateToSignUp,
  onNavigateToForgotPassword
}: LoginScreenProps) {
  const { theme } = useTheme();
  const { signIn, loading: authLoading } = useAuth();
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
  
  const navigateToForgotPassword = () => {
    if (__DEV__) {
      console.log('[LoginScreen] navigateToForgotPassword called');
    }
    try {
      if (navigation?.navigate) {
        if (__DEV__) {
          console.log('[LoginScreen] Using React Navigation to navigate to ForgotPassword');
        }
        navigation.navigate('ForgotPassword');
      } else if (onNavigateToForgotPassword) {
        if (__DEV__) {
          console.log('[LoginScreen] Using prop callback to navigate');
        }
        onNavigateToForgotPassword();
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setEmailError('');
    setPasswordError('');

    // Validate email
    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    // Validate password
    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    return isValid;
  };

  const handleSignIn = async () => {
    if (!validateForm()) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    setIsLoading(true);

    try {
      const response = await signIn(email.trim(), password);

      if (response.success) {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        // Navigation handled by AuthContext state change
      } else {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert('Sign In Failed', response.message || 'Please check your credentials and try again.');
      }
    } catch (error) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isProcessing = isLoading || authLoading;

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
      width: 120,
      height: 120,
      borderRadius: 21.5,
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
    forgotPasswordButton: {
      alignSelf: 'flex-end',
      marginTop: -theme.spacing.xs,
      marginBottom: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    forgotPasswordText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    signInButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 26,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: theme.spacing.md,
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
    signInButtonDisabled: {
      opacity: 0.6,
    },
    signInButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: theme.spacing.xl,
    },
    footerText: {
      color: theme.colors.text,
      fontSize: 16,
    },
    signUpLink: {
      color: theme.colors.primary,
      fontSize: 16,
      fontWeight: '600',
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

        {/* Sign In Form */}
        <View style={styles.formContainer}>
          <AuthInput
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError('');
            }}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            importantForAutofill="yes"
            error={emailError}
            editable={!isProcessing}
          />

          <AuthInput
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setPasswordError('');
            }}
            placeholder="Password"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            importantForAutofill="yes"
            error={passwordError}
            editable={!isProcessing}
          />

          {/* Forgot Password Link */}
          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={navigateToForgotPassword}
            disabled={isProcessing}
            activeOpacity={0.7}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signInButton, isProcessing && styles.signInButtonDisabled]}
            onPress={handleSignIn}
            disabled={isProcessing}
            activeOpacity={0.8}>
            {isProcessing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={navigateToSignUp}
              disabled={isProcessing}
              activeOpacity={0.7}>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}