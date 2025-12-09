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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../config/supabase';

/**
 * Route parameters expected by AccountRecoveryScreen
 */
type AccountRecoveryScreenProps = NativeStackScreenProps<any, 'AccountRecovery'>;

/**
 * Route params structure
 */
interface RouteParams {
  deletedAt: string; // ISO timestamp when account was marked for deletion
  userEmail: string; // User's email for display purposes
}

/**
 * AccountRecoveryScreen
 * 
 * Displayed when a user with a deleted account tries to log in during the 30-day grace period.
 * Allows the user to either:
 * 1. Recover their account (clears deleted_at timestamp)
 * 2. Continue with permanent deletion (signs out, account deleted by scheduled job)
 * 
 * Features:
 * - Grace period countdown display (days/hours remaining)
 * - Information about what will be recovered
 * - Confirmation dialogs for critical actions
 * - Loading states during API calls
 * - Error handling with user-friendly messages
 */
export default function AccountRecoveryScreen({ navigation, route }: AccountRecoveryScreenProps) {
  const { theme } = useTheme();
  const { signOut, clearDeletedAccountInfo } = useAuth();
  const { showSuccess, showError } = useToast();
  
  // Extract route parameters
  const params = route.params as RouteParams;
  const { deletedAt, userEmail } = params;
  
  // Component state
  const [isRecovering, setIsRecovering] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [hoursRemaining, setHoursRemaining] = useState(0);

  /**
   * Calculate and update the remaining time in the grace period
   */
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const deletionDate = new Date(deletedAt);
      const gracePeriodEnd = new Date(deletionDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30); // 30-day grace period
      
      const now = new Date();
      const timeRemaining = gracePeriodEnd.getTime() - now.getTime();
      
      if (timeRemaining <= 0) {
        setDaysRemaining(0);
        setHoursRemaining(0);
        return;
      }
      
      // Calculate days and hours
      const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      setDaysRemaining(days);
      setHoursRemaining(hours);
    };
    
    // Calculate immediately
    calculateTimeRemaining();
    
    // Update every minute
    const interval = setInterval(calculateTimeRemaining, 60000);
    
    return () => clearInterval(interval);
  }, [deletedAt]);

  /**
   * Call the recover-account Edge Function to restore the user's account
   */
  const handleRecoverAccount = async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    setIsRecovering(true);
    
    try {
      // Get the current session to obtain the access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('No active session. Please try logging in again.');
      }
      
      if (__DEV__) {
        console.log('[AccountRecovery] Calling recover-account function...');
      }
      
      // Call the recover-account Edge Function
      const { data, error } = await supabase.functions.invoke('recover-account', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) {
        throw error;
      }
      
      if (!data || !data.success) {
        throw new Error(data?.message || 'Failed to recover account');
      }
      
      if (__DEV__) {
        console.log('[AccountRecovery] Account recovered successfully:', data);
      }
      
      // Success feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      showSuccess('Account recovered successfully! Welcome back.');
      
      // Clear deleted account info so AppNavigator switches to MainNavigator
      // This allows proper navigation to the main app
      clearDeletedAccountInfo();
      
      // No need to navigate manually - AppNavigator will automatically switch to MainNavigator
      // and show the Home screen when deletedAccountInfo is cleared
      
    } catch (error: any) {
      if (__DEV__) {
        console.error('[AccountRecovery] Recovery failed:', error);
      }
      
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      
      const errorMessage = error?.message || 'Failed to recover account. Please try again.';
      showError(errorMessage);
      
      // If error is about expired grace period, show specific alert
      if (errorMessage.toLowerCase().includes('expired')) {
        Alert.alert(
          'Recovery Period Expired',
          'The 30-day recovery period has expired. Your account has been permanently deleted.',
          [
            {
              text: 'OK',
              onPress: () => handleSignOut(),
            },
          ]
        );
      }
    } finally {
      setIsRecovering(false);
    }
  };

  /**
   * Handle the "Continue with Deletion" action
   * Shows a confirmation dialog before signing out the user
   */
  const handleContinueDeletion = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    Alert.alert(
      'Continue with Deletion?',
      `Your account and all associated data will be permanently deleted after the ${daysRemaining}-day grace period.\n\nAre you sure you want to proceed?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue with Deletion',
          style: 'destructive',
          onPress: handleSignOut,
        },
      ]
    );
  };

  /**
   * Sign out the user
   * For users continuing with deletion, their account will be removed by the scheduled cleanup job
   */
  const handleSignOut = async () => {
    try {
      // Clear deleted account info before signing out
      // This ensures clean state transition
      clearDeletedAccountInfo();
      
      await signOut();
      
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[AccountRecovery] Sign out error:', error);
      }
      showError('Failed to sign out. Please try again.');
    }
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
    content: {
      flex: 1,
    },
    warningIconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.warning + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
      alignSelf: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
      textAlign: 'center',
      lineHeight: 36,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      lineHeight: 24,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    emailText: {
      fontWeight: '600',
      color: theme.colors.text,
    },
    countdownContainer: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      borderWidth: 2,
      borderColor: theme.colors.warning,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.warning,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    countdownLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    countdownValue: {
      fontSize: 36,
      fontWeight: '700',
      color: theme.colors.warning,
      textAlign: 'center',
      marginBottom: theme.spacing.xs,
    },
    countdownSubtext: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    infoCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.sm,
    },
    infoItemIcon: {
      marginRight: theme.spacing.sm,
      marginTop: 2,
    },
    infoItemText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    buttonContainer: {
      gap: theme.spacing.md,
      marginTop: theme.spacing.lg,
    },
    recoverButton: {
      backgroundColor: theme.colors.success,
      borderRadius: 26,
      paddingVertical: 16,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.success,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    recoverButtonDisabled: {
      opacity: 0.6,
    },
    recoverButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    deleteButton: {
      backgroundColor: 'transparent',
      borderRadius: 26,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.colors.error,
    },
    deleteButtonDisabled: {
      opacity: 0.6,
    },
    deleteButtonText: {
      color: theme.colors.error,
      fontSize: 16,
      fontWeight: '700',
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Warning Icon */}
          <View style={styles.warningIconContainer}>
            <Ionicons name="warning" size={56} color={theme.colors.warning} />
          </View>
          
          {/* Title and Description */}
          <Text style={styles.title}>Account Scheduled for Deletion</Text>
          <Text style={styles.subtitle}>
            Your account <Text style={styles.emailText}>{userEmail}</Text> is scheduled for permanent deletion. You can recover it within the grace period.
          </Text>

          {/* Grace Period Countdown */}
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownLabel}>Time Remaining</Text>
            <Text style={styles.countdownValue}>
              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
            </Text>
            <Text style={styles.countdownSubtext}>
              {hoursRemaining} {hoursRemaining === 1 ? 'hour' : 'hours'} until permanent deletion
            </Text>
          </View>

          {/* What Will Be Recovered */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What will be recovered:</Text>
            
            <View style={styles.infoItem}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.colors.success}
                style={styles.infoItemIcon}
              />
              <Text style={styles.infoItemText}>All your tracked subscriptions and recurring expenses</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.colors.success}
                style={styles.infoItemIcon}
              />
              <Text style={styles.infoItemText}>Payment history and transaction records</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.colors.success}
                style={styles.infoItemIcon}
              />
              <Text style={styles.infoItemText}>App settings and preferences</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.colors.success}
                style={styles.infoItemIcon}
              />
              <Text style={styles.infoItemText}>Your premium membership status</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Recover Account Button */}
            <TouchableOpacity
              style={[styles.recoverButton, isRecovering && styles.recoverButtonDisabled]}
              onPress={handleRecoverAccount}
              disabled={isRecovering}
              activeOpacity={0.8}
              accessibilityLabel="Recover my account"
              accessibilityHint="Restores your account and all associated data">
              {isRecovering ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.recoverButtonText}>Recover My Account</Text>
              )}
            </TouchableOpacity>

            {/* Continue with Deletion Button */}
            <TouchableOpacity
              style={[styles.deleteButton, isRecovering && styles.deleteButtonDisabled]}
              onPress={handleContinueDeletion}
              disabled={isRecovering}
              activeOpacity={0.8}
              accessibilityLabel="Continue with deletion"
              accessibilityHint="Proceed with permanent account deletion">
              <Text style={styles.deleteButtonText}>Continue with Deletion</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}