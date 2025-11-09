import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Development utilities for testing and debugging
 * These functions should only be used during development
 */

const ONBOARDING_KEY = '@onboarding_complete';
const STORAGE_KEY = '@subscriptions';

/**
 * Reset onboarding status to show onboarding screen again
 */
export const resetOnboarding = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    console.log('✅ Onboarding reset - restart app to see onboarding screen');
  } catch (error) {
    console.error('Error resetting onboarding:', error);
  }
};

/**
 * Clear all local storage data
 */
export const clearAllLocalData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([ONBOARDING_KEY, STORAGE_KEY]);
    console.log('✅ All local data cleared');
  } catch (error) {
    console.error('Error clearing local data:', error);
  }
};

/**
 * Check current onboarding status
 */
export const checkOnboardingStatus = async (): Promise<void> => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    console.log('Onboarding status:', value === 'true' ? 'Completed' : 'Not completed');
  } catch (error) {
    console.error('Error checking onboarding:', error);
  }
};

/**
 * View all AsyncStorage keys and values
 */
export const viewAllStorage = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    console.log('📦 AsyncStorage Keys:', keys);
    
    for (const key of keys) {
      const value = await AsyncStorage.getItem(key);
      console.log(`  ${key}:`, value?.substring(0, 100) + (value && value.length > 100 ? '...' : ''));
    }
  } catch (error) {
    console.error('Error viewing storage:', error);
  }
};

// Make functions available globally in development
if (__DEV__) {
  (global as any).resetOnboarding = resetOnboarding;
  (global as any).clearAllLocalData = clearAllLocalData;
  (global as any).checkOnboardingStatus = checkOnboardingStatus;
  (global as any).viewAllStorage = viewAllStorage;
  
  console.log('🛠️ Dev tools available:');
  console.log('  - resetOnboarding()');
  console.log('  - clearAllLocalData()');
  console.log('  - checkOnboardingStatus()');
  console.log('  - viewAllStorage()');
}