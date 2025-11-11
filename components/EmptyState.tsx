import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function EmptyState({
  title = 'No subscriptions yet',
  message = 'Tap the + button to add your first subscription',
  icon = 'file-tray-outline',
}: EmptyStateProps) {
  const { theme } = useTheme();
  const iconScale = useSharedValue(1);
  const iconOpacity = useSharedValue(0);

  useEffect(() => {
    // Fade in animation
    iconOpacity.value = withTiming(1, { duration: 600 });

    // Gentle pulse animation
    iconScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xl,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 122, 255, 0.08)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    message: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 300,
    },
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
        <Ionicons 
          name={icon} 
          size={56} 
          color={theme.isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 122, 255, 0.4)'} 
        />
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}