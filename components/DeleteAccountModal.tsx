import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { SlideInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteAccountModal({
  visible,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');

  // Reset input when modal closes
  useEffect(() => {
    if (!visible) {
      setConfirmationText('');
    }
  }, [visible]);

  // Check if user typed "DELETE" correctly
  const isConfirmed = confirmationText === 'DELETE';

  const handleConfirm = async () => {
    if (!isConfirmed || loading) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    setLoading(true);

    try {
      await onConfirm();

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error deleting account:', error);

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;

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
      height: '90%',
      maxHeight: '90%',
      overflow: 'hidden',
      position: 'relative',
    },
    header: {
      alignItems: 'center',
      paddingTop: 24,
      paddingHorizontal: 24,
      paddingBottom: 16,
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
      zIndex: 10,
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${theme.colors.error}20`,
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
    warningHeading: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    warningSubtext: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      marginBottom: 16,
    },
    listContainer: {
      backgroundColor: theme.isDark
        ? 'rgba(255, 69, 58, 0.1)'
        : 'rgba(255, 59, 48, 0.08)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.error + '30',
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    listItemLast: {
      marginBottom: 0,
    },
    bulletIcon: {
      marginRight: 12,
      marginTop: 2,
    },
    listItemText: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.colors.text,
      lineHeight: 22,
      flex: 1,
    },
    gracePeriodText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 24,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
    inputLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      borderWidth: 2,
      borderColor: theme.colors.border,
      marginBottom: 24,
    },
    inputFocused: {
      borderColor: theme.colors.error,
    },
    buttonContainer: {
      gap: 12,
    },
    deleteButton: {
      backgroundColor: theme.colors.error,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    deleteButtonDisabled: {
      opacity: 0.5,
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      marginLeft: 8,
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
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <BlurView
            intensity={20}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </Pressable>

        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          style={styles.modalContent}>
          {/* Close Button - Must be above ScrollView */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            disabled={loading}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            pointerEvents="box-only">
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          {/* Header - OUTSIDE ScrollView */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="warning" size={36} color={theme.colors.error} />
            </View>
            <Text style={styles.title}>Delete Account</Text>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: Platform.OS === 'ios' ? 34 : 24
              }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              scrollEnabled={true}
              keyboardShouldPersistTaps="handled">
              {/* Warning Heading */}
              <Text style={styles.warningHeading}>
                This action cannot be undone
              </Text>

              {/* Warning Subtext */}
              <Text style={styles.warningSubtext}>
                Deleting your account will permanently remove:
              </Text>

              {/* List of what will be deleted */}
              <View style={styles.listContainer}>
                <View style={styles.listItem}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={theme.colors.error}
                    style={styles.bulletIcon}
                  />
                  <Text style={styles.listItemText}>
                    All your tracked subscriptions and recurring expenses
                  </Text>
                </View>

                <View style={styles.listItem}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={theme.colors.error}
                    style={styles.bulletIcon}
                  />
                  <Text style={styles.listItemText}>Payment history and transaction records</Text>
                </View>

                <View style={styles.listItem}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={theme.colors.error}
                    style={styles.bulletIcon}
                  />
                  <Text style={styles.listItemText}>
                    App settings and preferences
                  </Text>
                </View>

                <View style={[styles.listItem, styles.listItemLast]}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={theme.colors.error}
                    style={styles.bulletIcon}
                  />
                  <Text style={styles.listItemText}>
                    Your premium membership and account data
                  </Text>
                </View>
              </View>

              {/* Grace Period Info */}
              <Text style={styles.gracePeriodText}>
                You will have 30 days to recover your account before it is
                permanently deleted.
              </Text>

              {/* Confirmation Input */}
              <Text style={styles.inputLabel}>Type DELETE to confirm</Text>
              <TextInput
                style={[
                  styles.input,
                  confirmationText.length > 0 && styles.inputFocused,
                ]}
                value={confirmationText}
                onChangeText={(text) => setConfirmationText(text.toUpperCase())}
                placeholder="DELETE"
                placeholderTextColor={theme.colors.textSecondary + '80'}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!loading}
                maxLength={6}
              />

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleClose}
                  disabled={loading}
                  activeOpacity={0.8}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    (!isConfirmed || loading) && styles.deleteButtonDisabled,
                  ]}
                  onPress={handleConfirm}
                  disabled={!isConfirmed || loading}
                  activeOpacity={0.8}>
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="trash" size={20} color="#FFFFFF" />
                      <Text style={styles.deleteButtonText}>
                        Delete My Account
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}