import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Pressable,
  Image
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { theme } from '../constants/theme';
import { storage } from '../utils/storage';
import { dateHelpers } from '../utils/dateHelpers';
import { calculations } from '../utils/calculations';
import { Subscription } from '../types';
import * as Haptics from 'expo-haptics';

// Type definitions for navigation
type SubscriptionsStackParamList = {
  Home: undefined;
  AddSubscription: { subscription?: Subscription };
  EditSubscription: { subscription: Subscription };
};

type EditSubscriptionScreenRouteProp = RouteProp<SubscriptionsStackParamList, 'EditSubscription'>;
type EditSubscriptionScreenNavigationProp = StackNavigationProp<SubscriptionsStackParamList, 'EditSubscription'>;

// Service brand colors mapping (same as SubscriptionCard)
const SERVICE_COLORS: { [key: string]: string } = {
  'netflix': '#E50914',
  'spotify': '#1DB954',
  'dropbox': '#0061FF',
  'apple': '#000000',
  'youtube': '#FF0000',
  'amazon': '#FF9900',
};

export default function EditSubscriptionScreen() {
  const navigation = useNavigation<EditSubscriptionScreenNavigationProp>();
  const route = useRoute<EditSubscriptionScreenRouteProp>();
  const { subscription: initialSubscription } = route.params;
  const [subscription, setSubscription] = useState(initialSubscription);
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Refresh subscription data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      // Refresh subscription data from storage
      setLoading(true);
      try {
        const updatedSubscription = await storage.getById(initialSubscription.id);
        if (updatedSubscription) {
          setSubscription(updatedSubscription);
        }
      } catch (error) {
        console.error('Error refreshing subscription:', error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [navigation, initialSubscription.id]);

  // Set up navigation header with edit button
  useEffect(() => {
    navigation.setOptions({
      title: 'Subscription',
      headerRight: () => (
        <Pressable
          onPress={handleEditPress}
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.editButtonPressed,
          ]}>
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  // Get service icon color based on service name
  const getIconColor = (): string => {
    const serviceName = subscription.name.toLowerCase();
    for (const [key, color] of Object.entries(SERVICE_COLORS)) {
      if (serviceName.includes(key)) {
        return color;
      }
    }
    return theme.colors.primary;
  };

  // Get first letter of service name
  const getIconLetter = (): string => {
    return subscription.name.charAt(0).toUpperCase();
  };

  // Handle edit button press - navigate to AddSubscription screen in edit mode
  const handleEditPress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate('AddSubscription', { subscription });
  };

  // Render either logo or fallback icon
  const renderIcon = () => {
    if (subscription.domain && !logoError) {
      return (
        <View style={styles.logoContainer}>
          <Image
            source={{
              uri: `https://logo.clearbit.com/${subscription.domain}`
            }}
            style={styles.logoImage}
            onError={() => setLogoError(true)}
          />
        </View>
      );
    }

    // Fallback to letter-based icon
    return (
      <View style={[styles.iconContainer, { backgroundColor: getIconColor() }]}>
        <Text style={styles.iconText}>{getIconLetter()}</Text>
      </View>
    );
  };

  const monthlyCost = calculations.getMonthlyCost(subscription);
  const renewalDateFormatted = dateHelpers.formatFullDate(subscription.renewalDate);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Main Content */}
      <View style={styles.contentContainer}>
        {/* Service Logo or Icon */}
        {renderIcon()}

        {/* Service Name */}
        <Text style={styles.serviceName}>{subscription.name}</Text>

        {/* Price */}
        <Text style={styles.price}>${monthlyCost.toFixed(2)}/mo</Text>

        {/* Renewal Date Section */}
        <View style={styles.renewalSection}>
          <Text style={styles.renewalLabel}>Renews</Text>
          <Text style={styles.renewalDate}>{renewalDateFormatted}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 60,
    height: 60,
  },
  logoImage: {
    width: 60,
    height: 60,
    borderRadius: 15,
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  serviceName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  price: {
    fontSize: 20,
    color: theme.colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  renewalSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  renewalLabel: {
    fontSize: 15,
    color: '#8E8E93',
    marginBottom: 4,
  },
  renewalDate: {
    fontSize: 17,
    color: theme.colors.text,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editButtonPressed: {
    opacity: 0.6,
  },
  editButtonText: {
    fontSize: 17,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});