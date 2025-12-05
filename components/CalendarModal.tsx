import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import CalendarView from './CalendarView';
import { RepeatInterval } from '../types';
import * as Haptics from 'expo-haptics';

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  subscriptionName: string;
  renewalDate: string;
  repeatInterval: RepeatInterval;
  subscriptionColor?: string;
}

export default function CalendarModal({
  visible,
  onClose,
  subscriptionName,
  renewalDate,
  repeatInterval,
  subscriptionColor,
}: CalendarModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const handleClose = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 8,
      height: '90%',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
      alignSelf: 'center',
      marginBottom: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerText: {
      flex: 1,
      paddingRight: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    closeButtonPressed: {
      opacity: 0.6,
    },
    calendarWrapper: {
      flex: 1,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}>
      <Pressable style={styles.modalOverlay} onPress={handleClose}>
        <Pressable
          style={[
            styles.modalContainer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
          onPress={(e) => e.stopPropagation()}>
          {/* Handle for drag gesture hint */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{subscriptionName}</Text>
              <Text style={styles.subtitle}>Renewal Calendar</Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              onPress={handleClose}>
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Calendar View */}
          <View style={styles.calendarWrapper}>
            <CalendarView
              renewalDate={renewalDate}
              repeatInterval={repeatInterval}
              subscriptionColor={subscriptionColor}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}