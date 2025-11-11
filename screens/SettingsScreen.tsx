import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const { user, signOut } = useAuth();
  const { theme, themeMode, setThemeMode } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<string>('person');
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Load saved icon preference
  useEffect(() => {
    loadIconPreference();
  }, []);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const handleSignOut = () => {
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
      paddingBottom: theme.spacing.xl,
    },
    section: {
      marginTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
    },
    firstSection: {
      marginTop: 25,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: theme.spacing.md,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
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
      fontWeight: '500',
    },
    userInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatarContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: `${theme.colors.primary}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing.md,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    tapToChangeText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    signOutButton: {
      backgroundColor: theme.colors.error,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
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
      paddingVertical: theme.spacing.sm,
    },
    infoLabel: {
      fontSize: 16,
      color: theme.colors.text,
    },
    infoValue: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
    footer: {
      marginTop: theme.spacing.xxl,
      paddingHorizontal: theme.spacing.xl,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
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
            style={styles.card} 
            onPress={handleAvatarPress}
            activeOpacity={0.8}>
            <View style={styles.userInfoRow}>
              <View style={styles.avatarContainer}>
                <Ionicons name={selectedIcon as any} size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user?.user_metadata?.name || 'User'}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
            <Text style={styles.tapToChangeText}>Tap to change icon</Text>
          </TouchableOpacity>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={handleThemeToggle}
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

        {/* Sign Out Button */}
        <View style={styles.section}>
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