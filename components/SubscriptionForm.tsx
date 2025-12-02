import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  Switch,
  Image,
  TouchableWithoutFeedback,
  Modal,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { Subscription, BillingCycle, ChargeType } from '../types';
import {
  extractDomain,
  getCompanyNames,
  isValidDomain,
  getDomainSuggestion,
  verifyAndCacheDomain,
  cacheManualDomain,
  type DomainSuggestion as DomainSuggestionType,
} from '../utils/domainHelpers';
import { getLogoUrlForSource, getNextLogoSource, LogoSource } from '../utils/logoHelpers';
import DomainSuggestion from './DomainSuggestion';
import * as Haptics from 'expo-haptics';

interface SubscriptionFormProps {
  subscription?: Subscription;
  onSubmit: (subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const CATEGORIES = [
  { name: 'Streaming', icon: '📺', color: '#FF3B30' },
  { name: 'Cloud Storage', icon: '☁️', color: '#007AFF' },
  { name: 'Music', icon: '🎵', color: '#FF9500' },
  { name: 'Software', icon: '💻', color: '#5856D6' },
  { name: 'News', icon: '📰', color: '#34C759' },
  { name: 'Other', icon: '📦', color: '#8E8E93' },
];

export default function SubscriptionForm({ subscription, onSubmit, onCancel, isSubmitting = false }: SubscriptionFormProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(subscription?.name || '');
  const [cost, setCost] = useState(subscription?.cost ? subscription.cost.toFixed(2) : '');
  const [description, setDescription] = useState(subscription?.description || '');
  const [chargeType, setChargeType] = useState<ChargeType>(subscription?.chargeType || 'recurring');
  const [billingFrequency, setBillingFrequency] = useState<BillingCycle>(subscription?.billingCycle || 'monthly');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [logoSources, setLogoSources] = useState<Map<string, LogoSource>>(new Map());
  const nameInputRef = useRef<TextInput>(null);
  
  // Domain discovery state
  const [domainSuggestion, setDomainSuggestion] = useState<DomainSuggestionType | null>(null);
  const [showManualDomainInput, setShowManualDomainInput] = useState(false);
  const [manualDomain, setManualDomain] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const domainDiscoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Helper to parse date string without timezone offset
  const parseDateWithoutTimezone = (dateStr: string): Date => {
    // If date is in YYYY-MM-DD format, parse it correctly
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    // If it's an ISO string with time, extract just the date part
    if (dateStr.includes('T')) {
      const datePart = dateStr.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    // Fallback to regular Date parsing
    return new Date(dateStr);
  };

  const [useCustomDate, setUseCustomDate] = useState(subscription?.isCustomRenewalDate || false);
  const [customRenewalDate, setCustomRenewalDate] = useState<Date>(
    subscription?.renewalDate
      ? parseDateWithoutTimezone(subscription.renewalDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [enableReminders, setEnableReminders] = useState(subscription?.reminders ?? true);

  // Get all company names for autocomplete
  const allCompanyNames = getCompanyNames();

  useEffect(() => {
    if (subscription) {
      setName(subscription.name);
      setCost(subscription.cost.toFixed(2));
      setDescription(subscription.description || '');
      setChargeType(subscription.chargeType || 'recurring');
      setBillingFrequency(subscription.billingCycle);
    }
  }, [subscription]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    const costNum = parseFloat(cost);
    if (!cost || isNaN(costNum) || costNum <= 0) {
      newErrors.cost = 'Price is required and must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Use custom date if enabled, otherwise auto-generate (30 days from now)
    const renewalDate = useCustomDate
      ? customRenewalDate
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Format date as YYYY-MM-DD to avoid timezone issues
    const formatDateOnly = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Use "Other" as default category
    const category = 'Other';
    const selectedCategory = CATEGORIES.find(cat => cat.name === category) || CATEGORIES[CATEGORIES.length - 1];

    // Determine final domain to use
    let finalDomain = '';
    
    if (showManualDomainInput && manualDomain) {
      // User manually entered a domain
      if (isValidDomain(manualDomain)) {
        finalDomain = manualDomain;
        // Cache the manual domain
        try {
          await cacheManualDomain(name.trim(), manualDomain);
        } catch (error) {
          console.error('[Form] Error caching manual domain:', error);
        }
      }
    } else if (domainSuggestion) {
      // Use discovered domain
      finalDomain = domainSuggestion.domain;
      
      // Verify low-confidence domains before saving
      if (domainSuggestion.confidence === 'low' && !domainSuggestion.verified) {
        setIsVerifying(true);
        try {
          const verified = await verifyAndCacheDomain(name.trim(), domainSuggestion.domain);
          if (!verified) {
            console.log('[Form] Domain verification failed, but proceeding with save');
            // Still use the domain even if verification failed
            // User can always edit later
          }
        } catch (error) {
          console.error('[Form] Error verifying domain:', error);
        } finally {
          setIsVerifying(false);
        }
      }
    } else {
      // Fallback to old extraction method
      const extractedDomain = extractDomain(name.trim());
      finalDomain = (extractedDomain && isValidDomain(extractedDomain)) ? extractedDomain : '';
    }

    onSubmit({
      name: name.trim(),
      cost: parseFloat(cost),
      billingCycle: billingFrequency,
      renewalDate: formatDateOnly(renewalDate),
      category,
      color: selectedCategory.color,
      domain: finalDomain,
      description: description.trim() || undefined,
      isCustomRenewalDate: useCustomDate,
      reminders: chargeType === 'recurring' ? enableReminders : false,
      chargeType,
    });
  };

  // Filter suggestions based on user input
  const filterSuggestions = (text: string) => {
    if (!text || text.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const searchText = text.toLowerCase().trim();
    const filtered = allCompanyNames
      .filter(companyName =>
        companyName.toLowerCase().includes(searchText)
      )
      .slice(0, 5); // Limit to max 5 suggestions

    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  // Debounced domain discovery
  const discoverDomain = React.useCallback(async (serviceName: string) => {
    if (!serviceName || serviceName.trim().length === 0) {
      setDomainSuggestion(null);
      return;
    }

    try {
      const suggestion = await getDomainSuggestion(serviceName);
      setDomainSuggestion(suggestion);
      console.log('[Form] Domain suggestion:', suggestion);
    } catch (error) {
      console.error('[Form] Error discovering domain:', error);
      setDomainSuggestion(null);
    }
  }, []);

  // Debounced domain discovery when name changes
  React.useEffect(() => {
    // Clear previous timeout
    if (domainDiscoveryTimeoutRef.current) {
      clearTimeout(domainDiscoveryTimeoutRef.current);
    }

    // Skip if name is empty or if we have autocomplete suggestions showing
    if (!name || name.trim().length === 0 || showSuggestions) {
      setDomainSuggestion(null);
      return;
    }

    // Debounce domain discovery (wait 500ms after user stops typing)
    domainDiscoveryTimeoutRef.current = setTimeout(() => {
      discoverDomain(name);
    }, 500);

    return () => {
      if (domainDiscoveryTimeoutRef.current) {
        clearTimeout(domainDiscoveryTimeoutRef.current);
      }
    };
  }, [name, showSuggestions, discoverDomain]);

  // Handle logo error for suggestions and try fallback sources
  const handleSuggestionLogoError = (suggestion: string) => {
    const currentSource = logoSources.get(suggestion) || 'primary';
    const nextSource = getNextLogoSource(currentSource);
    setLogoSources(new Map(logoSources.set(suggestion, nextSource)));
  };

  // Handle selecting a suggestion
  const handleSuggestionSelect = (suggestion: string) => {
    setName(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    if (errors.name) setErrors({ ...errors, name: '' });
    
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const formatCurrency = (value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    return numValue.toFixed(2);
  };

  // Calculate monthly cost for display
  const calculateMonthlyCost = () => {
    const costNum = parseFloat(cost);
    if (isNaN(costNum) || costNum <= 0) return '0.00';
    return costNum.toFixed(2);
  };

  // Calculate bottom padding to avoid tab bar overlay
  const TAB_BAR_HEIGHT = 60;
  const safeAreaBottom = insets.bottom > 0 ? insets.bottom : 8;
  const bottomPadding = TAB_BAR_HEIGHT + safeAreaBottom + 80;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: bottomPadding,
    },
    form: {
      paddingHorizontal: 16,
      paddingTop: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 24,
      lineHeight: 34,
    },
    field: {
      marginBottom: 20,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    inputContainer: {
      position: 'relative',
    },
    input: {
      color: theme.colors.text,
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      fontSize: 16,
      height: 52,
      ...Platform.select({
        ios: {
          shadowColor: '#00000010',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
        },
        android: {
          elevation: 1,
        },
      }),
    },
    textArea: {
      height: 100,
      paddingTop: 16,
    },
    inputFocused: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
      }),
    },
    inputError: {
      borderColor: theme.colors.error,
      borderWidth: 2,
    },
    errorText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.error,
      marginTop: 6,
      marginLeft: 4,
      lineHeight: 16,
    },
    costContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      paddingHorizontal: 16,
      height: 52,
      ...Platform.select({
        ios: {
          shadowColor: '#00000010',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
        },
        android: {
          elevation: 1,
        },
      }),
    },
    currencySymbol: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '600',
      marginRight: 4,
    },
    costInput: {
      color: theme.colors.text,
      flex: 1,
      fontSize: 16,
      paddingVertical: 0,
      height: 52,
      paddingRight: 8,
    },
    chevronIcon: {
      marginLeft: 8,
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 4,
      height: 52,
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
          elevation: 1,
        },
      }),
    },
    segmentButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      paddingVertical: 12,
    },
    segmentButtonLeft: {
      marginRight: 2,
    },
    segmentButtonRight: {
      marginLeft: 2,
    },
    segmentButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    segmentButtonPressed: {
      opacity: 0.7,
    },
    segmentButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    segmentButtonTextActive: {
      color: '#FFFFFF',
    },
    calculatedCostContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 24,
      marginBottom: 16,
    },
    calculatedCost: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: -0.5,
      lineHeight: 38,
    },
    calculatedCostSuffix: {
      fontSize: 20,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      marginLeft: 4,
      lineHeight: 26,
    },
    buttonContainer: {
      padding: 16,
      paddingBottom: TAB_BAR_HEIGHT + safeAreaBottom + 16,
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    submitButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      height: 50,
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
    submitButtonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '700',
    },
    suggestionsContainer: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: 4,
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      maxHeight: 250,
      zIndex: 1000,
      ...Platform.select({
        ios: {
          shadowColor: '#00000010',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    suggestionsList: {
      maxHeight: 250,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    suggestionItemPressed: {
      backgroundColor: theme.colors.background,
    },
    suggestionItemLast: {
      borderBottomWidth: 0,
    },
    suggestionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    suggestionLogo: {
      width: 24,
      height: 24,
      borderRadius: 6,
      marginRight: 12,
      backgroundColor: theme.colors.border,
    },
    suggestionText: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '500',
      lineHeight: 22,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    dateButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 16,
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
          elevation: 1,
        },
      }),
    },
    dateButtonPressed: {
      opacity: 0.7,
    },
    dateButtonText: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '500',
      lineHeight: 22,
    },
    helperText: {
      fontSize: 12,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      marginTop: 6,
      marginLeft: 4,
      lineHeight: 16,
      opacity: 0.8,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.4)',
    },
    modalContent: {
      backgroundColor: theme.isDark ? theme.colors.card : '#FFFFFF',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      ...Platform.select({
        ios: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: theme.isDark ? 0.3 : 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
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
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.text,
    },
    modalDoneButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    modalDoneText: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    pickerContainer: {
      backgroundColor: theme.isDark ? theme.colors.card : '#FFFFFF',
      paddingVertical: 16,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonLoader: {
      marginRight: 8,
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* Name Field with Autocomplete */}
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <View style={styles.inputContainer}>
              <TextInput
                ref={nameInputRef}
                style={[
                  styles.input,
                  focusedField === 'name' && styles.inputFocused,
                  errors.name && styles.inputError,
                ]}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  filterSuggestions(text);
                  if (errors.name) setErrors({ ...errors, name: '' });
                }}
                onFocus={() => {
                  setFocusedField('name');
                  if (name.trim().length > 0) {
                    filterSuggestions(name);
                  }
                }}
                onBlur={() => {
                  // Delay hiding suggestions to allow click events
                  setTimeout(() => {
                    setFocusedField(null);
                    setShowSuggestions(false);
                  }, 200);
                }}
                placeholder="e.g., Netflix, Gym Membership, Coffee"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="words"
              />
              
              {/* Autocomplete Suggestions Dropdown */}
              {showSuggestions && focusedField === 'name' && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView
                    style={styles.suggestionsList}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}>
                    {suggestions.map((suggestion, index) => {
                      const domain = extractDomain(suggestion);
                      const logoSource = logoSources.get(suggestion) || 'primary';
                      const logoUrl = domain ? getLogoUrlForSource(domain, logoSource, 64) : null;
                      
                      return (
                        <Pressable
                          key={`${suggestion}-${index}`}
                          style={({ pressed }) => [
                            styles.suggestionItem,
                            pressed && styles.suggestionItemPressed,
                            index === suggestions.length - 1 && styles.suggestionItemLast,
                          ]}
                          onPress={() => handleSuggestionSelect(suggestion)}>
                          <View style={styles.suggestionContent}>
                            {logoUrl && (
                              <Image
                                source={{ uri: logoUrl }}
                                style={styles.suggestionLogo}
                                onError={() => handleSuggestionLogoError(suggestion)}
                              />
                            )}
                            <Text style={styles.suggestionText}>{suggestion}</Text>
                          </View>
                          <Ionicons
                            name="arrow-forward"
                            size={16}
                            color={theme.colors.textSecondary}
                          />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            
            {/* Domain Suggestion Display */}
            {!showSuggestions && name.trim().length > 0 && (
              <DomainSuggestion
                suggestion={domainSuggestion}
                onEdit={() => {
                  setShowManualDomainInput(true);
                  setManualDomain(domainSuggestion?.domain || '');
                }}
                onManualInput={() => {
                  setShowManualDomainInput(true);
                  setManualDomain('');
                }}
              />
            )}

            {/* Manual Domain Input */}
            {showManualDomainInput && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.label}>Website Domain (Optional)</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === 'manualDomain' && styles.inputFocused,
                  ]}
                  value={manualDomain}
                  onChangeText={setManualDomain}
                  onFocus={() => setFocusedField('manualDomain')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g., planetfitness.com"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <Text style={styles.helperText}>
                  Enter the company's website domain for logo display
                </Text>
              </View>
            )}
          </View>

          {/* Price Field */}
          <View style={styles.field}>
            <Text style={styles.label}>Price ($)</Text>
            <View
              style={[
                styles.costContainer,
                focusedField === 'cost' && styles.inputFocused,
                errors.cost && styles.inputError,
              ]}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.costInput}
                value={cost}
                onChangeText={(text) => {
                  // Allow only numbers and one decimal point
                  const cleaned = text.replace(/[^0-9.]/g, '');
                  const parts = cleaned.split('.');
                  if (parts.length > 2) return;
                  if (parts[1] && parts[1].length > 2) return;
                  setCost(cleaned);
                  if (errors.cost) setErrors({ ...errors, cost: '' });
                }}
                onFocus={() => setFocusedField('cost')}
                onBlur={() => {
                  setFocusedField(null);
                  // Always format to 2 decimal places, or set to empty if invalid
                  if (cost && !isNaN(parseFloat(cost))) {
                    setCost(formatCurrency(cost));
                  } else if (cost && cost.trim() !== '') {
                    // If there's text but it's not a valid number, clear it
                    setCost('');
                  }
                }}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={theme.colors.textSecondary}
              />
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textSecondary}
                style={styles.chevronIcon}
              />
            </View>
            {errors.cost && <Text style={styles.errorText}>{errors.cost}</Text>}
          </View>

          {/* Card Description Field */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  focusedField === 'description' && styles.inputFocused,
                ]}
                value={description}
                onChangeText={setDescription}
                onFocus={() => setFocusedField('description')}
                onBlur={() => setFocusedField(null)}
                placeholder="Add notes about this charge..."
                placeholderTextColor={theme.colors.textSecondary}
                multiline={true}
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Charge Type Selector */}
          <View style={styles.field}>
            <Text style={styles.label}>Charge Type</Text>
            <View style={styles.segmentedControl}>
              <Pressable
                style={({ pressed }) => [
                  styles.segmentButton,
                  styles.segmentButtonLeft,
                  chargeType === 'recurring' && styles.segmentButtonActive,
                  pressed && styles.segmentButtonPressed,
                ]}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setChargeType('recurring');
                }}>
                <Text
                  style={[
                    styles.segmentButtonText,
                    chargeType === 'recurring' && styles.segmentButtonTextActive,
                  ]}>
                  Recurring
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.segmentButton,
                  styles.segmentButtonRight,
                  chargeType === 'one_time' && styles.segmentButtonActive,
                  pressed && styles.segmentButtonPressed,
                ]}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setChargeType('one_time');
                }}>
                <Text
                  style={[
                    styles.segmentButtonText,
                    chargeType === 'one_time' && styles.segmentButtonTextActive,
                  ]}>
                  One-time
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Billing Frequency Selector - Only show for recurring charges */}
          {chargeType === 'recurring' && (
            <View style={styles.field}>
              <Text style={styles.label}>Billing Frequency</Text>
              <View style={styles.segmentedControl}>
              <Pressable
                style={({ pressed }) => [
                  styles.segmentButton,
                  styles.segmentButtonLeft,
                  billingFrequency === 'monthly' && styles.segmentButtonActive,
                  pressed && styles.segmentButtonPressed,
                ]}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setBillingFrequency('monthly');
                }}>
                <Text
                  style={[
                    styles.segmentButtonText,
                    billingFrequency === 'monthly' && styles.segmentButtonTextActive,
                  ]}>
                  Monthly
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.segmentButton,
                  styles.segmentButtonRight,
                  billingFrequency === 'yearly' && styles.segmentButtonActive,
                  pressed && styles.segmentButtonPressed,
                ]}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setBillingFrequency('yearly');
                }}>
                <Text
                  style={[
                    styles.segmentButtonText,
                    billingFrequency === 'yearly' && styles.segmentButtonTextActive,
                  ]}>
                  Yearly
                </Text>
              </Pressable>
            </View>
          </View>
          )}

          {/* Date Toggle */}
          <View style={styles.field}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>
                {chargeType === 'recurring' ? 'Set Renewal Date (Optional)' : 'Set Charge Date (Optional)'}
              </Text>
              <Switch
                value={useCustomDate}
                onValueChange={(value) => {
                  setUseCustomDate(value);
                  if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            {!useCustomDate && (
              <Text style={styles.helperText}>
                {chargeType === 'recurring'
                  ? 'Renewal date will be set to 30 days from today'
                  : 'Charge date will be set to today'}
              </Text>
            )}
            {useCustomDate && (
              <Pressable
                style={({ pressed }) => [
                  styles.dateButton,
                  pressed && styles.dateButtonPressed,
                ]}
                onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateButtonText}>
                  {customRenewalDate.toLocaleDateString()}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
              </Pressable>
            )}
          </View>

          {/* Enable Reminders Toggle - Only show for recurring charges */}
          {chargeType === 'recurring' && (
            <View style={styles.field}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Renewal Reminders</Text>
              <Switch
                value={enableReminders}
                onValueChange={(value) => {
                  setEnableReminders(value);
                  if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            {enableReminders && (
              <Text style={styles.helperText}>
                Get notified 24 hours before your recurring item renews
              </Text>
            )}
          </View>
          )}

          {/* Calculated Cost Display - Only show suffix for recurring charges */}
          {cost && !isNaN(parseFloat(cost)) && parseFloat(cost) > 0 && (
            <View style={styles.calculatedCostContainer}>
              <Text style={styles.calculatedCost}>${calculateMonthlyCost()}</Text>
              {chargeType === 'recurring' && (
                <Text style={styles.calculatedCostSuffix}>
                  {billingFrequency === 'monthly' ? '/mo' : '/yr'}
                </Text>
              )}
            </View>
          )}

          {/* DateTimePicker - Modal wrapper for iOS */}
          {Platform.OS === 'ios' ? (
            <Modal
              visible={showDatePicker}
              transparent={true}
              animationType="slide">
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      {chargeType === 'recurring' ? 'Select Renewal Date' : 'Select Charge Date'}
                    </Text>
                    <Pressable
                      style={styles.modalDoneButton}
                      onPress={() => {
                        setShowDatePicker(false);
                        if (Platform.OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                      }}>
                      <Text style={styles.modalDoneText}>Done</Text>
                    </Pressable>
                  </View>
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={customRenewalDate}
                      mode="date"
                      display="inline"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setCustomRenewalDate(selectedDate);
                        }
                      }}
                      minimumDate={new Date()}
                      themeVariant={theme.isDark ? 'dark' : 'light'}
                    />
                  </View>
                </View>
              </View>
            </Modal>
          ) : (
            showDatePicker && (
              <DateTimePicker
                value={customRenewalDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setCustomRenewalDate(selectedDate);
                  }
                }}
                minimumDate={new Date()}
              />
            )
          )}
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={styles.buttonContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            pressed && !isSubmitting && styles.submitButtonPressed,
            isSubmitting && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting}>
          {isSubmitting ? (
            <View style={styles.submitButtonContent}>
              <ActivityIndicator size="small" color="#FFFFFF" style={styles.buttonLoader} />
              <Text style={styles.submitButtonText}>Saving...</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>
              {subscription
                ? 'Save'
                : chargeType === 'recurring'
                  ? 'Add'
                  : 'Add'}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}