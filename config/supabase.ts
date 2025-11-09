import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Get environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase configuration is missing. Please create a .env file with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

/**
 * Custom storage adapter for Supabase that uses SecureStore on native platforms
 * and AsyncStorage on web for secure session management
 */
const SupabaseStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      return AsyncStorage.setItem(key, value);
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      return AsyncStorage.removeItem(key);
    }
    return SecureStore.deleteItemAsync(key);
  },
};

/**
 * Supabase client instance configured for React Native/Expo
 * Uses secure storage for authentication tokens
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SupabaseStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for mobile apps
  },
});

/**
 * Helper to check if Supabase is properly configured
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};