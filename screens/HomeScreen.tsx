import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { Subscription } from '../types';
import { storage } from '../utils/storage';
import { calculations } from '../utils/calculations';
import SubscriptionCard from '../components/SubscriptionCard';
import EmptyState from '../components/EmptyState';
import AnimatedPressable from '../components/AnimatedPressable';
import { SkeletonCard } from '../components/SkeletonLoader';
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
  const { theme } = useTheme();
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
        const exists = prev.some((sub) => sub.id === newSubscription.id);
        if (exists) {
          if (__DEV__) {
            console.log('Subscription already exists, skipping insert');
          }
          return prev;
        }
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
          return [updatedSubscription, ...prev];
        }
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
        <AnimatedPressable
          onPress={() => {
            navigation.navigate('AddSubscription', {});
          }}
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

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (__DEV__) {
        console.log('HomeScreen focused - force refreshing from Supabase...');
      }
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
                  'Could not delete subscription. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Error deleting subscription:', error);
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
  const monthlyCount = subscriptions.filter(sub => sub.billingCycle === 'monthly').length;
  const yearlyCount = subscriptions.filter(sub => sub.billingCycle === 'yearly').length;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerCard: {
      backgroundColor: theme.colors.card,
      marginTop: 16,
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
      marginBottom: 12,
      letterSpacing: -1,
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
    },
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
    listContainer: {
      paddingHorizontal: 16,
      paddingBottom: 24,
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Subscriptions</Text>
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
      <FlatList
        data={subscriptions}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.delay(index * 50).springify()}>
            <SubscriptionCard
              subscription={item}
              onPress={() => handleEdit(item)}
              onLongPress={() => handleDelete(item)}
            />
          </Animated.View>
        )}
        ListHeaderComponent={
          <>
            {/* Summary Card */}
            <View style={styles.headerCard}>
              <Text style={styles.headerLabel}>MONTHLY TOTAL</Text>
              <Text style={styles.totalAmount}>${totalMonthlyCost.toFixed(2)}</Text>
              {subscriptions.length > 0 && (
                <View style={styles.statsRow}>
                  {monthlyCount > 0 && (
                    <View style={styles.statBadge}>
                      <Text style={styles.statText}>{monthlyCount} monthly</Text>
                    </View>
                  )}
                  {yearlyCount > 0 && (
                    <View style={styles.statBadge}>
                      <Text style={styles.statText}>{yearlyCount} yearly</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Section Title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Subscriptions</Text>
            </View>
          </>
        }
        ListEmptyComponent={<EmptyState />}
        contentContainerStyle={
          subscriptions.length === 0 ? styles.emptyContainer : styles.listContainer
        }
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}