import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

interface CollapsibleSectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export default function CollapsibleSection({
  title,
  count,
  children,
  defaultExpanded = true,
}: CollapsibleSectionProps) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleSection = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Configure layout animation for smooth expand/collapse
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const styles = StyleSheet.create({
    container: {
      marginTop: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerPressed: {
      opacity: 0.7,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    countBadge: {
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      minWidth: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
    },
    iconContainer: {
      padding: 4,
    },
    content: {
      paddingHorizontal: 16,
      gap: 12,
    },
  });

  return (
    <View style={styles.container}>
      <Pressable
        onPress={toggleSection}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${title} section, ${count} items, ${isExpanded ? 'expanded' : 'collapsed'}`}
        accessibilityHint="Tap to expand or collapse this section">
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        </View>
        <View style={styles.iconContainer}>
          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
            size={20}
            color={theme.colors.textSecondary}
          />
        </View>
      </Pressable>
      {isExpanded && <View style={styles.content}>{children}</View>}
    </View>
  );
}