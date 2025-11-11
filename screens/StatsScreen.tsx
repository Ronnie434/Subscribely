import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '../contexts/ThemeContext';
import { Subscription } from '../types';
import { storage } from '../utils/storage';
import { calculations } from '../utils/calculations';
import { parseLocalDate } from '../utils/dateHelpers';
import CategoryBar from '../components/CategoryBar';
import InsightCard from '../components/InsightCard';
import RenewalItem from '../components/RenewalItem';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { useRealtimeSubscriptions } from '../hooks/useRealtimeSubscriptions';

type SubscriptionsStackParamList = {
  Home: undefined;
  AddSubscription: { subscription?: Subscription };
  EditSubscription: { subscription: Subscription };
  Stats: undefined;
};

type StatsScreenNavigationProp = StackNavigationProp<SubscriptionsStackParamList, 'Stats'>;

export default function StatsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<StatsScreenNavigationProp>();
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Set up real-time subscriptions for live updates
  useRealtimeSubscriptions(user?.id, {
    onInsert: (newSubscription) => {
      setSubscriptions((prev) => {
        const exists = prev.some((sub) => sub.id === newSubscription.id);
        if (exists) return prev;
        return [newSubscription, ...prev];
      });
    },
    onUpdate: (updatedSubscription) => {
      setSubscriptions((prev) => {
        const index = prev.findIndex((sub) => sub.id === updatedSubscription.id);
        if (index === -1) return [updatedSubscription, ...prev];
        const updated = [...prev];
        updated[index] = updatedSubscription;
        return updated;
      });
    },
    onDelete: (deletedId) => {
      setSubscriptions((prev) => prev.filter((sub) => sub.id !== deletedId));
    },
  });

  const loadSubscriptions = async (forceRefresh = false) => {
    try {
      const data = forceRefresh ? await storage.refresh() : await storage.getAll();
      setSubscriptions(data);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load subscriptions';
      Alert.alert(
        'Error Loading Data',
        errorMessage.includes('network') || errorMessage.includes('Network')
          ? 'Please check your internet connection and try again.'
          : errorMessage
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSubscriptions(true);
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

  const handleRenewalPress = (subscription: Subscription) => {
    navigation.navigate('EditSubscription', { subscription });
  };

  // Calculate statistics
  const totalMonthly = calculations.getTotalMonthlyCost(subscriptions);
  const totalYearly = calculations.getTotalYearlyCost(subscriptions);
  const averageCost = calculations.getAverageMonthlyCost(subscriptions);
  const billingDistribution = calculations.getBillingCycleDistribution(subscriptions);
  const nextRenewal = calculations.getNextRenewalDate(subscriptions);
  const categoryBreakdown = calculations.getCategorySorted(subscriptions);
  const renewalTimeline = calculations.getRenewalTimeline(subscriptions, 30);
  const insights = calculations.generateInsights(subscriptions);

  // Format next renewal date
  const formatNextRenewal = () => {
    if (!nextRenewal) return 'None';
    const daysUntil = calculations.getDaysUntilRenewal(nextRenewal);
    
    if (daysUntil === 0) return 'Today';
    if (daysUntil === 1) return 'Tomorrow';
    if (daysUntil <= 7) return `${daysUntil} days`;
    
    const date = parseLocalDate(nextRenewal);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingBottom: 32,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    
    // Card styles matching HomeScreen
    card: {
      backgroundColor: theme.colors.card,
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 16,
      padding: 20,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.isDark ? 0.3 : 0.08,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    cardHeader: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    largeValue: {
      fontSize: 48,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
      letterSpacing: -1,
    },
    subtitle: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    
    // Stats grid
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginHorizontal: 16,
      marginBottom: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.isDark ? 0.3 : 0.06,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    statLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: -0.5,
    },
    statSubtext: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    
    // Section headers
    sectionHeader: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.text,
      letterSpacing: -0.2,
    },
    
    // Billing cycle specific
    billingRow: {
      flexDirection: 'row',
      gap: 16,
    },
    billingItem: {
      flex: 1,
      alignItems: 'center',
    },
    billingValue: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    billingLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    
    // Renewal groups
    renewalGroup: {
      marginBottom: 20,
    },
    renewalGroupTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    emptyText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

  if (loading) {
    return <LoadingIndicator />;
  }

  if (subscriptions.length === 0) {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <EmptyState
            title="No Statistics Yet"
            message="Add subscriptions to see your spending insights"
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Main Monthly Total Card - Clean Design */}
        <View style={[styles.card, { marginTop: 16 }]}>
          <Text style={styles.cardHeader}>MONTHLY SPENDING</Text>
          <Text style={styles.largeValue}>${totalMonthly.toFixed(2)}</Text>
          <Text style={styles.subtitle}>${totalYearly.toFixed(2)} per year</Text>
        </View>

        {/* Quick Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Average</Text>
            <Text style={styles.statValue}>${averageCost.toFixed(2)}</Text>
            <Text style={styles.statSubtext}>per month</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Subs</Text>
            <Text style={styles.statValue}>{subscriptions.length}</Text>
          </View>
        </View>

        {/* Billing Cycles Card */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Billing Cycles</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.billingRow}>
            <View style={styles.billingItem}>
              <Text style={styles.billingValue}>{billingDistribution.monthly}</Text>
              <Text style={styles.billingLabel}>Monthly</Text>
            </View>
            <View style={styles.billingItem}>
              <Text style={styles.billingValue}>{billingDistribution.yearly}</Text>
              <Text style={styles.billingLabel}>Yearly</Text>
            </View>
          </View>
        </View>

        {/* Category Breakdown */}
        {categoryBreakdown.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Spending by Category</Text>
            </View>
            <View style={styles.card}>
              {categoryBreakdown.map((item) => (
                <CategoryBar
                  key={item.category}
                  category={item.category}
                  amount={item.total}
                  percentage={item.percentage}
                  maxPercentage={categoryBreakdown[0].percentage}
                />
              ))}
            </View>
          </>
        )}

        {/* Insights */}
        {insights.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Insights</Text>
            </View>
            {insights.map((insight, index) => (
              <InsightCard
                key={index}
                type={insight.type as any}
                message={insight.message}
                priority={insight.priority}
              />
            ))}
          </>
        )}

        {/* Upcoming Renewals */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Renewals (30 days)</Text>
        </View>

        {renewalTimeline.thisWeek.length > 0 && (
          <View style={styles.renewalGroup}>
            <Text style={styles.renewalGroupTitle}>This Week</Text>
            {renewalTimeline.thisWeek.map((subscription) => (
              <RenewalItem
                key={subscription.id}
                subscription={subscription}
                onPress={() => handleRenewalPress(subscription)}
              />
            ))}
          </View>
        )}

        {renewalTimeline.nextWeek.length > 0 && (
          <View style={styles.renewalGroup}>
            <Text style={styles.renewalGroupTitle}>Next Week</Text>
            {renewalTimeline.nextWeek.map((subscription) => (
              <RenewalItem
                key={subscription.id}
                subscription={subscription}
                onPress={() => handleRenewalPress(subscription)}
              />
            ))}
          </View>
        )}

        {renewalTimeline.thisMonth.length > 0 && (
          <View style={styles.renewalGroup}>
            <Text style={styles.renewalGroupTitle}>This Month</Text>
            {renewalTimeline.thisMonth.map((subscription) => (
              <RenewalItem
                key={subscription.id}
                subscription={subscription}
                onPress={() => handleRenewalPress(subscription)}
              />
            ))}
          </View>
        )}

        {renewalTimeline.thisWeek.length === 0 &&
          renewalTimeline.nextWeek.length === 0 &&
          renewalTimeline.thisMonth.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.emptyText}>No renewals in the next 30 days</Text>
            </View>
          )}
      </ScrollView>
    </View>
  );
}