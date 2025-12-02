# Domain Discovery System - Testing Guide

## Overview

This guide provides comprehensive testing procedures for the new intelligent domain discovery system that automatically finds and verifies domains for subscription services.

---

## Testing the Multi-Tier Discovery

### Test Case 1: Known Service (High Confidence)

**Service**: Netflix

**Expected Behavior:**
1. User types "Netflix" in name field
2. Autocomplete suggests "Netflix"
3. Upon selection or completion:
   - Domain suggestion appears: `netflix.com` with ✅ "Verified" badge
   - Green checkmark indicates high confidence (hardcoded mapping)
4. On save:
   - Domain saved instantly without verification
   - No network calls needed

**Verification:**
```sql
SELECT name, domain FROM recurring_items WHERE name = 'Netflix';
-- Expected: domain = 'netflix.com'
```

---

### Test Case 2: Cached Service (Medium Confidence)

**Service**: Previously verified service (e.g., "Dropbox" after first successful save)

**Expected Behavior:**
1. User types service name
2. Domain suggestion appears with 🔵 "Cached" badge
3. Blue dot indicates medium confidence (from cache)
4. On save:
   - Domain saved from cache
   - No verification needed

**Cache Check:**
```javascript
// In React Native Debugger console
import { domainCacheService } from './services/domainCacheService';
const cached = await domainCacheService.getCachedDomain('Dropbox');
console.log('Cached domain:', cached);
```

---

### Test Case 3: Unknown Service with Pattern Match (Low Confidence)

**Service**: Planet Fitness

**Expected Behavior:**
1. User types "Planet Fitness"
2. No autocomplete match (not in hardcoded list)
3. After 500ms delay (debounce), domain suggestion appears:
   - `planetfitness.com` with ⚠️ "Unverified" badge
   - Yellow warning indicates low confidence (guessed)
4. User can:
   - Accept suggestion (click away or continue)
   - Click "Edit" to modify domain
   - Enter completely different domain
5. On save:
   - Background verification starts (shows "Saving..." button state)
   - Logo check attempts to verify domain
   - If verified: ✅ Cached for future use
   - If failed: Still saves but doesn't cache
   - Takes 500-1500ms

**Console Output:**
```
[Discovery] Generated 5 candidates for Planet Fitness: planetfitness.com, planetfitness.net, planetfitness.io...
[Discovery] Verifying planetfitness.com for Planet Fitness...
[Verification] Logo check for planetfitness.com: SUCCESS (856ms)
[Discovery] ✅ Verified and cached planetfitness.com (856ms)
```

---

### Test Case 4: Service with No Good Pattern Match

**Service**: My Local Gym

**Expected Behavior:**
1. User types "My Local Gym"
2. Pattern matching generates candidates but none are valid
3. Domain suggestion shows: ❓ "No domain found"
4. "Enter manually" button appears
5. Click opens manual input field
6. User enters domain: `mylocalgym.com`
7. On save:
   - Attempts verification
   - If fails: Shows warning but allows save

---

### Test Case 5: Manual Domain Override

**Service**: XYZ Company

**Expected Behavior:**
1. User types "XYZ Company"
2. System suggests `xyzcompany.com` (low confidence)
3. User clicks "Edit" button
4. Manual domain input field appears with pre-filled `xyzcompany.com`
5. User changes to `xyz.io`
6. On save:
   - Verifies `xyz.io`
   - Caches as manual entry
   - Future additions suggest `xyz.io`

---

## Performance Testing

### Timing Benchmarks

| Operation | Target Time | Acceptable Range |
|-----------|-------------|------------------|
| Hardcoded lookup | <1ms | <5ms |
| Cache lookup | <10ms | <50ms |
| Pattern generation | <50ms | <100ms |
| Domain verification | 500-1500ms | 500-3000ms |
| Full save with verification | 1000-2000ms | 1000-5000ms |

### Test Network Scenarios

#### Online Mode (Normal)
```javascript
// Should verify domains successfully
// Check console for timing logs
[Verification] Logo check for domain.com: SUCCESS (856ms)
```

#### Slow Network
```javascript
// Should timeout after 5 seconds
[Verification] Logo check for domain.com: FAILED (5001ms)
```

#### Offline Mode
```javascript
// Should use cache, skip verification
[Cache] Hit for Netflix: netflix.com
[Discovery] Using cached domain (no verification in offline mode)
```

---

## Cache Management Testing

### Test Cache Persistence

1. Add "Planet Fitness" → Verifies → Caches
2. Close app completely
3. Reopen app
4. Add "Planet Fitness" again
5. **Expected**: Domain appears with 🔵 "Cached" badge (no verification)

### Test Cache Statistics

```javascript
// In console
import { domainDiscoveryService } from './services/domainDiscoveryService';
const stats = await domainDiscoveryService.getCacheStats();
console.log('Cache stats:', stats);
// Expected: { size: 5, oldestEntry: 1701234567890, newestEntry: 1701234600000 }
```

### Test Cache Pruning

1. Fill cache with 500+ entries (programmatically)
2. Add one more entry
3. **Expected**: Oldest entry removed automatically

```javascript
// Verify pruning
const entries = await domainCacheService.getAllEntries();
console.log('Cache size:', entries.length); // Should be ≤ 500
```

---

## UI/UX Testing

### Visual States

#### State 1: No Suggestion
- Service name entered
- No domain found
- Shows: ❓ "No domain found" + "Enter manually" button

#### State 2: High Confidence
- Known service
- Shows: 🌐 domain.com ✅ Verified

#### State 3: Medium Confidence  
- Cached service
- Shows: 🌐 domain.com 🔵 Cached

#### State 4: Low Confidence
- Guessed domain
- Shows: 🌐 domain.com ⚠️ Unverified

