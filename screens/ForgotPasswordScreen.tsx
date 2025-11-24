import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import AuthInput from '../components/AuthInput';
import { useAuth } from '../contexts/AuthContext';

interface ForgotPasswordScreenProps {
  // Props are optional now since we use useNavigation
  onNavigateToSignIn?: () => void;
}

export default function ForgotPasswordScreen({ onNavigateToSignIn }: ForgotPasswordScreenProps) {
  const { theme } = useTheme();
  const { resetPassword, loading: authLoading } = useAuth();
  const navigation = useNavigation<any>();
  
  // Use React Navigation's navigate function, fallback to prop if provided
  const navigateToSignIn = () => {
    if (__DEV__) {
      console.log('[ForgotPasswordScreen] navigateToSignIn called');
    }
    try {
      if (navigation?.navigate) {
        if (__DEV__) {
          console.log('[ForgotPasswordScreen] Using React Navigation to navigate to Login');
        }
        navigation.navigate('Login');
      } else if (onNavigateToSignIn) {
        if (__DEV__) {
          console.log('[ForgotPasswordScreen] Using prop callback to navigate');
        }
        onNavigateToSignIn();
      } else {
        if (__DEV__) {
          console.error('[ForgotPasswordScreen] No navigation method available!');
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[ForgotPasswordScreen] Navigation error:', error);
      }
    }
  };
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const validateForm = (): boolean => {
    setEmailError('');

    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }
    
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleResetPassword = async () => {
    if (!validateForm()) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    setIsLoading(true);

    try {
      const response = await resetPassword(email.trim());

      if (response.success) {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        // Show confirmation alert with user's email
        Alert.alert(
          'Reset Link Sent! ✓',
          `A password reset link has been sent to ${email.trim()}.\n\nPlease check your email and follow the instructions to reset your password.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setEmailSent(true);
              },
            },
          ]
        );
      } else {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert('Error', response.message || 'Failed to send reset email. Please try again.');
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
    sendButton: {
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
    sendButtonDisabled: {
      opacity: 0.6,
    },
    sendButtonText: {
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
    signInLink: {
      color: theme.colors.primary,
      fontSize: 16,
      fontWeight: '600',
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
      marginBottom: theme.spacing.lg,
    },
    emailText: {
      color: theme.colors.text,
      fontWeight: '600',
    },
    successSubtext: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: theme.spacing.xxl,
      paddingHorizontal: theme.spacing.md,
      opacity: 0.8,
    },
    backButton: {
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
    backButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });

  if (emailSent) {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.successContainer}>
            <View style={styles.successIconContainer}>
              <Ionicons name="mail-outline" size={64} color={theme.colors.primary} />
            </View>
            <Text style={styles.successTitle}>Check Your Email</Text>
            <Text style={styles.successMessage}>
              We've sent password reset instructions to{'\n'}
              <Text style={styles.emailText}>{email}</Text>
            </Text>
            <Text style={styles.successSubtext}>
              Please check your inbox and follow the link to reset your password.
            </Text>
            
            <TouchableOpacity
              style={styles.backButton}
              onPress={navigateToSignIn}
              activeOpacity={0.8}>
              <Text style={styles.backButtonText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
            onPress={navigateToSignIn}
            disabled={isProcessing}
            activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed-outline" size={48} color={theme.colors.primary} />
          </View>
          
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            No worries! Enter your email address and we'll send you instructions to reset your password.
          </Text>

          {/* Form */}
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
              error={emailError}
              editable={!isProcessing}
            />

            <TouchableOpacity
              style={[styles.sendButton, isProcessing && styles.sendButtonDisabled]}
              onPress={handleResetPassword}
              disabled={isProcessing}
              activeOpacity={0.8}>
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.sendButtonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>

            {/* Back to Sign In */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Remember your password? </Text>
              <TouchableOpacity
                onPress={navigateToSignIn}
                disabled={isProcessing}
                activeOpacity={0.7}>
                <Text style={styles.signInLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}