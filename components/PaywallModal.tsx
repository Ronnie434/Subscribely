import React, { useState, useEffect, useRef } from 'react';
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
  AppState,
  AppStateStatus,
  Animated as RNAnimated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, SlideInDown, FadeOut, ZoomIn, BounceIn } from 'react-native-reanimated';
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
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const appState = useRef(AppState.currentState);
  const successScale = useRef(new RNAnimated.Value(0)).current;
  const successOpacity = useRef(new RNAnimated.Value(0)).current;
  const purchaseStateRef = useRef(purchaseState);
  const purchaseCancelledRef = useRef(false); // Track if purchase was cancelled
  
  // Keep ref in sync with state
  useEffect(() => {
    purchaseStateRef.current = purchaseState;
    // Reset cancellation flag when starting new purchase
    if (purchaseState === PurchaseState.PURCHASING) {
      purchaseCancelledRef.current = false;
    }
  }, [purchaseState]);

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
             showToast('Failed to initialize purchase system. Please restart the app.', 'error');
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
            console.warn('[PaywallModal] 📋 Troubleshooting steps:');
            console.warn('[PaywallModal] 1. Verify products exist in App Store Connect');
            console.warn('[PaywallModal] 2. Check if signed in with Sandbox account (Settings > App Store)');
            console.warn('[PaywallModal] 3. Verify Bundle ID matches product IDs');
            console.warn('[PaywallModal] 4. Ensure products are "Ready to Submit" status');
            console.warn('[PaywallModal] 5. Check Paid Applications Agreement is signed');
            
            // Show user-visible message in TestFlight
            showToast(
              'Subscription products unavailable. Please ensure you are signed in with a Sandbox test account in Settings > App Store.',
              'error'
            );
          } else {
            console.log('[PaywallModal] ✅ Products loaded successfully');
            console.log('[PaywallModal] 📦 Available products:');
            products.forEach((product, index) => {
              console.log(`[PaywallModal]   ${index + 1}. ${product.productId}`);
              console.log(`[PaywallModal]      - Title: ${product.title}`);
              console.log(`[PaywallModal]      - Price: ${product.currency} ${product.price}`);
              console.log(`[PaywallModal]      - Display: ${product.localizedPrice}`);
            });
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

  // Set up purchase cancellation callback
  useEffect(() => {
    if (!visible || !isIOS) return;

    // Register callback to detect purchase cancellation
    appleIAPService.setPurchaseCancellationCallback(() => {
      console.log('[PaywallModal] 📢 Purchase cancellation detected via callback');
      purchaseCancelledRef.current = true;
      
      // Reset purchase state immediately
      if (purchaseStateRef.current === PurchaseState.PURCHASING) {
        console.log('[PaywallModal] 🔄 Resetting purchase state due to cancellation');
        setPurchaseState(PurchaseState.IDLE);
      }
    });

    return () => {
      // Clean up callback when modal closes
      appleIAPService.setPurchaseCancellationCallback(null);
    };
  }, [visible, isIOS]);

  // Listen for app state changes to refresh after purchase
  useEffect(() => {
    if (!visible) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // When app comes back to foreground after being in background
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[PaywallModal] 🔄 App returned to foreground, refreshing subscription status...');
        
        // Only check for purchase completion if we're in PURCHASING state
        if (purchaseStateRef.current !== PurchaseState.PURCHASING) {
          console.log('[PaywallModal] ℹ️ Not in purchasing state, skipping check');
          appState.current = nextAppState;
          return;
        }
        
        // Add a delay to let error listener fire first if user cancelled
        // This prevents race condition where AppState fires before error listener
        // We use 1 second to ensure error listener has time to process
        setTimeout(async () => {
          // Check if purchase was cancelled (set by timeout or error detection)
          if (purchaseCancelledRef.current) {
            console.log('[PaywallModal] ℹ️ Purchase was cancelled, skipping premium check');
            return;
          }
          
          // Double-check we're still in purchasing state (error listener might have reset it)
          if (purchaseStateRef.current !== PurchaseState.PURCHASING) {
            console.log('[PaywallModal] ℹ️ Purchase state changed during delay (likely cancelled), skipping check');
            return;
          }
          
          try {
            // Get previous premium status before refresh
            const wasPremium = await subscriptionTierService.isPremiumUser();
            
            // Refresh subscription status
            await Promise.all([
              subscriptionLimitService.refreshLimitStatus(),
              subscriptionTierService.refreshTierInfo(),
            ]);
            
            // Get updated premium status after refresh
            const isNowPremium = await subscriptionTierService.isPremiumUser();
            
            console.log('[PaywallModal] ✅ Subscription status refreshed');
            console.log(`[PaywallModal] 📊 Premium status: ${wasPremium} → ${isNowPremium}`);
            
            // Check if user just upgraded to premium
            if (!wasPremium && isNowPremium) {
              console.log('[PaywallModal] 🎉 Purchase completed! User is now premium');
              setPurchaseState(PurchaseState.PURCHASED);
              showSuccessCheckmark();
              
              // Close modal after animation
              setTimeout(() => {
                onClose();
                setPurchaseState(PurchaseState.IDLE);
                if (onSuccess) {
                  onSuccess();
                }
              }, 2500);
            } else {
              // No upgrade detected - user likely cancelled
              console.log('[PaywallModal] ℹ️ No upgrade detected, resetting purchase state');
              purchaseCancelledRef.current = true; // Mark as cancelled to prevent future checks
              setPurchaseState(PurchaseState.IDLE);
            }
          } catch (error) {
            console.error('[PaywallModal] ❌ Error refreshing subscription status:', error);
            // Reset state on error
            setPurchaseState(PurchaseState.IDLE);
          }
        }, 1000); // 1 second delay to let error listener fire first
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [visible, purchaseState, onClose, onSuccess]);

  // Animate success checkmark
  const showSuccessCheckmark = () => {
    setShowSuccessAnimation(true);
    
    // Haptic feedback
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Animate scale and opacity
    RNAnimated.parallel([
      RNAnimated.spring(successScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      RNAnimated.timing(successOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Hide after delay
    setTimeout(() => {
      RNAnimated.parallel([
        RNAnimated.timing(successScale, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        RNAnimated.timing(successOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowSuccessAnimation(false);
        successScale.setValue(0);
        successOpacity.setValue(0);
      });
    }, 2000);
  };

  const handleUpgrade = async (plan: 'monthly' | 'yearly') => {
    console.log(`[PaywallModal] 🎯 handleUpgrade called with plan: ${plan}`);
    
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // iOS: Use Apple IAP
    if (isIOS) {
      console.log('[PaywallModal] 📱 iOS detected, using Apple IAP');
      
      try {
        // Ensure IAP is initialized before purchase
        if (!appleIAPService.isInitialized()) {
          console.log('[PaywallModal] ⚠️ IAP not initialized, initializing...');
          showToast('Initializing purchase system...', 'info');
          await appleIAPService.initialize();
          
          if (!appleIAPService.isInitialized()) {
            console.error('[PaywallModal] ❌ Failed to initialize IAP after attempt');
            showToast('Failed to initialize purchase system. Please restart the app.', 'error');
            return;
          }
          console.log('[PaywallModal] ✅ IAP initialized successfully');
        } else {
          console.log('[PaywallModal] ✅ IAP already initialized');
        }

        // Check if products are available
        console.log(`[PaywallModal] 📦 Checking products availability... (${iapProducts.length} products loaded)`);
        
        if (iapProducts.length === 0) {
          console.log('[PaywallModal] ⚠️ No products loaded, fetching...');
          showToast('Loading subscription options...', 'info');
          
          try {
            const products = await appleIAPService.getProducts();
            setIapProducts(products);
            
            console.log(`[PaywallModal] 📦 Fetched ${products.length} products`);
            
            if (products.length === 0) {
              console.error('[PaywallModal] ❌ Still no products after fetch');
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
        } else {
          console.log('[PaywallModal] ✅ Products already available');
        }

        // Set purchasing state
        setPurchaseState(PurchaseState.PURCHASING);
        
        // Map plan to product ID
        const productId = getProductIdByBillingCycle(plan);
        
        console.log(`[PaywallModal] 🔍 Mapped plan "${plan}" to product ID: ${productId}`);
        
        if (!productId) {
          console.error(`[PaywallModal] ❌ No product ID found for plan: ${plan}`);
          throw new Error(`No product ID found for plan: ${plan}`);
        }
        
        // Verify product exists in fetched products
        const productExists = iapProducts.some(p => p.productId === productId);
        console.log(`[PaywallModal] 🔍 Product exists in fetched list: ${productExists}`);
        
        if (!productExists) {
          console.warn('[PaywallModal] ⚠️ Product not in fetched list, but proceeding anyway');
          console.warn('[PaywallModal] 📋 Available products:', iapProducts.map(p => p.productId).join(', '));
        }
        
        console.log('[PaywallModal] 🛒 Starting purchase for:', productId);
        
        // Initiate purchase through Apple IAP
        const result = await appleIAPService.purchaseSubscription(productId);
        
        console.log('[PaywallModal] 📦 Purchase result:', result);
        
        // Check if purchase request failed immediately
        if (!result.success) {
          setPurchaseState(PurchaseState.FAILED);
          
          // Don't show error toast for user cancellation
          if (result.error?.code !== 'E_USER_CANCELLED' && 
              result.error?.code !== 'user-cancelled') {
            showToast(result.error?.message || 'Purchase failed', 'error');
          } else {
            console.log('[PaywallModal] ℹ️ User cancelled purchase');
          }
          
          // Reset state
          setTimeout(() => {
            setPurchaseState(PurchaseState.IDLE);
          }, 1000);
          return;
        }
        
        // Purchase request was sent - popup is showing to user
        // Stay in PURCHASING state and wait for actual completion
        console.log('[PaywallModal] ⏳ Purchase popup shown, waiting for user action...');
        console.log('[PaywallModal] ℹ️ Success will be detected via AppState listener when subscription updates');
        
        // Reset cancellation flag for new purchase
        purchaseCancelledRef.current = false;
        
        // Set a timeout to reset state if nothing happens (user cancelled)
        // This will fire if user cancels and error listener doesn't reset state quickly enough
        setTimeout(() => {
          if (purchaseStateRef.current === PurchaseState.PURCHASING) {
            console.log('[PaywallModal] ⏱️ Purchase timeout - user likely cancelled, resetting state');
            purchaseCancelledRef.current = true;
            setPurchaseState(PurchaseState.IDLE);
          }
        }, 15000); // 15 second timeout
        
        // The actual success handling happens in the AppState listener above
        // When user completes purchase:
        // 1. Purchase listener updates subscription in database
        // 2. User closes Apple popup and returns to app
        // 3. AppState listener detects foreground
        // 4. Checks if user is now premium
        // 5. Shows success animation if upgrade detected
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
    console.log('[PaywallModal] 🚪 Close button pressed');
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
      position: 'relative',
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
      zIndex: 1000,
      elevation: 1000, // Android
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
      gap: 16,
      marginTop: 24,
      marginBottom: 24,
    },
    planCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      borderWidth: 2,
      borderColor: theme.colors.border,
      position: 'relative',
      minHeight: 180,
      ...Platform.select({
        ios: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    planCardSelected: {
      borderColor: theme.colors.primary,
      borderWidth: 3,
      backgroundColor: theme.isDark 
        ? `${theme.colors.primary}15`
        : `${theme.colors.primary}08`,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    recommendedBadge: {
      position: 'absolute',
      top: -10,
      left: 24,
      right: 24,
      alignItems: 'center',
      zIndex: 10,
    },
    recommendedGradient: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 20,
      overflow: 'hidden',
    },
    recommendedText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FFFFFF',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 16,
    },
    planName: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: -0.5,
      marginTop: 8,
      marginBottom: 12,
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    savingsBadge: {
      backgroundColor: theme.colors.success,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      marginLeft: 12,
    },
    savingsText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    price: {
      fontSize: 36,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -1,
    },
    period: {
      fontSize: 18,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      marginLeft: 6,
    },
    billingNote: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      marginBottom: 20,
      lineHeight: 20,
    },
    planCheckmark: {
      position: 'absolute',
      top: 20,
      right: 20,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
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
    successOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    successContent: {
      alignItems: 'center',
      padding: 32,
    },
    successCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.colors.success,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    successTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 8,
      textAlign: 'center',
    },
    successSubtitle: {
      fontSize: 16,
      fontWeight: '400',
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'center',
      lineHeight: 24,
    },
    continueButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 16,
      paddingVertical: 18,
      paddingHorizontal: 48,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      marginBottom: 16,
    },
    continueButtonDisabled: {
      opacity: 0.6,
    },
    continueButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    loadingText: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      marginTop: 12,
      textAlign: 'center',
    },
    restoreButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      marginTop: 16,
    },
    restoreButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
      textAlign: 'center',
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
          {/* Close Button - Must be above ScrollView */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            pointerEvents="box-only">
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 34 : 24, paddingTop: 8 }}
            showsVerticalScrollIndicator={true}
            bounces={true}
            scrollEnabled={true}
            contentInsetAdjustmentBehavior="automatic">
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
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setSelectedPlan('yearly');
                }}>
                <Animated.View entering={FadeIn.delay(400)}>
                  <View style={[
                    styles.planCard,
                    selectedPlan === 'yearly' && styles.planCardSelected
                  ]}>
                    {/* Best Value Badge - Centered at top */}
                    <View style={styles.recommendedBadge}>
                      <LinearGradient
                        colors={theme.gradients.success as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.recommendedGradient}>
                        <Text style={styles.recommendedText}>Best Value</Text>
                      </LinearGradient>
                    </View>

                    {/* Selection Checkmark - Top Right */}
                    {selectedPlan === 'yearly' && (
                      <View style={styles.planCheckmark}>
                        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                      </View>
                    )}

                    {/* Plan Name */}
                    <Text style={styles.planName}>Yearly</Text>

                    {/* Price Row with Savings Badge */}
                    <View style={styles.priceContainer}>
                      <View style={styles.priceRow}>
                        <Text style={styles.price}>
                          ${SUBSCRIPTION_PLANS.yearly.amount.toFixed(2)}
                        </Text>
                        <Text style={styles.period}>/year</Text>
                      </View>
                      <View style={styles.savingsBadge}>
                        <Text style={styles.savingsText}>
                          Save {savingsPercentage}%
                        </Text>
                      </View>
                    </View>

                    {/* Billing Note */}
                    <Text style={styles.billingNote}>
                      ${(SUBSCRIPTION_PLANS.yearly.amount / 12).toFixed(2)} per month
                    </Text>
                  </View>
                </Animated.View>
              </TouchableOpacity>

              {/* Monthly Plan */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setSelectedPlan('monthly');
                }}>
                <Animated.View entering={FadeIn.delay(500)}>
                  <View style={[
                    styles.planCard,
                    selectedPlan === 'monthly' && styles.planCardSelected
                  ]}>
                    {/* Selection Checkmark - Top Right */}
                    {selectedPlan === 'monthly' && (
                      <View style={styles.planCheckmark}>
                        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                      </View>
                    )}

                    {/* Plan Name */}
                    <Text style={styles.planName}>Monthly</Text>

                    {/* Price */}
                    <View style={styles.priceContainer}>
                      <View style={styles.priceRow}>
                        <Text style={styles.price}>
                          ${SUBSCRIPTION_PLANS.monthly.amount.toFixed(2)}
                        </Text>
                        <Text style={styles.period}>/month</Text>
                      </View>
                    </View>

                    {/* Billing Note */}
                    <Text style={styles.billingNote}>
                      Billed monthly, cancel anytime
                    </Text>
                  </View>
                </Animated.View>
              </TouchableOpacity>
            </View>

            {/* Single Continue Button */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                (purchaseState === PurchaseState.PURCHASING || loadingProducts) && styles.continueButtonDisabled
              ]}
              onPress={() => {
                console.log(`[PaywallModal] 📱 Continue button pressed with ${selectedPlan} plan`);
                handleUpgrade(selectedPlan);
              }}
              activeOpacity={0.8}
              disabled={purchaseState === PurchaseState.PURCHASING || loadingProducts}>
              {purchaseState === PurchaseState.PURCHASING ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.continueButtonText}>
                  Continue with {selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'}
                </Text>
              )}
            </TouchableOpacity>

            {loadingProducts && (
              <Text style={styles.loadingText}>Loading subscription options...</Text>
            )}

            {/* Restore Purchases Button (iOS only) - Hidden for now */}
            {false && isIOS && (
              <TouchableOpacity
                style={styles.restoreButton}
                onPress={async () => {
                  if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setRestoringPurchases(true);
                  try {
                    await appleIAPService.restorePurchases();
                    showToast('Purchases restored successfully!', 'success');
                  } catch (error: any) {
                    showToast(error?.message || 'Failed to restore purchases', 'error');
                  } finally {
                    setRestoringPurchases(false);
                  }
                }}
                activeOpacity={0.7}
                disabled={restoringPurchases}>
                <Text style={styles.restoreButtonText}>
                  {restoringPurchases ? 'Restoring...' : 'Restore Purchases'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Maybe Later */}
            <TouchableOpacity
              style={styles.maybeLaterButton}
              onPress={handleClose}
              activeOpacity={0.7}>
              <Text style={styles.maybeLaterText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>

          {/* Success Overlay */}
          {showSuccessAnimation && (
            <RNAnimated.View 
              style={[
                styles.successOverlay,
                {
                  opacity: successOpacity,
                },
              ]}>
              <Animated.View entering={ZoomIn.springify().damping(15)}>
                <View style={styles.successContent}>
                  <RNAnimated.View 
                    style={[
                      styles.successCircle,
                      {
                        transform: [{ scale: successScale }],
                      },
                    ]}>
                    <Ionicons name="checkmark" size={64} color="#FFFFFF" />
                  </RNAnimated.View>
                  
                  <Text style={styles.successTitle}>Welcome to Premium!</Text>
                  <Text style={styles.successSubtitle}>
                    You now have unlimited access to all premium features
                  </Text>
                </View>
              </Animated.View>
            </RNAnimated.View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}