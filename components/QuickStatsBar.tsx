import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';
import { dateHelpers } from '../utils/dateHelpers';
import { Subscription } from '../types';

interface QuickStatsBarProps {
  subscriptions: Subscription[];
  totalMonthlyCost: number;
}

export default function QuickStatsBar({
  subscriptions,
  totalMonthlyCost,
}: QuickStatsBarProps) {
  const { theme } = useTheme();

  // Calculate next renewal (earliest upcoming date)
  const getNextRenewalDays = (): number | null => {
    if (subscriptions.length === 0) return null;

    const upcomingRenewals = subscriptions
      .map(sub => dateHelpers.getDaysUntilRenewal(sub.renewalDate))
      .filter(days => days >= 0)
      .sort((a, b) => a - b);

    return upcomingRenewals.length > 0 ? upcomingRenewals[0] : null;
  };

  const nextRenewalDays = getNextRenewalDays();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 12,
      gap: 8,
    },
    statCard: {
      flex: 1,
      height: 72,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: theme.gradients.accent,
    },
    blurContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 12,
    },
    value: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      lineHeight: 32,
      letterSpacing: -0.5,
      marginBottom: 2,
    },
    label: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      {/* Active Subscriptions */}
      <View style={styles.statCard}>
        <BlurView
          intensity={theme.isDark ? 20 : 10}
          tint={theme.isDark ? 'dark' : 'light'}
          style={styles.blurContainer}>
          <Text style={styles.value}>{subscriptions.length}</Text>
          <Text style={styles.label}>Active</Text>
        </BlurView>
      </View>

      {/* Monthly Total */}
      <View style={styles.statCard}>
        <BlurView
          intensity={theme.isDark ? 20 : 10}
          tint={theme.isDark ? 'dark' : 'light'}
          style={styles.blurContainer}>
          <Text style={styles.value}>${totalMonthlyCost.toFixed(0)}</Text>
          <Text style={styles.label}>/month</Text>
        </BlurView>
      </View>

      {/* Next Renewal */}
      <View style={styles.statCard}>
        <BlurView
          intensity={theme.isDark ? 20 : 10}
          tint={theme.isDark ? 'dark' : 'light'}
          style={styles.blurContainer}>
          <Text style={styles.value}>
            {nextRenewalDays !== null ? nextRenewalDays : '—'}
          </Text>
          <Text style={styles.label}>
            {nextRenewalDays !== null && nextRenewalDays === 1 ? 'day' : 'days'}
          </Text>
        </BlurView>
      </View>
    </View>
  );
}