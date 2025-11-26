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
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { SUBSCRIPTION_PLANS } from '../config/stripe';
import { paymentService } from '../services/paymentService';
import { usageTrackingService } from '../services/usageTrackingService';
import { subscriptionLimitService } from '../services/subscriptionLimitService';
import { subscriptionTierService } from '../services/subscriptionTierService';

type RootStackParamList = {
  SettingsHome: undefined;
  PlanSelection: undefined;
  PaymentScreen: { plan: 'monthly' | 'yearly'; origin?: 'Settings' | 'Home' };
  SubscriptionManagement: undefined;
};

type PaymentScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PaymentScreen'
>;

type PaymentScreenRouteProp = RouteProp<RootStackParamList, 'PaymentScreen'>;

interface PaymentScreenProps {
  navigation: PaymentScreenNavigationProp;
  route: PaymentScreenRouteProp;
}

export default function PaymentScreen({
  navigation,
  route,
}: PaymentScreenProps) {
  const { theme } = useTheme();
  const { confirmPayment, createPaymentMethod } = useStripe();
  const { plan } = route.params;
  
  const [initializing, setInitializing] = useState(true);
  const [cardComplete, setCardComplete] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [pollingMessage, setPollingMessage] = useState<string | null>(null);

  const planDetails = SUBSCRIPTION_PLANS[plan];
  const amount = planDetails.amount;
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 44; // Safe area top + standard header height
  const TAB_BAR_HEIGHT = 60;
  const safeAreaBottom = insets.bottom > 0 ? insets.bottom : 8;
  const bottomPadding = TAB_BAR_HEIGHT + safeAreaBottom;

  // Handle initial screen setup
  useEffect(() => {
    // Small delay to allow Stripe CardField to initialize
    const timer = setTimeout(() => {
      setInitializing(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Polls the database to confirm tier upgrade to premium
   * Returns true if premium status confirmed, false if timeout
   */
  const pollForPremiumStatus = async (): Promise<boolean> => {
    const MAX_ATTEMPTS = 7;
    const POLL_INTERVAL = 1500; // 1.5 seconds
    const TOTAL_TIMEOUT = MAX_ATTEMPTS * POLL_INTERVAL; // ~10.5 seconds
    
    console.log(`🔄 Starting premium status polling (max ${MAX_ATTEMPTS} attempts, ${TOTAL_TIMEOUT/1000}s timeout)`);
    
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        console.log(`🔄 Poll attempt ${attempt}/${MAX_ATTEMPTS}...`);
        setPollingMessage(`Confirming your upgrade... (${attempt}/${MAX_ATTEMPTS})`);
        
        const result = await subscriptionLimitService.checkCanAddSubscription();
        
        console.log(`🔄 Poll result:`, {
          attempt,
          isPremium: result.isPremium,
          canAdd: result.canAdd,
        });
        
        // Check if user is now premium
        if (result.isPremium) {
          console.log(`✅ Premium status confirmed!`);
          setPollingMessage(null);
          return true;
        }
        
        // If not the last attempt, wait before next poll
        if (attempt < MAX_ATTEMPTS) {
          console.log(`⏳ Still showing free tier, waiting ${POLL_INTERVAL}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        }
      } catch (error) {
        console.error(`⚠️ Error during poll attempt ${attempt}:`, error);
        // Continue polling even on errors
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        }
      }
    }
    
    console.log(`⏱️ Polling timeout after ${MAX_ATTEMPTS} attempts`);
    setPollingMessage(null);
    return false;
  };

  useEffect(() => {
    // Set up navigation header
    navigation.setOptions({
      title: 'Complete Payment',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ paddingLeft: 16 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme]);

  const handlePayment = async () => {
    if (!cardComplete) {
      Alert.alert('Incomplete Card', 'Please enter complete card details.');
      return;
    }

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setProcessingPayment(true);

    try {
      console.log('=== Payment Flow Started ===');
      console.log('Plan:', plan);
      console.log('Amount:', amount);
      
      // Track payment initiation
      await usageTrackingService.trackPaymentInitiated(plan, amount);

      // Step 1: Get client secret from backend
      console.log('Step 1: Initiating subscription for plan:', plan);
      const response = await paymentService.initiateSubscription(plan);
      console.log('Received response:', response);

      if (!response.clientSecret) {
        console.error('No client secret in response:', response);
        throw new Error('Failed to initialize payment - no client secret received');
      }

      console.log('Client secret received:', response.clientSecret.substring(0, 30) + '...');
      console.log('Subscription ID:', response.subscriptionId);
      console.log('Status:', response.status);

      // Step 2: Confirm payment with Stripe
      console.log('Step 2: Confirming payment with Stripe...');
      
      const { error, paymentIntent } = await confirmPayment(response.clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        console.error('Payment confirmation failed:', error);
        
        // Track payment failure
        await usageTrackingService.trackPaymentFailed(
          plan,
          error.message || 'Payment failed'
        );

        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        Alert.alert(
          'Payment Failed',
          error.message || 'Your payment could not be processed. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Payment confirmed!');
      console.log('Payment Intent ID:', paymentIntent?.id);
      console.log('Payment Intent Status:', paymentIntent?.status);

      // Step 3: Verify payment succeeded
      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'Succeeded') {
        console.log('=== Payment Succeeded ===');
        console.log('Payment Intent ID:', paymentIntent.id);
        
        // Track payment completion
        await usageTrackingService.trackPaymentCompleted(
          plan,
          amount,
          paymentIntent.id
        );

        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        // Step 4: Refresh subscription status and tier info
        console.log('Refreshing subscription status and tier info...');
        try {
          await Promise.all([
            subscriptionLimitService.refreshLimitStatus(),
            subscriptionTierService.refreshTierInfo(),
          ]);
          console.log('✅ Cache refreshed successfully');
        } catch (refreshError) {
          console.error('⚠️ Error refreshing cache (non-critical):', refreshError);
          // Continue anyway - the webhook will update the database
        }

        // Step 5: Poll for premium status confirmation
        console.log('Polling for premium status confirmation...');
        const isPremiumConfirmed = await pollForPremiumStatus();
        
        if (!isPremiumConfirmed) {
          console.log('⚠️ Premium status not confirmed within timeout period');
          console.log('⚠️ Webhook will complete the upgrade in the background');
        }

        // Show success message and navigate
        console.log('Showing success alert...');
        const alertMessage = isPremiumConfirmed
          ? 'Welcome to Premium! You now have access to all premium features.'
          : 'Your payment was successful! Your premium features will be available shortly.';
        
        Alert.alert(
          'Payment Successful!',
          alertMessage,
          [
            {
              text: 'Continue',
              onPress: () => {
                const origin = route.params?.origin;
                if (origin === 'Settings') {
                  console.log('Navigating to Settings screen...');
                  navigation.pop(2); // Pop PaymentScreen and PlanSelection to reach SettingsHome
                } else {
                  console.log('Navigating back to Home screen...');
                  navigation.pop(2); // Pop PaymentScreen and PlanSelection to reach Home
                }
              },
            },
          ]
        );
      } else {
        console.error('Unexpected payment status:', paymentIntent?.status);
        throw new Error(`Payment status is ${paymentIntent?.status || 'unknown'}`);
      }
    } catch (error) {
      console.error('=== Payment Error ===');
      console.error('Error details:', error);
      
      const errorMessage = error instanceof Error
        ? error.message
        : 'An unexpected error occurred';

      console.error('Error message:', errorMessage);

      await usageTrackingService.trackPaymentFailed(plan, errorMessage).catch(console.error);

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      Alert.alert(
        'Payment Error',
        errorMessage || 'Unable to process your payment. Please check your card details and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setProcessingPayment(false);
      console.log('=== Payment Flow Completed ===');
    }
  };

  // Show loading state while initializing
  if (initializing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{
            marginTop: 16,
            fontSize: 16,
            color: theme.colors.textSecondary
          }}>
            Loading payment details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPadding }, // Space for fixed button container
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Order Summary</Text>
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Plan</Text>
              <View style={[styles.planBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
                <Text style={[styles.planBadgeText, { color: theme.colors.primary }]}>
                  {plan === 'yearly' ? 'Yearly' : 'Monthly'} Premium
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Billing Cycle</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {plan === 'yearly' ? 'Annual' : 'Monthly'}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryRowLast, { borderTopColor: theme.colors.border }]}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Total</Text>
              <Text style={[styles.summaryTotal, { color: theme.colors.text }]}>
                ${amount.toFixed(2)}
                {plan === 'yearly' ? '/year' : '/month'}
              </Text>
            </View>
          </View>

          {/* What You Get */}
          <Text style={[styles.sectionTitle, { marginTop: 24, color: theme.colors.text }]}>
            What You're Getting
          </Text>
          <View style={styles.featuresContainer}>
            {planDetails.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: `${theme.colors.success}20` }]}>
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={theme.colors.success}
                  />
                </View>
                <Text style={[styles.featureText, { color: theme.colors.text }]}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Test Card Info (Development Only) */}
        {__DEV__ && (
          <View style={[styles.testCardInfo, { backgroundColor: theme.isDark ? 'rgba(255, 159, 10, 0.1)' : 'rgba(255, 159, 10, 0.1)' }]}>
            <Text style={[styles.testCardTitle, { color: theme.colors.warning }]}>Test Mode</Text>
            <Text style={[styles.testCardText, { color: theme.colors.text }]}>
              Use card: 4242 4242 4242 4242{'\n'}
              Any future expiry date and CVC
            </Text>
          </View>
        )}

        {/* Payment Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Payment Information</Text>
          
          <View
            style={[
              styles.cardFieldContainer,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              cardComplete && [styles.cardFieldContainerFocused, { borderColor: theme.colors.primary }],
            ]}>
            <CardField
              postalCodeEnabled={true}
              placeholders={{
                number: '4242 4242 4242 4242',
              }}
              cardStyle={{
                backgroundColor: theme.colors.card,
                textColor: theme.colors.text,
                placeholderColor: theme.colors.textSecondary,
              }}
              style={styles.cardField}
              onCardChange={(cardDetails) => {
                setCardComplete(cardDetails.complete);
              }}
            />
          </View>

          <View style={[styles.securityBadge, { backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' }]}>
            <Ionicons
              name="shield-checkmark"
              size={20}
              color={theme.colors.success}
            />
            <Text style={[styles.securityText, { color: theme.colors.textSecondary }]}>
              Secured by Stripe • PCI-DSS Compliant
            </Text>
          </View>
        </View>

        <Text style={[styles.footerNote, { color: theme.colors.textSecondary }]}>
          Your subscription will automatically renew. Cancel anytime.{'\n'}
          7-day money-back guarantee.
        </Text>
      </ScrollView>

      {/* Fixed Button Container */}
      <View style={[
        styles.buttonContainer,
        {
          paddingBottom: TAB_BAR_HEIGHT + safeAreaBottom ,
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
        }
      ]}>
        {/* Polling Status Indicator */}
        {pollingMessage && (
          <View style={[styles.pollingIndicator, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.pollingText, { color: theme.colors.text }]}>{pollingMessage}</Text>
          </View>
        )}

        {/* Pay Button */}
        <TouchableOpacity
          style={[
            styles.payButton,
            {
              backgroundColor: theme.colors.primary,
              ...Platform.select({
                ios: {
                  shadowColor: theme.colors.primary,
                },
              }),
            },
            (!cardComplete || processingPayment) && styles.payButtonDisabled,
          ]}
          onPress={handlePayment}
          disabled={!cardComplete || processingPayment}
          activeOpacity={0.8}>
          {processingPayment ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.payButtonContent}>
              <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
              <Text style={styles.payButtonText}>
                Pay ${amount.toFixed(2)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Will be overridden by theme
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF', // Will be overridden by theme
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#1C1C1E', // Will be overridden by theme
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#38383A', // Will be overridden by theme
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryRowLast: {
    marginBottom: 0,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A', // Will be overridden by theme
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#8E8E93', // Will be overridden by theme
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF', // Will be overridden by theme
  },
  summaryTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF', // Will be overridden by theme
  },
  planBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)', // Will be overridden by theme
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  planBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF', // Will be overridden by theme
  },
  cardFieldContainer: {
    backgroundColor: '#1C1C1E', // Will be overridden by theme
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#38383A', // Will be overridden by theme
    marginBottom: 16,
  },
  cardFieldContainerFocused: {
    borderColor: '#007AFF', // Will be overridden by theme
  },
  cardField: {
    width: '100%',
    height: 50,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  securityText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93', // Will be overridden by theme
    marginLeft: 8,
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
    backgroundColor: 'rgba(52, 199, 89, 0.2)', // Will be overridden by theme
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#FFFFFF', // Will be overridden by theme
    flex: 1,
  },
  payButton: {
    backgroundColor: '#007AFF', // Will be overridden by theme
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -16,
    ...Platform.select({
      ios: {
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerNote: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93', // Will be overridden by theme
    textAlign: 'center',
    lineHeight: 20,
  },
  testCardInfo: {
    backgroundColor: 'rgba(255, 159, 10, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  testCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9F0A', // Will be overridden by theme
    marginBottom: 8,
  },
  testCardText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#FFFFFF', // Will be overridden by theme
    lineHeight: 20,
  },
  pollingIndicator: {
    backgroundColor: '#1C1C1E', // Will be overridden by theme
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#38383A', // Will be overridden by theme
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pollingText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF', // Will be overridden by theme
    flex: 1,
  },
  buttonContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
});