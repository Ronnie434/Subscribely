import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { Subscription } from '../types';
import { storage } from '../utils/storage';
import { calculations } from '../utils/calculations';
import SubscriptionCard from '../components/SubscriptionCard';
import EmptyState from '../components/EmptyState';
import LoadingIndicator from '../components/LoadingIndicator';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useRealtimeSubscriptions } from '../hooks/useRealtimeSubscriptions';

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
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Set up real-time subscriptions
  const { isConnected, error: realtimeError } = useRealtimeSubscriptions(user?.id, {
    onInsert: (newSubscription) => {
      if (__DEV__) {
        console.log('Real-time INSERT:', newSubscription.name);
      }
      setSubscriptions((prev) => {
        // Prevent duplicates - check if subscription already exists
        const exists = prev.some((sub) => sub.id === newSubscription.id);
        if (exists) {
          if (__DEV__) {
            console.log('Subscription already exists, skipping insert');
          }
          return prev;
        }
        // Add new subscription at the beginning (most recent first)
        return [newSubscription, ...prev];
      });
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
          // If not found, add it (edge case: might have been created on another device)
          return [updatedSubscription, ...prev];
        }
        // Update existing subscription
        const updated = [...prev];
        updated[index] = updatedSubscription;
        return updated;
      });
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
        <Pressable
          onPress={() => {
            if (Platform.OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            navigation.navigate('AddSubscription', {});
          }}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}>
          <Ionicons name="add" size={28} color={theme.colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  const loadSubscriptions = async (forceRefresh = false) => {
    try {
      // Use refresh when force refreshing or when coming back from add/edit
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

  // Refresh data when screen comes into focus (after adding/editing)
  useFocusEffect(
    useCallback(() => {
      if (__DEV__) {
        console.log('HomeScreen focused - force refreshing from Supabase...');
      }
      // Force refresh from Supabase to get latest data
      loadSubscriptions(true);
      return () => {
        // Cleanup if needed
      };
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Use the dedicated refresh method which forces a fetch from Supabase
      const data = await storage.refresh();
      setSubscriptions(data);
    } catch (error) {
      console.error('Error refreshing subscriptions:', error);
      // Silently fail on refresh - data might already be loaded
      // Just reload from cache if refresh fails
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

  const handleDelete = (subscription: Subscription) => {
    Alert.alert(
      'Delete Subscription',
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
            
            // Optimistic delete: Remove from UI immediately
            const previousSubscriptions = [...subscriptions];
            setSubscriptions(prev => prev.filter(s => s.id !== subscription.id));
            
            // Delete in background
            try {
              const success = await storage.delete(subscription.id);
              
              if (!success) {
                // Rollback on failure
                setSubscriptions(previousSubscriptions);
                if (Platform.OS === 'ios') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }
                Alert.alert(
                  'Failed to Delete',
                  'Could not delete subscription. Please try again.',
                  [{ text: 'OK' }]
                );
              }
              // If successful, real-time sync will handle updates on other devices
            } catch (error) {
              console.error('Error deleting subscription:', error);
              // Rollback on error
              setSubscriptions(previousSubscriptions);
              if (Platform.OS === 'ios') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
              Alert.alert(
                'Failed to Delete',
                'Could not delete subscription. Please try again.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  };

  const totalMonthlyCost = calculations.getTotalMonthlyCost(subscriptions);
  
  // Calculate breakdown of monthly vs yearly subscriptions
  const monthlyCount = subscriptions.filter(sub => sub.billingCycle === 'monthly').length;
  const yearlyCount = subscriptions.filter(sub => sub.billingCycle === 'yearly').length;

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.monthlyTotal}>${totalMonthlyCost.toFixed(2)}</Text>
        <Text style={styles.perMonthLabel}>monthly total</Text>
        {subscriptions.length > 0 && (
          <Text style={styles.breakdownLabel}>
            {monthlyCount > 0 && `${monthlyCount} monthly`}
            {monthlyCount > 0 && yearlyCount > 0 && ' • '}
            {yearlyCount > 0 && `${yearlyCount} yearly`}
          </Text>
        )}
        <Text style={styles.sectionTitle}>Subscriptions</Text>
      </View>

      {/* Subscription List */}
      <FlatList
        data={subscriptions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SubscriptionCard
            subscription={item}
            onPress={() => handleEdit(item)}
            onLongPress={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={<EmptyState />}
        contentContainerStyle={
          subscriptions.length === 0 ? styles.emptyContainer : styles.listContainer
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  monthlyTotal: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  perMonthLabel: {
    fontSize: 15,
    color: '#8E8E93',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonPressed: {
    opacity: 0.6,
  },
});

