import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigationState } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { SUBSCRIPTION_PLANS, calculateYearlySavingsPercentage } from '../config/stripe';
import { usageTrackingService } from '../services/usageTrackingService';

type RootStackParamList = {
  PlanSelection: undefined;
  PaymentScreen: { plan: 'monthly' | 'yearly'; origin?: 'Settings' | 'Home' };
};

type PlanSelectionScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PlanSelection'
>;

interface PlanSelectionScreenProps {
  navigation: PlanSelectionScreenNavigationProp;
}

export default function PlanSelectionScreen({
  navigation,
}: PlanSelectionScreenProps) {
  const { theme } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const savingsPercentage = calculateYearlySavingsPercentage();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 60;
  const safeAreaBottom = insets.bottom > 0 ? insets.bottom : 8;
  const bottomPadding = TAB_BAR_HEIGHT + safeAreaBottom + 20;

  // Detect which stack we're in to determine origin
  const origin = useNavigationState(state => {
    // Navigate up through the state tree to find the root navigator
    let currentState = state;
    while (currentState?.routes) {
      const currentRoute = currentState.routes[currentState.index];
      // Check if we're in Settings or Subscriptions stack
      if (currentRoute.name === 'Settings') {
        return 'Settings' as const;
      }
      if (currentRoute.name === 'Subscriptions') {
        return 'Home' as const;
      }
      // Move to nested state if available
      if (currentRoute.state) {
        currentState = currentRoute.state as any;
      } else {
        break;
      }
    }
    return 'Home' as const; // Default to Home if unable to determine
  });

  const handlePlanSelect = (plan: 'monthly' | 'yearly') => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedPlan(plan);
  };

  const handleContinue = async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      // Track plan selection
      await usageTrackingService.trackPlanSelected(
        selectedPlan,
        SUBSCRIPTION_PLANS[selectedPlan].amount.toString()
      );

      // Navigate to payment screen with origin parameter
      navigation.navigate('PaymentScreen', { plan: selectedPlan, origin });
    } catch (error) {
      console.error('Error tracking plan selection:', error);
      // Still navigate even if tracking fails
      navigation.navigate('PaymentScreen', { plan: selectedPlan, origin });
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 24,
      paddingBottom: bottomPadding,
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
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
    plansContainer: {
      gap: 16,
      marginBottom: 32,
    },
    planCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      borderWidth: 3,
      borderColor: theme.colors.border,
      position: 'relative',
    },
    planCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.isDark ? theme.colors.card : `${theme.colors.primary}08`,
    },
    recommendedBadge: {
      position: 'absolute',
      top: -12,
      left: 24,
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
      marginBottom: 12,
    },
    planNameContainer: {
      flex: 1,
    },
    planName: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    planDescription: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
    },
    savingsBadge: {
      backgroundColor: theme.colors.success,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    savingsText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: 8,
    },
    price: {
      fontSize: 40,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: -1,
    },
    period: {
      fontSize: 18,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      marginLeft: 4,
    },
    billingNote: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      marginBottom: 20,
    },
    featuresContainer: {
      gap: 12,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
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
      fontSize: 15,
      fontWeight: '400',
      color: theme.colors.text,
      flex: 1,
    },
    checkmark: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    comparisonSection: {
      marginBottom: 32,
    },
    comparisonTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    comparisonCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    comparisonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    comparisonRowLast: {
      borderBottomWidth: 0,
    },
    comparisonLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '400',
      color: theme.colors.text,
    },
    continueButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    continueButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    footerNote: {
      fontSize: 13,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={theme.gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}>
              <Ionicons name="star" size={40} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={styles.title}>Choose Your Plan</Text>
          <Text style={styles.subtitle}>
            Unlock unlimited recurring items and premium features
          </Text>
        </Animated.View>

        {/* Plan Cards */}
        <View style={styles.plansContainer}>
          {/* Yearly Plan */}
          <Animated.View entering={FadeInDown.delay(200)}>
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'yearly' && styles.planCardSelected,
              ]}
              onPress={() => handlePlanSelect('yearly')}
              activeOpacity={0.7}>
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
                <View style={styles.planNameContainer}>
                  <Text style={styles.planName}>Yearly Plan</Text>
                  <Text style={styles.planDescription}>
                    {SUBSCRIPTION_PLANS.yearly.description}
                  </Text>
                </View>
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
                Only ${(SUBSCRIPTION_PLANS.yearly.amount / 12).toFixed(2)} per
                month • Billed annually
              </Text>

              <View style={styles.featuresContainer}>
                {SUBSCRIPTION_PLANS.yearly.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <View style={styles.featureIcon}>
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={theme.colors.success}
                      />
                    </View>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {selectedPlan === 'yearly' && (
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Monthly Plan */}
          <Animated.View entering={FadeInDown.delay(300)}>
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'monthly' && styles.planCardSelected,
              ]}
              onPress={() => handlePlanSelect('monthly')}
              activeOpacity={0.7}>
              <View style={styles.planHeader}>
                <View style={styles.planNameContainer}>
                  <Text style={styles.planName}>Monthly Plan</Text>
                  <Text style={styles.planDescription}>
                    {SUBSCRIPTION_PLANS.monthly.description}
                  </Text>
                </View>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.price}>
                  ${SUBSCRIPTION_PLANS.monthly.amount.toFixed(2)}
                </Text>
                <Text style={styles.period}>/month</Text>
              </View>

              <Text style={styles.billingNote}>
                Billed monthly • Cancel anytime
              </Text>

              <View style={styles.featuresContainer}>
                {SUBSCRIPTION_PLANS.monthly.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <View style={styles.featureIcon}>
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={theme.colors.success}
                      />
                    </View>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {selectedPlan === 'monthly' && (
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Comparison Section */}
        <Animated.View
          entering={FadeInDown.delay(400)}
          style={styles.comparisonSection}>
          <Text style={styles.comparisonTitle}>All Plans Include</Text>
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonRow}>
              <Text style={styles.comparisonLabel}>Unlimited recurring items</Text>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
            </View>
            <View style={styles.comparisonRow}>
              <Text style={styles.comparisonLabel}>Advanced analytics</Text>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
            </View>
            <View style={styles.comparisonRow}>
              <Text style={styles.comparisonLabel}>Export capabilities</Text>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
            </View>
            <View style={[styles.comparisonRow, styles.comparisonRowLast]}>
              <Text style={styles.comparisonLabel}>Priority support</Text>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
            </View>
          </View>
        </Animated.View>

        {/* Continue Button */}
        <Animated.View entering={FadeInDown.delay(500)}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}>
            <Text style={styles.continueButtonText}>
              Continue to Payment
            </Text>
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            Cancel anytime. No hidden fees. 7-day money-back guarantee.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}