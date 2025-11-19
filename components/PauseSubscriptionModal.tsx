import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';

interface PauseSubscriptionModalProps {
  visible: boolean;
  isCurrentlyPaused: boolean;
  onClose: () => void;
  onConfirm: (resumeDate?: Date) => Promise<void>;
}

export default function PauseSubscriptionModal({
  visible,
  isCurrentlyPaused,
  onClose,
  onConfirm,
}: PauseSubscriptionModalProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(30); // Days to pause

  const pauseOptions = [
    { days: 7, label: '1 Week', description: 'Pause for 7 days' },
    { days: 14, label: '2 Weeks', description: 'Pause for 14 days' },
    { days: 30, label: '1 Month', description: 'Pause for 30 days' },
    { days: 60, label: '2 Months', description: 'Pause for 60 days' },
    { days: 90, label: '3 Months', description: 'Pause for 90 days' },
  ];

  const handleConfirm = async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setLoading(true);

    try {
      if (isCurrentlyPaused) {
        // Resume subscription
        await onConfirm();
        
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        Alert.alert(
          'Subscription Resumed',
          'Your subscription has been resumed successfully. You will be billed on your next billing date.',
          [{ text: 'OK', onPress: onClose }]
        );
      } else {
        // Pause subscription
        const resumeDate = new Date();
        resumeDate.setDate(resumeDate.getDate() + selectedDuration);
        
        await onConfirm(resumeDate);
        
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        Alert.alert(
          'Subscription Paused',
          `Your subscription has been paused for ${selectedDuration} days. It will automatically resume on ${resumeDate.toLocaleDateString()}.`,
          [{ text: 'OK', onPress: onClose }]
        );
      }
    } catch (error) {
      console.error('Error handling subscription pause/resume:', error);
      
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      
      Alert.alert(
        'Error',
        `Failed to ${isCurrentlyPaused ? 'resume' : 'pause'} subscription. Please try again.`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: Platform.OS === 'ios' ? 34 : 24,
      maxHeight: '80%',
    },
    header: {
      alignItems: 'center',
      paddingTop: 24,
      paddingHorizontal: 24,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.isDark
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(0, 0, 0, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isCurrentlyPaused
        ? `${theme.colors.success}20`
        : `${theme.colors.warning}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    content: {
      paddingHorizontal: 24,
      paddingVertical: 24,
    },
    infoCard: {
      backgroundColor: theme.isDark
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(0, 0, 0, 0.03)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    infoText: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    optionsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 16,
    },
    optionCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    optionCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.isDark
        ? theme.colors.card
        : `${theme.colors.primary}08`,
    },
    optionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    optionDescription: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
    },
    checkmark: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonContainer: {
      gap: 12,
      marginTop: 24,
    },
    confirmButton: {
      backgroundColor: isCurrentlyPaused
        ? theme.colors.success
        : theme.colors.warning,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmButtonDisabled: {
      opacity: 0.6,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    cancelButton: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    benefitsList: {
      marginTop: 16,
    },
    benefitItem: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    benefitIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: `${theme.colors.success}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      marginTop: 2,
    },
    benefitText: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.text,
      lineHeight: 20,
      flex: 1,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        </Pressable>

        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          style={styles.modalContent}
        >
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons
                name={isCurrentlyPaused ? 'play-circle' : 'pause-circle'}
                size={32}
                color={isCurrentlyPaused ? theme.colors.success : theme.colors.warning}
              />
            </View>
            <Text style={styles.title}>
              {isCurrentlyPaused ? 'Resume Subscription' : 'Pause Subscription'}
            </Text>
            <Text style={styles.subtitle}>
              {isCurrentlyPaused
                ? 'Ready to resume your premium benefits?'
                : 'Take a break from your subscription'}
            </Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {isCurrentlyPaused ? (
              <>
                {/* Resume Info */}
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>What happens when you resume?</Text>
                  <View style={styles.benefitsList}>
                    <View style={styles.benefitItem}>
                      <View style={styles.benefitIcon}>
                        <Ionicons name="checkmark" size={16} color={theme.colors.success} />
                      </View>
                      <Text style={styles.benefitText}>
                        Immediate access to all premium features
                      </Text>
                    </View>
                    <View style={styles.benefitItem}>
                      <View style={styles.benefitIcon}>
                        <Ionicons name="checkmark" size={16} color={theme.colors.success} />
                      </View>
                      <Text style={styles.benefitText}>
                        Billing resumes on your next scheduled date
                      </Text>
                    </View>
                    <View style={styles.benefitItem}>
                      <View style={styles.benefitIcon}>
                        <Ionicons name="checkmark" size={16} color={theme.colors.success} />
                      </View>
                      <Text style={styles.benefitText}>
                        All your data and settings remain intact
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Pause Options */}
                <Text style={styles.optionsTitle}>How long would you like to pause?</Text>
                
                {pauseOptions.map((option) => (
                  <TouchableOpacity
                    key={option.days}
                    style={[
                      styles.optionCard,
                      selectedDuration === option.days && styles.optionCardSelected,
                    ]}
                    onPress={() => setSelectedDuration(option.days)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionHeader}>
                      <View>
                        <Text style={styles.optionTitle}>{option.label}</Text>
                        <Text style={styles.optionDescription}>{option.description}</Text>
                      </View>
                      {selectedDuration === option.days && (
                        <View style={styles.checkmark}>
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Pause Info */}
                <View style={[styles.infoCard, { marginTop: 16 }]}>
                  <Text style={styles.infoTitle}>What happens during pause?</Text>
                  <Text style={styles.infoText}>
                    • You won't be charged during the pause period{'\n'}
                    • Your subscription data remains safe{'\n'}
                    • Premium features will be temporarily unavailable{'\n'}
                    • Subscription automatically resumes after the pause period
                  </Text>
                </View>
              </>
            )}

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  loading && styles.confirmButtonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {isCurrentlyPaused ? 'Resume Subscription' : `Pause for ${selectedDuration} Days`}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}