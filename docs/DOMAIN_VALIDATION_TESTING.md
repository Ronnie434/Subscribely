# Domain Validation Testing Guide

## Overview

This guide provides comprehensive testing procedures for the domain validation implementation in the Renvo subscription tracking application. The domain validation feature ensures that only verified, known service domains are stored and used for logo redirection, preventing invalid or broken links.

### What Was Implemented

The domain validation system includes four key components:

1. **Domain Extraction with Validation** - [`utils/domainHelpers.ts`](../utils/domainHelpers.ts:92-114)
   - [`extractDomain()`](../utils/domainHelpers.ts:92-114) now only returns domains for known services
   - Returns empty string for unknown/unrecognized services
   - Prevents auto-generation of invalid domains

2. **Form-Level Validation** - [`components/SubscriptionForm.tsx`](../components/SubscriptionForm.tsx:141-143)
   - Validates domain before saving to database
   - Only saves domains that pass [`isValidDomain()`](../utils/domainHelpers.ts:123-129) check

3. **UI Visual Feedback** - [`components/SubscriptionCard.tsx`](../components/SubscriptionCard.tsx:54-75)
   - Logos without valid domains are non-clickable
   - Reduced opacity (0.7) indicates non-clickable state
   - No errors when clicking non-clickable logos

4. **Database Migration** - [`database/clear_invalid_domains_migration.sql`](../database/clear_invalid_domains_migration.sql)
   - Clears existing invalid domains from database
   - Preserves valid domains
   - Idempotent (safe to run multiple times)

### Why This Matters

Before this implementation:
- Invalid domains like "temp.com", "mygym.com" were auto-generated
- Users clicking logos would be redirected to non-existent or wrong websites
- Poor user experience with broken links

After this implementation:
- Only verified domains are stored and used
- Unknown services get no domain (non-clickable logo)
- Clean, reliable redirection experience

---

## Prerequisites

### Development Environment Setup

#### Required
- [ ] Development build running locally
- [ ] Access to Supabase database
- [ ] Test user account created
- [ ] Metro bundler console visible for debugging

#### Recommended Tools
- **Database Access**: Supabase dashboard or SQL client
- **Debugging**: React Native Debugger or Chrome DevTools
- **Network Inspection**: Reactotron (optional)

### Test Data Preparation

Before starting tests, prepare these test scenarios:

