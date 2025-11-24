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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import AuthInput from '../components/AuthInput';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';

type ResetPasswordRouteProp = RouteProp<
  {
    ResetPassword: {
      token?: string;
      access_token?: string;
      refresh_token?: string;
      type?: string;
    }
  },
  'ResetPassword'
>;

const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
  if (password.length < 6) return 'weak';
  if (password.length < 10) return 'medium';
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  return score >= 3 ? 'strong' : 'medium';
};

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const { updatePassword, loading: authLoading } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<ResetPasswordRouteProp>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tokenValidated, setTokenValidated] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recoveryTokens, setRecoveryTokens] = useState<{
    accessToken: string;
    refreshToken: string;
  } | null>(null);

  const passwordStrength = password ? getPasswordStrength(password) : null;
  const isProcessing = isLoading || authLoading;

  // Extract and validate recovery tokens from URL
  useEffect(() => {
    const validateRecoveryTokens = async () => {
      if (__DEV__) {
        console.log('[ResetPasswordScreen] === PASSWORD RESET DEBUG ===');
        console.log('[ResetPasswordScreen] Route params:', route.params);
        console.log('[ResetPasswordScreen] Available param keys:', route.params ? Object.keys(route.params) : 'no params');
      }
      
      // Extract tokens from route params
      const extractedAccessToken = route.params?.access_token;
      const refreshToken = route.params?.refresh_token;
      const type = route.params?.type;
      
      if (__DEV__) {
        console.log('[ResetPasswordScreen] Extracted tokens:', {
          hasAccessToken: !!extractedAccessToken,
          hasRefreshToken: !!refreshToken,
          type: type
        });
      }

      // Validate we have the required tokens
      if (!extractedAccessToken || !refreshToken) {
        if (__DEV__) {
          console.log('[ResetPasswordScreen] Missing required tokens');
        }
        setErrorMessage('Invalid or expired reset link. Please request a new one.');
        Alert.alert(
          'Invalid Reset Link',
          'This password reset link is invalid or has expired. Please request a new one.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('ForgotPassword'),
            },
          ]
        );
        return;
      }

      // Verify this is a recovery session
      if (type !== 'recovery') {
        if (__DEV__) {
          console.log('[ResetPasswordScreen] Invalid session type:', type);
        }
        setErrorMessage('Invalid reset link type.');
        Alert.alert(
          'Invalid Reset Link',
          'This link is not a valid password reset link. Please request a new one.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('ForgotPassword'),
            },
          ]
        );
        return;
      }

      if (__DEV__) {
        console.log('[ResetPasswordScreen] Tokens validated successfully - showing password form');
      }

      // Store tokens for later use during password update
      setRecoveryTokens({
        accessToken: extractedAccessToken,
        refreshToken: refreshToken,
      });
      setTokenValidated(true);
    };

    validateRecoveryTokens();
  }, [route.params, navigation]);

  const getStrengthColor = () => {
    if (!passwordStrength) return theme.colors.border;
    switch (passwordStrength) {
      case 'weak':
        return theme.colors.error;
      case 'medium':
        return '#FFA500';
      case 'strong':
        return '#00C853';
    }
  };

  const validateForm = (): boolean => {
    let isValid = true;

    setPasswordError('');
    setConfirmPasswordError('');
    setErrorMessage(null);

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }

    return isValid;
  };

  const handleResetPassword = async () => {
    if (!validateForm()) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    if (!recoveryTokens) {
      setErrorMessage('Invalid reset token. Please request a new password reset link.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (__DEV__) {
        console.log('[ResetPasswordScreen] Establishing recovery session for password update...');
      }

      // Step 1: Temporarily establish session with recovery tokens
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: recoveryTokens.accessToken,
        refresh_token: recoveryTokens.refreshToken,
      });

      if (sessionError) {
        if (__DEV__) {
          console.log('[ResetPasswordScreen] Session establishment failed:', sessionError);
        }
        throw sessionError;
      }

      if (__DEV__) {
        console.log('[ResetPasswordScreen] Session established, updating password...');
      }

      // Step 2: Update password using the established session
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        if (__DEV__) {
          console.log('[ResetPasswordScreen] Password update failed:', updateError);
        }
        throw updateError;
      }

      if (__DEV__) {
        console.log('[ResetPasswordScreen] Password updated successfully');
      }

      // Step 3: Sign out to clear the recovery session
      if (__DEV__) {
        console.log('[ResetPasswordScreen] Signing out to clear recovery session...');
      }
      await supabase.auth.signOut();
      
      if (__DEV__) {
        console.log('[ResetPasswordScreen] Signed out successfully');
      }

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setResetSuccess(true);
    } catch (error: any) {
      if (__DEV__) {
        console.log('[ResetPasswordScreen] Exception during password reset:', error);
      }
      
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      // Check for expired token error
      const errorMsg = error?.message || 'Failed to reset password';
      if (errorMsg.toLowerCase().includes('expired') || errorMsg.toLowerCase().includes('invalid')) {
        Alert.alert(
          'Link Expired',
          'This password reset link has expired. Please request a new one.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('ForgotPassword'),
            },
          ]
        );
      } else {
        setErrorMessage(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToLogin = () => {
    navigation.navigate('Login');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: 60,
      paddingBottom: 40,
    },
    header: {
      marginBottom: theme.spacing.xl,
    },
    backIconButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    content: {
      flex: 1,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#00000010',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
      lineHeight: 40,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      lineHeight: 24,
      marginBottom: theme.spacing.xxl,
    },
    formContainer: {
      paddingTop: theme.spacing.md,
    },
    strengthContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
      marginTop: -theme.spacing.xs,
    },
    strengthBars: {
      flexDirection: 'row',
      gap: 4,
      marginRight: theme.spacing.md,
    },
    strengthBar: {
      width: 40,
      height: 4,
      borderRadius: 2,
    },
    strengthText: {
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    errorBox: {
      backgroundColor: theme.colors.error + '15',
      borderRadius: 12,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.error + '30',
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 14,
      lineHeight: 20,
    },
    resetButton: {
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
    resetButtonDisabled: {
      opacity: 0.6,
    },
    resetButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    successContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing.xxl,
    },
    successIconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#00000010',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    successTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
      textAlign: 'center',
      lineHeight: 34,
    },
    successMessage: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: theme.spacing.xxl,
      paddingHorizontal: theme.spacing.md,
    },
    continueButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 26,
      paddingVertical: 16,
      paddingHorizontal: 48,
      alignItems: 'center',
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
    continueButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });

  // Show success state
  if (resetSuccess) {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.successContainer}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={64} color={theme.colors.primary} />
            </View>
            <Text style={styles.successTitle}>Password Reset!</Text>
            <Text style={styles.successMessage}>
              Your password has been successfully reset. You can now sign in with your new password.
            </Text>
            
            <TouchableOpacity
              style={styles.continueButton}
              onPress={navigateToLogin}
              activeOpacity={0.8}>
              <Text style={styles.continueButtonText}>Continue to Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Don't show form until token is validated
  if (!tokenValidated) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={navigateToLogin}
            disabled={isProcessing}
            activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="key-outline" size={48} color={theme.colors.primary} />
          </View>
          
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Please enter your new password. Make sure it's strong and secure.
          </Text>

          {/* Error Message */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.formContainer}>
            <AuthInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError('');
                setErrorMessage(null);
              }}
              placeholder="New Password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              error={passwordError}
              editable={!isProcessing}
            />

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBars}>
                  <View
                    style={[
                      styles.strengthBar,
                      { backgroundColor: getStrengthColor() },
                    ]}
                  />
                  <View
                    style={[
                      styles.strengthBar,
                      passwordStrength !== 'weak'
                        ? { backgroundColor: getStrengthColor() }
                        : { backgroundColor: theme.colors.border },
                    ]}
                  />
                  <View
                    style={[
                      styles.strengthBar,
                      passwordStrength === 'strong'
                        ? { backgroundColor: getStrengthColor() }
                        : { backgroundColor: theme.colors.border },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthText, { color: getStrengthColor() }]}>
                  {passwordStrength === 'weak' && 'Weak'}
                  {passwordStrength === 'medium' && 'Medium'}
                  {passwordStrength === 'strong' && 'Strong'}
                </Text>
              </View>
            )}

            <AuthInput
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setConfirmPasswordError('');
                setErrorMessage(null);
              }}
              placeholder="Confirm New Password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              error={confirmPasswordError}
              editable={!isProcessing}
            />

            <TouchableOpacity
              style={[styles.resetButton, isProcessing && styles.resetButtonDisabled]}
              onPress={handleResetPassword}
              disabled={isProcessing}
              activeOpacity={0.8}>
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.resetButtonText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}