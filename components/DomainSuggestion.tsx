import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import type { DomainSuggestion as DomainSuggestionType } from '../utils/domainHelpers';
import * as Haptics from 'expo-haptics';

interface DomainSuggestionProps {
  suggestion: DomainSuggestionType | null;
  onAccept?: () => void;
  onEdit?: () => void;
  onManualInput?: () => void;
}

export default function DomainSuggestion({
  suggestion,
  onAccept,
  onEdit,
  onManualInput,
}: DomainSuggestionProps) {
  const { theme } = useTheme();

  // Create styles at the top of the component, before any returns
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 8,
      ...Platform.select({
        ios: {
          shadowColor: '#00000010',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
        },
        android: {
          elevation: 1,
        },
      }),
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 8,
    },
    domainText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      marginRight: 8,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    actionButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    actionButtonPressed: {
      opacity: 0.6,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    noSuggestionText: {
      fontSize: 14,
      fontWeight: '500',
    },
  });

  // If no suggestion, show manual input option
  if (!suggestion) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.content}>
          <Ionicons name="help-circle-outline" size={20} color={theme.colors.textSecondary} />
          <Text style={[styles.noSuggestionText, { color: theme.colors.textSecondary }]}>
            No domain found
          </Text>
        </View>
        {onManualInput && (
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
            onPress={() => {
              if (Platform.OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onManualInput();
            }}>
            <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>
              Enter manually
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Get confidence indicator
  const getConfidenceIndicator = () => {
    switch (suggestion.confidence) {
      case 'high':
        return { icon: 'checkmark-circle', color: theme.colors.success || '#34C759', label: 'Verified' };
      case 'medium':
        return { icon: 'radio-button-on', color: theme.colors.primary, label: 'Cached' };
      case 'low':
        return { icon: 'alert-circle', color: theme.colors.warning || '#FF9500', label: 'Unverified' };
    }
  };

  const indicator = getConfidenceIndicator();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.content}>
        <Ionicons name="globe-outline" size={18} color={theme.colors.primary} />
        <Text style={styles.domainText}>{suggestion.domain}</Text>
        <View style={styles.badge}>
          <Ionicons name={indicator.icon as any} size={12} color={indicator.color} />
          <Text style={[styles.badgeText, { color: indicator.color }]}>
            {indicator.label}
          </Text>
        </View>
      </View>
      {onEdit && (
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
          onPress={() => {
            if (Platform.OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onEdit();
          }}>
          <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>
            Edit
          </Text>
        </Pressable>
      )}
    </View>
  );
}