#### State 5: Manual Input
- User clicked "Edit" or "Enter manually"
- Shows: Text input field for domain
- Helper text: "Enter the company's website domain for logo display"

### Interaction Testing

1. **Edit Button**
   - Click "Edit" on suggestion
   - Manual input field appears
   - Domain pre-filled
   - Can modify and save

2. **Enter Manually Button**
   - Click when no suggestion
   - Empty manual input field appears
   - Can enter custom domain

3. **Haptic Feedback (iOS)**
   - Light haptic on "Edit" click
   - Light haptic on "Enter manually" click

---

## Error Handling Testing

### Test Case: Verification Timeout

1. Use service with non-existent domain
2. **Expected**: Timeout after 5 seconds
3. **Console**: `[Verification] Logo check for fake.com: FAILED (5001ms)`
4. **Behavior**: Still saves subscription, no cache entry

### Test Case: Invalid Domain Format

1. Enter manual domain: `not a valid domain`
2. **Expected**: Format validation fails
3. **Behavior**: Domain not saved, warning in console

### Test Case: Network Error During Verification

1. Turn off network after typing service name
2. Domain suggestion shows (from pattern matching)
3. Click save
4. **Expected**: Verification fails gracefully
5. **Behavior**: Subscription still saves without verified domain

---

## Accessibility Testing

### Screen Reader

1. Domain suggestion should announce:
   - "Website domain: netflix.com, verified"
   - "Edit button"
   
2. Manual input should announce:
   - "Website Domain, optional, text field"

### Keyboard Navigation (if applicable)

- Tab through form fields
- Domain suggestion "Edit" button should be reachable
- Enter key should activate "Edit"

---

## Integration Testing

### Full Flow Test

1. **Add Known Service (Netflix)**
   - Instant suggestion
   - Quick save
   - Logo loads immediately

2. **Add Unknown Service (Planet Fitness)**
   - Pattern-matched suggestion
   - Background verification on save
   - Cached for next time

3. **Re-add Planet Fitness**
   - Cache hit
   - No verification needed
   - Faster save

4. **Add Custom Service with Manual Domain**
   - No suggestion
   - Enter manually: `customservice.io`
   - Verification attempts
   - Saves regardless of result

5. **Verify Logo Display**
   - All services show logos (if domains exist)
   - Click logo opens correct website
   - Fallback icons for failed/no domains

---

## Database Verification

### Check Saved Domains

```sql
-- View all domains
SELECT name, domain, category 
FROM recurring_items 
ORDER BY created_at DESC 
LIMIT 10;

-- Count domains by type
SELECT 
  CASE 
    WHEN domain IS NULL OR domain = '' THEN 'No domain'
    ELSE 'Has domain'
  END as domain_status,
  COUNT(*) as count
FROM recurring_items
GROUP BY domain_status;
```

---

## Performance Monitoring

### Key Metrics to Track

1. **Discovery Speed**
   - Average time from name input to suggestion display
   - Target: <100ms

2. **Verification Success Rate**
   - Percentage of domains successfully verified
   - Target: >80%

3. **Cache Hit Rate**
   - Percentage of lookups that hit cache
   - Target: >60%

4. **User Override Rate**
   - How often users manually edit domains
   - Indicates pattern matching accuracy

### Console Monitoring

Enable verbose logging in development:

```javascript
// All discovery operations log to console
[Discovery] Service initialized
[Discovery] Hardcoded match for Netflix: netflix.com
[Cache] Hit for Dropbox: dropbox.com
[Discovery] Generated 5 candidates for Unknown Service
[Verification] Logo check for domain.com: SUCCESS (856ms)
[Discovery] ✅ Verified and cached domain.com (856ms)
[Cache] Cached Unknown Service → domain.com (logo)
```

---

## Regression Testing

### Ensure Backwards Compatibility

1. **Existing Subscriptions**
   - All existing subscriptions still load correctly
   - Domains preserved
   - Logos still display

2. **Old Domain Extraction**
   - `extractDomain()` still works for known services
   - Returns empty string for unknown services (as before)

3. **Form Behavior**
   - Adding subscriptions without discovery enabled works
   - Manual domain entry always available
   - No breaking changes to save flow

---

## Common Issues & Debugging

### Issue: Suggestion Not Appearing

**Possible Causes:**
1. Name too short (< 2 characters)
2. Autocomplete showing (suggestions hidden during autocomplete)
3. Discovery service not initialized

**Debug:**
```javascript
import { domainDiscoveryService } from './services/domainDiscoveryService';
const suggestion = await domainDiscoveryService.discoverDomain('Test Service');
console.log('Manual discovery:', suggestion);
```

### Issue: Verification Always Failing

**Possible Causes:**
1. Network offline
2. Firewall blocking requests
3. Timeout too short (5s)

**Debug:**
```javascript
import { domainVerificationService } from './services/domainVerificationService';
const result = await domainVerificationService.verifyDomainByLogo('netflix.com');
console.log('Verification result:', result);
```

### Issue: Cache Not Persisting

**Possible Causes:**
1. AsyncStorage error
2. Cache not initialized
3. App killed before persist

**Debug:**
```javascript
import { domainCacheService } from './services/domainCacheService';
const entries = await domainCacheService.getAllEntries();
console.log('Cache entries:', entries);

// Force save
await domainCacheService.cacheDomain('Test', 'test.com', true, 'manual');
```

---

## Summary

The intelligent domain discovery system provides:

✅ **Fast suggestions** via multi-tier lookup
✅ **Smart caching** for offline performance  
✅ **Background verification** for accuracy
✅ **Manual override** for flexibility
✅ **Clear confidence indicators** for transparency
✅ **Graceful degradation** when offline or errors occur

All existing functionality remains intact while providing enhanced domain discovery capabilities.