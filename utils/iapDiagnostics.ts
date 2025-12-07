/**
 * IAP Diagnostics Utility
 * 
 * Helps debug IAP issues in TestFlight by providing detailed diagnostics
 * that can be displayed to the user via Alert dialogs.
 */

import { Alert, Platform } from 'react-native';
import { initConnection, fetchProducts, getAvailablePurchases } from 'react-native-iap';
import { APPLE_IAP_CONFIG } from '../config/appleIAP';
import { supabase } from '../config/supabase';

/**
 * Run comprehensive IAP diagnostics
 * Shows results via Alert dialogs for TestFlight debugging
 */
export async function runIAPDiagnostics(): Promise<void> {
  const results: string[] = [];
  
  try {
    // Check 1: Platform
    results.push(`Platform: ${Platform.OS}`);
    results.push(`iOS Version: ${Platform.Version}`);
    
    // Check 2: IAP Connection
    try {
      await initConnection();
      results.push('✅ IAP Connection: OK');
    } catch (error: any) {
      results.push(`❌ IAP Connection: FAILED - ${error.message}`);
      Alert.alert('IAP Diagnostics', results.join('\n'));
      return;
    }
    
    // Check 3: Product Configuration
    results.push(`Product IDs: ${APPLE_IAP_CONFIG.productIds.length}`);
    APPLE_IAP_CONFIG.productIds.forEach((id, index) => {
      results.push(`  ${index + 1}. ${id}`);
    });
    
    // Check 4: Fetch Products
    try {
      const products = await fetchProducts({ 
        skus: APPLE_IAP_CONFIG.productIds as string[],
        type: 'subs'
      });
      
      results.push(`\n✅ Products Fetched: ${products.length}`);
      
      if (products.length === 0) {
        results.push('\n❌ NO PRODUCTS FOUND');
        results.push('\nPossible Issues:');
        results.push('1. Products not created in App Store Connect');
        results.push('2. Products not "Ready to Submit"');
        results.push('3. Bundle ID mismatch');
        results.push('4. Not signed in with Sandbox account');
        results.push('\nAction Required:');
        results.push('- Sign out of production Apple ID');
        results.push('- Settings > App Store > Sandbox Account');
        results.push('- Sign in with test account');
      } else {
        products.forEach((product: any, index: number) => {
          const id = product.productId || product.id;
          const price = product.localizedPrice || product.price;
          results.push(`  ${index + 1}. ${id}: ${price}`);
        });
      }
    } catch (error: any) {
      results.push(`❌ Fetch Products: FAILED - ${error.message}`);
    }
    
    // Check 5: Available Purchases
    try {
      const purchases = await getAvailablePurchases();
      results.push(`\nAvailable Purchases: ${purchases.length}`);
      if (purchases.length > 0) {
        purchases.forEach((purchase: any, index: number) => {
          results.push(`  ${index + 1}. ${purchase.productId}`);
        });
      }
    } catch (error: any) {
      results.push(`\n⚠️ Available Purchases: ${error.message}`);
    }
    
    // Check 6: User Authentication
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        results.push(`\n✅ User Authenticated: ${user.email}`);
      } else {
        results.push('\n❌ User: Not authenticated');
      }
    } catch (error: any) {
      results.push(`\n❌ User Check: ${error.message}`);
    }
    
    // Show results
    Alert.alert(
      'IAP Diagnostics',
      results.join('\n'),
      [
        { text: 'Copy', onPress: () => {
          // In a real app, you'd use Clipboard API here
          console.log('=== IAP DIAGNOSTICS ===');
          console.log(results.join('\n'));
          console.log('======================');
        }},
        { text: 'OK' }
      ]
    );
    
  } catch (error: any) {
    Alert.alert(
      'IAP Diagnostics Failed',
      `Error running diagnostics: ${error.message}`
    );
  }
}

/**
 * Quick check if IAP is properly configured
 * Returns true if everything looks good
 */
export async function quickIAPCheck(): Promise<{
  success: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  
  try {
    // Check platform
    if (Platform.OS !== 'ios') {
      issues.push('Not iOS platform');
      return { success: false, issues };
    }
    
    // Check connection
    try {
      await initConnection();
    } catch (error) {
      issues.push('Failed to initialize IAP connection');
      return { success: false, issues };
    }
    
    // Check products
    const products = await fetchProducts({ 
      skus: APPLE_IAP_CONFIG.productIds as string[],
      type: 'subs'
    });
    
    if (products.length === 0) {
      issues.push('No products available from App Store');
      issues.push('Sign in with Sandbox account in Settings > App Store');
      return { success: false, issues };
    }
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      issues.push('User not authenticated');
      return { success: false, issues };
    }
    
    return { success: true, issues: [] };
    
  } catch (error: any) {
    issues.push(`Error: ${error.message}`);
    return { success: false, issues };
  }
}

