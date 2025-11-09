import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  variant?: 'primary' | 'secondary' | 'default';
}

export default function SummaryCard({
  title,
  value,
  subtitle,
  variant = 'default',
}: SummaryCardProps) {
  const backgroundColor =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'secondary'
      ? theme.colors.secondary
      : theme.colors.card;

  const textColor = variant !== 'default' ? '#FFFFFF' : theme.colors.text;
  const subtitleColor = variant !== 'default' ? '#FFFFFF' : theme.colors.textSecondary;

  return (
    <View style={[styles.card, { backgroundColor }, theme.shadows.md]}>
      <Text style={[styles.title, { color: subtitleColor }]}>{title}</Text>
      <Text style={[styles.value, { color: textColor }]}>{value}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.caption,
    marginBottom: theme.spacing.xs,
  },
  value: {
    ...theme.typography.h2,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.caption,
  },
});

