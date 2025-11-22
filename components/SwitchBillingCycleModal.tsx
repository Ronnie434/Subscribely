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
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { SUBSCRIPTION_PLANS, calculateYearlySavingsPercentage } from '../config/stripe';

interface SwitchBillingCycleModalProps {
  visible: boolean;
  currentCycle: 'monthly' | 'yearly';
  onClose: () => void;
  onConfirm: (newCycle: 'monthly' | 'yearly') => Promise<void>;
}

export default function SwitchBillingCycleModal({
  visible,
  currentCycle,
  onClose,
  onConfirm,
}: SwitchBillingCycleModalProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>(
    currentCycle === 'monthly' ? 'yearly' : 'monthly'
  );
  
  const savingsPercentage = calculateYearlySavingsPercentage();
  const targetCycle = currentCycle === 'monthly' ? 'yearly' : 'monthly';

  const handleConfirm = async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setLoading(true);

    try {
      await onConfirm(selectedCycle);
      
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      const message = selectedCycle === 'yearly'
        ? `You have switched to yearly billing and will save ${savingsPercentage}% per year!`
        : 'You have switched to monthly billing. Your next charge will be adjusted accordingly.';
      
      Alert.alert(
        'Billing Cycle Updated',
        message,
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('Error switching billing cycle:', error);
      
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      
      Alert.alert(
        'Error',
        'Failed to switch billing cycle. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  const getProrationInfo = () => {
    const currentPlan = SUBSCRIPTION_PLANS[currentCycle];
    const newPlan = SUBSCRIPTION_PLANS[selectedCycle];
    
    // Validate plans exist
    if (!currentPlan || !newPlan) {
      console.error('Invalid billing cycle for proration calculation:', { currentCycle, selectedCycle });
      return {
        type: 'upgrade',
        message: 'Switch billing cycle',
        details: 'Your billing cycle will be updated at the next renewal.',
      };
    }
    
    if (currentCycle === 'monthly' && selectedCycle === 'yearly') {
      const monthlyCost = currentPlan.amount * 12;
      const yearlyCost = newPlan.amount;
      const savings = monthlyCost - yearlyCost;
      
      return {
        type: 'upgrade',
        message: `Save $${savings.toFixed(2)} per year`,
        details: 'You will be charged the prorated difference for the remainder of your current billing period.',
      };
    } else {
      return {
        type: 'downgrade',
        message: 'Switch to monthly billing',
        details: 'Your account will be credited for the unused portion of your yearly subscription.',
      };
    }
  };

  const prorationInfo = getProrationInfo();

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
      maxHeight: '85%',
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
      overflow: 'hidden',
      marginBottom: 16,
    },
    iconGradient: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
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
    currentPlanCard: {
      backgroundColor: theme.isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(0, 0, 0, 0.03)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    planLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    planInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    planName: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    planPrice: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    newPlanSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 16,
    },
    planOption: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 3,
      borderColor: theme.colors.border,
      marginBottom: 16,
      position: 'relative',
    },
    planOptionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.isDark
        ? theme.colors.card
        : `${theme.colors.primary}08`,
    },
    savingsBadge: {
      position: 'absolute',
      top: -12,
      right: 20,
      backgroundColor: theme.colors.success,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    savingsText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    planOptionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    planOptionName: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    checkmark: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    planOptionPrice: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    planOptionPeriod: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      marginLeft: 4,
    },
    planOptionDetails: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    prorationCard: {
      backgroundColor: prorationInfo.type === 'upgrade'
        ? `${theme.colors.success}10`
        : `${theme.colors.info}10`,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: prorationInfo.type === 'upgrade'
        ? `${theme.colors.success}40`
        : `${theme.colors.info}40`,
    },
    prorationTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    prorationText: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    comparisonTable: {
      marginBottom: 24,
    },
    comparisonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    comparisonLabel: {
      fontSize: 15,
      fontWeight: '400',
      color: theme.colors.textSecondary,
    },
    comparisonValue: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    comparisonValueNew: {
      color: theme.colors.primary,
    },
    buttonContainer: {
      gap: 12,
    },
    confirmButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmButtonDisabled: {
      opacity: 0.6,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    cancelButton: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <BlurView intensity={20} style={StyleSheet.absoluteFill} pointerEvents="none" />
        </Pressable>

        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          style={styles.modalContent}
        >
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          {/* Header */}
          <View
            style={styles.header}
            pointerEvents="box-none"
          >
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={theme.gradients.primary as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Ionicons name="swap-horizontal" size={32} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={styles.title}>Switch Billing Cycle</Text>
            <Text style={styles.subtitle}>
              Choose the billing option that works best for you
            </Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Current Plan */}
            <View style={styles.currentPlanCard}>
              <Text style={styles.planLabel}>Current Plan</Text>
              <View style={styles.planInfo}>
                <Text style={styles.planName}>
                  {currentCycle === 'monthly' ? 'Monthly' : 'Yearly'} Billing
                </Text>
                <Text style={styles.planPrice}>
                  ${SUBSCRIPTION_PLANS[currentCycle]?.amount?.toFixed(2) || '?.??'}
                  {currentCycle === 'monthly' ? '/mo' : '/yr'}
                </Text>
              </View>
            </View>

            {/* New Plan Options */}
            <View style={styles.newPlanSection}>
              <Text style={styles.sectionTitle}>Switch to:</Text>

              {/* Yearly Option */}
              <TouchableOpacity
                style={[
                  styles.planOption,
                  selectedCycle === 'yearly' && styles.planOptionSelected,
                ]}
                onPress={() => setSelectedCycle('yearly')}
                activeOpacity={0.7}
                disabled={currentCycle === 'yearly'}
              >
                {currentCycle === 'monthly' && (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsText}>Save {savingsPercentage}%</Text>
                  </View>
                )}
                <View style={styles.planOptionHeader}>
                  <Text style={styles.planOptionName}>Yearly</Text>
                  {selectedCycle === 'yearly' && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={styles.planOptionPrice}>
                    ${SUBSCRIPTION_PLANS.yearly.amount.toFixed(2)}
                  </Text>
                  <Text style={styles.planOptionPeriod}>/year</Text>
                </View>
                <Text style={styles.planOptionDetails}>
                  ${(SUBSCRIPTION_PLANS.yearly.amount / 12).toFixed(2)} per month • Billed annually
                </Text>
              </TouchableOpacity>

              {/* Monthly Option */}
              <TouchableOpacity
                style={[
                  styles.planOption,
                  selectedCycle === 'monthly' && styles.planOptionSelected,
                ]}
                onPress={() => setSelectedCycle('monthly')}
                activeOpacity={0.7}
                disabled={currentCycle === 'monthly'}
              >
                <View style={styles.planOptionHeader}>
                  <Text style={styles.planOptionName}>Monthly</Text>
                  {selectedCycle === 'monthly' && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={styles.planOptionPrice}>
                    ${SUBSCRIPTION_PLANS.monthly.amount.toFixed(2)}
                  </Text>
                  <Text style={styles.planOptionPeriod}>/month</Text>
                </View>
                <Text style={styles.planOptionDetails}>
                  Billed monthly • Cancel anytime
                </Text>
              </TouchableOpacity>
            </View>

            {/* Proration Info */}
            {currentCycle !== selectedCycle && (
              <View style={styles.prorationCard}>
                <Text style={styles.prorationTitle}>
                  {prorationInfo.message}
                </Text>
                <Text style={styles.prorationText}>
                  {prorationInfo.details}
                </Text>
              </View>
            )}

            {/* Comparison */}
            {currentCycle !== selectedCycle && (
              <View style={styles.comparisonTable}>
                <View style={styles.comparisonRow}>
                  <Text style={styles.comparisonLabel}>Current</Text>
                  <Text style={styles.comparisonValue}>
                    ${SUBSCRIPTION_PLANS[currentCycle].amount.toFixed(2)}
                    {currentCycle === 'monthly' ? '/mo' : '/yr'}
                  </Text>
                </View>
                <View style={[styles.comparisonRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.comparisonLabel}>New</Text>
                  <Text style={[styles.comparisonValue, styles.comparisonValueNew]}>
                    ${SUBSCRIPTION_PLANS[selectedCycle].amount.toFixed(2)}
                    {selectedCycle === 'monthly' ? '/mo' : '/yr'}
                  </Text>
                </View>
              </View>
            )}

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (loading || currentCycle === selectedCycle) && styles.confirmButtonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={loading || currentCycle === selectedCycle}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    Switch to {selectedCycle === 'monthly' ? 'Monthly' : 'Yearly'} Billing
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Keep Current Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}