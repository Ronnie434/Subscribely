import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'past_due' | 'trialing' | 'incomplete';

interface SubscriptionStatusIndicatorProps {
  status: SubscriptionStatus;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export default function SubscriptionStatusIndicator({
  status,
  size = 'medium',
  showLabel = true,
}: SubscriptionStatusIndicatorProps) {
  const { theme } = useTheme();

  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return {
          label: 'Active',
          icon: 'checkmark-circle' as const,
          color: theme.colors.success,
          backgroundColor: `${theme.colors.success}20`,
        };
      case 'paused':
        return {
          label: 'Paused',
          icon: 'pause-circle' as const,
          color: theme.colors.warning,
          backgroundColor: `${theme.colors.warning}20`,
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          icon: 'close-circle' as const,
          color: theme.colors.error,
          backgroundColor: `${theme.colors.error}20`,
        };
      case 'past_due':
        return {
          label: 'Past Due',
          icon: 'alert-circle' as const,
          color: theme.colors.error,
          backgroundColor: `${theme.colors.error}20`,
        };
      case 'trialing':
        return {
          label: 'Trial',
          icon: 'time' as const,
          color: theme.colors.info,
          backgroundColor: `${theme.colors.info}20`,
        };
      case 'incomplete':
        return {
          label: 'Setup Required',
          icon: 'warning' as const,
          color: theme.colors.warning,
          backgroundColor: `${theme.colors.warning}20`,
        };
      default:
        return {
          label: 'Unknown',
          icon: 'help-circle' as const,
          color: theme.colors.textSecondary,
          backgroundColor: `${theme.colors.textSecondary}20`,
        };
    }
  };

  const config = getStatusConfig();

  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return {
          iconSize: 16,
          fontSize: 12,
          padding: 6,
          paddingHorizontal: 10,
          borderRadius: 6,
        };
      case 'large':
        return {
          iconSize: 24,
          fontSize: 16,
          padding: 12,
          paddingHorizontal: 16,
          borderRadius: 10,
        };
      case 'medium':
      default:
        return {
          iconSize: 20,
          fontSize: 14,
          padding: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
        };
    }
  };

  const sizeConfig = getSizeConfig();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: config.backgroundColor,
      paddingVertical: sizeConfig.padding,
      paddingHorizontal: sizeConfig.paddingHorizontal,
      borderRadius: sizeConfig.borderRadius,
      alignSelf: 'flex-start',
    },
    label: {
      fontSize: sizeConfig.fontSize,
      fontWeight: '600',
      color: config.color,
      marginLeft: showLabel ? 6 : 0,
    },
    iconOnly: {
      paddingHorizontal: sizeConfig.padding,
    },
  });

  return (
    <View 
      style={[
        styles.container,
        !showLabel && styles.iconOnly,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Subscription status: ${config.label}`}
    >
      <Ionicons
        name={config.icon}
        size={sizeConfig.iconSize}
        color={config.color}
      />
      {showLabel && (
        <Text style={styles.label}>{config.label}</Text>
      )}
    </View>
  );
}