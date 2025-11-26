import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Pressable,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../utils/storage';
import { dateHelpers } from '../utils/dateHelpers';
import { calculations } from '../utils/calculations';
import { Subscription } from '../types';
import * as Haptics from 'expo-haptics';
import { LogoSource, getNextLogoSource, getLogoUrlForSource } from '../utils/logoHelpers';
import { subscriptionLimitService } from '../services/subscriptionLimitService';

// Type definitions for navigation
type SubscriptionsStackParamList = {
  Home: undefined;
  AddSubscription: { subscription?: Subscription };
  EditSubscription: { subscription: Subscription };
};

type EditSubscriptionScreenRouteProp = RouteProp<SubscriptionsStackParamList, 'EditSubscription'>;
type EditSubscriptionScreenNavigationProp = StackNavigationProp<SubscriptionsStackParamList, 'EditSubscription'>;

// Service brand colors mapping (same as SubscriptionCard)
const SERVICE_COLORS: { [key: string]: string } = {
  'netflix': '#E50914',
  'spotify': '#1DB954',
  'dropbox': '#0061FF',
  'apple': '#000000',
  'youtube': '#FF0000',
  'amazon': '#FF9900',
};

export default function EditSubscriptionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<EditSubscriptionScreenNavigationProp>();
  const route = useRoute<EditSubscriptionScreenRouteProp>();
  const { subscription: initialSubscription } = route.params;
  const [subscription, setSubscription] = useState(initialSubscription);
  const [loading, setLoading] = useState(false);
  const [logoSource, setLogoSource] = useState<LogoSource>('primary');

  // Refresh subscription data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      // Refresh subscription data from storage
      setLoading(true);
      try {
        const updatedSubscription = await storage.getById(initialSubscription.id);
        if (updatedSubscription) {
          setSubscription(updatedSubscription);
        }
      } catch (error) {
        console.error('Error refreshing subscription:', error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [navigation, initialSubscription.id]);

  // Set up navigation header
  useEffect(() => {
    navigation.setOptions({
      title: subscription.chargeType === 'one_time' ? 'Charge Details' : 'Recurring Item Details',
    });
  }, [navigation, subscription.chargeType]);

  // Get service icon color based on service name
  const getIconColor = (): string => {
    const serviceName = subscription.name.toLowerCase();
    for (const [key, color] of Object.entries(SERVICE_COLORS)) {
      if (serviceName.includes(key)) {
        return color;
      }
    }
    return theme.colors.primary;
  };

  // Get first letter of service name
  const getIconLetter = (): string => {
    return subscription.name.charAt(0).toUpperCase();
  };

  // Handle edit button press - navigate to AddSubscription screen in edit mode
  const handleEditPress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate('AddSubscription', { subscription });
  };

  // Handle delete subscription
  const handleDelete = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    const isOneTime = subscription.chargeType === 'one_time';
    Alert.alert(
      isOneTime ? 'Delete Charge' : 'Delete Recurring Item',
      `Are you sure you want to delete ${subscription.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS === 'ios') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            
            setLoading(true);
            try {
              const success = await storage.delete(subscription.id);
              
              if (success) {
                // Invalidate limit status cache to ensure count is refreshed immediately
                await subscriptionLimitService.refreshLimitStatus().catch(err => {
                  console.error('Failed to refresh limit status after delete:', err);
                  // Don't block navigation if cache refresh fails
                });
                
                if (Platform.OS === 'ios') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                navigation.navigate('Home');
              } else {
                throw new Error('Failed to delete subscription');
              }
            } catch (error) {
              console.error('Error deleting subscription:', error);
              if (Platform.OS === 'ios') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
              Alert.alert(
                'Failed to Delete',
                'Could not delete subscription. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Handle logo error and try fallback sources
  const handleLogoError = () => {
    setLogoSource(currentSource => getNextLogoSource(currentSource));
  };

  // Render either logo or fallback icon
  const renderIcon = () => {
    const logoUrl = subscription.domain ? getLogoUrlForSource(subscription.domain, logoSource, 64) : '';
    
    if (subscription.domain && logoUrl) {
      return (
        <View style={styles.logoContainer}>
          <Image
            source={{ uri: logoUrl }}
            style={styles.logoImage}
            onError={handleLogoError}
          />
        </View>
      );
    }

    // Fallback to letter-based icon when no domain or all sources failed
    return (
      <View style={[styles.iconContainer, { backgroundColor: getIconColor() }]}>
        <Text style={styles.iconText}>{getIconLetter()}</Text>
      </View>
    );
  };

  const monthlyCost = calculations.getMonthlyCost(subscription);
  const renewalDateFormatted = dateHelpers.formatFullDate(subscription.renewalDate);
  const daysUntilRenewal = calculations.getDaysUntilRenewal(subscription.renewalDate);

  // Calculate bottom padding to avoid tab bar overlay
  const TAB_BAR_HEIGHT = 60;
  const safeAreaBottom = insets.bottom > 0 ? insets.bottom : 8;
  const bottomPadding = TAB_BAR_HEIGHT + safeAreaBottom + 80;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: bottomPadding,
    },
    // Hero Card
    heroCard: {
      backgroundColor: theme.colors.card,
      marginTop: 16,
      marginHorizontal: 16,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#00000010',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    logoContainer: {
      width: 80,
      height: 80,
      marginBottom: 16,
    },
    logoImage: {
      width: 80,
      height: 80,
      borderRadius: 20,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      marginBottom: 16,
    },
    iconText: {
      color: '#FFFFFF',
      fontSize: 36,
      fontWeight: '700',
    },
    serviceName: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      lineHeight: 34,
      marginBottom: 8,
    },
    price: {
      fontSize: 48,
      fontWeight: '700',
      color: theme.colors.primary,
      textAlign: 'center',
      letterSpacing: -1,
      lineHeight: 56,
    },
    billingCycle: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
    },
    // Section
    section: {
      marginTop: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      marginHorizontal: 16,
    },
    card: {
      backgroundColor: theme.colors.card,
      marginHorizontal: 16,
      borderRadius: 16,
      padding: 16,
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
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    infoLabel: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '500',
      lineHeight: 22,
    },
    infoValue: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      fontWeight: '400',
      lineHeight: 22,
      textAlign: 'right',
      flex: 1,
      marginLeft: 16,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
    },
    // Description Card
    descriptionCard: {
      backgroundColor: theme.colors.card,
      marginHorizontal: 16,
      borderRadius: 16,
      padding: 16,
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
    descriptionText: {
      fontSize: 15,
      color: theme.colors.text,
      lineHeight: 22,
    },
    // Action Buttons
    actionsSection: {
      marginTop: 20,
      marginHorizontal: 16,
      gap: 12,
    },
    editButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    editButtonPressed: {
      opacity: 0.8,
    },
    editButtonText: {
      fontSize: 17,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    deleteButton: {
      backgroundColor: theme.isDark ? 'rgba(255, 69, 58, 0.15)' : 'rgba(255, 59, 48, 0.1)',
      borderRadius: 16,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.error,
    },
    deleteButtonPressed: {
      opacity: 0.7,
    },
    deleteButtonText: {
      fontSize: 17,
      color: theme.colors.error,
      fontWeight: '600',
    },
    renewalBadge: {
      backgroundColor: daysUntilRenewal <= 7 
        ? theme.isDark ? 'rgba(255, 159, 10, 0.15)' : 'rgba(255, 149, 0, 0.1)'
        : theme.isDark ? 'rgba(50, 215, 75, 0.15)' : 'rgba(52, 199, 89, 0.1)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    renewalBadgeText: {
      fontSize: 13,
      fontWeight: '600',
      color: daysUntilRenewal <= 7 ? theme.colors.warning : theme.colors.success,
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Hero Card - Service Info */}
        <View style={styles.heroCard}>
          {renderIcon()}
          <Text style={styles.serviceName}>{subscription.name}</Text>
          <Text style={styles.price}>${monthlyCost.toFixed(2)}</Text>
          {subscription.chargeType !== 'one_time' && (
            <Text style={styles.billingCycle}>
              per {subscription.billingCycle === 'monthly' ? 'month' : 'year'}
            </Text>
          )}
        </View>

        {/* Billing Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billing Information</Text>
          <View style={styles.card}>
            {subscription.chargeType !== 'one_time' && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Billing Cycle</Text>
                  <Text style={styles.infoValue}>
                    {subscription.billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}
                  </Text>
                </View>
                <View style={styles.divider} />
              </>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {subscription.chargeType === 'one_time' ? 'Charge Date' : 'Next Renewal'}
              </Text>
              <Text style={styles.infoValue}>{renewalDateFormatted}</Text>
            </View>
            {subscription.chargeType !== 'one_time' && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Days Until Renewal</Text>
                  <View style={styles.renewalBadge}>
                    <Text style={styles.renewalBadgeText}>
                      {daysUntilRenewal === 0 ? 'Today' :
                       daysUntilRenewal === 1 ? 'Tomorrow' :
                       `${daysUntilRenewal} days`}
                    </Text>
                  </View>
                </View>
              </>
            )}
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>{subscription.category || 'Other'}</Text>
            </View>
            {subscription.chargeType !== 'one_time' && subscription.billingCycle === 'yearly' && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Monthly Equivalent</Text>
                  <Text style={styles.infoValue}>${monthlyCost.toFixed(2)}/mo</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Description Section (if available) */}
        {subscription.description && subscription.description.trim() !== '' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>{subscription.description}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <Pressable
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.editButtonPressed,
            ]}
            onPress={handleEditPress}>
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <Text style={styles.editButtonText}>
              {subscription.chargeType === 'one_time' ? 'Edit Charge' : 'Edit Recurring Item'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.deleteButtonPressed,
            ]}
            onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
            <Text style={styles.deleteButtonText}>
              {subscription.chargeType === 'one_time' ? 'Delete Charge' : 'Delete Recurring Item'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}