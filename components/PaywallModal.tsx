import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { SUBSCRIPTION_PLANS, calculateYearlySavingsPercentage } from '../config/stripe';
import { usageTrackingService } from '../services/usageTrackingService';
import * as Haptics from 'expo-haptics';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgradePress: (plan: 'monthly' | 'yearly') => void;
  currentCount: number;
  maxCount: number;
}

export default function PaywallModal({
  visible,
  onClose,
  onUpgradePress,
  currentCount,
  maxCount,
}: PaywallModalProps) {
  const { theme } = useTheme();
  const savingsPercentage = calculateYearlySavingsPercentage();

  // Track paywall shown event when modal becomes visible
  React.useEffect(() => {
    if (visible) {
      usageTrackingService.trackPaywallShown().catch(console.error);
    }
  }, [visible]);

  const handleUpgrade = (plan: 'monthly' | 'yearly') => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onUpgradePress(plan);
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
      maxHeight: '90%',
    },
    header: {
      alignItems: 'center',
      paddingTop: 24,
      paddingHorizontal: 24,
      paddingBottom: 8,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      overflow: 'hidden',
    },
    iconGradient: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    limitBadge: {
      backgroundColor: theme.colors.error,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      marginBottom: 16,
    },
    limitText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    title: {
      fontSize: 28,
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
    featuresTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 16,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    featureIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: `${theme.colors.success}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    featureText: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.text,
      flex: 1,
    },
    plansContainer: {
      gap: 12,
      marginTop: 24,
    },
    planCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 2,
      borderColor: theme.colors.border,
      position: 'relative',
    },
    recommendedBadge: {
      position: 'absolute',
      top: -12,
      right: 20,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      overflow: 'hidden',
    },
    recommendedGradient: {
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    recommendedText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    planName: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    savingsBadge: {
      backgroundColor: theme.colors.success,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    savingsText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: 4,
    },
    price: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.colors.text,
    },
    period: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      marginLeft: 4,
    },
    billingNote: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      marginBottom: 16,
    },
    selectButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    maybeLaterButton: {
      marginTop: 16,
      paddingVertical: 12,
      alignItems: 'center',
    },
    maybeLaterText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.textSecondary,
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
              <LinearGradient
                colors={theme.gradients.error as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}>
                <Ionicons name="lock-closed" size={40} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <View style={styles.limitBadge}>
              <Text style={styles.limitText}>
                {currentCount}/{maxCount} Recurring Items Used
              </Text>
            </View>

            <Text style={styles.title}>Upgrade to Premium</Text>
            <Text style={styles.subtitle}>
              Track unlimited recurring items and unlock all features
            </Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Features */}
            <Text style={styles.featuresTitle}>Premium Features</Text>
            {SUBSCRIPTION_PLANS.monthly.features.map((feature, index) => (
              <Animated.View
                key={index}
                entering={FadeIn.delay(index * 100)}
                style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={theme.colors.success}
                  />
                </View>
                <Text style={styles.featureText}>{feature}</Text>
              </Animated.View>
            ))}

            {/* Plan Options */}
            <View style={styles.plansContainer}>
              {/* Yearly Plan */}
              <Animated.View entering={FadeIn.delay(400)}>
                <View style={styles.planCard}>
                  <View style={styles.recommendedBadge}>
                    <LinearGradient
                      colors={theme.gradients.success as any}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.recommendedGradient}>
                      <Text style={styles.recommendedText}>Best Value</Text>
                    </LinearGradient>
                  </View>

                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>Yearly</Text>
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsText}>
                        Save {savingsPercentage}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.priceRow}>
                    <Text style={styles.price}>
                      ${SUBSCRIPTION_PLANS.yearly.amount.toFixed(2)}
                    </Text>
                    <Text style={styles.period}>/year</Text>
                  </View>

                  <Text style={styles.billingNote}>
                    ${(SUBSCRIPTION_PLANS.yearly.amount / 12).toFixed(2)} per
                    month
                  </Text>

                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => handleUpgrade('yearly')}
                    activeOpacity={0.8}>
                    <Text style={styles.selectButtonText}>Choose Yearly</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Monthly Plan */}
              <Animated.View entering={FadeIn.delay(500)}>
                <View style={styles.planCard}>
                  <Text style={styles.planName}>Monthly</Text>

                  <View style={styles.priceRow}>
                    <Text style={styles.price}>
                      ${SUBSCRIPTION_PLANS.monthly.amount.toFixed(2)}
                    </Text>
                    <Text style={styles.period}>/month</Text>
                  </View>

                  <Text style={styles.billingNote}>
                    Billed monthly, cancel anytime
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.selectButton,
                      { backgroundColor: theme.colors.secondary },
                    ]}
                    onPress={() => handleUpgrade('monthly')}
                    activeOpacity={0.8}>
                    <Text style={styles.selectButtonText}>Choose Monthly</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>

            {/* Maybe Later */}
            <TouchableOpacity
              style={styles.maybeLaterButton}
              onPress={handleClose}
              activeOpacity={0.7}>
              <Text style={styles.maybeLaterText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}