import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';

interface TierBadgeProps {
  tier: 'free' | 'premium';
  size?: 'small' | 'large';
  style?: any;
}

export default function TierBadge({
  tier,
  size = 'small',
  style,
}: TierBadgeProps) {
  const { theme } = useTheme();

  const isSmall = size === 'small';
  const isPremium = tier === 'premium';

  const styles = StyleSheet.create({
    container: {
      alignSelf: 'flex-start',
    },
    badge: {
      borderRadius: isSmall ? 12 : 16,
      overflow: 'hidden',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isSmall ? 10 : 16,
      paddingVertical: isSmall ? 6 : 10,
      gap: isSmall ? 6 : 8,
    },
    freeBadge: {
      backgroundColor: theme.isDark
        ? 'rgba(142, 142, 147, 0.2)'
        : 'rgba(142, 142, 147, 0.15)',
    },
    text: {
      fontSize: isSmall ? 13 : 16,
      fontWeight: '700',
      color: isPremium ? '#FFFFFF' : theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });

  if (isPremium) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.badge}>
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.content}>
            <Ionicons
              name="star"
              size={isSmall ? 14 : 18}
              color="#FFFFFF"
            />
            <Text style={styles.text}>Premium</Text>
          </LinearGradient>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.badge, styles.freeBadge]}>
        <View style={styles.content}>
          <Ionicons
            name="pricetag"
            size={isSmall ? 14 : 18}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.text}>Free</Text>
        </View>
      </View>
    </View>
  );
}