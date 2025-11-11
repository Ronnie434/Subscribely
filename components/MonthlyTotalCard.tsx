import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface MonthlyTotalCardProps {
  totalAmount: number;
  monthlyCount: number;
  yearlyCount: number;
  subtitle?: string;
}

export default function MonthlyTotalCard({
  totalAmount,
  monthlyCount,
  yearlyCount,
  subtitle = 'per year',
}: MonthlyTotalCardProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
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
    header: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    amount: {
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
      marginBottom: 12,
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
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>MONTHLY SPENDING</Text>
      <Text style={styles.amount}>${totalAmount.toFixed(2)}</Text>
      <Text style={styles.subtitle}>${(totalAmount * 12).toFixed(2)} {subtitle}</Text>
      
      {(monthlyCount > 0 || yearlyCount > 0) && (
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
  );
}