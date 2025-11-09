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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import AuthInput from '../components/AuthInput';
import { useAuth } from '../contexts/AuthContext';

interface ForgotPasswordScreenProps {
  onNavigateToSignIn: () => void;
}

export default function ForgotPasswordScreen({ onNavigateToSignIn }: ForgotPasswordScreenProps) {
  const { resetPassword, loading: authLoading } = useAuth();
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
        setEmailSent(true);
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
              onPress={onNavigateToSignIn}
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
            onPress={onNavigateToSignIn}
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
                onPress={onNavigateToSignIn}
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
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
    marginBottom: theme.spacing.xxl,
  },
  formContainer: {
    paddingTop: theme.spacing.md,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  // Success state styles
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
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
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
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.md,
  },
  backButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});