1. **Clean State**: Remove all existing subscriptions or create new test user
2. **Known Services**: List of services to test (see [Known Services List](#known-services-list))
3. **Unknown Services**: Creative service names that won't match known domains

### Known Services List

The following services have validated domains (sample of 58 total):

**Streaming Services:**
- Netflix → netflix.com
- Spotify → spotify.com
- Disney+ → disneyplus.com
- Hulu → hulu.com
- HBO Max → hbomax.com
- YouTube Premium → youtube.com

**Cloud & Productivity:**
- Dropbox → dropbox.com
- Google One → google.com
- iCloud → icloud.com
- Microsoft 365 → microsoft.com
- Notion → notion.so

**Social & Communication:**
- LinkedIn → linkedin.com
- Slack → slack.com
- Zoom → zoom.us

**Creative Tools:**
- Adobe → adobe.com
- Canva → canva.com
- Figma → figma.com

> 💡 **Note**: Full list of 58 services available in [`utils/domainHelpers.ts`](../utils/domainHelpers.ts:6-59)

---

## Test Scenarios

### 1. Creating New Subscriptions

#### Test Case 1.1: Adding a Known Service (Netflix)

**Objective**: Verify that known services get valid domains assigned

**Steps:**
1. Navigate to Add Subscription screen
2. In the Name field, type "Net" 
3. Observe autocomplete suggestions appear
4. Select "Netflix" from suggestions (or finish typing)
5. Fill in remaining fields:
   - Cost: $15.99
   - Billing frequency: Monthly
   - Set renewal date: Tomorrow
6. Tap "Add Recurring Item"
7. Return to subscription list
8. Observe the Netflix subscription card

**Expected Results:**
- [x] Netflix appears in autocomplete suggestions
- [x] Netflix logo loads in subscription card
- [x] Logo has normal opacity (fully visible)
- [x] Logo is visually clickable (no reduced opacity)
- [x] Console shows no domain errors

**Verification Command:**
```sql
-- Check in Supabase SQL Editor
SELECT name, domain FROM recurring_items WHERE name = 'Netflix';
-- Expected: domain = 'netflix.com'
```

**Status:** ⬜ Pass ⬜ Fail

---

#### Test Case 1.2: Adding an Unknown Service

**Objective**: Verify unknown services don't get invalid domains

**Steps:**
1. Navigate to Add Subscription screen
2. In the Name field, type "My Gym Membership"
3. Note: No autocomplete suggestion appears
4. Fill in remaining fields:
   - Cost: $50.00
   - Billing frequency: Monthly
5. Tap "Add Recurring Item"
6. Return to subscription list
7. Observe the subscription card

**Expected Results:**
- [x] No autocomplete suggestions appear
- [x] Subscription saves successfully
- [x] Fallback icon displays (letter "M" on colored background)
- [x] Icon has reduced opacity (0.7)
- [x] Icon is NOT clickable (tapping does nothing)
- [x] Console shows: `[Validation] No known domain for: My Gym Membership`

**Verification Command:**
```sql
-- Check domain is empty
SELECT name, domain FROM recurring_items WHERE name = 'My Gym Membership';
-- Expected: domain = '' OR domain IS NULL
```

**Status:** ⬜ Pass ⬜ Fail

---

#### Test Case 1.3: Adding Multiple Unknown Services

**Objective**: Verify multiple unknown services behave consistently

**Test Services:**
- "Temp Service" (common invalid pattern)
- "Test Subscription" (another common pattern)
- "Random App 123" (with numbers)
- "My-Custom-Service" (with hyphens)

**Steps:**
1. Create each service following Test Case 1.2 steps
2. Verify each gets no domain assigned
3. Verify all have non-clickable fallback icons

**Expected Results:**
- [x] All 4 subscriptions save successfully
- [x] All show fallback icons with reduced opacity
- [x] None have clickable logos
- [x] No console errors

**Status:** ⬜ Pass ⬜ Fail

---

#### Test Case 1.4: Editing Existing Subscription with Valid Domain

**Objective**: Verify editing preserves valid domains

**Precondition**: Netflix subscription exists from Test Case 1.1

**Steps:**
1. Tap on Netflix subscription card
2. Change cost from $15.99 to $17.99
3. Change billing frequency to Yearly
4. Tap "Save Changes"
5. Return to list

**Expected Results:**
- [x] Changes save successfully
- [x] Logo remains clickable
- [x] Domain remains "netflix.com"
- [x] No domain-related errors

**Verification Command:**
```sql
SELECT name, domain, cost, billing_cycle FROM recurring_items WHERE name = 'Netflix';
-- Expected: domain still = 'netflix.com', cost = 17.99, billing_cycle = 'yearly'
```

**Status:** ⬜ Pass ⬜ Fail

---

#### Test Case 1.5: Editing Subscription Without Domain

**Objective**: Verify editing non-domain subscriptions works correctly

**Precondition**: "My Gym Membership" exists from Test Case 1.2

**Steps:**
1. Tap on "My Gym Membership" card
2. Change cost from $50.00 to $55.00
3. Tap "Save Changes"
4. Return to list

**Expected Results:**
- [x] Changes save successfully
- [x] Icon remains non-clickable (reduced opacity)
- [x] Domain remains empty
- [x] No errors

**Status:** ⬜ Pass ⬜ Fail

---

### 2. Logo Interaction Tests

#### Test Case 2.1: Click Logo with Valid Domain

**Objective**: Verify clicking valid domain logo opens browser

**Precondition**: Netflix subscription exists with domain

**Steps:**
1. View subscription list
2. Locate Netflix subscription
3. Tap directly on the Netflix logo (not the card)
4. Observe behavior

**Expected Results:**
- [x] Browser/web view opens
- [x] Navigates to https://netflix.com
- [x] URL format is correct (https:// prefix)
- [x] No error dialogs
- [x] App remains in background (browser opens in foreground)

**Note**: On iOS, this may open Safari. On Android, default browser.

**Status:** ⬜ Pass ⬜ Fail

---

#### Test Case 2.2: Click Logo Without Domain

**Objective**: Verify clicking invalid domain logo does nothing

**Precondition**: "My Gym Membership" exists without domain

**Steps:**
1. View subscription list
2. Locate "My Gym Membership" subscription
3. Tap directly on the fallback icon
4. Observe behavior

**Expected Results:**
- [x] Nothing happens (no action)
- [x] No browser opens
- [x] No error dialogs or toasts
- [x] Icon has reduced opacity indicating non-clickable state
- [x] App remains on subscription list screen

**Console Output:**
```
[SubscriptionCard] Logo pressed but no domain available
```

**Status:** ⬜ Pass ⬜ Fail

---

#### Test Case 2.3: Visual Feedback - Opacity Check

**Objective**: Verify visual distinction between clickable and non-clickable logos

**Steps:**
1. View subscription list with both Netflix and "My Gym Membership"
2. Compare visual appearance of both icons

**Expected Results:**
- [x] Netflix logo: Full opacity (1.0), clearly visible
- [x] Gym membership icon: Reduced opacity (0.7), slightly faded
- [x] Visual difference is noticeable
- [x] Fallback icon shows first letter ("M") on colored background

**Visual Comparison:**
```
Netflix Logo:           Gym Icon:
██████████             ░░░░░░░░░░
██ LOGO ██             ░░  M   ░░
██████████  (bright)   ░░░░░░░░░░ (faded)
```

**Status:** ⬜ Pass ⬜ Fail

---

#### Test Case 2.4: Multiple Clicks - No Error Accumulation

**Objective**: Verify multiple clicks on non-clickable logo don't cause errors

**Steps:**
1. Rapidly tap "My Gym Membership" icon 10 times
2. Check console for errors
3. Verify app remains stable

**Expected Results:**
- [x] No browser opens
- [x] No error dialogs
- [x] No console errors
- [x] App remains responsive
- [x] No memory leaks or crashes

**Status:** ⬜ Pass ⬜ Fail

---

### 3. URL Redirection Tests

#### Test Case 3.1: Verify Correct URL Format

**Objective**: Ensure URLs use https:// protocol

**Precondition**: Spotify subscription with domain

**Steps:**
1. Add Spotify subscription
2. Tap on Spotify logo
3. Observe URL in browser

**Expected Results:**
- [x] URL starts with "https://"
- [x] Domain is "spotify.com"
- [x] Full URL: https://spotify.com
- [x] No "http://" (insecure)

**Code Reference:**
See [`SubscriptionCard.tsx:63`](../components/SubscriptionCard.tsx:63) - URL construction

**Status:** ⬜ Pass ⬜ Fail

---

#### Test Case 3.2: Test Multiple Service Redirections

**Objective**: Verify different services open correct domains

**Services to Test:**
1. **Netflix** → https://netflix.com
2. **Dropbox** → https://dropbox.com
3. **GitHub** → https://github.com
4. **Notion** → https://notion.so

**Steps:**
1. Create subscriptions for all 4 services
2. Click each logo individually
3. Verify correct domain opens each time

**Expected Results:**
- [x] All 4 logos are clickable
- [x] Each opens correct domain
- [x] All use https:// protocol
- [x] Notion correctly uses .so TLD (not .com)

**Status:** ⬜ Pass ⬜ Fail

---

#### Test Case 3.3: Handle Special Domains

**Objective**: Verify special domain formats work correctly

**Services with Special Formats:**
- **Zoom** → zoom.us (not .com)
- **Notion** → notion.so (not .com)
- **Coursera** → coursera.org (not .com)

**Steps:**
1. Create subscriptions for these 3 services
2. Tap each logo
3. Verify correct TLD is used

**Expected Results:**
- [x] Zoom opens zoom.us (not zoom.com)
- [x] Notion opens notion.so
- [x] Coursera opens coursera.org
- [x] No redirect errors

**Status:** ⬜ Pass ⬜ Fail

---

### 4. Database Migration Tests

#### Test Case 4.1: Run Migration

**Objective**: Execute the domain cleanup migration

**Prerequisites:**
- [ ] Database backup created (recommended)
- [ ] Access to Supabase SQL Editor
- [ ] Test data in database

**Steps:**
1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Copy contents of [`database/clear_invalid_domains_migration.sql`](../database/clear_invalid_domains_migration.sql)
4. Paste into SQL Editor
5. Execute query
6. Check results

**Expected Results:**
- [x] Query executes without errors
- [x] Returns "UPDATE X" where X = number of rows modified
- [x] No fatal errors in Supabase logs
- [x] Database remains accessible

**Status:** ⬜ Pass ⬜ Fail

---

#### Test Case 4.2: Verify Invalid Domains Cleared

**Objective**: Confirm migration cleared invalid domains

**Pre-Migration Setup:**
```sql
-- Create test data with invalid domains
INSERT INTO recurring_items (user_id, name, cost, billing_cycle, renewal_date, domain)
VALUES 
  ('test-user-id', 'Test Service', 10.00, 'monthly', '2024-01-15', 'test.com'),
  ('test-user-id', 'My Gym', 50.00, 'monthly', '2024-01-20', 'mygym.com'),
  ('test-user-id', 'Temp', 5.00, 'monthly', '2024-01-25', 'temp.com');
```

**Verification Query:**
```sql
-- After migration, these should have empty domains
SELECT name, domain 
FROM recurring_items 
WHERE name IN ('Test Service', 'My Gym', 'Temp');

-- Expected: All have domain = '' or NULL
```

**Expected Results:**
- [x] Test Service: domain = ''
- [x] My Gym: domain = ''
- [x] Temp: domain = ''
- [x] Valid domains (Netflix, Spotify) unchanged

**Status:** ⬜ Pass ⬜ Fail

---

#### Test Case 4.3: Verify Valid Domains Preserved

**Objective**: Ensure migration doesn't affect valid domains

**Pre-Migration Setup:**
```sql
-- Create subscriptions with valid domains
INSERT INTO recurring_items (user_id, name, cost, billing_cycle, renewal_date, domain)
VALUES 
  ('test-user-id', 'Netflix', 15.99, 'monthly', '2024-01-15', 'netflix.com'),
  ('test-user-id', 'Spotify', 9.99, 'monthly', '2024-01-20', 'spotify.com'),
  ('test-user-id', 'GitHub', 7.00, 'monthly', '2024-01-25', 'github.com');
```

**Verification Query:**
```sql
-- After migration, these should remain unchanged
SELECT name, domain 
FROM recurring_items 
WHERE name IN ('Netflix', 'Spotify', 'GitHub');
```

**Expected Results:**
- [x] Netflix: domain = 'netflix.com' (unchanged)
- [x] Spotify: domain = 'spotify.com' (unchanged)
- [x] GitHub: domain = 'github.com' (unchanged)
- [x] No valid domains were cleared

**Status:** ⬜ Pass ⬜ Fail

---

#### Test Case 4.4: Test Migration Idempotency

**Objective**: Verify migration can be run multiple times safely

**Steps:**
1. Run migration first time (from Test Case 4.1)
2. Note number of rows affected
3. Run migration second time
4. Note number of rows affected
5. Compare results

**Expected Results:**
- [x] First run: X rows updated (where X > 0)
- [x] Second run: 0 rows updated (all already clean)
- [x] No errors on second run
- [x] Database state identical after second run
- [x] No duplicate updates or data corruption

**Verification:**
```sql
-- Run this query before and after second migration
SELECT 
  COUNT(*) as total_items,
  COUNT(CASE WHEN domain = '' OR domain IS NULL THEN 1 END) as empty_domains,
  COUNT(CASE WHEN domain != '' AND domain IS NOT NULL THEN 1 END) as valid_domains
FROM recurring_items;

-- Results should be identical before and after second run
```

**Status:** ⬜ Pass ⬜ Fail

---

## Intelligent Domain Discovery Tests

This section covers the new intelligent domain discovery system that automatically suggests and verifies domains for subscriptions.

### Architecture Overview

The system consists of three new services:
- [`services/domainDiscoveryService.ts`](../services/domainDiscoveryService.ts) - Multi-tier orchestration
- [`services/domainVerificationService.ts`](../services/domainVerificationService.ts) - Logo & HTTP verification
- [`services/domainCacheService.ts`](../services/domainCacheService.ts) - AsyncStorage caching

### Discovery Tiers

1. **Tier 1: Hardcoded Mappings** (instant) - Known services like Netflix, Spotify
2. **Tier 2: Cache Lookup** (~10ms) - Previously discovered and verified domains
3. **Tier 3: Pattern Matching** (~50ms) - Intelligent guessing based on service name
4. **Tier 4: Verification** (500-2000ms) - Background verification on save

---

### Test Case 5.1: Known Service with High Confidence

**Objective**: Verify instant domain suggestion for hardcoded services

**Precondition**: New subscription form, no existing subscriptions

**Steps:**
1. Navigate to Add Subscription screen
2. Type "Netflix" in the Name field
3. Observe domain suggestion appears
4. Check confidence badge
5. Fill in cost: $15.99
6. Fill in billing frequency: Monthly
7. Tap "Add Recurring Item"
8. Check subscription card

**Expected Results:**
- [x] Domain suggestion appears instantly (<100ms)
- [x] Shows "netflix.com"
- [x] Confidence badge: "Verified" with green checkmark
- [x] Source: hardcoded
- [x] Logo loads immediately on subscription card
- [x] Logo is clickable

**Console Output:**
```
[Discovery] Hardcoded match for Netflix: netflix.com
[Discovery] Service initialized
```

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.2: Unknown Service with Pattern Match

**Objective**: Verify pattern matching generates domain suggestions

**Steps:**
1. Navigate to Add Subscription screen
2. Type "Planet Fitness" in the Name field
3. Wait for domain suggestion (~50ms)
4. Check confidence badge
5. Fill in remaining fields:
   - Cost: $25.00
   - Billing frequency: Monthly
6. Tap "Add Recurring Item"
7. Wait for background verification (1-2 seconds)
8. Check subscription card
9. Delete subscription
10. Re-add "Planet Fitness" again

**Expected Results (First Add):**
- [x] Domain suggestion appears: "planetfitness.com"
- [x] Confidence badge: "Unverified" with yellow/orange warning icon
- [x] Source: guessed (pattern matching)
- [x] Subscription saves successfully
- [x] Background verification starts automatically
- [x] Console shows verification attempt

**Expected Results (Second Add):**
- [x] Domain suggestion appears instantly from cache
- [x] Confidence badge: "Cached" with blue indicator
- [x] Source: cached
- [x] Faster suggestion display

**Console Output:**
```
[Discovery] Generated 5 candidates for Planet Fitness: planetfitness.com, ...
[Discovery] Verifying planetfitness.com for Planet Fitness...
[Verification] Logo check for planetfitness.com: SUCCESS (823ms)
[Discovery] ✅ Verified and cached planetfitness.com (823ms)
[Cache] Cached planet fitness → planetfitness.com (logo)
```

**Verification Query:**
```sql
SELECT name, domain FROM recurring_items WHERE name = 'Planet Fitness';
-- Expected: domain = 'planetfitness.com'
```

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.3: Cached Domain Retrieval

**Objective**: Verify cache provides instant suggestions on subsequent uses

**Precondition**: "Planet Fitness" was previously added and verified (from Test 5.2)

**Steps:**
1. Delete "Planet Fitness" subscription
2. Navigate to Add Subscription screen
3. Type "Planet Fitness" again
4. Observe suggestion speed and confidence

**Expected Results:**
- [x] Domain suggestion appears instantly (<20ms)
- [x] Shows "planetfitness.com" from cache
- [x] Confidence badge: "Cached" with blue indicator
- [x] No network verification needed
- [x] Console shows cache hit

**Console Output:**
```
[Cache] Hit for planet fitness: planetfitness.com
[Discovery] Service initialized
```

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.4: Invalid Service Name (No Match)

**Objective**: Verify system handles services with no domain match

**Steps:**
1. Navigate to Add Subscription screen
2. Type "Random XYZ Service 123" in the Name field
3. Wait for domain suggestion attempt
4. Check for suggestion display
5. Fill in cost: $10.00
6. Tap "Add Recurring Item"
7. Check subscription card

**Expected Results:**
- [x] No domain suggestion appears (or "No domain found" message)
- [x] Option to "Enter manually" is displayed
- [x] Subscription saves without domain
- [x] Fallback icon displays (letter "R")
- [x] Icon has reduced opacity (0.7)
- [x] Icon is non-clickable

**Console Output:**
```
[Discovery] Generated 5 candidates for Random XYZ Service 123: randomxyzservice123.com, ...
[Discovery] No valid candidate found
[Validation] No known domain for: Random XYZ Service 123
```

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.5: Manual Domain Override

**Objective**: Verify user can manually enter custom domains

**Steps:**
1. Navigate to Add Subscription screen
2. Type "My Custom Service" in the Name field
3. Observe no automatic suggestion
4. Tap "Enter manually" button
5. Enter domain: "customservice.io"
6. Fill in remaining fields
7. Tap "Add Recurring Item"
8. Wait for verification
9. Check subscription card

**Expected Results:**
- [x] Manual input option appears
- [x] Can enter custom domain
- [x] Domain is validated (format check)
- [x] Background verification runs
- [x] Domain cached as "manual" source
- [x] Subscription saves with custom domain
- [x] Logo loads from Google Favicons
- [x] Logo is clickable

**Console Output:**
```
[Discovery] Cached manual domain: My Custom Service → customservice.io
[Discovery] Verifying customservice.io for My Custom Service...
[Verification] Logo check for customservice.io: SUCCESS (1245ms)
[Cache] Cached my custom service → customservice.io (manual)
```

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.6: Confidence Level Visual Indicators

**Objective**: Verify confidence badges display correctly for all levels

**Precondition**: Create subscriptions with different confidence levels

**Test Data:**
1. High: "Netflix" (hardcoded)
2. Medium: "Planet Fitness" (cached after first add)
3. Low: "LA Fitness" (pattern match, not yet verified)

**Steps:**
1. Add all three subscriptions
2. Compare badge appearances
3. Check icon colors and labels

**Expected Results:**

**High Confidence (Netflix):**
- [x] Badge shows "Verified"
- [x] Icon: checkmark-circle (✓)
- [x] Color: Green (#34C759)
- [x] Appears instantly

**Medium Confidence (Planet Fitness - Cached):**
- [x] Badge shows "Cached"
- [x] Icon: radio-button-on (●)
- [x] Color: Blue (primary color)
- [x] Appears instantly from cache

**Low Confidence (LA Fitness - Guessed):**
- [x] Badge shows "Unverified"
- [x] Icon: alert-circle (!)
- [x] Color: Yellow/Orange (#FF9500)
- [x] Appears after pattern matching

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.7: Background Verification After Save

**Objective**: Verify domains are verified in background after saving

**Steps:**
1. Add subscription: "Gold's Gym"
2. Observe initial low confidence suggestion
3. Save subscription
4. Wait 2-3 seconds
5. Check console for verification logs
6. Re-open subscription form for "Gold's Gym"

**Expected Results:**
- [x] Initial suggestion appears with low confidence
- [x] Subscription saves immediately (no waiting)
- [x] Background verification starts after save
- [x] Console shows verification attempt and result
- [x] Verification completes within 2000ms
- [x] Next time, domain loads from cache with medium confidence

**Performance Benchmarks:**
- Logo verification: 500-1500ms typical
- HTTP verification: 800-2000ms typical
- Total verification: <3000ms

**Console Output:**
```
[Discovery] Verifying goldsgym.com for Gold's Gym...
[Verification] Logo check for goldsgym.com: SUCCESS (1124ms)
[Discovery] ✅ Verified and cached goldsgym.com (1124ms)
[Cache] Cached gold's gym → goldsgym.com (logo)
```

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.8: Cache Persistence Across App Restarts

**Objective**: Verify cache persists and loads on app restart

**Precondition**: Several domains cached from previous tests

**Steps:**
1. Check cache stats before restart:
   ```javascript
   import { domainDiscoveryService } from './services/domainDiscoveryService';
   const stats = await domainDiscoveryService.getCacheStats();
   console.log('Cache stats:', stats);
   ```
2. Fully close and restart the app
3. Add a previously cached subscription (e.g., "Planet Fitness")
4. Observe suggestion speed

**Expected Results:**
- [x] Cache loads on app startup
- [x] Console shows: `[Cache] Initialized with X entries`
- [x] Cached domains appear instantly
- [x] No re-verification needed
- [x] Cache size matches pre-restart count

**Console Output:**
```
[Cache] Initialized with 12 entries
[Cache] Hit for planet fitness: planetfitness.com
```

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.9: Cache Expiration (90 Days)

**Objective**: Verify expired cache entries are removed

**Steps:**
1. Manually create an expired cache entry (for testing):
   ```javascript
   // In React Native Debugger console
   import AsyncStorage from '@react-native-async-storage/async-storage';
   
   const cache = {
     'test service': {
       domain: 'testservice.com',
       serviceName: 'test service',
       verified: true,
       timestamp: Date.now() - (91 * 24 * 60 * 60 * 1000), // 91 days ago
       verificationMethod: 'logo'
     }
   };
   
   await AsyncStorage.setItem('@domain_cache', JSON.stringify(cache));
   ```
2. Restart app to load cache
3. Try to add "Test Service"
4. Check if cached domain is used

**Expected Results:**
- [x] Expired entry is detected
- [x] Entry is removed from cache
- [x] New domain discovery runs
- [x] Console shows: `[Cache] Entry expired for Test Service`

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.10: Multiple Domain Candidates

**Objective**: Verify system generates multiple candidates for complex names

**Test Services:**
- "LA Fitness" (acronym + word)
- "Apple Music" (multi-word with known brand)
- "My-Custom-Service" (hyphens)

**Steps:**
1. For each service, check console for generated candidates
2. Verify best candidate is selected
3. Check preference for .com domains

**Expected Results:**
- [x] Multiple candidates generated for each
- [x] Console shows: `[Discovery] Generated 5 candidates for ...`
- [x] .com domains preferred over other TLDs
- [x] Valid domain format enforced
- [x] First valid candidate shown if no .com available

**Console Examples:**
```
[Discovery] Generated 5 candidates for LA Fitness: lafitness.com, lafitness.net, lafitness.io, ...
[Discovery] Generated 5 candidates for Apple Music: applemusic.com, apple.com, ...
```

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.11: Verification Timeout Handling

**Objective**: Verify system handles slow/unresponsive domains

**Steps:**
1. Add subscription with domain that times out (e.g., "slowservice.notexist")
2. Manually trigger verification for testing:
   ```javascript
   import { domainVerificationService } from './services/domainVerificationService';
   await domainVerificationService.verifyWithFallback('slowservice.notexist');
   ```
3. Wait for timeout (5 seconds)
4. Check console output

**Expected Results:**
- [x] Verification times out after 5000ms
- [x] Returns verification failed
- [x] Domain not cached (or cached as unverified)
- [x] No app crash or hanging
- [x] Error logged to console

**Console Output:**
```
[Verification] Logo check for slowservice.notexist: FAILED (5003ms)
[Verification] HTTP check for slowservice.notexist: FAILED (5004ms)
[Discovery] ❌ Failed to verify slowservice.notexist
```

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.12: Edit Domain Suggestion

**Objective**: Verify user can edit suggested domains

**Steps:**
1. Add subscription: "Fitness Center"
2. Observe suggestion: "fitnesscenter.com"
3. Tap "Edit" button on suggestion
4. Change domain to: "myfitness.com"
5. Save subscription
6. Verify custom domain is used

**Expected Results:**
- [x] Edit button appears on suggestion
- [x] Can modify suggested domain
- [x] Modified domain is validated
- [x] Subscription saves with edited domain
- [x] Edited domain is cached

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.13: Cache Size Management (500 Entry Limit)

**Objective**: Verify cache pruning works when limit reached

**Steps:**
1. Check current cache size
2. If needed, manually add entries to approach 500 limit
3. Add new subscription that triggers caching
4. Verify oldest entries are removed

**Expected Results:**
- [x] Cache maintains max 500 entries
- [x] Oldest entries removed first (FIFO)
- [x] Console shows: `[Cache] Pruned X old entries`
- [x] New entries are added successfully
- [x] Most recent entries preserved

**Verification:**
```javascript
const stats = await domainDiscoveryService.getCacheStats();
console.log('Cache size:', stats.size);
// Should be <= 500
```

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.14: Network Offline - Cache Works

**Objective**: Verify cached domains work without network

**Precondition**: Several domains cached from previous tests

**Steps:**
1. Enable airplane mode or disable network
2. Open app
3. Add previously cached subscription (e.g., "Planet Fitness")
4. Observe suggestion

**Expected Results:**
- [x] Cache loads from AsyncStorage
- [x] Cached domains appear instantly
- [x] No network errors
- [x] Subscriptions can be created with cached domains
- [x] Background verification skipped (no network)

**Console Output:**
```
[Cache] Initialized with 12 entries
[Cache] Hit for planet fitness: planetfitness.com
```

**Status:** ⬜ Pass ⬜ Fail

---

### Test Case 5.15: Case-Insensitive Cache Lookup

**Objective**: Verify cache lookups are case-insensitive

**Precondition**: "Planet Fitness" cached from previous test

**Test Variations:**
- "planet fitness" (lowercase)
- "PLANET FITNESS" (uppercase)
- "Planet Fitness" (proper case)
- "pLaNeT fItNeSs" (mixed case)

**Steps:**
1. Delete any existing "Planet Fitness" subscription
2. Try each variation above
3. Verify cache hit for all

**Expected Results:**
- [x] All variations find cached domain
- [x] Cache key normalization works
- [x] Console shows cache hit for each
- [x] Same domain returned: "planetfitness.com"

**Status:** ⬜ Pass ⬜ Fail

---

## Updated Success Criteria

✅ **Intelligent domain discovery is working correctly when:**

### 1. Known Services (Hardcoded)
- Domain suggestion appears instantly (<100ms)
- Confidence badge shows "Verified" with green checkmark
- Logo displays and is clickable
- No network request needed

### 2. Unknown Services (Pattern Matching)
- Domain suggestion appears within 100ms
- Confidence badge shows "Unverified" with yellow/orange icon
- Subscription saves immediately
- Background verification runs after save (500-2000ms)
- Verified domains cached for future use

### 3. Cached Services
- Domain suggestion appears instantly (<20ms)
- Confidence badge shows "Cached" with blue indicator
- No verification needed on subsequent uses
- Works offline

### 4. Manual Override
- User can enter custom domains
- Custom domains are validated (format)
- Custom domains are verified in background
- Custom domains cached with "manual" source

### 5. Performance
- Hardcoded lookup: <100ms
- Cache lookup: <20ms
- Pattern matching: <100ms
- Verification (logo): 500-1500ms typical
- Verification (HTTP): 800-2000ms typical
- Total verification: <3000ms

### 6. Cache Management
- Persists across app restarts
- Expires after 90 days
- Limited to 500 entries (pruned when exceeded)
- Case-insensitive lookups

---

## Additional Troubleshooting

### Issue 6: Domain Suggestions Not Appearing

**Symptoms:**
- No domain suggestions show for any service
- "No domain found" appears for known services

**Possible Causes:**
1. Discovery service not initialized
2. Cache initialization failed
3. Component state not updating

**Debug Steps:**
```javascript
// Check if service is initialized
import { domainDiscoveryService } from './services/domainDiscoveryService';
await domainDiscoveryService.initialize();

// Test discovery manually
const result = await domainDiscoveryService.discoverDomain('Netflix');
console.log('Discovery result:', result);
```

**Solution:**
1. Ensure [`App.tsx`](../App.tsx) initializes discovery service on startup
2. Check AsyncStorage permissions
3. Verify [`DomainSuggestion.tsx`](../components/DomainSuggestion.tsx) is imported in form

---

### Issue 7: Verification Failing for Valid Domains

**Symptoms:**
- Domains show as "Unverified" even after background check
- Console shows verification failures
- No domains get cached

**Possible Causes:**
1. Network connectivity issues
2. Verification timeout too short
3. CORS or fetch errors
4. Logo URL blocked

**Debug Steps:**
```javascript
// Test verification manually
import { domainVerificationService } from './services/domainVerificationService';
const result = await domainVerificationService.verifyWithFallback('netflix.com');
console.log('Verification result:', result);
```

**Solution:**
1. Check network connection
2. Increase timeout in [`domainVerificationService.ts:18`](../services/domainVerificationService.ts:18)
3. Test logo URL directly: `https://www.google.com/s2/favicons?sz=64&domain=netflix.com`
4. Check for network errors in console

---

### Issue 8: Cache Not Persisting

**Symptoms:**
- Domains not cached after verification
- Cache empty on app restart
- Same domains verified repeatedly

**Possible Causes:**
1. AsyncStorage write failure
2. Cache service not initialized
3. Persistence not triggered

**Debug Steps:**
```javascript
// Check cache directly
import AsyncStorage from '@react-native-async-storage/async-storage';
const cache = await AsyncStorage.getItem('@domain_cache');
console.log('Raw cache:', cache);

// Check cache stats
import { domainDiscoveryService } from './services/domainDiscoveryService';
const stats = await domainDiscoveryService.getCacheStats();
console.log('Cache stats:', stats);
```

**Solution:**
1. Clear and reinitialize cache:
   ```javascript
   await domainDiscoveryService.clearCache();
   await domainDiscoveryService.initialize();
   ```
2. Check AsyncStorage permissions
3. Verify [`domainCacheService.ts:181`](../services/domainCacheService.ts:181) - persistCache()

---

### Issue 9: Confidence Badges Not Showing Correctly

**Symptoms:**
- All badges show same color
- Badge text wrong
- Icons not displaying

**Possible Causes:**
1. Theme colors not defined
2. Icon names incorrect
3. Component style not applied

**Debug Steps:**
```javascript
// Check suggestion object
const suggestion = await domainDiscoveryService.discoverDomain('Netflix');
console.log('Suggestion:', suggestion);
// Should have: confidence, source, verified properties
```

**Solution:**
1. Verify [`DomainSuggestion.tsx:55`](../components/DomainSuggestion.tsx:55) - getConfidenceIndicator()
2. Check theme context provides: colors.success, colors.warning, colors.primary
3. Ensure Ionicons properly imported

---

### Issue 10: Pattern Matching Not Working

**Symptoms:**
- Simple service names not generating domains
- Common patterns like "LA Fitness" not matched
- Console shows no candidates generated

**Possible Causes:**
1. Service name too short (< 2 chars)
2. Invalid characters preventing normalization
3. Regex removing all characters

**Debug Steps:**
```javascript
// Check candidate generation
import { domainDiscoveryService } from './services/domainDiscoveryService';
const suggestions = await domainDiscoveryService.getSuggestions('LA Fitness');
console.log('Suggestions:', suggestions);
```

**Solution:**
1. Verify [`domainDiscoveryService.ts:124`](../services/domainDiscoveryService.ts:124) - generateDomainCandidates()
2. Check normalization doesn't remove too much
3. Ensure at least 2 characters remain after normalization
4. Test with simpler names first

---

## Expected Results Summary

### Quick Reference Table

| Test Scenario | Known Service (Netflix) | Pattern Match (Planet Fitness) | Unknown Service (Random XYZ) |
|--------------|------------------------|-------------------------------|----------------------------|
| **Domain Suggestion** | ✅ Instant (hardcoded) | ✅ Fast (pattern match) | ❌ No match |
| **Confidence Level** | ✅ High (green) | ⚠️ Low → Medium (yellow → blue) | ❌ N/A |
| **Suggestion Speed** | ⚡ <100ms | ⚡ <100ms | ❌ N/A |
| **Domain Assigned** | ✅ netflix.com | ✅ planetfitness.com | ❌ Empty string |
| **Logo Type** | ✅ Service logo | ✅ Service logo | ⚠️ Fallback icon (letter) |
| **Logo Opacity** | ✅ 1.0 (full) | ✅ 1.0 (full) | ⚠️ 0.7 (reduced) |
| **Clickable** | ✅ Yes | ✅ Yes | ❌ No |
| **Click Action** | ✅ Opens browser | ✅ Opens browser | ❌ No action |
| **URL Format** | ✅ https://netflix.com | ✅ https://planetfitness.com | ❌ N/A |
| **Autocomplete** | ✅ Appears | ❌ No hardcoded match | ❌ No suggestions |
| **Background Verify** | ❌ Not needed | ✅ Yes (500-2000ms) | ❌ N/A |
| **Cache Behavior** | ❌ Not cached (hardcoded) | ✅ Cached after verify | ❌ Not applicable |
| **Validation** | ✅ Passes | ✅ Passes | ⚠️ Skipped (no domain) |

### Confidence Level Reference

| Level | Badge | Icon | Color | Meaning | Source |
|-------|-------|------|-------|---------|--------|
| **High** | "Verified" | ✓ Checkmark | Green (#34C759) | Hardcoded, trusted domain | Hardcoded mappings |
| **Medium** | "Cached" | ● Circle | Blue (primary) | Previously verified & cached | Cache |
| **Low** | "Unverified" | ! Alert | Yellow/Orange (#FF9500) | Pattern match, not yet verified | Pattern matching |

### Performance Benchmarks

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Hardcoded lookup | <100ms | Instant suggestion |
| Cache lookup | <20ms | Very fast, offline capable |
| Pattern matching | <100ms | Fast suggestion generation |
| Logo verification | 500-1500ms | Background, non-blocking |
| HTTP verification | 800-2000ms | Fallback method |
| Total verification | <3000ms | Worst case scenario |

---

## Edge Cases

### Edge Case 1: Empty Service Name

**Scenario**: User submits form with empty name field

**Expected Behavior:**
- [x] Form validation prevents submission
- [x] Error message: "Name is required"
- [x] No database write occurs

**Status:** ⬜ Pass ⬜ Fail

---

### Edge Case 2: Service Name with Special Characters

**Test Names:**
- "My-Gym-2024" (hyphens and numbers)
- "Café Subscription" (accented characters)
- "Test & Trial" (ampersand)
- "Service (Premium)" (parentheses)

**Expected Behavior:**
- [x] All names save correctly
- [x] No domain assigned (unknown services)
- [x] Fallback icons display correctly
- [x] No parsing errors

**Status:** ⬜ Pass ⬜ Fail

---

### Edge Case 3: Case-Insensitive Matching

**Test Variations:**
- "netflix" (lowercase)
- "NETFLIX" (uppercase)
- "Netflix" (proper case)
- "nEtFliX" (mixed case)

**Expected Behavior:**
- [x] All variations match to "netflix.com"
- [x] Domain lookup is case-insensitive
- [x] Autocomplete shows "Netflix" (proper case)

**Code Reference:**
[`domainHelpers.ts:98`](../utils/domainHelpers.ts:98) - Normalization to lowercase

**Status:** ⬜ Pass ⬜ Fail

---

### Edge Case 4: Partial Name Matching

**Test Cases:**
- "Apple Music" should match "apple" → apple.com
- "Prime Video" should match "prime" → amazon.com
- "YouTube Premium" should match "youtube" → youtube.com

**Expected Behavior:**
- [x] Partial matching works
- [x] Correct domain assigned
- [x] Autocomplete suggests full name

**Code Reference:**
[`domainHelpers.ts:106-110`](../utils/domainHelpers.ts:106-110) - Partial matching logic

**Status:** ⬜ Pass ⬜ Fail

---

### Edge Case 5: Logo Fallback Chain

**Scenario**: Logo URLs fail to load

**Expected Behavior:**
- [x] Primary logo source tried first
- [x] Falls back to secondary source on error
- [x] Eventually shows fallback icon if all fail
- [x] No infinite retry loops

**Status:** ⬜ Pass ⬜ Fail

---

### Edge Case 6: Database Contains NULL vs Empty String

**Scenario**: Existing data has both NULL and '' for domain

**Verification Query:**
```sql
-- Check both NULL and empty string
SELECT name, domain, (domain IS NULL) as is_null, (domain = '') as is_empty
FROM recurring_items
WHERE domain IS NULL OR domain = '';
```

**Expected Behavior:**
- [x] Migration handles both NULL and ''
- [x] App treats both as "no domain"
- [x] No clickability for either case

**Status:** ⬜ Pass ⬜ Fail

---

## Troubleshooting

### Issue 1: Logo Remains Clickable Without Domain

**Symptoms:**
- Icon has reduced opacity but still opens browser
- Browser opens to empty page or error

**Possible Causes:**
1. Old app version cached
2. Domain field has whitespace instead of empty string
3. Conditional logic not evaluating correctly

**Debug Steps:**
```sql
-- Check for whitespace
SELECT name, domain, LENGTH(domain) as domain_length
FROM recurring_items
WHERE name = 'Your Service Name';
```

**Solution:**
1. Force refresh app (Cmd+R on simulator)
2. Check [`SubscriptionCard.tsx:58`](../components/SubscriptionCard.tsx:58) - early return logic
3. Clean whitespace: `UPDATE recurring_items SET domain = '' WHERE domain = '  ';`

---

### Issue 2: Valid Domain Not Recognized

**Symptoms:**
- Known service (e.g., Netflix) gets no domain
- Logo shows fallback icon instead of service logo

**Possible Causes:**
1. Service name has typo
2. Domain mapping not in [`domainHelpers.ts`](../utils/domainHelpers.ts:6-59)
3. Case sensitivity issue

**Debug Steps:**
```javascript
// In React Native Debugger console
import { extractDomain } from './utils/domainHelpers';
console.log(extractDomain('Netflix')); // Should return 'netflix.com'
console.log(extractDomain('netflix')); // Should also return 'netflix.com'
```

**Solution:**
1. Verify exact spelling in DOMAIN_MAPPINGS
2. Check normalization: [`domainHelpers.ts:98`](../utils/domainHelpers.ts:98)
3. Add service to DOMAIN_MAPPINGS if missing

---

### Issue 3: Migration Doesn't Clear Invalid Domains

**Symptoms:**
- After running migration, invalid domains still exist
- Query returns 0 rows updated

**Possible Causes:**
1. Domain format different than expected
2. Regex pattern not matching
3. Permission issues

**Debug Query:**
```sql
-- Check what domains exist
SELECT DISTINCT domain, COUNT(*) as count
FROM recurring_items
WHERE domain IS NOT NULL AND domain != ''
GROUP BY domain
ORDER BY count DESC;

-- Test regex match
SELECT name, domain, 
  (domain !~* '^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$') as should_clear
FROM recurring_items
WHERE domain IS NOT NULL AND domain != '';
```

**Solution:**
1. Review regex pattern in migration
2. Check for non-ASCII characters in domains
3. Manually clear problematic domains:
   ```sql
   UPDATE recurring_items 
   SET domain = '' 
   WHERE domain IN ('temp.com', 'test.com', 'mygym.com');
   ```

---

### Issue 4: Autocomplete Not Showing Suggestions

**Symptoms:**
- Type service name but no suggestions appear
- Known services don't trigger autocomplete

**Possible Causes:**
1. Modal z-index issue (suggestions hidden)
2. State not updating
3. Suggestions filtered out incorrectly

**Debug Steps:**
```javascript
// Check available suggestions
import { getCompanyNames } from './utils/domainHelpers';
console.log(getCompanyNames()); // Should show 58 services
```

**Solution:**
1. Check [`SubscriptionForm.tsx:161-177`](../components/SubscriptionForm.tsx:161-177) - filtering logic
2. Verify z-index: [`SubscriptionForm.tsx:452`](../components/SubscriptionForm.tsx:452)
3. Check if suggestions array is being set

---

### Issue 5: URL Opens But Shows Error Page

**Symptoms:**
- Logo click opens browser
- Browser shows "Can't reach this page" or similar error

**Possible Causes:**
1. No internet connection
2. Domain DNS not resolving
3. URL malformed

**Debug Steps:**
```javascript
// In SubscriptionCard.tsx, add logging
const handleLogoPress = async () => {
  if (!subscription.domain) return;
  
  const url = `https://${subscription.domain}`;
  console.log('[DEBUG] Opening URL:', url);
  
  const canOpen = await Linking.canOpenURL(url);
  console.log('[DEBUG] Can open URL:', canOpen);
  // ... rest of function
};
```

**Solution:**
1. Test internet connection
2. Try URL in desktop browser first
3. Verify domain in database matches expected format
4. Check for typos in domain string

---

## Production Verification

### Pre-Deployment Checklist

Before deploying to production, verify:

- [ ] All test cases pass on development
- [ ] Migration tested on staging database
- [ ] Rollback plan documented
- [ ] Analytics tracking verified (optional)
- [ ] No console errors in production build

### Post-Deployment Smoke Tests

#### Smoke Test 1: Create Known Service
1. Create Netflix subscription in production
2. Verify logo is clickable
3. Verify opens correct URL

**Expected**: ✅ Success (< 5 seconds)

---

#### Smoke Test 2: Create Unknown Service  
1. Create "Test Service" subscription in production
2. Verify fallback icon shows
3. Verify icon is non-clickable

**Expected**: ✅ Success (< 5 seconds)

---

#### Smoke Test 3: Verify Existing Subscriptions
1. Check existing user subscriptions
2. Verify known services have clickable logos
3. Verify no broken links

**Expected**: ✅ All existing subscriptions work

---

### Monitoring Recommendations

After production deployment, monitor:

1. **Error Rates**
   - Watch for increases in link-related errors
   - Monitor Linking.openURL failures

2. **User Feedback**
   - Reviews mentioning "broken links"
   - Support tickets about logo clicks

3. **Database Health**
   ```sql
   -- Weekly check for data quality
   SELECT 
     COUNT(*) as total_subscriptions,
     COUNT(CASE WHEN domain != '' THEN 1 END) as with_domain,
     COUNT(CASE WHEN domain = '' OR domain IS NULL THEN 1 END) as without_domain
   FROM recurring_items;
   ```

---

## Rollback Procedures

### If Issues Are Found

#### Option 1: Rollback Code Changes

If critical bugs are found in the domain validation logic:

```bash
# Revert commits
git revert <commit-hash-domain-validation>
git push origin main

# Redeploy previous version
eas build --platform all --profile production
```

#### Option 2: Rollback Database Migration

If invalid domains need to be restored (NOT RECOMMENDED):

```sql
-- WARNING: This re-introduces invalid domains
-- Only use if critical data was lost

-- Example: Restore auto-generated domains (not recommended)
UPDATE recurring_items
SET domain = LOWER(REPLACE(name, ' ', '')) || '.com'
WHERE (domain IS NULL OR domain = '')
  AND name NOT IN (SELECT name FROM known_services);
  
-- Better approach: Let users re-add subscriptions with corrections
```

#### Option 3: Hot Fix

If specific domain is missing from DOMAIN_MAPPINGS:

1. Add domain to [`utils/domainHelpers.ts`](../utils/domainHelpers.ts:6-59)
2. Release patch version
3. No database migration needed (future saves will use new mapping)

---

## Success Criteria

✅ **Feature is working correctly when:**

1. **Known Services**
   - Logo displays and is clickable
   - Opens correct website in browser
   - URL uses https:// format
   - Autocomplete works

2. **Unknown Services**
   - Fallback icon displays
   - Icon has reduced opacity (0.7)
   - Icon is non-clickable
   - No errors when clicked

3. **Database**
   - Invalid domains cleared
   - Valid domains preserved
   - Migration is idempotent

4. **User Experience**
   - No broken links
   - Clear visual feedback
   - Smooth navigation
   - No error dialogs

---

## Additional Resources

- **Implementation Details**: See [`utils/domainHelpers.ts`](../utils/domainHelpers.ts)
- **Form Logic**: See [`components/SubscriptionForm.tsx`](../components/SubscriptionForm.tsx)
- **Card Behavior**: See [`components/SubscriptionCard.tsx`](../components/SubscriptionCard.tsx)
- **Migration Script**: See [`database/clear_invalid_domains_migration.sql`](../database/clear_invalid_domains_migration.sql)

---

## Test Report Template

Use this template to document your test session:

```markdown
## Domain Validation Test Report

**Date**: [YYYY-MM-DD]
**Tester**: [Your Name]
**Environment**: [Development/Staging/Production]
**App Version**: [Version Number]
**Device/Simulator**: [Device Info]

### Test Results Summary

Total Test Cases: __/43
- Passed: __
- Failed: __
- Skipped: __

**Breakdown by Section:**
- Basic Domain Validation: __/19 (Tests 1.1-4.4)
- Intelligent Discovery: __/15 (Tests 5.1-5.15)
- Edge Cases: __/6
- Production Smoke Tests: __/3

### Critical Issues
- [List any blocking issues]

### Minor Issues  
- [List any non-blocking issues]

### Notes
- [Additional observations]

### Recommendation
⬜ Approved for Production
⬜ Needs Fixes Before Deployment
```

---

## Support

If you encounter issues during testing:
1. Check console logs for detailed error messages
2. Verify database state with SQL queries
3. Review code references in this guide
4. Check existing subscriptions for data integrity
5. Test with fresh user account if needed

For questions about the implementation, review the code files referenced throughout this document.