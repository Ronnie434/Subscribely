# Past Due Subscription Handling - Architecture & Implementation Plan

## Overview
This document outlines the architecture and implementation plan for handling past due recurring items in the subscription tracker app. When a recurring item's renewal date has passed, the system will prompt the user to confirm whether they paid or not, and automatically update the next renewal date.

## Problem Statement
Currently, when a recurring item's renewal date passes, the app:
- Does not prompt the user to confirm payment
- Does not track payment history
- Does not automatically update the renewal date to the next interval
- Has no mechanism to handle missed or delayed payments

## Solution Architecture

### 1. Database Schema

#### New Table: `payment_history`
Tracks payment status for each recurring item renewal.

```sql
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_item_id UUID REFERENCES recurring_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  payment_date DATE,
  status TEXT CHECK (status IN ('paid', 'skipped', 'pending')),
  amount NUMERIC(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Fields Explanation:
- `recurring_item_id`: Links to the recurring item
- `due_date`: The original renewal date when payment was due
- `payment_date`: Actual date when user confirmed payment (can differ from due_date)
- `status`: 
  - `pending`: Not yet confirmed by user
  - `paid`: User confirmed they paid
  - `skipped`: User indicated they didn't pay this cycle
- `amount`: Cost at the time of renewal (historical record)
- `notes`: Optional user notes

### 2. Past Due Detection Logic

#### Detection Criteria:
```typescript
isPastDue(item: RecurringItem): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const renewalDate = new Date(item.renewal_date);
  renewalDate.setHours(0, 0, 0, 0);
  
  // Past due if renewal date is before today
  return renewalDate < today;
}
```

#### When to Check:
- On app launch (HomeScreen mount)
- When HomeScreen comes into focus
- After adding/editing a recurring item
- Daily background check (if possible)

### 3. User Flow

#### Past Due Modal Flow:
```
1. User opens app
2. System detects past due items (renewal_date < today)
3. Show modal for FIRST past due item only
4. Modal displays:
   - Item name
   - Original renewal date
   - Cost
   - Two options: "I Paid" / "I Didn't Pay"
5. User selects option:
   
   IF "I Paid":
   - Create payment_history record with status='paid'
   - Calculate next renewal date based on repeat_interval
   - Update recurring_item.renewal_date to next date
   - Close modal
   - Check for next past due item
   
   IF "I Didn't Pay":
   - Create payment_history record with status='skipped'
   - Calculate next renewal date based on repeat_interval
   - Update recurring_item.renewal_date to next date
   - Close modal
   - Check for next past due item
```

#### Multiple Past Due Items:
- Process one at a time to avoid overwhelming the user
- After handling one, check for next past due item
- Show modal again if another past due item exists
- Continue until all past due items are handled

### 4. Renewal Date Calculation

Based on `repeat_interval`, calculate the next renewal date:

```typescript
function calculateNextRenewalDate(
  currentRenewalDate: string,
  repeatInterval: RepeatInterval
): string {
  const current = new Date(currentRenewalDate);
  const config = REPEAT_INTERVAL_CONFIG[repeatInterval];
  
  if (repeatInterval === 'never') {
    return currentRenewalDate; // One-time, don't update
  }
  
  // Add days based on interval
  const nextDate = new Date(current);
  nextDate.setDate(nextDate.getDate() + config.days);
  
  return nextDate.toISOString().split('T')[0];
}
```

### 5. Component Architecture

#### New Components:

##### `PastDueModal.tsx`
- Modal that displays when a recurring item is past due
- Shows item details (name, cost, due date)
- Two action buttons: "I Paid" and "I Didn't Pay"
- Handles user response and triggers payment recording

##### `PastDueService.ts`
- `detectPastDueItems()`: Find all past due recurring items
- `recordPayment()`: Record payment status and update renewal date
- `getPaymentHistory()`: Retrieve payment history for an item
- `getPastDueCount()`: Get count of past due items

### 6. Database Functions

```sql
-- Check for past due items
CREATE FUNCTION get_past_due_items(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cost NUMERIC,
  renewal_date DATE,
  repeat_interval TEXT,
  days_past_due INTEGER
) AS $$
  SELECT 
    id,
    name,
    cost,
    renewal_date,
    repeat_interval,
    CURRENT_DATE - renewal_date AS days_past_due
  FROM recurring_items
  WHERE user_id = p_user_id
    AND renewal_date < CURRENT_DATE
    AND status = 'active'
  ORDER BY renewal_date ASC;
