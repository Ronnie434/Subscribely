# Repeat Interval UI Implementation Guide - Phase 3

## Overview
This document outlines the UI changes needed to replace the two-field system (Charge Type + Billing Frequency) with a single "Repeat Interval" dropdown.

---

## 1. SubscriptionForm Component Changes

### Current UI (Old):
```
[Charge Type Selector]
┌─────────────┬──────────────┐
│  Recurring  │  One-time   │  ← Segmented Control
└─────────────┴──────────────┘

[Billing Frequency Selector] (only shown if Recurring)
┌─────────────┬──────────────┐
│  Monthly    │   Yearly     │  ← Segmented Control
└─────────────┴──────────────┘
```

### New UI (Proposed):
```
[Repeat Interval]
┌──────────────────────────────┐
│ Every Month              ▼  │  ← Dropdown/Modal Picker
└──────────────────────────────┘

Options in picker:
- Every Week
- Every 2 Weeks
- Twice Per Month
- Every Month
- Every 2 Months
- Every 3 Months
- Every 6 Months
- Every Year
- One Time Only
```

### Implementation Details:

**File:** `components/SubscriptionForm.tsx`

**Changes Required:**

1. **Replace state variables:**
   ```typescript
   // OLD
   const [chargeType, setChargeType] = useState<ChargeType>('recurring');
   const [billingFrequency, setBillingFrequency] = useState<BillingCycle>('monthly');
   
   // NEW
   const [repeatInterval, setRepeatInterval] = useState<RepeatInterval>('monthly');
   ```

2. **Add interval picker modal state:**
   ```typescript
   const [showIntervalPicker, setShowIntervalPicker] = useState(false);
   ```

3. **Replace the two segmented controls with one picker button:**
   - Remove Charge Type selector (lines ~906-952)
   - Remove Billing Frequency selector (lines ~955-1004)
   - Add new Repeat Interval picker button

4. **Update all conditional logic:**
   - Replace `chargeType === 'recurring'` with `repeatInterval !== 'never'`
   - Replace `chargeType === 'one_time'` with `repeatInterval === 'never'`
   - Remove all `billingFrequency` references

5. **Update submit handler:**
   - Pass `repeat_interval` to onSubmit
   - Convert to legacy fields for backward compatibility

6. **Update helper text and labels:**
   - "Set Renewal Date" vs "Set Charge Date" based on `repeatInterval !== 'never'`
   - Cost display suffix should use `REPEAT_INTERVAL_CONFIG[repeatInterval].label`

---

## 2. Repeat Interval Picker Modal

### Component Design:

**New Component:** `components/RepeatIntervalPicker.tsx`

```typescript
interface RepeatIntervalPickerProps {
  visible: boolean;
  currentInterval: RepeatInterval;
  onSelect: (interval: RepeatInterval) => void;
  onClose: () => void;
}
```

### UI Layout:

```
┌─────────────────────────────────────┐
│  Select Repeat Interval        [×] │
├─────────────────────────────────────┤
│                                     │
│  FREQUENT                           │
│  ○ Every Week                       │
│  ○ Every 2 Weeks                    │
│  ○ Twice Per Month                  │
│                                     │
│  STANDARD                           │
│  ● Every Month         ← selected   │
│  ○ Every 2 Months                   │
│  ○ Every 3 Months                   │
│                                     │
│  INFREQUENT                         │
│  ○ Every 6 Months                   │
│  ○ Every Year                       │
│                                     │
│  ONE-TIME                           │
│  ○ One Time Only                    │
│                                     │
└─────────────────────────────────────┘
```

### Features:
- Grouped options for better UX
- Radio button selection
- Tap anywhere on row to select
- Auto-close on selection
- Haptic feedback on iOS

---

## 3. SubscriptionCard Display Updates

### Current Display:
```
Netflix
$15.99/month  ← or /year
```

### New Display Options:

**For recurring intervals:**
```
Netflix
$15.99 every month
$15.99 every week
$15.99 twice per month
```

**For one-time:**
```
Coffee Maker
$49.99 one time
```

### Implementation:

**File:** `components/SubscriptionCard.tsx`

**Changes:**
1. Replace `/month` or `/year` suffix
2. Use `getIntervalLabel(subscription.repeat_interval)` 
3. Format as: `$${cost} ${label.toLowerCase()}`

---

## 4. Other Component Updates

### Files to Update:

1. **`screens/HomeScreen.tsx`**
   - Update filtering logic for recurring vs one-time
   - Replace `chargeType` checks with `repeat_interval !== 'never'`

