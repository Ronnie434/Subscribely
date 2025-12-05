import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { PastDueItem } from '../types';
import AnimatedPressable from './AnimatedPressable';
import { Ionicons } from '@expo/vector-icons';
import { dateHelpers } from '../utils/dateHelpers';
import * as Haptics from 'expo-haptics';

interface PastDueModalProps {
  visible: boolean;
  item: PastDueItem | null;
  onPaid: (itemId: string) => Promise<void>;
  onSkipped: (itemId: string) => Promise<void>;
  onClose: () => void;
}

export default function PastDueModal({
  visible,
  item,
  onPaid,
  onSkipped,
  onClose,
}: PastDueModalProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [processingType, setProcessingType] = useState<'paid' | 'skipped' | null>(null);

  if (!item) return null;

  const handlePaid = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setProcessingType('paid');
      
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      await onPaid(item.id);
      
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert(
        'Error',
        'Failed to record payment. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setProcessingType(null);
    }
  };

  const handleSkipped = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setProcessingType('skipped');
      
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      await onSkipped(item.id);
      
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error recording skip:', error);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert(
        'Error',
        'Failed to record skip. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setProcessingType(null);
    }
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modal: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.error + '20',
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    detailsCard: {
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    detailRowLast: {
      marginBottom: 0,
    },
    detailLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    detailValue: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '600',
    },
    detailValueHighlight: {
      fontSize: 16,
      color: theme.colors.error,
      fontWeight: '700',
    },
    itemName: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    costText: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    buttonContainer: {
      gap: 12,
    },
    button: {
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    paidButton: {
      backgroundColor: theme.colors.primary,
    },
    skippedButton: {
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    skippedButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    loadingContainer: {
      opacity: 0.6,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name="alert-circle"
              size={32}
              color={theme.colors.error}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>Payment Due</Text>
          <Text style={styles.subtitle}>
            Did you pay for this subscription?
          </Text>

          {/* Item Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.itemName}>{item.name}</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.costText}>
                ${item.cost.toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Due Date</Text>
              <Text style={styles.detailValue}>
                {dateHelpers.formatDate(item.renewal_date)}
              </Text>
            </View>
            
            <View style={[styles.detailRow, styles.detailRowLast]}>
              <Text style={styles.detailLabel}>Past Due</Text>
              <Text style={styles.detailValueHighlight}>
                {item.days_past_due} {item.days_past_due === 1 ? 'day' : 'days'}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <AnimatedPressable
              onPress={handlePaid}
              style={[
                styles.button,
                styles.paidButton,
                loading && processingType !== 'paid' && styles.loadingContainer,
              ]}
              disabled={loading}
              scaleOnPress={0.98}>
              {loading && processingType === 'paid' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.buttonText}>I Paid</Text>
                </>
              )}
            </AnimatedPressable>

            <AnimatedPressable
              onPress={handleSkipped}
              style={[
                styles.button,
                styles.skippedButton,
                loading && processingType !== 'skipped' && styles.loadingContainer,
              ]}
              disabled={loading}
              scaleOnPress={0.98}>
              {loading && processingType === 'skipped' ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={20} color={theme.colors.text} />
                  <Text style={styles.skippedButtonText}>I Didn't Pay</Text>
                </>
              )}
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}