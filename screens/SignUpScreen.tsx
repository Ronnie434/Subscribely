import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import AuthInput from '../components/AuthInput';
import { useAuth } from '../contexts/AuthContext';

interface SignUpScreenProps { onNavigateToSignIn?: () => void; }

const validateEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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

export default function SignUpScreen({ onNavigateToSignIn }: SignUpScreenProps) {
  const { theme } = useTheme();
  const { signUp, loading: authLoading, isHandlingDuplicate, clearDuplicateFlag } = useAuth();
  const navigation = useNavigation<any>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Logo is preloaded at app startup, so it should be available immediately
  // No need for loading state since it's a local asset

  const passwordStrength = password ? getPasswordStrength(password) : null;
  const isProcessing = isLoading || authLoading;

  const getStrengthColor = () => {
    if (!passwordStrength) return theme.colors.border;
    switch (passwordStrength) {
      case 'weak': return theme.colors.error;
      case 'medium': return '#FFA500';
      case 'strong': return '#00C853';
    }
  };

  const navigateToSignIn = () => {
    if (isHandlingDuplicate) clearDuplicateFlag();
    if (navigation?.navigate) navigation.navigate('Login');
    else if (onNavigateToSignIn) onNavigateToSignIn();
  };

  const validateForm = (): boolean => {
    let valid = true;
    setNameError(''); setEmailError(''); setPasswordError(''); setConfirmPasswordError('');

    if (!name.trim()) { setNameError('Name is required'); valid = false; }
    if (!email.trim()) { setEmailError('Email is required'); valid = false; }
    else if (!validateEmail(email)) { setEmailError('Invalid email'); valid = false; }
    if (!password) { setPasswordError('Password is required'); valid = false; }
    else if (password.length < 8) { setPasswordError('Password must be at least 8 chars'); valid = false; }
    if (!confirmPassword) { setConfirmPasswordError('Confirm password'); valid = false; }
    else if (password !== confirmPassword) { setConfirmPasswordError('Passwords do not match'); valid = false; }

    return valid;
  };

  const handleSignUp = async () => {
    if (!validateForm()) {
      if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    try {
      const response = await signUp(email.trim(), password, name.trim());
      if (response.success) {
        if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (response.message?.includes('email')) {
          Alert.alert('Account Created', response.message, [{ text: 'OK', onPress: onNavigateToSignIn }]);
        }
      } else {
        if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const msg = response.message || '';
        const isDuplicate = /already exists|duplicate|already registered/i.test(msg);
        if (isDuplicate) Alert.alert('Account Exists', msg, [{ text: 'Sign In', onPress: navigateToSignIn }], { cancelable: false });
        else Alert.alert('Sign Up Failed', msg || 'Please try again.');
      }
    } catch {
      if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Unexpected error occurred.');
    } finally { setIsLoading(false); }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { flexGrow: 1, paddingHorizontal: theme.spacing.xl, paddingTop: 120, paddingBottom: 40 },
    header: { alignItems: 'center', marginBottom: theme.spacing.xxl },
    logoContainer: { justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing.lg },
    logoImage: { width: 120, height: 120, borderRadius: 21.5, resizeMode: 'contain' as const },
    appName: { fontSize: 36, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.xs, lineHeight: 44 },
    tagline: { fontSize: 16, fontWeight: '400', color: theme.colors.textSecondary, lineHeight: 22 },
    formContainer: { flex: 1, paddingTop: theme.spacing.lg },
    strengthContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md, marginTop: -theme.spacing.xs },
    strengthBars: { flexDirection: 'row', gap: 4, marginRight: theme.spacing.md },
    strengthBar: { width: 40, height: 4, borderRadius: 2 },
    strengthText: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
    createButton: { backgroundColor: theme.colors.primary, borderRadius: 26, paddingVertical: 16, alignItems: 'center', marginTop: theme.spacing.md, ...Platform.select({ android: { elevation: 3 } }) },
    createButtonDisabled: { opacity: 0.6 },
    createButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: theme.spacing.xl },
    footerText: { color: theme.colors.text, fontSize: 16 },
    signInLink: { color: theme.colors.primary, fontSize: 16, fontWeight: '600' },
  });

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/app-logo.png')}
            style={styles.logoImage}
            fadeDuration={0}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appName}>Subscribely</Text>
        <Text style={styles.tagline}>Track your subscriptions smartly</Text>
      </View>

      <View style={styles.formContainer}>
        <AuthInput value={name} onChangeText={setName} placeholder="Name" error={nameError} editable={!isProcessing} />
        <AuthInput value={email} onChangeText={setEmail} placeholder="Email" error={emailError} keyboardType="email-address" editable={!isProcessing} />
        <AuthInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry error={passwordError} editable={!isProcessing} />
        {password.length > 0 && (
          <View style={styles.strengthContainer}>
            <View style={styles.strengthBars}>
              <View style={[styles.strengthBar, { backgroundColor: getStrengthColor() }]} />
              <View style={[styles.strengthBar, passwordStrength !== 'weak' ? { backgroundColor: getStrengthColor() } : { backgroundColor: theme.colors.border }]} />
              <View style={[styles.strengthBar, passwordStrength === 'strong' ? { backgroundColor: getStrengthColor() } : { backgroundColor: theme.colors.border }]} />
            </View>
            <Text style={[styles.strengthText, { color: getStrengthColor() }]}>
              {passwordStrength === 'weak' && 'Weak'}
              {passwordStrength === 'medium' && 'Medium'}
              {passwordStrength === 'strong' && 'Strong'}
            </Text>
          </View>
        )}
        <AuthInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm Password" secureTextEntry error={confirmPasswordError} editable={!isProcessing} />

        <TouchableOpacity style={[styles.createButton, isProcessing && styles.createButtonDisabled]} onPress={handleSignUp} disabled={isProcessing}>
          {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.createButtonText}>Create Account</Text>}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={navigateToSignIn} disabled={isProcessing}>
            <Text style={styles.signInLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}