2. **`screens/StatsScreen.tsx`**
   - Update statistics calculations
   - Show breakdown by interval type
   - Update "Switch to yearly" suggestions

3. **`components/MonthlyTotalCard.tsx`**
   - Display logic already uses calculations.ts (no changes needed)

4. **`components/QuickStatsBar.tsx`**
   - Display logic already uses calculations.ts (no changes needed)

5. **`components/InsightCard.tsx`**
   - Update suggestions text for new intervals
   - "Switch from weekly to monthly" suggestions

---

## 5. Testing Checklist

### Unit Tests
- [ ] Test repeat interval conversions
- [ ] Test monthly cost calculations for all intervals
- [ ] Test yearly cost calculations for all intervals
- [ ] Test renewal date calculations

### Integration Tests  
- [ ] Create item with each interval option
- [ ] Update item to different interval
- [ ] Verify dual-write to database
- [ ] Test backward compatibility with migrated data

### UI Tests
- [ ] Picker displays all 9 options
- [ ] Selection updates form state
- [ ] Cost display shows correct suffix
- [ ] Reminders toggle hidden for one-time
- [ ] Date label changes based on interval

### Edge Cases
- [ ] Edit existing "one_time" item (migrated as "never")
- [ ] Edit existing "monthly" recurring item
- [ ] Edit existing "yearly" recurring item
- [ ] Switch between all interval types
- [ ] Create item, immediately edit interval

---

## 6. Backward Compatibility

### Data Flow:

**Reading existing data:**
1. Database has `repeat_interval` (migrated) OR legacy fields
2. Service layer reads `repeat_interval` first
3. Falls back to `convertToRepeatInterval(charge_type, billing_cycle)`
4. UI displays correct interval option

**Writing new data:**
1. User selects interval in picker
2. Form submits with `repeat_interval`
3. Service converts to legacy fields
4. Both formats written to database

### Migration Scenarios:

| Old Data | Migrated To | Display In Picker |
|----------|-------------|-------------------|
| `recurring` + `monthly` | `monthly` | "Every Month" |
| `recurring` + `yearly` | `yearly` | "Every Year" |
| `one_time` + `monthly` | `never` | "One Time Only" |
| `one_time` + `yearly` | `never` | "One Time Only" |

---

## 7. Implementation Order

1. **Create RepeatIntervalPicker component**
   - Build modal with grouped options
   - Add selection logic
   - Test standalone

2. **Update SubscriptionForm**
   - Replace state variables
   - Remove old controls
   - Add picker button
   - Update all conditional logic
   - Test create/edit flows

3. **Update SubscriptionCard**
   - Change display format
   - Test with various intervals

4. **Update other screens**
   - HomeScreen filtering
   - StatsScreen calculations
   - InsightCard suggestions

5. **Add tests**
   - Unit tests for new functions
   - Integration tests for UI flow
   - E2E tests for full journey

6. **User testing**
   - Test with real users
   - Gather feedback
   - Iterate on UX

---

## 8. UX Considerations

### Pros of New Design:
- ✅ Simpler - one field instead of two
- ✅ More options - 9 instead of 4
- ✅ Better discoverability - all options visible
- ✅ Consistent UX - same interaction pattern

### Potential Issues:
- ⚠️ Longer picker list (9 vs 2 options)
  - **Solution:** Group options by frequency
- ⚠️ Users might not find "One Time Only"
  - **Solution:** Place in separate group at bottom
- ⚠️ Existing users need to learn new UI
  - **Solution:** Show tooltip on first use

### Accessibility:
- Ensure picker is keyboard navigable
- Add proper labels for screen readers
- Maintain sufficient color contrast
- Support dynamic text sizing

---

## 9. Analytics Tracking

Track the following events:

```typescript
// When user opens interval picker
analytics.track('repeat_interval_picker_opened');

// When user selects an interval
analytics.track('repeat_interval_selected', {
  interval: 'biweekly',
  previous_interval: 'monthly',
  is_new_item: true
});

// Track usage distribution
analytics.track('repeat_interval_usage', {
  weekly: 5,
  biweekly: 12,
  semimonthly: 3,
  monthly: 145,
  bimonthly: 8,
  quarterly: 15,
  semiannually: 4,
  yearly: 23,
  never: 7
});
```

---

## Summary

Phase 3 transforms the UI from a two-step process (charge type → billing frequency) into a single, unified repeat interval selection. This improves UX while maintaining full backward compatibility through the dual-write strategy implemented in Phase 2.

**Estimated Effort:** 2-3 days
**Risk Level:** Low (backward compatible)
**User Impact:** High (better UX, more options)