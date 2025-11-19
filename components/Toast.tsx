import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onHide?: () => void;
}

export default function Toast({
  message,
  type = 'info',
  duration = 3000,
  onHide,
}: ToastProps) {
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    // Trigger haptic feedback
    if (Platform.OS === 'ios') {
      if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === 'error') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (type === 'warning') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }

    // Slide in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 65,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide after duration
    const timer = setTimeout(() => {
      hideToast();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  };

  const getToastConfig = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: theme.colors.success,
          icon: 'checkmark-circle' as const,
          iconColor: '#FFFFFF',
        };
      case 'error':
        return {
          backgroundColor: theme.colors.error,
          icon: 'close-circle' as const,
          iconColor: '#FFFFFF',
        };
      case 'warning':
        return {
          backgroundColor: theme.colors.warning,
          icon: 'warning' as const,
          iconColor: '#FFFFFF',
        };
      case 'info':
      default:
        return {
          backgroundColor: theme.colors.info,
          icon: 'information-circle' as const,
          iconColor: '#FFFFFF',
        };
    }
  };

  const config = getToastConfig();

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 60 : 40,
      left: 16,
      right: 16,
      zIndex: 9999,
    },
    toast: {
      backgroundColor: config.backgroundColor,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    iconContainer: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    message: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
      lineHeight: 20,
    },
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.toast}>
        <View style={styles.iconContainer}>
          <Ionicons name={config.icon} size={20} color={config.iconColor} />
        </View>
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}