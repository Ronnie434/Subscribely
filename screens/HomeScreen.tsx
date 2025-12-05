import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { Subscription } from '../types';
import { storage } from '../utils/storage';
import { calculations } from '../utils/calculations';
import SubscriptionCard from '../components/SubscriptionCard';
import EmptyState from '../components/EmptyState';
import AnimatedPressable from '../components/AnimatedPressable';
import { SkeletonCard } from '../components/SkeletonLoader';
import CollapsibleSection from '../components/CollapsibleSection';
import SearchInput from '../components/SearchInput';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import PaywallModal from '../components/PaywallModal';
import UpgradePrompt from '../components/UpgradePrompt';
import LimitReachedBanner from '../components/LimitReachedBanner';
import { subscriptionLimitService } from '../services/subscriptionLimitService';
import { usageTrackingService } from '../services/usageTrackingService';
import { useRealtimeSubscriptions } from '../hooks/useRealtimeSubscriptions';
import { supabase } from '../config/supabase';

type SubscriptionsStackParamList = {
  Home: undefined;
  AddSubscription: { subscription?: Subscription };
  EditSubscription: { subscription: Subscription };
};

type HomeScreenNavigationProp = StackNavigationProp<SubscriptionsStackParamList, 'Home'>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [limitStatus, setLimitStatus] = useState({ currentCount: 0, maxCount: 5, atLimit: false, isPremium: false });
  const [searchQuery, setSearchQuery] = useState('');

  // Helper function to refresh limit status from backend
  const refreshLimitStatusFromBackend = async () => {
    try {
      // Invalidate cache and refresh from backend
      await subscriptionLimitService.refreshLimitStatus();
      
      // Get fresh status from backend
      const status = await subscriptionLimitService.getSubscriptionLimitStatus();
      
      const newLimitStatus = {
        currentCount: status.currentCount,
        maxCount: status.maxAllowed || 5,
        atLimit: !status.canAddMore,
        isPremium: status.isPremium,
      };
      
      setLimitStatus(newLimitStatus);
      
      if (__DEV__) {
        console.log('✅ Limit status refreshed from backend:', {
          currentCount: status.currentCount,
          maxCount: status.maxAllowed || 5,
          atLimit: !status.canAddMore,
        });
      }
    } catch (error) {
      console.error('Error refreshing limit status:', error);
      // On error, the useEffect watching subscriptions.length will update currentCount as fallback
    }
  };

  // Set up real-time subscriptions
  const { isConnected, error: realtimeError } = useRealtimeSubscriptions(user?.id, {
    onInsert: (newSubscription) => {
      if (__DEV__) {
        console.log('Real-time INSERT:', newSubscription.name);
      }
      setSubscriptions((prev) => {
        const exists = prev.some((sub) => sub.id === newSubscription.id);
        if (exists) {
          if (__DEV__) {
            console.log('Subscription already exists, skipping insert');
          }
          return prev;
        }
        return [newSubscription, ...prev];
      });
      // Refresh limit status from backend to keep count in sync
      refreshLimitStatusFromBackend();
    },
    onUpdate: (updatedSubscription) => {
      if (__DEV__) {
        console.log('Real-time UPDATE:', updatedSubscription.name);
      }
      setSubscriptions((prev) => {
        const index = prev.findIndex((sub) => sub.id === updatedSubscription.id);
        if (index === -1) {
          if (__DEV__) {
            console.log('Subscription not found for update, adding it');
          }
          return [updatedSubscription, ...prev];
        }
        const updated = [...prev];
        updated[index] = updatedSubscription;
        return updated;
      });
      // Note: Updates don't change count, but refresh to ensure consistency
      refreshLimitStatusFromBackend();
    },
    onDelete: (deletedId) => {
      if (__DEV__) {
        console.log('Real-time DELETE:', deletedId);
      }
      setSubscriptions((prev) => {
        const filtered = prev.filter((sub) => sub.id !== deletedId);
        if (filtered.length === prev.length) {
          if (__DEV__) {
            console.log('Subscription not found for delete');
          }
        }
        return filtered;
      });
      // Refresh limit status from backend to keep count in sync
      refreshLimitStatusFromBackend();
    },
  });

  // Show real-time connection error if any
  useEffect(() => {
    if (realtimeError) {
      console.error('Real-time connection error:', realtimeError);
    }
  }, [realtimeError]);

  // Set up navigation header with add button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <AnimatedPressable
          onPress={handleAddSubscription}
          style={styles.addButton}>
          <Ionicons name="add" size={28} color={theme.colors.primary} />
        </AnimatedPressable>
      ),
    });
  }, [navigation]);

  const loadSubscriptions = async (forceRefresh = false) => {
    try {
      const data = forceRefresh ? await storage.refresh() : await storage.getAll();
      setSubscriptions(data);
      if (__DEV__ && data.length > 0) {
        console.log(`Loaded ${data.length} subscriptions`);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load subscriptions';
      Alert.alert(
        'Error Loading Subscriptions',
        errorMessage.includes('network') || errorMessage.includes('Network')
          ? 'Please check your internet connection and try again.'
          : errorMessage
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Update subscription count in real-time when subscriptions change
  // while preserving backend's maxCount and atLimit values
  useEffect(() => {
    setLimitStatus(prev => {
      const newCount = subscriptions.length;
      return {
        ...prev,
        currentCount: newCount,
        atLimit: newCount >= prev.maxCount,  // Recalculate based on new count
      };
    });
  }, [subscriptions.length]);

  // REMOVED: This useEffect was overwriting correct backend premium status with hardcoded logic
  // The useFocusEffect (lines 208-250) already correctly sets limitStatus based on backend data
  /*
  useEffect(() => {
    const count = subscriptions.length;
    console.log('🐛 DEBUG: useEffect triggered - subscriptions changed');
    console.log('🐛 Current subscriptions count:', count);
    console.log('🐛 BEFORE setLimitStatus - current limitStatus:', limitStatus);
    
    setLimitStatus({
      currentCount: count,
      maxCount: 5,
      atLimit: count >= 5,  // ← HARDCODED: Always true when >= 5 subs (WRONG for premium users)
    });
    
    console.log('🐛 AFTER setLimitStatus - new limitStatus will be:', {
      currentCount: count,
      maxCount: 5,
      atLimit: count >= 5,
    });
    console.log('🐛 ⚠️ WARNING: This useEffect OVERWRITES backend data with hardcoded logic!');
  }, [subscriptions]);
  */

  const handleAddSubscription = async () => {
    try {
      // Check if user can add more subscriptions
      const check = await subscriptionLimitService.checkCanAddSubscription();
      
      if (!check.canAdd) {
        // Track limit reached event
        await usageTrackingService.trackLimitReached();
        
        // Show paywall modal
        setPaywallVisible(true);
        
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        return;
      }
      
      // User can add, navigate to add screen
      navigation.navigate('AddSubscription', {});
    } catch (error) {
      console.error('Error checking subscription limit:', error);
      // On error, allow navigation (fail open)
      navigation.navigate('AddSubscription', {});
    }
  };

  const handleUpgradePress = (plan: 'monthly' | 'yearly') => {
    setPaywallVisible(false);
    // Navigate to plan selection screen
    navigation.navigate('PlanSelection' as any);
  };

  const handleUpgradePromptPress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigation.navigate('PlanSelection' as any);
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (__DEV__) {
        console.log('HomeScreen focused - force refreshing from Supabase...');
      }
      
      // Refresh subscriptions and subscription status
      const refreshAll = async () => {
        try {
          // Refresh subscription limit status (clears cache and re-fetches)
          await subscriptionLimitService.refreshLimitStatus();
          
          // Get fresh status
          const status = await subscriptionLimitService.getSubscriptionLimitStatus();
          
          setLimitStatus({
            currentCount: status.currentCount,
            maxCount: status.maxAllowed || 5,
            atLimit: !status.canAddMore,
            isPremium: status.isPremium,
          });
          
          // Refresh subscriptions list
          await loadSubscriptions(true);
        } catch (error) {
          console.error('Error refreshing on focus:', error);
          // Still try to load subscriptions even if limit refresh fails
          await loadSubscriptions(true);
        }
      };
      
      refreshAll();
      return () => {};
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await storage.refresh();
      setSubscriptions(data);
    } catch (error) {
      console.error('Error refreshing subscriptions:', error);
      await loadSubscriptions();
    } finally {
      setRefreshing(false);
    }
  };

  const handleEdit = (subscription: Subscription) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate('EditSubscription', { subscription });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleDelete = (subscription: Subscription) => {
    Alert.alert(
      'Delete Recurring Item',
      `Are you sure you want to delete ${subscription.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS === 'ios') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            
            const previousSubscriptions = [...subscriptions];
            
            setSubscriptions(prev => prev.filter(s => s.id !== subscription.id));
            
            try {
              const success = await storage.delete(subscription.id);
              
              if (!success) {
                setSubscriptions(previousSubscriptions);
                if (Platform.OS === 'ios') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }
                Alert.alert(
                  'Failed to Delete',
                  'Could not delete recurring item. Please try again.',
                  [{ text: 'OK' }]
                );
              } else {
                // Refresh limit status after successful delete
                // (Real-time hook will also trigger, but this ensures sync even if real-time is delayed)
                await refreshLimitStatusFromBackend();
              }
            } catch (error) {
              console.error('Error deleting subscription:', error);
              setSubscriptions(previousSubscriptions);
              if (Platform.OS === 'ios') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
              Alert.alert(
                'Failed to Delete',
                'Could not delete recurring item. Please try again.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  };

  // Filter subscriptions based on search query
  const filteredSubscriptions = searchQuery.trim() === ''
    ? subscriptions
    : subscriptions.filter(sub =>
        sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sub.category && sub.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sub.cost && sub.cost.toString().includes(searchQuery))
      );

  // Group filtered subscriptions by repeat interval
  const groupedByInterval = filteredSubscriptions.reduce((acc, sub) => {
    const interval = sub.repeat_interval;
    if (!acc[interval]) {
      acc[interval] = [];
    }
    acc[interval].push(sub);
    return acc;
  }, {} as Record<string, Subscription[]>);

  const totalMonthlyCost = calculations.getTotalMonthlyCost(filteredSubscriptions);
  
  // Define display order for intervals
  const intervalOrder = ['weekly', 'biweekly', 'semimonthly', 'monthly', 'bimonthly', 'quarterly', 'semiannually', 'yearly', 'never'];
  const intervalLabels: Record<string, string> = {
    weekly: 'Every Week',
    biweekly: 'Every 2 Weeks',
    semimonthly: 'Twice Per Month',
    monthly: 'Every Month',
    bimonthly: 'Every 2 Months',
    quarterly: 'Every 3 Months',
    semiannually: 'Every 6 Months',
    yearly: 'Every Year',
    never: 'One-Time Charges'
  };

  // Calculate bottom padding to avoid tab bar overlay
  const TAB_BAR_HEIGHT = 60;
  const safeAreaBottom = insets.bottom > 0 ? insets.bottom : 8;
  const bottomPadding = TAB_BAR_HEIGHT + safeAreaBottom + 20;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerCard: {
      backgroundColor: theme.colors.card,
      marginTop: 16,
      marginBottom: 12,
      marginHorizontal: 16,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#00000010',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    headerLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    totalAmount: {
      fontSize: 48,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
      letterSpacing: -1,
      lineHeight: 56,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    statBadge: {
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    statText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
      lineHeight: 18,
    },
    scrollContent: {
      paddingBottom: bottomPadding,
    },
    emptyContainer: {
      flex: 1,
    },
    addButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    skeletonContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    noResultsContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 32,
    },
    noResultsIcon: {
      marginBottom: 16,
      opacity: 0.5,
    },
    noResultsText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    noResultsSubtext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

  // Render skeleton loading
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <Text style={styles.headerLabel}>MONTHLY TOTAL</Text>
          <Text style={styles.totalAmount}>$---.--</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBadge}>
              <Text style={styles.statText}>-- monthly</Text>
            </View>
          </View>
        </View>
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={subscriptions.length === 0 ? styles.emptyContainer : styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}>
        
        {/* Summary Card */}
        <View style={styles.headerCard}>
          <Text style={styles.headerLabel}>MONTHLY TOTAL</Text>
          <Text style={styles.totalAmount}>${totalMonthlyCost.toFixed(2)}</Text>
          {/* {recurringItems.length > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statBadge}>
                <Text style={styles.statText}>-- items</Text>
              </View>
            </View>
          )} */}
        </View>

        {/* Search Input - Only show when there are subscriptions */}
        {subscriptions.length > 0 && (
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClear={handleClearSearch}
            placeholder="Search..."
          />
        )}

        {/* Empty State */}
        {subscriptions.length === 0 && <EmptyState />}

        {/* No Search Results */}
        {subscriptions.length > 0 && filteredSubscriptions.length === 0 && (
          <View style={styles.noResultsContainer}>
            <Ionicons
              name="search-outline"
              size={48}
              color={theme.colors.textSecondary}
              style={styles.noResultsIcon}
            />
            <Text style={styles.noResultsText}>No subscriptions found</Text>
            <Text style={styles.noResultsSubtext}>
              Try adjusting your search query
            </Text>
          </View>
        )}

        {/* Grouped by Interval Sections */}
        {intervalOrder.map((interval) => {
          const items = groupedByInterval[interval];
          if (!items || items.length === 0) return null;
          
          return (
            <CollapsibleSection
              key={interval}
              title={intervalLabels[interval]}
              count={items.length}>
              {items.map((item, index) => (
                <Animated.View
                  key={item.id}
                  entering={FadeInDown.delay(index * 50).springify()}>
                  <SubscriptionCard
                    subscription={item}
                    onPress={() => handleEdit(item)}
                    onLongPress={() => handleDelete(item)}
                  />
                </Animated.View>
              ))}
            </CollapsibleSection>
          );
        })}
      </ScrollView>

      {/* Paywall Modal */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onUpgradePress={handleUpgradePress}
        currentCount={limitStatus.currentCount}
        maxCount={limitStatus.maxCount}
      />

      {/* Upgrade Prompt for Free Users (shown when not at limit) */}
      {!loading && subscriptions.length > 0 && !limitStatus.isPremium && limitStatus.currentCount < limitStatus.maxCount && (
        <UpgradePrompt onPress={handleUpgradePromptPress} />
      )}

      {/* Limit Reached Banner (sticky, can't be dismissed) */}
      {!loading && limitStatus.atLimit && (
        <LimitReachedBanner
          currentCount={limitStatus.currentCount}
          maxCount={limitStatus.maxCount}
          onUpgradePress={handleUpgradePromptPress}
        />
      )}
    </View>
  );
}