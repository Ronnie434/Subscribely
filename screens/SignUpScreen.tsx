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

interface SignUpScreenProps {
  onNavigateToSignIn: () => void;
}

// Helper functions
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
  if (password.length < 6) return 'weak';
  if (password.length < 10) return 'medium';
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const strengthScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
  
  if (strengthScore >= 3) return 'strong';
  return 'medium';
};

export default function SignUpScreen({ onNavigateToSignIn }: SignUpScreenProps) {
  const { signUp, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const passwordStrength = password ? getPasswordStrength(password) : null;

  const getStrengthColor = () => {
    if (!passwordStrength) return theme.colors.border;
    switch (passwordStrength) {
      case 'weak':
        return theme.colors.error;
      case 'medium':
        return '#FFA500';
      case 'strong':
        return '#00C853';
      default:
        return theme.colors.border;
    }
  };

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');

    // Validate name
    if (!name.trim()) {
      setNameError('Name is required');
      isValid = false;
    }

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
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      isValid = false;
    }

    // Validate confirm password
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }

    return isValid;
  };

  const handleSignUp = async () => {
    if (!validateForm()) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    setIsLoading(true);

    try {
      const response = await signUp(email.trim(), password, name.trim());

      if (response.success) {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        // Check if email confirmation is required
        if (response.message?.includes('email')) {
          Alert.alert(
            'Account Created',
            response.message,
            [{ text: 'OK', onPress: onNavigateToSignIn }]
          );
        } else {
          // Auto-signed in, navigation handled by AuthContext
        }
      } else {
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert('Sign Up Failed', response.message || 'Please try again.');
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
            <Ionicons name="trending-up" size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>SubTrack</Text>
          <Text style={styles.tagline}>Track your subscriptions smartly</Text>
        </View>

        {/* Sign Up Form */}
        <View style={styles.formContainer}>
          <AuthInput
            value={name}
            onChangeText={(text) => {
              setName(text);
              setNameError('');
            }}
            placeholder="Name"
            autoCapitalize="words"
            autoComplete="name"
            error={nameError}
            editable={!isProcessing}
          />

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

          <AuthInput
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setPasswordError('');
            }}
            placeholder="Password"
            secureTextEntry
            autoComplete="password"
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
                    passwordStrength === 'medium' || passwordStrength === 'strong'
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
            }}
            placeholder="Confirm Password"
            secureTextEntry
            autoComplete="password"
            error={confirmPasswordError}
            editable={!isProcessing}
          />

          <TouchableOpacity
            style={[styles.createButton, isProcessing && styles.createButtonDisabled]}
            onPress={handleSignUp}
            disabled={isProcessing}
            activeOpacity={0.8}>
            {isProcessing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.createButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Sign In Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={onNavigateToSignIn}
              disabled={isProcessing}
              activeOpacity={0.7}>
              <Text style={styles.signInLink}>Sign In</Text>
            </TouchableOpacity>
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
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  tagline: {
    fontSize: 16,
    color: '#8E8E93',
  },
  formContainer: {
    flex: 1,
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
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
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
});