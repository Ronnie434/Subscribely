import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, Image, Linking, Alert, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Subscription } from '../types';
import { calculations } from '../utils/calculations';
import AnimatedPressable from './AnimatedPressable';
import { getLogoUrlForSource, getNextLogoSource, LogoSource } from '../utils/logoHelpers';

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
  const [logoSource, setLogoSource] = useState<LogoSource>('primary');
  const monthlyCost = calculations.getDisplayCost(subscription);

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
    // Don't attempt to open URL if domain is missing/empty
    // This prevents invalid redirections for subscriptions without validated domains
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
      borderRadius: 16,
      padding: 16,
      marginBottom: 0,
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
      overflow: 'hidden',
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
    fallbackIcon: {
      opacity: 0.7,
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
      lineHeight: 22,
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    price: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    priceLabel: {
      fontSize: 13,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      marginLeft: 2,
      lineHeight: 18,
    },
  });

  // Handle logo error and try fallback sources
  const handleLogoError = () => {
    const nextSource = getNextLogoSource(logoSource);
    setLogoSource(nextSource);
  };

  // Render either logo or fallback icon
  const renderIcon = () => {
    const logoUrl = subscription.domain ? getLogoUrlForSource(subscription.domain, logoSource, 64) : '';
    
    if (subscription.domain && logoUrl) {
      return (
        <AnimatedPressable
          onPress={(e: any) => {
            e?.stopPropagation?.();
            handleLogoPress();
          }}
          style={styles.logoContainer}
          scaleOnPress={0.92}>
          <Image
            source={{ uri: logoUrl }}
            style={styles.logoImage}
            onError={handleLogoError}
          />
        </AnimatedPressable>
      );
    }

    // Fallback to letter-based icon when no domain or all sources failed
    // Reduced opacity indicates it's not clickable
    return (
      <View style={[styles.iconContainer, styles.fallbackIcon, { backgroundColor: getIconColor() }]}>
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
      accessibilityLabel={`${subscription.name} recurring item, costs $${monthlyCost.toFixed(2)} per month`}
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
            {/* Only show billing frequency for recurring charges */}
            {(!subscription.chargeType || subscription.chargeType === 'recurring') && (
              <Text style={styles.priceLabel}>
                /{subscription.billingCycle === 'yearly' ? 'year' : 'month'}
              </Text>
            )}
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
});

export default SubscriptionCard;