# Export to Excel Premium Feature Implementation Plan

## Overview
Make the "Export to Excel" feature in the Statistics screen a premium-only feature. Free users should see a paywall when attempting to export.

## Current State Analysis

### StatsScreen.tsx
- **Location**: `screens/StatsScreen.tsx`
- **Export Button**: Lines 437-452
- **Export Handler**: `handleExportToExcel` function (lines 122-141)
- **Current Behavior**: Exports subscriptions to Excel without any premium check

### Existing Premium Check Infrastructure
- **Service**: `subscriptionTierService.isPremiumUser()` - Returns boolean
- **Location**: `services/subscriptionTierService.ts` (line 333)
- **Caching**: Uses subscriptionCache for performance

### PaywallModal Component
- **Location**: `components/PaywallModal.tsx`
- **Props Required**:
  - `visible: boolean`
  - `onClose: () => void`
  - `onUpgradePress: (plan: 'monthly' | 'yearly') => void`
  - `currentCount: number`
  - `maxCount: number`
  - `onSuccess?: () => void`

### Navigation Pattern
- **PlanSelection Screen**: Available in SubscriptionsStack and SettingsStack
- **Pattern from HomeScreen**: Uses `navigation.navigate('PlanSelection' as any)`
- **StatsScreen Navigation**: Uses `StackNavigationProp<SubscriptionsStackParamList, 'Stats'>`

## Implementation Steps

### Step 1: Add Required Imports
Add to StatsScreen.tsx imports:
```typescript
import PaywallModal from '../components/PaywallModal';
import { subscriptionTierService } from '../services/subscriptionTierService';
import { subscriptionLimitService } from '../services/subscriptionLimitService';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
```

### Step 2: Add State Management
Add state variables to StatsScreen component:
```typescript
const [isPremium, setIsPremium] = useState<boolean>(false);
const [paywallVisible, setPaywallVisible] = useState(false);
const [checkingPremium, setCheckingPremium] = useState(false);
const [limitStatus, setLimitStatus] = useState({ currentCount: 0, maxCount: 5, isPremium: false });
```

### Step 3: Add Premium Status Check Function
Create function to check premium status:
```typescript
const checkPremiumStatus = useCallback(async () => {
  try {
    setCheckingPremium(true);
    const premiumStatus = await subscriptionTierService.isPremiumUser();
    setIsPremium(premiumStatus);
    
    // Also get limit status for paywall modal
    const status = await subscriptionLimitService.getSubscriptionLimitStatus();
    setLimitStatus({
      currentCount: status.currentCount,
      maxCount: status.maxAllowed || 5,
      isPremium: status.isPremium,
    });
  } catch (error) {
    console.error('Error checking premium status:', error);
    // Default to false on error
    setIsPremium(false);
  } finally {
    setCheckingPremium(false);
  }
}, []);
```

### Step 4: Load Premium Status on Screen Focus
Update `useFocusEffect` to check premium status:
```typescript
useFocusEffect(
  useCallback(() => {
    loadSubscriptions(true);
    checkPremiumStatus();
    return () => {};
  }, [loadSubscriptions, checkPremiumStatus])
);
```

### Step 5: Modify Export Handler
Update `handleExportToExcel` to check premium status:
```typescript
const handleExportToExcel = async () => {
  // Check premium status first
  const isUserPremium = await subscriptionTierService.isPremiumUser();
  
  if (!isUserPremium) {
    // Show paywall for free users
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setPaywallVisible(true);
    return;
  }
  
  // Premium users can export
  if (subscriptions.length === 0) {
    Alert.alert('No Data', 'There are no subscriptions to export.');
    return;
  }

  setExporting(true);
  try {
    await exportSubscriptionsToExcel(subscriptions);
    Alert.alert('Success', 'Your subscriptions have been exported successfully!');
  } catch (error) {
    console.error('Export error:', error);
    Alert.alert(
      'Export Failed',
      'Failed to export subscriptions. Please try again.'
    );
  } finally {
    setExporting(false);
  }
};
```

### Step 6: Add Upgrade Navigation Handler
Add handler for paywall upgrade button:
```typescript
const handleUpgradePress = (plan: 'monthly' | 'yearly') => {
  setPaywallVisible(false);
  // Navigate to plan selection screen
  // Note: StatsScreen is in StatsStack, but PlanSelection is in SubscriptionsStack
  // We'll need to navigate to the main tab navigator first
  navigation.getParent()?.navigate('Subscriptions', { screen: 'PlanSelection' });
  // Alternative: Use as any for type safety workaround
  // navigation.navigate('PlanSelection' as any);
};
```

### Step 7: Add PaywallModal to JSX
Add PaywallModal component before closing View tag:
```typescript
{/* Paywall Modal */}
<PaywallModal
  visible={paywallVisible}
  onClose={() => setPaywallVisible(false)}
  onUpgradePress={handleUpgradePress}
  currentCount={limitStatus.currentCount}
  maxCount={limitStatus.maxCount}
  onSuccess={async () => {
    // Refresh premium status after successful upgrade
    await checkPremiumStatus();
    // Optionally auto-export after upgrade
    // handleExportToExcel();
  }}
/>
```

### Step 8: Handle Navigation Type Issue
Since StatsScreen uses `SubscriptionsStackParamList` but PlanSelection might not be directly accessible, we have two options:

**Option A**: Navigate to parent navigator
```typescript
navigation.getParent()?.navigate('Subscriptions', { screen: 'PlanSelection' });
```

**Option B**: Use type assertion (like HomeScreen does)
```typescript
navigation.navigate('PlanSelection' as any);
```

**Option C**: Add PlanSelection to StatsStack (if needed for consistency)

## Testing Checklist

- [ ] Free user clicks Export button → Paywall appears
- [ ] Premium user clicks Export button → Export proceeds normally
- [ ] Paywall upgrade button navigates to PlanSelection screen
- [ ] After successful upgrade, premium status is refreshed
- [ ] Export works correctly for premium users
- [ ] Error handling works if premium check fails
- [ ] Loading states are handled properly
- [ ] iOS haptic feedback works when paywall appears

## Edge Cases to Handle

1. **Network Error**: If premium check fails, default to showing paywall (safer)
2. **Cache Issues**: Premium status might be cached - ensure we check fresh status on export attempt
3. **Navigation**: Ensure PlanSelection is accessible from StatsScreen navigation context
4. **Race Conditions**: Multiple rapid clicks on export button should be handled

## Future Enhancements (Optional)

1. **Visual Indicator**: Add a premium badge/icon to the export button for free users
2. **Tooltip/Info**: Show a tooltip explaining it's a premium feature
3. **Analytics**: Track how many users attempt export without premium
4. **Auto-export after upgrade**: Optionally trigger export automatically after user upgrades

## Files to Modify

1. `screens/StatsScreen.tsx` - Main implementation
2. No database changes required
3. No service changes required (using existing services)

## Implementation Notes

- Uses existing `subscriptionTierService.isPremiumUser()` method
- Follows same pattern as HomeScreen for paywall integration
- Maintains consistency with other premium-gated features
- Minimal code changes required
- No breaking changes to existing functionality

