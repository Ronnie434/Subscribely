import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { paymentService } from '../services/paymentService';

interface CancelSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CancelSubscriptionModal({
  visible,
  onClose,
  onSuccess,
}: CancelSubscriptionModalProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [cancelOption, setCancelOption] = useState<'end_of_period' | 'immediately'>(
    'end_of_period'
  );

  const handleCancel = async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Alert.alert(
      'Confirm Cancellation',
      cancelOption === 'immediately'
        ? 'Your subscription will be cancelled immediately and you will lose access to premium features right away. This action cannot be undone.'
        : 'Your subscription will be cancelled at the end of your current billing period. You will continue to have access to premium features until then.',
      [
        {
          text: 'Go Back',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);

            try {
              await paymentService.cancelSubscription(
                cancelOption === 'immediately'
              );

              if (Platform.OS === 'ios') {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
              }

              Alert.alert(
                'Subscription Cancelled',
                cancelOption === 'immediately'
                  ? 'Your subscription has been cancelled. You no longer have access to premium features.'
                  : 'Your subscription has been cancelled. You will continue to have access to premium features until the end of your current billing period.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      onSuccess();
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('Error cancelling subscription:', error);

              if (Platform.OS === 'ios') {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Error
                );
              }

              Alert.alert(
                'Cancellation Failed',
                'Unable to cancel your subscription. Please try again or contact support.',
                [{ text: 'OK' }]
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: Platform.OS === 'ios' ? 34 : 24,
      maxHeight: '80%',
    },
    header: {
      alignItems: 'center',
      paddingTop: 24,
      paddingHorizontal: 24,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.isDark
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(0, 0, 0, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${theme.colors.error}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    content: {
      paddingHorizontal: 24,
      paddingVertical: 24,
    },
    warningCard: {
      backgroundColor: theme.isDark
        ? 'rgba(255, 69, 58, 0.1)'
        : 'rgba(255, 59, 48, 0.1)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    warningTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.error,
      marginBottom: 8,
    },
    warningText: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.text,
      lineHeight: 20,
    },
    optionsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 16,
    },
    optionCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    optionCardSelected: {
      borderColor: theme.colors.error,
      backgroundColor: theme.isDark
        ? theme.colors.card
        : `${theme.colors.error}08`,
    },
    optionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    optionDescription: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    checkmark: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.error,
      justifyContent: 'center',
      alignItems: 'center',
    },
    whatHappensSection: {
      marginTop: 24,
      marginBottom: 24,
    },
    whatHappensTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    bulletPoint: {
      flexDirection: 'row',
      marginBottom: 8,
      paddingLeft: 8,
    },
    bulletDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.textSecondary,
      marginTop: 7,
      marginRight: 12,
    },
    bulletText: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      lineHeight: 20,
      flex: 1,
    },
    buttonContainer: {
      gap: 12,
    },
    cancelButton: {
      backgroundColor: theme.colors.error,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonDisabled: {
      opacity: 0.6,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    keepButton: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    keepButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.primary,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        </Pressable>

        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          style={styles.modalContent}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="warning"
                size={32}
                color={theme.colors.error}
              />
            </View>
            <Text style={styles.title}>Cancel Subscription?</Text>
            <Text style={styles.subtitle}>
              We're sorry to see you go. Are you sure you want to cancel?
            </Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Warning */}
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>What You'll Lose</Text>
              <Text style={styles.warningText}>
                • Unlimited subscription tracking{'\n'}
                • Advanced analytics and insights{'\n'}
                • Export capabilities{'\n'}
                • Priority support
              </Text>
            </View>

            {/* Options */}
            <Text style={styles.optionsTitle}>Cancellation Options</Text>

            <TouchableOpacity
              style={[
                styles.optionCard,
                cancelOption === 'end_of_period' && styles.optionCardSelected,
              ]}
              onPress={() => setCancelOption('end_of_period')}
              activeOpacity={0.7}>
              <View style={styles.optionHeader}>
                <Text style={styles.optionTitle}>At End of Period</Text>
                {cancelOption === 'end_of_period' && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </View>
                )}
              </View>
              <Text style={styles.optionDescription}>
                Keep access to premium features until your billing period ends
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                cancelOption === 'immediately' && styles.optionCardSelected,
              ]}
              onPress={() => setCancelOption('immediately')}
              activeOpacity={0.7}>
              <View style={styles.optionHeader}>
                <Text style={styles.optionTitle}>Cancel Immediately</Text>
                {cancelOption === 'immediately' && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </View>
                )}
              </View>
              <Text style={styles.optionDescription}>
                Lose access to premium features right away
              </Text>
            </TouchableOpacity>

            {/* What Happens */}
            <View style={styles.whatHappensSection}>
              <Text style={styles.whatHappensTitle}>What Happens Next?</Text>
              <View style={styles.bulletPoint}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  If you have more than 5 subscriptions, you won't be able to
                  add more until you delete some
                </Text>
              </View>
              <View style={styles.bulletPoint}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  You can resubscribe anytime to regain premium features
                </Text>
              </View>
              <View style={styles.bulletPoint}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>
                  Your data will be preserved and available when you return
                </Text>
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.keepButton}
                onPress={handleClose}
                activeOpacity={0.8}>
                <Text style={styles.keepButtonText}>Keep Premium</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  loading && styles.cancelButtonDisabled,
                ]}
                onPress={handleCancel}
                disabled={loading}
                activeOpacity={0.8}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.cancelButtonText}>
                    Confirm Cancellation
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}