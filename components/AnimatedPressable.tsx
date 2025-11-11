import React from 'react';
import { Pressable, PressableProps, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface AnimatedPressableProps extends PressableProps {
  scaleOnPress?: number;
  enableHaptics?: boolean;
  animationType?: 'spring' | 'timing';
  children: React.ReactNode;
}

const AnimatedPressableComponent = Animated.createAnimatedComponent(Pressable);

export default function AnimatedPressable({
  scaleOnPress = 0.96,
  enableHaptics = true,
  animationType = 'spring',
  children,
  onPressIn,
  onPressOut,
  disabled,
  ...pressableProps
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (event: any) => {
    if (disabled) return;

    if (enableHaptics && Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    scale.value = animationType === 'spring'
      ? withSpring(scaleOnPress, {
          damping: 15,
          stiffness: 150,
        })
      : withTiming(scaleOnPress, { duration: 100 });

    onPressIn?.(event);
  };

  const handlePressOut = (event: any) => {
    scale.value = animationType === 'spring'
      ? withSpring(1, {
          damping: 15,
          stiffness: 150,
        })
      : withTiming(1, { duration: 100 });

    onPressOut?.(event);
  };

  return (
    <AnimatedPressableComponent
      {...pressableProps}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[animatedStyle, pressableProps.style]}
    >
      {children}
    </AnimatedPressableComponent>
  );
}