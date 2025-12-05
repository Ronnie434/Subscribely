import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

export default function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: SkeletonLoaderProps) {
  const { theme } = useTheme();
  const shimmerAnimation = useSharedValue(0);

  useEffect(() => {
    shimmerAnimation.value = withRepeat(
      withTiming(1, {
        duration: 1500,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerAnimation.value,
      [0, 1],
      [-300, 300]
    );

    return {
      transform: [{ translateX }],
    };
  });

  const styles = StyleSheet.create({
    container: {
      width: width as any,
      height: height as any,
      borderRadius,
      backgroundColor: theme.isDark ? '#2C2C2E' : '#E1E1E1',
      overflow: 'hidden',
    },
    shimmer: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.isDark ? '#3A3A3C' : '#F0F0F0',
      opacity: 0.5,
    },
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[styles.shimmer, animatedStyle]} />
    </View>
  );
}

// Preset skeleton components for common use cases
export function SkeletonCard() {
  const { theme } = useTheme();
  return (
    <View style={{ padding: 16, backgroundColor: theme.colors.surface, borderRadius: 12, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SkeletonLoader width={50} height={50} borderRadius={25} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <SkeletonLoader width="60%" height={16} style={{ marginBottom: 8 }} />
          <SkeletonLoader width="40%" height={14} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonText({ width = '100%', lines = 3 }: { width?: string | number; lines?: number }) {
  return (
    <View>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonLoader
          key={index}
          width={index === lines - 1 ? '70%' : width}
          height={14}
          style={{ marginBottom: 8 }}
        />
      ))}
    </View>
  );
}