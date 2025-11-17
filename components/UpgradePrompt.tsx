import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';

interface UpgradePromptProps {
  onPress: () => void;
  dismissible?: boolean;
  style?: any;
}

export default function UpgradePrompt({
  onPress,
  dismissible = true,
  style,
}: UpgradePromptProps) {
  const { theme } = useTheme();
  const [dismissed, setDismissed] = useState(false);

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const handleDismiss = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setDismissed(true);
  };

  if (dismissed) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      borderRadius: 16,
      overflow: 'hidden',
      marginHorizontal: 16,
      marginBottom: 16,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    gradient: {
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: '400',
      color: 'rgba(255, 255, 255, 0.9)',
      lineHeight: 18,
    },
    actionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    upgradeButton: {
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    upgradeButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    dismissButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      style={[styles.container, style]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
        <LinearGradient
          colors={theme.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}>
          <View style={styles.iconContainer}>
            <Ionicons name="star" size={24} color="#FFFFFF" />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Upgrade to Premium</Text>
            <Text style={styles.subtitle}>
              Unlock unlimited subscriptions
            </Text>
          </View>

          <View style={styles.actionContainer}>
            <View style={styles.upgradeButton}>
              <Text style={styles.upgradeButtonText}>Upgrade</Text>
            </View>

            {dismissible && (
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDismiss();
                }}
                activeOpacity={0.7}>
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}