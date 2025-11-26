import React from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

interface LimitReachedBannerProps {
  currentCount: number;
  maxCount: number;
  onUpgradePress: () => void;
  style?: any;
}

export default function LimitReachedBanner({
  currentCount,
  maxCount,
  onUpgradePress,
  style,
}: LimitReachedBannerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const TAB_BAR_HEIGHT = 60;
  const safeAreaBottom = insets.bottom > 0 ? insets.bottom : 8;
  const bottomMargin = 16 + TAB_BAR_HEIGHT + safeAreaBottom;

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onUpgradePress();
  };

  const styles = StyleSheet.create({
    container: {
      borderRadius: 16,
      overflow: 'hidden',
      marginHorizontal: 16,
      marginBottom: bottomMargin,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    gradient: {
      padding: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    headerContent: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: '400',
      color: 'rgba(255, 255, 255, 0.9)',
      lineHeight: 18,
    },
    limitBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    limitText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    divider: {
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      marginVertical: 12,
    },
    featuresContainer: {
      gap: 8,
      marginBottom: 16,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    featureIcon: {
      marginRight: 8,
    },
    featureText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#FFFFFF',
      flex: 1,
    },
    upgradeButton: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    upgradeButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.error,
    },
  });

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      style={[styles.container, style]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
        <LinearGradient
          colors={theme.gradients.error}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
            </View>

            <View style={styles.headerContent}>
              <Text style={styles.title}>Item Limit Reached</Text>
              <Text style={styles.subtitle}>
                You can't add more recurring items
              </Text>
            </View>

            <View style={styles.limitBadge}>
              <Text style={styles.limitText}>
                {currentCount}/{maxCount}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Features */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureRow}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#FFFFFF"
                style={styles.featureIcon}
              />
              <Text style={styles.featureText}>
                Track unlimited recurring items
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#FFFFFF"
                style={styles.featureIcon}
              />
              <Text style={styles.featureText}>
                Advanced analytics & insights
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#FFFFFF"
                style={styles.featureIcon}
              />
              <Text style={styles.featureText}>
                Priority support
              </Text>
            </View>
          </View>

          {/* Upgrade Button */}
          <View style={styles.upgradeButton}>
            <Ionicons name="star" size={20} color={theme.colors.error} />
            <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}