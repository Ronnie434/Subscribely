import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface InsightCardProps {
  type: 'savings' | 'spending' | 'renewal' | 'count' | 'info';
  message: string;
  priority?: 'high' | 'medium' | 'low';
}

export default function InsightCard({ type, message, priority = 'medium' }: InsightCardProps) {
  const { theme } = useTheme();
  
  const getIconAndColor = () => {
    switch (type) {
      case 'savings':
        return { icon: '💰', color: theme.colors.success };
      case 'spending':
        return { icon: '📊', color: theme.colors.warning };
      case 'renewal':
        return { icon: '🔔', color: theme.colors.primary };
      case 'count':
        return { icon: '📱', color: theme.colors.secondary };
      default:
        return { icon: 'ℹ️', color: theme.colors.textSecondary };
    }
  };

  const { icon, color } = getIconAndColor();

  const getBorderColor = () => {
    switch (priority) {
      case 'high':
        return theme.colors.error;
      case 'medium':
        return theme.colors.warning;
      case 'low':
        return theme.colors.textSecondary;
      default:
        return theme.colors.border;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
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
    iconContainer: {
      marginRight: 12,
      justifyContent: 'center',
    },
    icon: {
      fontSize: 24,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
    },
    message: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.text,
    },
  });

  return (
    <View
      style={[
        styles.container,
        { borderLeftColor: getBorderColor() },
      ]}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}