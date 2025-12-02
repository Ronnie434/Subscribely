import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Modal, Pressable, Image, Switch } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import TierBadge from '../components/TierBadge';
import { subscriptionLimitService } from '../services/subscriptionLimitService';
import { SubscriptionLimitStatus, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useRealtimeSubscriptions } from '../hooks/useRealtimeSubscriptions';
import { supabase } from '../config/supabase';

// Navigation types
type SettingsStackParamList = {
  SettingsHome: undefined;
  SubscriptionManagement: undefined;
  PlanSelection: undefined;
};

type SettingsScreenNavigationProp = StackNavigationProp<
  SettingsStackParamList,
  'SettingsHome'
>;

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
const USE_PROFILE_PHOTO_KEY = '@use_profile_photo';

export default function SettingsScreen() {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { user, signOut } = useAuth();
  const { theme, themeMode, setThemeMode } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<string>('person');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionLimitStatus | null>(null);
  
  // Profile photo states
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [useProfilePhoto, setUseProfilePhoto] = useState(true);
  
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 60;
  const safeAreaBottom = insets.bottom > 0 ? insets.bottom : 8;
  const bottomPadding = TAB_BAR_HEIGHT + safeAreaBottom + 20;

  // Load saved icon preference and profile photo preference
  useEffect(() => {
    loadIconPreference();
    loadProfilePhotoPreference();
  }, []);

  // Load profile data when user is available
  useEffect(() => {
    if (user?.id) {
      loadProfileData();
    }
  }, [user?.id]);

  // Load subscription status
  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      const status = await subscriptionLimitService.getSubscriptionLimitStatus();
      setSubscriptionStatus(status);
    } catch (error) {
      console.error('Error loading subscription status:', error);
    }
  };

  // Helper function to refresh limit status from backend
  const refreshLimitStatusFromBackend = async () => {
    try {
      // Invalidate cache and refresh from backend
      await subscriptionLimitService.refreshLimitStatus();
      
      // Get fresh status from backend
      const status = await subscriptionLimitService.getSubscriptionLimitStatus();
      setSubscriptionStatus(status);
      
      if (__DEV__) {
        console.log('✅ Settings: Limit status refreshed from backend:', {
          currentCount: status.currentCount,
          maxCount: status.maxAllowed,
          atLimit: !status.canAddMore,
        });
      }
    } catch (error) {
      console.error('Error refreshing limit status:', error);
    }
  };

  // Set up real-time subscriptions to keep count in sync
  const { isConnected, error: realtimeError } = useRealtimeSubscriptions(user?.id, {
    onInsert: (newSubscription) => {
      if (__DEV__) {
        console.log('Settings: Real-time INSERT:', newSubscription.name);
      }
      // Refresh limit status from backend to keep count in sync
      refreshLimitStatusFromBackend();
    },
    onUpdate: (updatedSubscription) => {
      if (__DEV__) {
        console.log('Settings: Real-time UPDATE:', updatedSubscription.name);
      }
      // Note: Updates don't change count, but refresh to ensure consistency
      refreshLimitStatusFromBackend();
    },
    onDelete: (deletedId) => {
      if (__DEV__) {
        console.log('Settings: Real-time DELETE:', deletedId);
      }
      // Refresh limit status from backend to keep count in sync
      refreshLimitStatusFromBackend();
    },
  });

  // Show real-time connection error if any
  useEffect(() => {
    if (realtimeError) {
      console.error('Settings: Real-time connection error:', realtimeError);
    }
  }, [realtimeError]);

  // Refresh subscription status when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const refreshStatus = async () => {
        try {
          // Clear cache and fetch fresh data
          await subscriptionLimitService.refreshLimitStatus();
          const status = await subscriptionLimitService.getSubscriptionLimitStatus();
          setSubscriptionStatus(status);
        } catch (error) {
          console.error('Error refreshing subscription status on focus:', error);
        }
      };
      
      refreshStatus();
      return () => {};
    }, [])
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

  const loadProfilePhotoPreference = async () => {
    try {
      const savedPreference = await AsyncStorage.getItem(USE_PROFILE_PHOTO_KEY);
      if (savedPreference !== null) {
        setUseProfilePhoto(savedPreference === 'true');
      }
    } catch (error) {
      console.error('Error loading profile photo preference:', error);
    }
  };

  const loadProfileData = async () => {
    if (!user?.id) return;
    
    try {
      setProfileLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, created_at, updated_at')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error loading profile:', error);
        return;
      }
      
      setProfileData(data);
      
      if (__DEV__) {
        console.log('[Settings] Profile loaded:', {
          hasAvatar: !!data?.avatar_url,
          avatarUrl: data?.avatar_url
        });
      }
    } catch (error) {
      console.error('Error in loadProfileData:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleIconSelect = async (iconName: string) => {
    try {
      await AsyncStorage.setItem(ICON_STORAGE_KEY, iconName);
      setSelectedIcon(iconName);
      
      // When user selects an icon, switch to using icons instead of profile photo
      setUseProfilePhoto(false);
      await AsyncStorage.setItem(USE_PROFILE_PHOTO_KEY, 'false');
      setImageLoadError(false);
      
      setShowIconPicker(false);
      
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error saving icon preference:', error);
      Alert.alert('Error', 'Failed to save icon preference. Please try again.');
    }
  };

  const handleToggleProfilePhoto = async (value: boolean) => {
    try {
      setUseProfilePhoto(value);
      await AsyncStorage.setItem(USE_PROFILE_PHOTO_KEY, value.toString());
      
      if (!value) {
        // Reset image error when switching away from photo
        setImageLoadError(false);
      }
      
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error saving profile photo preference:', error);
    }
  };

  const handleAvatarPress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowIconPicker(true);
  };

  // Determine if we should show profile photo
  const shouldShowProfilePhoto =
    useProfilePhoto &&
    profileData?.avatar_url &&
    !imageLoadError;

  const handleThemeSelect = async (mode: ThemeMode) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    try {
      await setThemeMode(mode);
      setShowThemePicker(false);
      
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error changing theme:', error);
      Alert.alert('Error', 'Failed to change theme. Please try again.');
    }
  };

  const handleThemePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowThemePicker(true);
  };

  const getThemeLabel = (mode: ThemeMode): string => {
    switch (mode) {
      case 'light':
        return 'Light Mode';
      case 'dark':
        return 'Dark Mode';
      case 'auto':
        return 'System';
      default:
        return 'System';
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
      paddingBottom: bottomPadding,
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
      position: 'relative',
    },
    avatarImage: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    imageLoader: {
      position: 'absolute',
      zIndex: 10,
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
    photoToggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginRight: 12,
    },
    photoToggleLabel: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: '500',
    },
    photoPreviewContainer: {
      alignItems: 'center',
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      marginBottom: 12,
    },
    photoPreview: {
      width: 80,
      height: 80,
      borderRadius: 40,
      marginBottom: 12,
    },
    photoPreviewText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    themeOptionsContainer: {
      padding: 16,
    },
    themeOption: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    themeOptionSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    themeOptionContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    themeOptionIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: `${theme.colors.primary}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    themeOptionIconContainerSelected: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    themeOptionTextContainer: {
      flex: 1,
    },
    themeOptionLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    themeOptionLabelSelected: {
      color: '#FFFFFF',
    },
    themeOptionDescription: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.colors.textSecondary,
    },
    themeOptionDescriptionSelected: {
      color: 'rgba(255, 255, 255, 0.8)',
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
                {shouldShowProfilePhoto ? (
                  <>
                    {isImageLoading && (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                        style={styles.imageLoader}
                      />
                    )}
                    <Image
                      source={{ uri: profileData.avatar_url!, cache: 'force-cache' }}
                      style={styles.avatarImage}
                      onLoadStart={() => setIsImageLoading(true)}
                      onLoadEnd={() => setIsImageLoading(false)}
                      onError={(e) => {
                        console.error('Profile photo load error:', {
                          url: profileData?.avatar_url,
                          error: e.nativeEvent.error,
                        });
                        setImageLoadError(true);
                        setIsImageLoading(false);
                      }}
                    />
                  </>
                ) : (
                  <LinearGradient
                    colors={theme.gradients.primary as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarGradient}>
                    <Ionicons name={selectedIcon as any} size={28} color="#FFFFFF" />
                  </LinearGradient>
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user?.user_metadata?.name || 'User'}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
              </View>
              <View style={styles.chevronContainer}>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </View>
            </View>
            <Text style={styles.tapToChangeText}>
              {profileData?.avatar_url ? 'Tap to change avatar' : 'Tap to change icon'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subscription Section */}
        {subscriptionStatus && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subscription</Text>
            
            <View style={styles.card}>
              {/* Current Tier with Badge */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Current Plan</Text>
                <TierBadge
                  tier={subscriptionStatus.isPremium ? 'premium' : 'free'}
                  size="small"
                />
              </View>
              
              {/* Usage for Free Tier */}
              {!subscriptionStatus.isPremium && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Recurring Items</Text>
                    <Text style={styles.infoValue}>
                      {subscriptionStatus.currentCount} of {subscriptionStatus.maxAllowed} used
                    </Text>
                  </View>
                </>
              )}
              
              <View style={styles.divider} />
              
              {/* Manage Plan Button */}
              <TouchableOpacity
                style={[styles.infoRow, { paddingVertical: 0 }]}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  // Navigate to appropriate screen based on user status
                  if (subscriptionStatus.isPremium) {
                    // @ts-ignore - Navigation will work, types are simplified
                    navigation.navigate('SubscriptionManagement');
                  } else {
                    // @ts-ignore - Navigation will work, types are simplified
                    navigation.navigate('PlanSelection');
                  }
                }}
                activeOpacity={0.7}>
                <Text style={[styles.infoLabel, { color: theme.colors.primary, fontWeight: '600' }]}>
                  {subscriptionStatus.isPremium ? 'Manage Plan' : 'Upgrade to Premium'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

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
            onPress={() => handleRowPress(handleThemePress)}
            activeOpacity={0.7}>
            <View style={styles.themeRow}>
              <View style={styles.themeRowLeft}>
                <View style={styles.themeIconContainer}>
                  <Ionicons
                    name={theme.isDark ? 'moon' : 'sunny'}
                    size={22}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={styles.themeLabel}>Theme</Text>
              </View>
              <View style={styles.themeToggleContainer}>
                <Text style={styles.themeToggleText}>
                  {getThemeLabel(themeMode)}
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
              <Text style={styles.infoValue}>Renvo</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with ❤️ for recurring item management</Text>
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
              <Text style={styles.modalTitle}>
                {profileData?.avatar_url ? 'Choose Avatar' : 'Choose Your Icon'}
              </Text>
              {profileData?.avatar_url && (
                <View style={styles.photoToggleContainer}>
                  <Text style={styles.photoToggleLabel}>Profile Photo</Text>
                  <Switch
                    value={useProfilePhoto}
                    onValueChange={handleToggleProfilePhoto}
                    trackColor={{
                      false: theme.colors.border,
                      true: theme.colors.primary
                    }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={theme.colors.border}
                  />
                </View>
              )}
              <TouchableOpacity
                onPress={() => setShowIconPicker(false)}
                style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            {/* Show profile photo preview when toggle is on */}
            {profileData?.avatar_url && useProfilePhoto && (
              <View style={styles.photoPreviewContainer}>
                <Image
                  source={{ uri: profileData.avatar_url, cache: 'force-cache' }}
                  style={styles.photoPreview}
                />
                <Text style={styles.photoPreviewText}>
                  Using your profile photo
                </Text>
              </View>
            )}
            
            {/* Only show icon grid when not using profile photo or no profile photo available */}
            {(!profileData?.avatar_url || !useProfilePhoto) && (
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
            )}
          </View>
        </View>
      </Modal>

      {/* Theme Picker Modal */}
      <Modal
        visible={showThemePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowThemePicker(false)}>
        <View style={styles.modalOverlay}>
          <Pressable 
            style={styles.modalBackdrop} 
            onPress={() => setShowThemePicker(false)} 
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Theme</Text>
              <TouchableOpacity
                onPress={() => setShowThemePicker(false)}
                style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.themeOptionsContainer}>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  themeMode === 'light' && styles.themeOptionSelected,
                ]}
                onPress={() => handleThemeSelect('light')}
                activeOpacity={0.7}>
                <View style={styles.themeOptionContent}>
                  <View style={[
                    styles.themeOptionIconContainer,
                    themeMode === 'light' && styles.themeOptionIconContainerSelected,
                  ]}>
                    <Ionicons name="sunny" size={24} color={themeMode === 'light' ? '#FFFFFF' : theme.colors.primary} />
                  </View>
                  <View style={styles.themeOptionTextContainer}>
                    <Text style={[
                      styles.themeOptionLabel,
                      themeMode === 'light' && styles.themeOptionLabelSelected,
                    ]}>
                      Light Mode
                    </Text>
                    <Text style={[
                      styles.themeOptionDescription,
                      themeMode === 'light' && styles.themeOptionDescriptionSelected,
                    ]}>
                      Always use light theme
                    </Text>
                  </View>
                  {themeMode === 'light' && (
                    <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  themeMode === 'dark' && styles.themeOptionSelected,
                ]}
                onPress={() => handleThemeSelect('dark')}
                activeOpacity={0.7}>
                <View style={styles.themeOptionContent}>
                  <View style={[
                    styles.themeOptionIconContainer,
                    themeMode === 'dark' && styles.themeOptionIconContainerSelected,
                  ]}>
                    <Ionicons name="moon" size={24} color={themeMode === 'dark' ? '#FFFFFF' : theme.colors.primary} />
                  </View>
                  <View style={styles.themeOptionTextContainer}>
                    <Text style={[
                      styles.themeOptionLabel,
                      themeMode === 'dark' && styles.themeOptionLabelSelected,
                    ]}>
                      Dark Mode
                    </Text>
                    <Text style={[
                      styles.themeOptionDescription,
                      themeMode === 'dark' && styles.themeOptionDescriptionSelected,
                    ]}>
                      Always use dark theme
                    </Text>
                  </View>
                  {themeMode === 'dark' && (
                    <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  themeMode === 'auto' && styles.themeOptionSelected,
                ]}
                onPress={() => handleThemeSelect('auto')}
                activeOpacity={0.7}>
                <View style={styles.themeOptionContent}>
                  <View style={[
                    styles.themeOptionIconContainer,
                    themeMode === 'auto' && styles.themeOptionIconContainerSelected,
                  ]}>
                    <Ionicons name="phone-portrait" size={24} color={themeMode === 'auto' ? '#FFFFFF' : theme.colors.primary} />
                  </View>
                  <View style={styles.themeOptionTextContainer}>
                    <Text style={[
                      styles.themeOptionLabel,
                      themeMode === 'auto' && styles.themeOptionLabelSelected,
                    ]}>
                      System
                    </Text>
                    <Text style={[
                      styles.themeOptionDescription,
                      themeMode === 'auto' && styles.themeOptionDescriptionSelected,
                    ]}>
                      Follow system theme
                    </Text>
                  </View>
                  {themeMode === 'auto' && (
                    <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}