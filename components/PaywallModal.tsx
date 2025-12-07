import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { SUBSCRIPTION_PLANS, calculateYearlySavingsPercentage } from '../config/stripe';
import { getProductIdByBillingCycle } from '../config/appleIAP';
import { usageTrackingService } from '../services/usageTrackingService';
import appleIAPService from '../services/appleIAPService';
import { subscriptionLimitService } from '../services/subscriptionLimitService';
import { subscriptionTierService } from '../services/subscriptionTierService';
import * as Haptics from 'expo-haptics';
import type { AppleIAPProduct } from '../types';
import { PurchaseState } from '../types';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgradePress: (plan: 'monthly' | 'yearly') => void;
  currentCount: number;
  maxCount: number;
  onSuccess?: () => void;
}

export default function PaywallModal({
  visible,
  onClose,
  onUpgradePress,
  currentCount,
  maxCount,
  onSuccess,
}: PaywallModalProps) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const savingsPercentage = calculateYearlySavingsPercentage();

  // State management
  const [iapProducts, setIapProducts] = useState<AppleIAPProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>(PurchaseState.IDLE);
  const [restoringPurchases, setRestoringPurchases] = useState(false);

  // Check if we're on iOS
  const isIOS = Platform.OS === 'ios';

  // Initialize IAP and fetch products on iOS
  useEffect(() => {
    let mounted = true;

    const initializeIAP = async () => {
      if (!isIOS || !visible) return;

      // Avoid re-initializing if we already have products
      if (iapProducts.length > 0) return;

      try {
        setLoadingProducts(true);
        
        console.log('[PaywallModal] 🔄 Initializing IAP...');
        
        // Initialize IAP service
        await appleIAPService.initialize();
        
        if (!appleIAPService.isInitialized()) {
          console.error('[PaywallModal] ❌ IAP initialization failed - service not initialized');
          if (mounted) {
            // Only show toast if explicitly failed, don't loop
             console.log('[PaywallModal] Failed to initialize purchase system');
          }
          return;
        }
        
        console.log('[PaywallModal] ✅ IAP initialized, fetching products...');
        
        // Fetch products from App Store
        const products = await appleIAPService.getProducts();
        
        console.log(`[PaywallModal] ✅ Fetched ${products.length} products`);
        
        if (mounted) {
          setIapProducts(products);
          
          if (products.length === 0) {
            console.warn('[PaywallModal] ⚠️ No products available');
            // Reducing toast noise
            // showToast('Products not available. Please check your connection and try again.', 'info');
          }
        }
      } catch (error: any) {
        console.error('[PaywallModal] ❌ Failed to initialize IAP:', error);
        
        if (mounted) {
           // Reducing toast noise
           // showToast(error?.message || 'Failed to load subscription options.', 'error');
        }
      } finally {
        if (mounted) {
          setLoadingProducts(false);
        }
      }
    };

    initializeIAP();

    return () => {
      mounted = false;
    };
    // Removed showToast and iapProducts.length from dependencies to prevent loops
  }, [visible, isIOS]);

  // Retry fetching products after purchase attempt (in case sandbox sign-in made them available)
  const retryFetchProducts = async () => {
    if (!isIOS) return;
    
    try {
      const products = await appleIAPService.getProducts();
      setIapProducts(products);
    } catch (error) {
      console.error('[PaywallModal] ❌ Retry fetch failed:', error);
    }
  };

  // Track paywall shown event when modal becomes visible
  useEffect(() => {
    if (visible) {
      usageTrackingService.trackPaywallShown().catch(console.error);
    }
  }, [visible]);

  const handleUpgrade = async (plan: 'monthly' | 'yearly') => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // iOS: Use Apple IAP
    if (isIOS) {
      try {
        // Ensure IAP is initialized before purchase
        if (!appleIAPService.isInitialized()) {
          console.log('[PaywallModal] ⚠️ IAP not initialized, initializing...');
          showToast('Initializing purchase system...', 'info');
          await appleIAPService.initialize();
          
          if (!appleIAPService.isInitialized()) {
            showToast('Failed to initialize purchase system. Please restart the app.', 'error');
            return;
          }
        }

        // Check if products are available
        if (iapProducts.length === 0) {
          console.log('[PaywallModal] ⚠️ No products loaded, fetching...');
          showToast('Loading subscription options...', 'info');
          
          try {
            const products = await appleIAPService.getProducts();
            setIapProducts(products);
            
            if (products.length === 0) {
              showToast(
                'Subscription products are not available. Please check your internet connection and try again.',
                'error'
              );
              return;
            }
          } catch (fetchError: any) {
            console.error('[PaywallModal] ❌ Failed to fetch products:', fetchError);
            showToast(
              'Failed to load subscription options. Please try again.',
              'error'
            );
            return;
          }
        }

        // Set purchasing state
        setPurchaseState(PurchaseState.PURCHASING);
        
        // Map plan to product ID
        const productId = getProductIdByBillingCycle(plan);
        
        if (!productId) {
          throw new Error(`No product ID found for plan: ${plan}`);
        }
        
        // Verify product exists in fetched products
        const productExists = iapProducts.some(p => p.productId === productId);
        if (!productExists) {
          console.warn('[PaywallModal] ⚠️ Product not in fetched list, but proceeding anyway');
        }
        
        console.log('[PaywallModal] 🛒 Starting purchase for:', productId);
        showToast('Initiating purchase...', 'info');
        
        // Initiate purchase through Apple IAP
        const result = await appleIAPService.purchaseSubscription(productId);
        
        console.log('[PaywallModal] 📦 Purchase result:', result);
        
        if (result.success) {
          setPurchaseState(PurchaseState.PURCHASED);
          showToast('Processing your purchase...', 'success');
          
          // Retry fetching products in case sandbox sign-in made them available
          setTimeout(() => {
            retryFetchProducts();
          }, 2000);
          
          // Close modal after short delay
          setTimeout(() => {
            onClose();
            setPurchaseState(PurchaseState.IDLE);
            // Trigger success callback
            if (onSuccess) {
              onSuccess();
            }
          }, 1500);
        } else {
          setPurchaseState(PurchaseState.FAILED);
          
          // Retry fetching products
          setTimeout(() => {
            retryFetchProducts();
          }, 1000);
          
          // Don't show error for user cancellation or already-owned
          if (result.error?.code !== 'E_USER_CANCELLED' && 
              result.error?.code !== 'already-owned' &&
              result.error?.code !== 'E_ALREADY_OWNED') {
            if (iapProducts.length === 0) {
              showToast(
                'Signing in with sandbox account may make products available. Please try again.',
                'info'
              );
            } else {
              showToast(
                result.error?.message || 'Purchase failed. Please try again.',
                'error'
              );
            }
          } else if (result.error?.code === 'already-owned' || result.error?.code === 'E_ALREADY_OWNED') {
            // Subscription already owned - restore it
            showToast('Subscription already active. Restoring...', 'info');
            
            // Restore purchases and refresh status
            setTimeout(async () => {
              try {
                await appleIAPService.restorePurchases();
                await Promise.all([
                  subscriptionLimitService.refreshLimitStatus(),
                  subscriptionTierService.refreshTierInfo(),
                ]);
                showToast('Subscription restored successfully!', 'success');
                onClose();
                // Trigger success callback
                if (onSuccess) {
                  onSuccess();
                }
              } catch (restoreError) {
                console.error('[PaywallModal] Failed to restore:', restoreError);
              }
            }, 1000);
          }
          
          // Reset state after short delay
          setTimeout(() => {
            setPurchaseState(PurchaseState.IDLE);
          }, 2000);
        }
      } catch (error: any) {
        console.error('[PaywallModal] ❌ Purchase exception:', error);
        console.error('[PaywallModal] ❌ Error details:', {
          message: error?.message,
          code: error?.code,
          stack: error?.stack,
        });
        
        setPurchaseState(PurchaseState.FAILED);
        
        // Show detailed error message
        const errorMessage = error?.message || error?.toString() || 'An error occurred. Please try again.';
        showToast(errorMessage, 'error');
        
        setTimeout(() => {
          setPurchaseState(PurchaseState.IDLE);
        }, 2000);
      }
    } else {
      // Android/Web: Use Stripe flow
      onUpgradePress(plan);
    }
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
      height: '90%',
      maxHeight: '90%',
      overflow: 'hidden',
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

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 34 : 24 }}
            showsVerticalScrollIndicator={true}
            bounces={true}>
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
                    style={[
                      styles.selectButton,
                      purchaseState === PurchaseState.PURCHASING && { opacity: 0.6 }
                    ]}
                    onPress={() => {
                      console.log('[PaywallModal] 📱 Yearly button pressed');
                      handleUpgrade('yearly');
                    }}
                    activeOpacity={0.8}
                    disabled={purchaseState === PurchaseState.PURCHASING || loadingProducts}>
                    {purchaseState === PurchaseState.PURCHASING ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.selectButtonText}>Choose Yearly</Text>
                    )}
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
                      purchaseState === PurchaseState.PURCHASING && { opacity: 0.6 }
                    ]}
                    onPress={() => {
                      console.log('[PaywallModal] 📱 Monthly button pressed');
                      handleUpgrade('monthly');
                    }}
                    activeOpacity={0.8}
                    disabled={purchaseState === PurchaseState.PURCHASING || loadingProducts}>
                    {purchaseState === PurchaseState.PURCHASING ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.selectButtonText}>Choose Monthly</Text>
                    )}
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
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}