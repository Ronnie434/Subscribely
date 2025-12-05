import AsyncStorage from '@react-native-async-storage/async-storage';
import { detectDefaultCurrency, isSupportedCurrency } from './currencyHelpers';

const CURRENCY_PREFERENCE_KEY = '@user_currency_preference';

/**
 * Get the user's preferred currency from AsyncStorage
 * If not set, detect from device locale and save it
 */
export const getUserCurrency = async (): Promise<string> => {
  try {
    const savedCurrency = await AsyncStorage.getItem(CURRENCY_PREFERENCE_KEY);
    
    if (savedCurrency && isSupportedCurrency(savedCurrency)) {
      return savedCurrency;
    }
    
    // No saved preference or invalid - detect from locale
    const defaultCurrency = detectDefaultCurrency();
    
    // Save the detected currency for future use
    await setUserCurrency(defaultCurrency);
    
    return defaultCurrency;
  } catch (error) {
    console.error('Error getting user currency:', error);
    return 'USD'; // Fallback to USD
  }
};

/**
 * Set the user's preferred currency in AsyncStorage
 */
export const setUserCurrency = async (currencyCode: string): Promise<boolean> => {
  try {
    if (!isSupportedCurrency(currencyCode)) {
      console.warn(`Unsupported currency code: ${currencyCode}`);
      return false;
    }
    
    await AsyncStorage.setItem(CURRENCY_PREFERENCE_KEY, currencyCode);
    return true;
  } catch (error) {
    console.error('Error setting user currency:', error);
    return false;
  }
};

/**
 * Clear the user's currency preference
 */
export const clearUserCurrency = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CURRENCY_PREFERENCE_KEY);
  } catch (error) {
    console.error('Error clearing user currency:', error);
  }
};

/**
 * Check if user has set a currency preference
 */
export const hasCurrencyPreference = async (): Promise<boolean> => {
  try {
    const savedCurrency = await AsyncStorage.getItem(CURRENCY_PREFERENCE_KEY);
    return savedCurrency !== null;
  } catch (error) {
    console.error('Error checking currency preference:', error);
    return false;
  }
};