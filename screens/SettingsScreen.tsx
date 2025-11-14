import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

// Available user icon options
const USER_ICONS = [
  { name: 'person', label: 'Person' },
  { name: 'person-circle', label: 'Circle' },
  { name: 'happy', label: 'Happy' },
  { name: 'star', label: 'Star' },
  { name: 'heart', label: 'Heart' },
  { name: 'rocket', label: 'Rocket' },
  { name: 'bulb', label: 'Bulb' },
  { name: 'trophy', label: 'Trophy' },
  { name: 'leaf', label: 'Leaf' },
  { name: 'flame', label: 'Flame' },
  { name: 'sunny', label: 'Sunny' },
  { name: 'moon', label: 'Moon' },
] as const;

const ICON_STORAGE_KEY = '@user_icon_preference';

export default function SettingsScreen() {
  const { user, signOut, resetInactivityTimer } = useAuth();
  const { theme, themeMode, setThemeMode } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<string>('person');
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Load saved icon preference
  useEffect(() => {
    loadIconPreference();
  }, []);

  // Reset inactivity timer when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      resetInactivityTimer();
    }, [resetInactivityTimer])
  );

  const loadIconPreference = async () => {
    try {
      const savedIcon = await AsyncStorage.getItem(ICON_STORAGE_KEY);
      if (savedIcon) {
        setSelectedIcon(savedIcon);
      }
    } catch (error) {
      console.error('Error loading icon preference:', error);
    }
  };

  const handleIconSelect = async (iconName: string) => {
    try {
      await AsyncStorage.setItem(ICON_STORAGE_KEY, iconName);
      setSelectedIcon(iconName);
      setShowIconPicker(false);
      
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error saving icon preference:', error);
      Alert.alert('Error', 'Failed to save icon preference. Please try again.');
    }
  };

  const handleAvatarPress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowIconPicker(true);
  };

  const handleThemeToggle = async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    try {
      // Toggle between light and dark only
      const newMode: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
      await setThemeMode(newMode);
    } catch (error) {
      console.error('Error changing theme:', error);
      Alert.alert('Error', 'Failed to change theme. Please try again.');
    }
  };

  const handleRowPress = (callback: () => void) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    callback();
  };

  const handleSignOut = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            setIsLoading(true);
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // Create styles inside component to access theme
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 0,
      paddingBottom: theme.spacing.lg,
    },
    section: {
      marginTop: theme.spacing.md + 4,
    },
    firstSection: {
      marginTop: theme.spacing.md + 4,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: theme.spacing.xs + 2,
      marginHorizontal: 16,
      paddingHorizontal: 2,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 0,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#00000010',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    accountCard: {
      backgroundColor: theme.isDark ? theme.colors.card : '#F9F9F9',
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 0,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#00000010',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    themeRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    themeIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${theme.colors.primary}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing.md,
    },
    themeLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
    },
    themeToggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    themeToggleText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      fontWeight: '400',
    },
    themeChevron: {
      marginLeft: 4,
    },
    userInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    chevronContainer: {
      width: 20,
      alignItems: 'flex-end',
    },
    avatarContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing.md,
      overflow: 'hidden',
    },
    avatarGradient: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
      lineHeight: 22,
    },
    userEmail: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    tapToChangeText: {
      fontSize: 11,
      color: '#8E8E93',
      marginTop: theme.spacing.xs - 2,
      textAlign: 'center',
      opacity: 0.65,
    },
    signOutButton: {
      backgroundColor: theme.colors.error,
      borderRadius: 26,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    signOutButtonDisabled: {
      opacity: 0.6,
    },
    signOutButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.xs + 2,
      minHeight: 44,
    },
    infoLabel: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '500',
      lineHeight: 22,
    },
    infoValue: {
      fontSize: 16,
      color: theme.isDark ? '#A8A8AD' : '#787880',
      fontWeight: '400',
      lineHeight: 22,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.isDark ? theme.colors.border : '#E5E5EA',
      marginVertical: theme.spacing.xs - 2,
    },
    signOutSection: {
      marginTop: theme.spacing.md - 4,
      marginHorizontal: 16,
    },
    footer: {
      marginTop: theme.spacing.md + 4,
      marginHorizontal: 16,
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    footerText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      opacity: 0.75,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      maxHeight: '70%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    modalCloseButton: {
      padding: 4,
    },
    iconGrid: {
      maxHeight: 400,
    },
    iconGridContent: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 8,
    },
    iconOption: {
      width: '33.33%',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 8,
      paddingVertical: 16,
    },
    iconOptionSelected: {
      backgroundColor: `${theme.colors.primary}10`,
      borderRadius: 12,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${theme.colors.primary}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    iconCircleSelected: {
      backgroundColor: theme.colors.primary,
    },
    iconLabel: {
      fontSize: 12,
      color: theme.colors.text,
      textAlign: 'center',
      fontWeight: '500',
    },
    iconLabelSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Account Section */}
        <View style={[styles.section, styles.firstSection]}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          {/* User Info Card */}
          <TouchableOpacity 
            style={styles.accountCard} 
            onPress={() => handleRowPress(handleAvatarPress)}
            activeOpacity={0.7}>
            <View style={styles.userInfoRow}>
              <View style={styles.avatarContainer}>
                <LinearGradient
                  colors={theme.gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarGradient}>
                  <Ionicons name={selectedIcon as any} size={28} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user?.user_metadata?.name || 'User'}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
              </View>
              <View style={styles.chevronContainer}>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </View>
            </View>
            <Text style={styles.tapToChangeText}>Tap to change icon</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button - Close to top */}
        <View style={styles.signOutSection}>
          <TouchableOpacity
            style={[styles.signOutButton, isLoading && styles.signOutButtonDisabled]}
            onPress={handleSignOut}
            disabled={isLoading}
            activeOpacity={0.8}>
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
                <Text style={styles.signOutButtonText}>Sign Out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleRowPress(handleThemeToggle)}
            activeOpacity={0.7}>
            <View style={styles.themeRow}>
              <View style={styles.themeRowLeft}>
                <View style={styles.themeIconContainer}>
                  <Ionicons
                    name={themeMode === 'dark' ? 'moon' : 'sunny'}
                    size={22}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={styles.themeLabel}>Theme</Text>
              </View>
              <View style={styles.themeToggleContainer}>
                <Text style={styles.themeToggleText}>
                  {themeMode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </Text>
                <View style={styles.themeChevron}>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App Name</Text>
              <Text style={styles.infoValue}>Subscribely</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with ❤️ for subscription management</Text>
        </View>
      </ScrollView>

      {/* Icon Picker Modal */}
      <Modal
        visible={showIconPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowIconPicker(false)}>
        <View style={styles.modalOverlay}>
          <Pressable 
            style={styles.modalBackdrop} 
            onPress={() => setShowIconPicker(false)} 
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Your Icon</Text>
              <TouchableOpacity
                onPress={() => setShowIconPicker(false)}
                style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.iconGrid}
              contentContainerStyle={styles.iconGridContent}
              showsVerticalScrollIndicator={false}>
              {USER_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon.name}
                  style={[
                    styles.iconOption,
                    selectedIcon === icon.name && styles.iconOptionSelected,
                  ]}
                  onPress={() => handleIconSelect(icon.name)}
                  activeOpacity={0.7}>
                  <View style={[
                    styles.iconCircle,
                    selectedIcon === icon.name && styles.iconCircleSelected,
                  ]}>
                    <Ionicons 
                      name={icon.name as any} 
                      size={32} 
                      color={selectedIcon === icon.name ? '#FFFFFF' : theme.colors.primary} 
                    />
                  </View>
                  <Text style={[
                    styles.iconLabel,
                    selectedIcon === icon.name && styles.iconLabelSelected,
                  ]}>
                    {icon.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}