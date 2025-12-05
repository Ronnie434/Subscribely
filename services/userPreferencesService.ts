/**
 * User Preferences Service
 * 
 * Service for managing user preferences including currency settings.
 * Handles synchronization between AsyncStorage (local) and Supabase (remote).
 * 
 * @since v2.0.0
 */

import { supabase } from '../config/supabase';
import { detectDefaultCurrency } from '../utils/currencyHelpers';
import { setUserCurrency } from '../utils/currencyPreferences';

/**
 * Initialize user currency preference
 * 
 * Checks if currency exists in Supabase profiles table. If not set, detects
 * from device locale and saves to both AsyncStorage and Supabase profiles table.
 * 
 * @param userId - User ID to initialize currency for
 * @returns Currency code (e.g., 'USD', 'EUR', 'GBP')
 * 
 * @example
 * ```typescript
 * const currency = await initializeUserCurrency('user-123');
 * console.log(`User currency: ${currency}`);
 * ```
 */
export async function initializeUserCurrency(userId: string): Promise<string> {
  try {
    // Check if currency already exists in profile
    const existingCurrency = await getUserCurrencyFromProfile(userId);
    
    if (existingCurrency) {
      // Currency exists in profile, sync to AsyncStorage
      await setUserCurrency(existingCurrency).catch(err => {
        console.error('Failed to sync currency to AsyncStorage:', err);
      });
      return existingCurrency;
    }
    
    // No currency set - detect from device locale
    const detectedCurrency = detectDefaultCurrency();
    
    // Save to both Supabase and AsyncStorage
    await saveUserCurrencyToProfile(userId, detectedCurrency);
    
    return detectedCurrency;
  } catch (error) {
    console.error('Error initializing user currency:', error);
    // Fallback to USD on error
    return 'USD';
  }
}

/**
 * Get user currency from Supabase profiles table
 * 
 * Fetches the currency preference stored in the user's profile.
 * Returns null if not found or on error.
 * 
 * @param userId - User ID to fetch currency for
 * @returns Currency code or null if not found
 * 
 * @example
 * ```typescript
 * const currency = await getUserCurrencyFromProfile('user-123');
 * if (currency) {
 *   console.log(`User's currency: ${currency}`);
 * } else {
 *   console.log('No currency set');
 * }
 * ```
 */
export async function getUserCurrencyFromProfile(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('currency')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user currency from profile:', error);
      return null;
    }
    
    return data?.currency || null;
  } catch (error) {
    console.error('Error in getUserCurrencyFromProfile:', error);
    return null;
  }
}

/**
 * Save user currency to Supabase profiles table and AsyncStorage
 * 
 * Updates the currency preference in both remote (Supabase) and local (AsyncStorage)
 * storage to keep them synchronized.
 * 
 * @param userId - User ID to save currency for
 * @param currency - Currency code to save (e.g., 'USD', 'EUR', 'GBP')
 * 
 * @example
 * ```typescript
 * await saveUserCurrencyToProfile('user-123', 'EUR');
 * console.log('Currency saved successfully');
 * ```
 */
export async function saveUserCurrencyToProfile(
  userId: string,
  currency: string
): Promise<void> {
  try {
    // Save to Supabase profiles table
    const { error } = await supabase
      .from('profiles')
      .update({ currency })
      .eq('id', userId);
    
    if (error) {
      console.error('Error saving currency to profile:', error);
      throw error;
    }
    
    // Also save to AsyncStorage for local access
    const saved = await setUserCurrency(currency);
    if (!saved) {
      console.warn('Failed to save currency to AsyncStorage');
    }
  } catch (error) {
    console.error('Error in saveUserCurrencyToProfile:', error);
    throw error;
  }
}