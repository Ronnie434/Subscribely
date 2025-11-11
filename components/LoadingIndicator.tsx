import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { SkeletonCard } from './SkeletonLoader';

interface LoadingIndicatorProps {
  count?: number;
}

export default function LoadingIndicator({ count = 5 }: LoadingIndicatorProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 16,
      paddingTop: 24,
    },
  });

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </View>
  );
}