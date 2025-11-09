import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Image, Linking, Alert } from 'react-native';
import { theme } from '../constants/theme';
import { Subscription } from '../types';
import { calculations } from '../utils/calculations';
import * as Haptics from 'expo-haptics';

interface SubscriptionCardProps {
  subscription: Subscription;
  onPress: () => void;
  onLongPress?: () => void;
}

// Service brand colors mapping
const SERVICE_COLORS: { [key: string]: string } = {
  'netflix': '#E50914',
  'spotify': '#1DB954',
  'dropbox': '#0061FF',
  'apple': '#000000',
  'youtube': '#FF0000',
  'amazon': '#FF9900',
};

const SubscriptionCard = memo(function SubscriptionCard({
  subscription,
  onPress,
  onLongPress,
}: SubscriptionCardProps) {
  const [logoError, setLogoError] = useState(false);
  const monthlyCost = calculations.getMonthlyCost(subscription);

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const handleLongPress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onLongPress?.();
  };

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

  // Handle logo press to open company website
  const handleLogoPress = async () => {
    if (!subscription.domain) {
      return;
    }

    try {
      const url = `https://${subscription.domain}`;
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open this website');
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert('Error', 'Failed to open website');
    }
  };

  // Render either logo or fallback icon
  const renderIcon = () => {
    if (subscription.domain && !logoError) {
      return (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            handleLogoPress();
          }}
          style={({ pressed }) => [
            styles.logoContainer,
            pressed && styles.logoPressed,
          ]}>
          <Image
            source={{
              uri: `https://logo.clearbit.com/${subscription.domain}`
            }}
            style={styles.logoImage}
            onError={() => setLogoError(true)}
          />
        </Pressable>
      );
    }

    // Fallback to letter-based icon
    return (
      <View style={[styles.iconContainer, { backgroundColor: getIconColor() }]}>
        <Text style={styles.iconText}>{getIconLetter()}</Text>
      </View>
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
      accessible={true}
      accessibilityLabel={`${subscription.name} subscription, costs $${monthlyCost.toFixed(2)} per month`}
      accessibilityHint="Tap to edit, long press to delete"
      accessibilityRole="button">
      <View style={styles.container}>
        {/* Logo or Icon Container */}
        {renderIcon()}

        {/* Content Container */}
        <View style={styles.contentContainer}>
          <Text style={styles.name}>{subscription.name}</Text>
          <Text style={styles.price}>${monthlyCost.toFixed(2)}/mo</Text>
        </View>
      </View>
    </Pressable>
  );
});

export default SubscriptionCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    marginBottom: theme.spacing.md,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 50,
    height: 50,
  },
  logoPressed: {
    opacity: 0.6,
  },
  logoImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  contentContainer: {
    marginLeft: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  name: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontSize: 17,
    marginBottom: 2,
  },
  price: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 15,
  },
});

