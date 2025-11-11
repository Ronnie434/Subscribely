import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, Image, Linking, Alert, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Subscription } from '../types';
import { calculations } from '../utils/calculations';
import AnimatedPressable from './AnimatedPressable';

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
  'disney': '#113CCF',
  'hulu': '#1CE783',
  'adobe': '#FF0000',
  'microsoft': '#00A4EF',
};

const SubscriptionCard = memo(function SubscriptionCard({
  subscription,
  onPress,
  onLongPress,
}: SubscriptionCardProps) {
  const { theme } = useTheme();
  const [logoError, setLogoError] = useState(false);
  const monthlyCost = calculations.getMonthlyCost(subscription);

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
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open this website');
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert('Error', 'Failed to open website');
    }
  };

  const styles = StyleSheet.create({
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
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
    container: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoContainer: {
      width: 48,
      height: 48,
    },
    logoImage: {
      width: 48,
      height: 48,
      borderRadius: 10,
    },
    iconText: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '700',
    },
    contentContainer: {
      marginLeft: 12,
      flex: 1,
      justifyContent: 'center',
    },
    name: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
      letterSpacing: -0.2,
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    price: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    priceLabel: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginLeft: 2,
    },
  });

  // Render either logo or fallback icon
  const renderIcon = () => {
    if (subscription.domain && !logoError) {
      return (
        <AnimatedPressable
          onPress={(e: any) => {
            e?.stopPropagation?.();
            handleLogoPress();
          }}
          style={styles.logoContainer}
          scaleOnPress={0.92}>
          <Image
            source={{
              uri: `https://logo.clearbit.com/${subscription.domain}`
            }}
            style={styles.logoImage}
            onError={() => setLogoError(true)}
          />
        </AnimatedPressable>
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
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.card}
      scaleOnPress={0.98}
      accessible={true}
      accessibilityLabel={`${subscription.name} subscription, costs $${monthlyCost.toFixed(2)} per month`}
      accessibilityHint="Tap to edit, long press to delete"
      accessibilityRole="button">
      <View style={styles.container}>
        {/* Logo or Icon Container */}
        {renderIcon()}

        {/* Content Container */}
        <View style={styles.contentContainer}>
          <Text style={styles.name} numberOfLines={1}>
            {subscription.name}
          </Text>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>${monthlyCost.toFixed(2)}</Text>
            <Text style={styles.priceLabel}>/month</Text>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
});

export default SubscriptionCard;