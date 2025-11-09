import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import { categoryColors } from '../constants/colors';

interface CategoryBadgeProps {
  category: string;
  size?: 'sm' | 'md';
}

export default function CategoryBadge({ category, size = 'md' }: CategoryBadgeProps) {
  const color = categoryColors[category as keyof typeof categoryColors] || categoryColors.Other;
  
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }, size === 'sm' && styles.small]}>
      <Text style={[styles.text, { color }, size === 'sm' && styles.smallText]}>
        {category}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  text: {
    ...theme.typography.captionBold,
    fontSize: 12,
  },
  smallText: {
    fontSize: 10,
  },
});

