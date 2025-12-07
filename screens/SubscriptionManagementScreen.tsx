import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { subscriptionTierService } from '../services/subscriptionTierService';
import { subscriptionLimitService } from '../services/subscriptionLimitService';
import { paymentService } from '../services/paymentService';
import { SubscriptionLimitStatus } from '../types';
import { supabase } from '../config/supabase';
import { SUBSCRIPTION_PLANS } from '../config/stripe';
import TierBadge from '../components/TierBadge';
import BillingHistoryList from '../components/BillingHistoryList';
import CancelSubscriptionModal from '../components/CancelSubscriptionModal';
import SwitchBillingCycleModal from '../components/SwitchBillingCycleModal';
import SubscriptionStatusIndicator from '../components/SubscriptionStatusIndicator';
import SkeletonLoader from '../components/SkeletonLoader';
import { dateHelpers } from '../utils/dateHelpers';

type RootStackParamList = {
  SubscriptionManagement: undefined;
  PlanSelection: undefined;
};

type SubscriptionManagementScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'SubscriptionManagement'
>;

interface SubscriptionManagementScreenProps {
  navigation: SubscriptionManagementScreenNavigationProp;
}

export default function SubscriptionManagementScreen({
  navigation,
}: SubscriptionManagementScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 60;
  const safeAreaBottom = insets.bottom > 0 ? insets.bottom : 8;
  const bottomPadding = TAB_BAR_HEIGHT + safeAreaBottom + 20;
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SubscriptionLimitStatus | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showBillingCycleModal, setShowBillingCycleModal] = useState(false);
  const [showBillingHistory, setShowBillingHistory] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'paused' | 'cancelled' | 'canceled' | 'past_due' | 'trialing'>('active');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<{ last4: string; brand: string } | null>(null);
  const [actualBillingAmount, setActualBillingAmount] = useState<number | null>(null);
  const [nextBillingDate, setNextBillingDate] = useState<Date | null>(null);
  const [billingDataLoading, setBillingDataLoading] = useState<boolean>(false);
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'apple' | null>(null);

  // Reload status when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSubscriptionStatus();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      setLoading(true);
      const limitStatus = await subscriptionLimitService.getSubscriptionLimitStatus();
      setStatus(limitStatus);
      
      // Load additional subscription details for premium users
      if (limitStatus.isPremium) {
        setBillingDataLoading(true);
        
        try {
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            // Fetch user profile to check payment provider
            const { data: profile } = await supabase
              .from('profiles')
              .select('payment_provider')
              .eq('id', user.id)
              .single();

            if (profile) {
              setPaymentProvider(profile.payment_provider as 'stripe' | 'apple' | null);
            }

            // Fetch user subscription details from database
            const { data: subscription, error: subError } = await supabase
              .from('user_subscriptions')
              .select(`
                *,
                tier:subscription_tiers(*)
              `)
              .eq('user_id', user.id)
              .single();

            if (!subError && subscription) {
              // Set subscription status
              setSubscriptionStatus(subscription.status as 'active' | 'paused' | 'cancelled');
              // Payment provider is now set from profile
              
              // Set billing cycle from database with validation
              // Note: Database may store 'annual' which needs to map to 'yearly'
              let cycle: 'monthly' | 'yearly' = 'monthly'; // default fallback
              
              if (subscription.billing_cycle === 'monthly' || subscription.billing_cycle === 'yearly') {
                cycle = subscription.billing_cycle as 'monthly' | 'yearly';
              } else if (subscription.billing_cycle === 'annual') {
                // Map 'annual' to 'yearly' to match SUBSCRIPTION_PLANS keys
                cycle = 'yearly';
              }
              
              setBillingCycle(cycle);
              
              // Set next billing date from current_period_end
              if (subscription.current_period_end) {
                setNextBillingDate(new Date(subscription.current_period_end));
              }
              
              // Implement 3-level fallback for billing amount:
              // 1. Try payment_transactions (actual amount paid)
              let billingAmount: number | null = await paymentService.getUserBillingInfo();
              
              // 2. Fallback to subscription_tiers pricing (using correct database field names)
              if (billingAmount == null && subscription.tier) {
                billingAmount = cycle === 'monthly'
                  ? (subscription.tier as any).monthly_price
                  : (subscription.tier as any).annual_price;
              }
              
              // 3. Final fallback to SUBSCRIPTION_PLANS config
              if (billingAmount == null) {
                const plan = SUBSCRIPTION_PLANS[cycle];
                if (plan) {
                  billingAmount = plan.amount;
                } else {
                  // Emergency fallback if plan lookup fails
                  console.error('Invalid billing cycle for plan lookup:', cycle);
                  billingAmount = cycle === 'yearly' ? 39.99 : 4.99;
                }
              }
              
              setActualBillingAmount(billingAmount);
              
              // Set payment method placeholder (TODO: fetch from Stripe if needed)
              setPaymentMethod({ last4: '4242', brand: 'Visa' });
            }
          }
        } catch (billingError) {
          console.error('Error loading billing details:', billingError);
          // Set fallback values if billing data fetch fails
          const cycle = billingCycle;
          const plan = SUBSCRIPTION_PLANS[cycle];
          setActualBillingAmount(plan?.amount ?? 4.99);
        } finally {
          setBillingDataLoading(false);
        }
      }
    } catch (error) {
      console.error('Error loading subscription status:', error);
      Alert.alert('Error', 'Failed to load subscription information.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePaymentMethod = async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (paymentProvider === 'apple') {
      Alert.alert(
        'Managed by Apple',
        'Your payment method is managed through your Apple ID settings. Please check your iPhone Settings > Apple ID > Payment & Shipping.'
      );
      return;
    }

    setUpdatingPayment(true);

    try {
      // Get Stripe billing portal URL
      const { url } = await paymentService.getBillingPortalUrl();

      // Open billing portal in browser
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open billing portal');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      Alert.alert('Error', 'Failed to open billing portal. Please try again.');
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // For both Stripe and Apple, show the cancel modal first
    // The modal will handle the specific logic (API call vs deep link)
    setShowCancelModal(true);
  };

  const handleBillingCycleSwitch = async (newCycle: 'monthly' | 'yearly') => {
    try {
      // Switch billing cycle via payment service
      await paymentService.switchBillingCycle(newCycle);
      
      // Update local state
      setBillingCycle(newCycle);
      setShowBillingCycleModal(false);
      
      // Reload subscription status
      await loadSubscriptionStatus();
    } catch (error) {
      console.error('Error switching billing cycle:', error);
      throw error;
    }
  };

  const handleCancelSuccess = () => {
    setShowCancelModal(false);
    
    // Reload subscription status to get the real status from database
    loadSubscriptionStatus();
    
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    // Navigate back to Settings after brief delay to show updated status
    setTimeout(() => {
      navigation.goBack();
    }, 1000);
  };

  const handleUpgrade = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigation.navigate('PlanSelection');
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
    headerCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      marginBottom: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    headerGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 120,
      opacity: 0.1,
    },
    headerContent: {
      alignItems: 'center',
    },
    tierBadgeContainer: {
      marginBottom: 16,
    },
    tierTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    tierSubtitle: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    statusIndicatorContainer: {
      marginTop: 16,
      alignItems: 'center',
    },
    paymentMethodCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    paymentMethodIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: `${theme.colors.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    paymentMethodInfo: {
      flex: 1,
    },
    paymentMethodLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    paymentMethodDetails: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 16,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    infoRowLast: {
      marginBottom: 0,
    },
    infoLabel: {
      fontSize: 15,
      fontWeight: '400',
      color: theme.colors.textSecondary,
    },
    infoValue: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    actionButton: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      marginBottom: 12,
    },
    actionButtonPrimary: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    actionButtonDanger: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.error,
    },
    actionButtonLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    actionButtonIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${theme.colors.primary}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    actionButtonIconPrimary: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    actionButtonIconDanger: {
      backgroundColor: `${theme.colors.error}20`,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    actionButtonTextPrimary: {
      color: '#FFFFFF',
    },
    actionButtonTextDanger: {
      color: theme.colors.error,
    },
    upgradeCard: {
      borderRadius: 20,
      padding: 24,
      marginBottom: 24,
      overflow: 'hidden',
    },
    upgradeGradient: {
      padding: 24,
    },
    upgradeTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 8,
    },
    upgradeSubtitle: {
      fontSize: 16,
      fontWeight: '400',
      color: 'rgba(255, 255, 255, 0.9)',
      marginBottom: 20,
    },
    upgradeFeatures: {
      gap: 12,
      marginBottom: 20,
    },
    upgradeFeature: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    upgradeFeatureIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    upgradeFeatureText: {
      fontSize: 15,
      fontWeight: '400',
      color: '#FFFFFF',
      flex: 1,
    },
    upgradeButton: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    upgradeButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    usageCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      marginBottom: 24,
    },
    usageTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    usageBar: {
      height: 8,
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },
    usageBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    usageText: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 100,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.content}>
          <SkeletonLoader width="100%" height={200} borderRadius={20} style={{ marginBottom: 24 }} />
          <SkeletonLoader width="100%" height={120} borderRadius={16} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={60} borderRadius={12} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={60} borderRadius={12} />
        </View>
      </SafeAreaView>
    );
  }

  if (!status) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: theme.colors.textSecondary }}>
            Unable to load subscription information
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <LinearGradient
            colors={
              (status.isPremium
                ? theme.gradients.primary
                : theme.gradients.surface) as any
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          />
          <View style={styles.headerContent}>
            <View style={styles.tierBadgeContainer}>
              <TierBadge
                tier={status.isPremium ? 'premium' : 'free'}
                size="large"
              />
            </View>
            <Text style={styles.tierTitle}>
              {status.isPremium ? 'Premium Plan' : 'Free Plan'}
            </Text>
            <Text style={styles.tierSubtitle}>
              {status.isPremium
                ? 'Unlimited recurring items and all features'
                : `${status.currentCount} of ${status.maxAllowed} recurring items used`}
            </Text>
            {status.isPremium && (
              <View style={styles.statusIndicatorContainer}>
                <SubscriptionStatusIndicator
                  status={subscriptionStatus}
                  size="medium"
                />
              </View>
            )}
          </View>
        </View>

        {status.isPremium ? (
          <>
            {/* Payment Method */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              <View style={styles.paymentMethodCard}>
                <View style={styles.paymentMethodIcon}>
                  {paymentProvider === 'apple' ? (
                    <Ionicons name="logo-apple" size={24} color={theme.colors.text} />
                  ) : (
                    <Ionicons
                      name="card"
                      size={24}
                      color={theme.colors.primary}
                    />
                  )}
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodLabel}>
                    {paymentProvider === 'apple' ? 'Apple ID' : 'Card'}
                  </Text>
                  <Text style={styles.paymentMethodDetails}>
                    {paymentProvider === 'apple' 
                      ? 'Managed by Apple' 
                      : paymentMethod 
                        ? `${paymentMethod.brand} •••• ${paymentMethod.last4}`
                        : 'Loading...'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Billing Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Billing Information</Text>
              <View style={styles.card}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Plan</Text>
                  <Text style={styles.infoValue}>Premium</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Billing Cycle</Text>
                  <Text style={styles.infoValue}>
                    {billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Amount</Text>
                  {billingDataLoading ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Text style={styles.infoValue}>
                      ${actualBillingAmount?.toFixed(2) ?? '...'}
                    </Text>
                  )}
                </View>
                <View style={[styles.infoRow, styles.infoRowLast]}>
                  <Text style={styles.infoLabel}>Next Billing Date</Text>
                  {billingDataLoading ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Text style={styles.infoValue}>
                      {nextBillingDate
                        ? dateHelpers.formatDate(nextBillingDate)
                        : dateHelpers.formatDate(new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000))
                      }
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Manage Plan</Text>

              {/* Switch Billing Cycle - Only show for monthly subscribers via Stripe */}
              {billingCycle === 'monthly' && paymentProvider !== 'apple' && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setShowBillingCycleModal(true);
                  }}
                  activeOpacity={0.7}>
                  <View style={styles.actionButtonLeft}>
                    <View style={styles.actionButtonIcon}>
                      <Ionicons
                        name="swap-horizontal-outline"
                        size={20}
                        color={theme.colors.primary}
                      />
                    </View>
                    <Text style={styles.actionButtonText}>
                      Switch Billing Cycle
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              )}

              {/* Update Payment Method */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleUpdatePaymentMethod}
                disabled={updatingPayment}
                activeOpacity={0.7}>
                <View style={styles.actionButtonLeft}>
                  <View style={styles.actionButtonIcon}>
                    <Ionicons
                      name="card-outline"
                      size={20}
                      color={theme.colors.primary}
                    />
                  </View>
                  <Text style={styles.actionButtonText}>
                    Update Payment Method
                  </Text>
                </View>
                {updatingPayment ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                )}
              </TouchableOpacity>

              {/* Billing History */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setShowBillingHistory(!showBillingHistory)}
                activeOpacity={0.7}>
                <View style={styles.actionButtonLeft}>
                  <View style={styles.actionButtonIcon}>
                    <Ionicons
                      name="receipt-outline"
                      size={20}
                      color={theme.colors.primary}
                    />
                  </View>
                  <Text style={styles.actionButtonText}>
                    View Billing History
                  </Text>
                </View>
                <Ionicons
                  name={showBillingHistory ? 'chevron-up' : 'chevron-forward'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              {showBillingHistory && <BillingHistoryList />}

              {/* Cancel Subscription */}
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonDanger]}
                onPress={handleCancelSubscription}
                activeOpacity={0.7}>
                <View style={styles.actionButtonLeft}>
                  <View style={[styles.actionButtonIcon, styles.actionButtonIconDanger]}>
                    <Ionicons
                      name="close-circle-outline"
                      size={20}
                      color={theme.colors.error}
                    />
                  </View>
                  <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
                    Cancel Plan
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.error}
                />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Usage Card for Free Tier */}
            <View style={styles.usageCard}>
              <Text style={styles.usageTitle}>Recurring Item Usage</Text>
              <View style={styles.usageBar}>
                <LinearGradient
                  colors={
                    (status.currentCount >= (status.maxAllowed || 0)
                      ? theme.gradients.error
                      : theme.gradients.primary) as any
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.usageBarFill,
                    {
                      width: `${
                        ((status.currentCount / (status.maxAllowed || 1)) * 100)
                      }%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.usageText}>
                {status.currentCount} of {status.maxAllowed} recurring items used
              </Text>
            </View>

            {/* Upgrade Card */}
            <View style={styles.upgradeCard}>
              <LinearGradient
                colors={theme.gradients.primary as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.upgradeGradient}>
                <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
                <Text style={styles.upgradeSubtitle}>
                  Get unlimited recurring items and all premium features
                </Text>

                <View style={styles.upgradeFeatures}>
                  <View style={styles.upgradeFeature}>
                    <View style={styles.upgradeFeatureIcon}>
                      <Ionicons name="infinite" size={16} color="#FFFFFF" />
                    </View>
                    <Text style={styles.upgradeFeatureText}>
                      Unlimited recurring item tracking
                    </Text>
                  </View>
                  <View style={styles.upgradeFeature}>
                    <View style={styles.upgradeFeatureIcon}>
                      <Ionicons name="stats-chart" size={16} color="#FFFFFF" />
                    </View>
                    <Text style={styles.upgradeFeatureText}>
                      Advanced analytics
                    </Text>
                  </View>
                  <View style={styles.upgradeFeature}>
                    <View style={styles.upgradeFeatureIcon}>
                      <Ionicons name="download" size={16} color="#FFFFFF" />
                    </View>
                    <Text style={styles.upgradeFeatureText}>
                      Export capabilities
                    </Text>
                  </View>
                  <View style={styles.upgradeFeature}>
                    <View style={styles.upgradeFeatureIcon}>
                      <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
                    </View>
                    <Text style={styles.upgradeFeatureText}>
                      Priority support
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={handleUpgrade}
                  activeOpacity={0.8}>
                  <Text style={styles.upgradeButtonText}>
                    Upgrade Now
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </>
        )}
      </ScrollView>

      {/* Cancel Subscription Modal */}
      <CancelSubscriptionModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onSuccess={handleCancelSuccess}
        paymentProvider={paymentProvider}
      />

      {/* Switch Billing Cycle Modal */}
      <SwitchBillingCycleModal
        visible={showBillingCycleModal}
        currentCycle={billingCycle}
        onClose={() => setShowBillingCycleModal(false)}
        onConfirm={handleBillingCycleSwitch}
      />
    </SafeAreaView>
  );
}