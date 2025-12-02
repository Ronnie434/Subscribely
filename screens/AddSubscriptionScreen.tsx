import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../utils/storage';
import SubscriptionForm from '../components/SubscriptionForm';
import { Subscription } from '../types';
import * as Haptics from 'expo-haptics';
import { subscriptionLimitService } from '../services/subscriptionLimitService';

type SubscriptionsStackParamList = {
  Home: undefined;
  AddSubscription: { subscription?: Subscription };
  EditSubscription: { subscription: Subscription };
};

type AddSubscriptionScreenRouteProp = RouteProp<SubscriptionsStackParamList, 'AddSubscription'>;
type AddSubscriptionScreenNavigationProp = StackNavigationProp<SubscriptionsStackParamList, 'AddSubscription'>;

export default function AddSubscriptionScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<AddSubscriptionScreenNavigationProp>();
  const route = useRoute<AddSubscriptionScreenRouteProp>();
  const [saving, setSaving] = useState(false);
  const existingSubscription = route.params?.subscription;
  const isEditMode = !!existingSubscription;

  // Set the header title based on mode
  useEffect(() => {
    navigation.setOptions({
      title: isEditMode ? 'Edit Recurring Item' : 'Add Recurring Item',
    });
  }, [isEditMode, navigation]);

  const handleSubmit = async (subscriptionData: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => {
    setSaving(true);
    
    const subscription: Subscription = isEditMode
      ? {
          ...subscriptionData,
          id: existingSubscription.id,
          createdAt: existingSubscription.createdAt,
          updatedAt: new Date().toISOString(),
        }
      : {
          ...subscriptionData,
          // Temporary ID for new subscriptions - Supabase will generate the actual UUID
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    // Save to database FIRST, then navigate
    try {
      if (__DEV__) {
        console.log(`Saving subscription: ${subscription.name}...`);
      }
      
      const success = await storage.save(subscription);
      
      if (success) {
        // Invalidate limit status cache to ensure count is refreshed immediately
        // This ensures Settings and other screens show the correct count right away
        await subscriptionLimitService.refreshLimitStatus().catch(err => {
          console.error('Failed to refresh limit status after save:', err);
          // Don't block navigation if cache refresh fails
        });
        
        // Success - navigate back with haptic feedback
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (__DEV__) {
          console.log(`✅ Successfully saved ${subscription.name}`);
        }
        
        // If editing, navigate to Home instead of back to detail screen
        if (isEditMode) {
          navigation.navigate('Home');
        } else {
          navigation.goBack();
        }
      } else {
        // Save failed
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert(
          `Failed to ${isEditMode ? 'Update' : 'Save'} Subscription`,
          'Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error saving subscription:', error);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      
      const errorMessage = error instanceof Error ? error.message : '';
      const isNetworkError = errorMessage.toLowerCase().includes('network') ||
                           errorMessage.toLowerCase().includes('connection');
      
      Alert.alert(
        `Failed to ${isEditMode ? 'Update' : 'Save'} Subscription`,
        isNetworkError
          ? 'Please check your internet connection and try again.'
          : errorMessage || 'An unexpected error occurred.',
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });

  return (
    <View style={styles.container}>
      <SubscriptionForm
        subscription={existingSubscription}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={saving}
      />
    </View>
  );
}

