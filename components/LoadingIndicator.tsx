import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

export default function LoadingIndicator() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
});

