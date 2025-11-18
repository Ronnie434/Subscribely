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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  PlanSelection: undefined;
  PaymentScreen: { plan: 'monthly' | 'yearly' };
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
  
  const [loading, setLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [pollingMessage, setPollingMessage] = useState<string | null>(null);

  const planDetails = SUBSCRIPTION_PLANS[plan];
  const amount = planDetails.amount;

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

      // 🔍 DIAGNOSTIC: Track payment confirmation initiation
      console.log('🔍 DIAGNOSTIC: About to confirm payment', {
        hasClientSecret: !!response.clientSecret,
        clientSecretPrefix: response.clientSecret?.substring(0, 20),
        subscriptionId: response.subscriptionId,
        subscriptionStatus: response.status,
        cardComplete: cardComplete,
        timestamp: new Date().toISOString(),
      });

      // 🔍 DIAGNOSTIC: Check if we can create a payment method from CardField
      console.log('🔍 DIAGNOSTIC: Attempting to create payment method from CardField...');
      try {
        const { paymentMethod, error: pmError } = await createPaymentMethod({
          paymentMethodType: 'Card',
        });
        console.log('🔍 DIAGNOSTIC: Payment method creation result:', {
          hasPaymentMethod: !!paymentMethod,
          paymentMethodId: paymentMethod?.id,
          hasError: !!pmError,
          errorCode: pmError?.code,
          errorMessage: pmError?.message,
        });
        if (pmError) {
          console.error('🔍 DIAGNOSTIC: Payment method creation failed:', pmError);
        }
      } catch (pmTestError) {
        console.error('🔍 DIAGNOSTIC: Exception during payment method test:', pmTestError);
      }

      // Step 2: Confirm payment with Stripe
      console.log('Step 2: Confirming payment with Stripe...');
      console.log('🔍 DIAGNOSTIC: Calling confirmPayment with params:', {
        clientSecretLength: response.clientSecret?.length,
        paymentMethodType: 'Card',
      });
      
      const { error, paymentIntent } = await confirmPayment(response.clientSecret, {
        paymentMethodType: 'Card',
      });
      
      console.log('🔍 DIAGNOSTIC: confirmPayment call completed');

      // 🔍 DIAGNOSTIC: Track payment confirmation result
      console.log('🔍 DIAGNOSTIC: Payment confirmation completed', {
        hasError: !!error,
        errorCode: error?.code,
        errorMessage: error?.message,
        hasPaymentIntent: !!paymentIntent,
        paymentIntentId: paymentIntent?.id,
        paymentIntentStatus: paymentIntent?.status,
        timestamp: new Date().toISOString(),
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
          
          // DIAGNOSTIC LOG: Check what the client sees after cache refresh
          console.log('🔍 [DIAGNOSTIC] Checking subscription status after cache refresh...');
          const statusCheck = await paymentService.checkSubscriptionStatus();
          console.log('🔍 [DIAGNOSTIC] Client-side status check results:');
          console.log('🔍 [DIAGNOSTIC]   - hasActiveSubscription:', statusCheck.hasActiveSubscription);
          console.log('🔍 [DIAGNOSTIC]   - plan:', statusCheck.plan);
          console.log('🔍 [DIAGNOSTIC]   - subscription.status:', statusCheck.subscription?.status);
          console.log('🔍 [DIAGNOSTIC]   - subscription.tier_id:', statusCheck.subscription?.tier?.tier_id);
          console.log('🔍 [DIAGNOSTIC] NOTE: If tier_id is "free", payment succeeded but tier not upgraded!');
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
                console.log('Navigating to Home screen...');
                // Navigate to home screen
                navigation.navigate('Home' as any);
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
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 16,
    },
    summaryCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
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
      borderTopColor: theme.colors.border,
    },
    summaryLabel: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.textSecondary,
    },
    summaryValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    summaryTotal: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    planBadge: {
      backgroundColor: `${theme.colors.primary}20`,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    planBadgeText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    cardFieldContainer: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    cardFieldContainerFocused: {
      borderColor: theme.colors.primary,
    },
    cardField: {
      width: '100%',
      height: 50,
    },
    securityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      padding: 12,
      borderRadius: 12,
      marginBottom: 24,
    },
    securityText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.textSecondary,
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
    payButton: {
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
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    testCardInfo: {
      backgroundColor: theme.isDark ? 'rgba(255, 159, 10, 0.1)' : 'rgba(255, 159, 10, 0.1)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    testCardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.warning,
      marginBottom: 8,
    },
    testCardText: {
      fontSize: 13,
      fontWeight: '400',
      color: theme.colors.text,
      lineHeight: 20,
    },
    pollingIndicator: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    pollingText: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.colors.text,
      flex: 1,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Plan</Text>
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>
                  {plan === 'yearly' ? 'Yearly' : 'Monthly'} Premium
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Billing Cycle</Text>
              <Text style={styles.summaryValue}>
                {plan === 'yearly' ? 'Annual' : 'Monthly'}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryRowLast]}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryTotal}>
                ${amount.toFixed(2)}
                {plan === 'yearly' ? '/year' : '/month'}
              </Text>
            </View>
          </View>

          {/* What You Get */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
            What You're Getting
          </Text>
          <View style={styles.featuresContainer}>
            {planDetails.features.map((feature, index) => (
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
        </View>

        {/* Test Card Info (Development Only) */}
        {__DEV__ && (
          <View style={styles.testCardInfo}>
            <Text style={styles.testCardTitle}>Test Mode</Text>
            <Text style={styles.testCardText}>
              Use card: 4242 4242 4242 4242{'\n'}
              Any future expiry date and CVC
            </Text>
          </View>
        )}

        {/* Payment Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          
          <View
            style={[
              styles.cardFieldContainer,
              cardComplete && styles.cardFieldContainerFocused,
            ]}>
            <CardField
              postalCodeEnabled={true}
              placeholder={{
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

          <View style={styles.securityBadge}>
            <Ionicons
              name="shield-checkmark"
              size={20}
              color={theme.colors.success}
            />
            <Text style={styles.securityText}>
              Secured by Stripe • PCI-DSS Compliant
            </Text>
          </View>
        </View>

        {/* Polling Status Indicator */}
        {pollingMessage && (
          <View style={styles.pollingIndicator}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.pollingText}>{pollingMessage}</Text>
          </View>
        )}

        {/* Pay Button */}
        <TouchableOpacity
          style={[
            styles.payButton,
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

        <Text style={styles.footerNote}>
          Your subscription will automatically renew. Cancel anytime.{'\n'}
          7-day money-back guarantee.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}