$$ LANGUAGE sql;

-- Record payment
CREATE FUNCTION record_payment(
  p_recurring_item_id UUID,
  p_user_id UUID,
  p_status TEXT,
  p_payment_date DATE,
  p_amount NUMERIC,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_due_date DATE;
  v_payment_id UUID;
BEGIN
  -- Get the current renewal date as the due date
  SELECT renewal_date INTO v_due_date
  FROM recurring_items
  WHERE id = p_recurring_item_id AND user_id = p_user_id;
  
  -- Insert payment history
  INSERT INTO payment_history (
    recurring_item_id,
    user_id,
    due_date,
    payment_date,
    status,
    amount,
    notes
  ) VALUES (
    p_recurring_item_id,
    p_user_id,
    v_due_date,
    p_payment_date,
    p_status,
    p_amount,
    p_notes
  ) RETURNING id INTO v_payment_id;
  
  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Implementation Phases

### Phase 1: Database Setup ✅
- [x] Create payment_history table migration
- [x] Create database functions for past due detection
- [x] Create database functions for payment recording

### Phase 2: Service Layer
- [ ] Create PastDueService with detection logic
- [ ] Create functions for payment recording
- [ ] Create utility functions for date calculations
- [ ] Add types to types/index.ts

### Phase 3: UI Components
- [ ] Create PastDueModal component
- [ ] Add modal styling and animations
- [ ] Handle user interactions

### Phase 4: Integration
- [ ] Integrate with HomeScreen
- [ ] Add detection on app focus
- [ ] Handle multiple past due items sequentially
- [ ] Add loading states

### Phase 5: Testing & Polish
- [ ] Test with various repeat intervals
- [ ] Test edge cases (today = renewal date)
- [ ] Add error handling
- [ ] Add analytics tracking

## Technical Considerations

### Date Handling
- Always use local dates, not UTC timestamps
- Use `parseLocalDate` utility for consistent parsing
- Store dates in ISO format (YYYY-MM-DD)

### Edge Cases
1. **Item due today**: Not past due yet (wait until tomorrow)
2. **Multiple days past due**: Calculate from original due date
3. **Custom renewal dates**: Respect user's custom dates
4. **One-time items**: Don't show past due modal
5. **Paused items**: Don't show past due modal
6. **Cancelled items**: Don't show past due modal

### Performance
- Check past due only once per app session
- Cache past due items list
- Process modals one at a time
- Don't block app startup

### User Experience
- Don't overwhelm with too many modals
- Allow dismissing and handling later (optional)
- Show days past due for context
- Provide quick actions

## Future Enhancements

### V2 Features:
- Bulk payment confirmation (handle multiple at once)
- Payment calendar view
- Payment statistics and insights
- Remind me later option
- Smart predictions based on history
- Export payment history
- Integration with calendar apps

### Analytics:
- Track payment confirmation rate
- Track average delay in confirmation
- Identify frequently skipped items

## Success Metrics
- 80%+ users confirm payments within 24 hours
- Reduced data inconsistency
- Improved renewal date accuracy
- Positive user feedback on UX

## Rollout Strategy
1. Deploy database migration
2. Deploy service layer with feature flag (disabled)
3. Test internally with small user group
4. Enable feature flag for 10% of users
5. Monitor for issues
6. Gradual rollout to 100%