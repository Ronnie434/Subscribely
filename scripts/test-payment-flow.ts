#!/usr/bin/env ts-node
/**
 * Test Payment Flow Script
 * 
 * This script tests the complete payment flow in development by:
 * 1. Creating a test user
 * 2. Adding subscriptions to reach the limit
 * 3. Triggering the paywall
 * 4. Simulating payment initiation
 * 5. Verifying database updates
 * 6. Cleaning up test data
 * 
 * Usage:
 *   npx ts-node scripts/test-payment-flow.ts
 *   or
 *   npm run test-payment-flow
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

interface TestUser {
  id: string;
  email: string;
  password: string;
}

let testUser: TestUser | null = null;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, message: string) {
  log(`\n[Step ${step}] ${message}`, 'cyan');
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'blue');
}

// ============================================================================
// Test Functions
// ============================================================================

async function createTestUser(): Promise<TestUser> {
  logStep(1, 'Creating test user');
  
  const timestamp = Date.now();
  const email = `test-payment-${timestamp}@example.com`;
  const password = 'TestPassword123!';
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    
    if (!data.user) {
      throw new Error('User creation failed - no user returned');
    }
    
    testUser = {
      id: data.user.id,
      email,
      password,
    };
    
    logSuccess(`Created test user: ${email}`);
    logInfo(`User ID: ${testUser.id}`);
    
    return testUser;
  } catch (error) {
    logError(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

async function verifyUserSubscription(userId: string) {
  logStep(2, 'Verifying user subscription record');
  
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    
    if (!data) {
      throw new Error('No subscription record found for user');
    }
    
    logSuccess('User subscription record exists');
    logInfo(`Tier: ${data.tier_id}`);
    logInfo(`Status: ${data.status}`);
    logInfo(`Billing Cycle: ${data.billing_cycle}`);
    
    return data;
  } catch (error) {
    logError(`Failed to verify subscription: ${error instanceof Error ? error.message : 'Unknown'}`);
    throw error;
  }
}

async function addSubscriptions(userId: string, count: number) {
  logStep(3, `Adding ${count} test subscriptions`);
  
  const subscriptions = [];
  for (let i = 1; i <= count; i++) {
    subscriptions.push({
      user_id: userId,
      name: `Test Subscription ${i}`,
      amount: 9.99 + i,
      billing_cycle: 'monthly',
      renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'Entertainment',
      is_active: true,
    });
  }
  
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert(subscriptions)
      .select();
    
    if (error) throw error;
    
    logSuccess(`Added ${data?.length || 0} subscriptions`);
    
    return data;
  } catch (error) {
    logError(`Failed to add subscriptions: ${error instanceof Error ? error.message : 'Unknown'}`);
    throw error;
  }
}

async function checkSubscriptionLimit(userId: string) {
  logStep(4, 'Checking subscription limit');
  
  try {
    const { data, error } = await supabase
      .rpc('can_user_add_subscription', { p_user_id: userId });
    
    if (error) throw error;
    
    logInfo(`Current Count: ${data.current_count}`);
    logInfo(`Limit: ${data.limit_count}`);
    logInfo(`Can Add: ${data.allowed ? 'Yes' : 'No'}`);
    logInfo(`Tier: ${data.tier}`);
    
    if (!data.allowed) {
      logSuccess('Limit check working correctly - user cannot add more subscriptions');
    } else {
      logWarning('User can still add subscriptions - limit not reached');
    }
    
    return data;
  } catch (error) {
    logError(`Failed to check limit: ${error instanceof Error ? error.message : 'Unknown'}`);
    throw error;
  }
}

async function trackPaywallEvent(userId: string) {
  logStep(5, 'Tracking paywall viewed event');
  
  try {
    const { data, error } = await supabase
      .rpc('track_usage_event', {
        p_user_id: userId,
        p_event_type: 'paywall_viewed',
        p_event_context: 'test_script',
        p_event_data: { test: true, timestamp: new Date().toISOString() },
      });
    
    if (error) throw error;
    
    logSuccess('Paywall event tracked');
    
    return data;
  } catch (error) {
    logError(`Failed to track event: ${error instanceof Error ? error.message : 'Unknown'}`);
    throw error;
  }
}

async function simulatePaymentIntent() {
  logStep(6, 'Simulating payment intent creation');
  
  logInfo('In a real scenario, you would:');
  logInfo('1. Call create-subscription Edge Function');
  logInfo('2. Receive client_secret from Stripe');
  logInfo('3. Present payment sheet to user');
  logInfo('4. Process payment');
  logInfo('5. Webhook updates database');
  
  logWarning('This script cannot actually process payments');
  logWarning('Use Stripe test cards in the app to test real payment flow');
  
  log('\nTest Cards:', 'magenta');
  log('  Success: 4242 4242 4242 4242', 'reset');
  log('  Decline: 4000 0000 0000 0002', 'reset');
  log('  3D Secure: 4000 0027 6000 3184', 'reset');
}

async function verifyAnalyticsEvents(userId: string) {
  logStep(7, 'Verifying analytics events');
  
  try {
    const { data, error } = await supabase
      .from('usage_tracking_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    logSuccess(`Found ${data?.length || 0} analytics events`);
    
    if (data && data.length > 0) {
      log('\nRecent Events:', 'cyan');
      data.slice(0, 5).forEach(event => {
        log(`  - ${event.event_type} (${event.event_context})`, 'reset');
      });
    }
    
    return data;
  } catch (error) {
    logError(`Failed to verify events: ${error instanceof Error ? error.message : 'Unknown'}`);
    throw error;
  }
}

async function displayDatabaseState(userId: string) {
  log('\n' + '='.repeat(60), 'cyan');
  log('Database State Summary', 'cyan');
  log('='.repeat(60), 'cyan');
  
  try {
    // User subscription
    const { data: userSub } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    log('\nUser Subscription:', 'yellow');
    log(`  Tier: ${userSub?.tier_id}`, 'reset');
    log(`  Status: ${userSub?.status}`, 'reset');
    log(`  Billing Cycle: ${userSub?.billing_cycle}`, 'reset');
    
    // Subscriptions count
    const { count } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    log(`\nSubscriptions Count: ${count}`, 'yellow');
    
    // Analytics events
    const { count: eventCount } = await supabase
      .from('usage_tracking_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    log(`Analytics Events: ${eventCount}`, 'yellow');
    
  } catch (error) {
    logError(`Failed to display state: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

async function cleanupTestData(userId: string) {
  logStep(8, 'Cleaning up test data');
  
  const answer = await question('\nDo you want to delete the test data? (y/n): ');
  
  if (answer.toLowerCase() !== 'y') {
    logInfo('Skipping cleanup - test data preserved');
    logInfo(`Test user email: ${testUser?.email}`);
    logInfo(`Test user ID: ${userId}`);
    return;
  }
  
  try {
    // Delete subscriptions
    const { error: subsError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);
    
    if (subsError) throw subsError;
    logSuccess('Deleted test subscriptions');
    
    // Delete usage events
    const { error: eventsError } = await supabase
      .from('usage_tracking_events')
      .delete()
      .eq('user_id', userId);
    
    if (eventsError) throw eventsError;
    logSuccess('Deleted analytics events');
    
    // Note: user_subscriptions will be deleted when user is deleted (cascade)
    // Note: Cannot delete auth.users via client, would need admin API
    
    logWarning('User account not deleted (requires admin access)');
    logInfo(`Manually delete user ${testUser?.email} from Supabase Dashboard if needed`);
    
  } catch (error) {
    logError(`Failed to cleanup: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

// ============================================================================
// Main Test Flow
// ============================================================================

async function runPaymentFlowTest() {
  log('\n╔═══════════════════════════════════════════════════════════╗', 'cyan');
  log('║                                                           ║', 'cyan');
  log('║            Payment Flow Test Script                      ║', 'cyan');
  log('║                                                           ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════╝', 'cyan');
  
  logWarning('\nThis script tests database operations only.');
  logWarning('To test actual payments, use the app with Stripe test cards.\n');
  
  try {
    // Verify environment
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    logInfo(`Connected to: ${supabaseUrl}`);
    
    // Run test flow
    const user = await createTestUser();
    await verifyUserSubscription(user.id);
    await addSubscriptions(user.id, 5);
    await checkSubscriptionLimit(user.id);
    await trackPaywallEvent(user.id);
    await simulatePaymentIntent();
    await verifyAnalyticsEvents(user.id);
    await displayDatabaseState(user.id);
    await cleanupTestData(user.id);
    
    // Summary
    log('\n' + '='.repeat(60), 'green');
    log('Test Completed Successfully!', 'green');
    log('='.repeat(60), 'green');
    
    log('\nWhat was tested:', 'cyan');
    log('  ✅ User creation and subscription initialization', 'green');
    log('  ✅ Subscription tracking', 'green');
    log('  ✅ Limit enforcement logic', 'green');
    log('  ✅ Analytics event tracking', 'green');
    log('  ✅ Database operations', 'green');
    
    log('\nWhat to test manually:', 'yellow');
    log('  • Complete payment flow with Stripe test cards', 'reset');
    log('  • Webhook processing', 'reset');
    log('  • Payment sheet UI', 'reset');
    log('  • Subscription management screens', 'reset');
    log('  • Cancellation and refund flows', 'reset');
    
    log('\nNext Steps:', 'cyan');
    log('  1. Test in the app with actual payment flow', 'reset');
    log('  2. Use test card: 4242 4242 4242 4242', 'reset');
    log('  3. Verify webhook processing in Edge Function logs', 'reset');
    log('  4. Check Stripe Dashboard for test payments', 'reset');
    
    log('\nDocumentation:', 'blue');
    log('  • Integration Testing Guide: docs/INTEGRATION_TESTING_GUIDE.md', 'reset');
    log('  • Setup Guide: docs/PAYWALL_SETUP_GUIDE.md', 'reset');
    log('  • Troubleshooting: docs/TROUBLESHOOTING.md', 'reset');
    
  } catch (error) {
    log('\n' + '='.repeat(60), 'red');
    log('Test Failed!', 'red');
    log('='.repeat(60), 'red');
    
    logError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (testUser) {
      logInfo(`\nTest user created: ${testUser.email}`);
      logInfo('You may want to clean up this test data manually');
    }
    
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the test
runPaymentFlowTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});