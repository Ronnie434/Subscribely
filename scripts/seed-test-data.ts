#!/usr/bin/env ts-node
/**
 * Seed Test Data Script
 * 
 * This script seeds the database with test data for development and testing:
 * - Creates test users with different subscription states
 * - Adds sample subscriptions
 * - Creates test transactions
 * - Seeds analytics events
 * 
 * Usage:
 *   npx ts-node scripts/seed-test-data.ts
 *   or
 *   npm run seed-test-data
 * 
 * Warning: Only run in development/staging environments!
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

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Readline interface
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

interface TestUser {
  email: string;
  password: string;
  tier: 'free' | 'premium';
  subscriptionCount: number;
  description: string;
}

const testUsers: TestUser[] = [
  {
    email: 'test-free-empty@example.com',
    password: 'TestPassword123!',
    tier: 'free',
    subscriptionCount: 0,
    description: 'Free tier user with no subscriptions',
  },
  {
    email: 'test-free-partial@example.com',
    password: 'TestPassword123!',
    tier: 'free',
    subscriptionCount: 3,
    description: 'Free tier user with 3 subscriptions (under limit)',
  },
  {
    email: 'test-free-limit@example.com',
    password: 'TestPassword123!',
    tier: 'free',
    subscriptionCount: 5,
    description: 'Free tier user at 5-subscription limit',
  },
  {
    email: 'test-premium-monthly@example.com',
    password: 'TestPassword123!',
    tier: 'premium',
    subscriptionCount: 8,
    description: 'Premium user (monthly) with 8 subscriptions',
  },
  {
    email: 'test-premium-annual@example.com',
    password: 'TestPassword123!',
    tier: 'premium',
    subscriptionCount: 12,
    description: 'Premium user (annual) with 12 subscriptions',
  },
];

// Sample subscription data
const sampleSubscriptions = [
  { name: 'Netflix', amount: 15.99, category: 'Entertainment', logo_url: 'netflix.com' },
  { name: 'Spotify', amount: 9.99, category: 'Entertainment', logo_url: 'spotify.com' },
  { name: 'Amazon Prime', amount: 14.99, category: 'Shopping', logo_url: 'amazon.com' },
  { name: 'Apple Music', amount: 10.99, category: 'Entertainment', logo_url: 'apple.com' },
  { name: 'Disney+', amount: 7.99, category: 'Entertainment', logo_url: 'disneyplus.com' },
  { name: 'Hulu', amount: 6.99, category: 'Entertainment', logo_url: 'hulu.com' },
  { name: 'YouTube Premium', amount: 11.99, category: 'Entertainment', logo_url: 'youtube.com' },
  { name: 'HBO Max', amount: 14.99, category: 'Entertainment', logo_url: 'hbomax.com' },
  { name: 'Adobe Creative Cloud', amount: 54.99, category: 'Productivity', logo_url: 'adobe.com' },
  { name: 'Microsoft 365', amount: 6.99, category: 'Productivity', logo_url: 'microsoft.com' },
  { name: 'Dropbox', amount: 11.99, category: 'Productivity', logo_url: 'dropbox.com' },
  { name: 'GitHub Pro', amount: 4.00, category: 'Development', logo_url: 'github.com' },
];

// ============================================================================
// Utility Functions
// ============================================================================

function printHeader(text: string) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(text, 'cyan');
  log('='.repeat(60), 'cyan');
}

async function confirmAction(message: string): Promise<boolean> {
  const answer = await question(`${message} (y/n): `);
  return answer.toLowerCase() === 'y';
}

// ============================================================================
// Seeding Functions
// ============================================================================

async function createTestUser(testUser: TestUser): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
    });
    
    if (error) {
      if (error.message.includes('already registered')) {
        log(`  ⚠️  User already exists: ${testUser.email}`, 'yellow');
        return null;
      }
      throw error;
    }
    
    if (!data.user) {
      throw new Error('User creation failed');
    }
    
    log(`  ✅ Created: ${testUser.email}`, 'green');
    return data.user.id;
  } catch (error) {
    log(`  ❌ Failed: ${testUser.email} - ${error instanceof Error ? error.message : 'Unknown'}`, 'red');
    return null;
  }
}

async function upgradeToPremium(userId: string, billingCycle: 'monthly' | 'annual') {
  try {
    const periodStart = new Date();
    const periodEnd = new Date();
    
    if (billingCycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }
    
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        tier_id: 'premium',
        billing_cycle: billingCycle,
        status: 'active',
        stripe_customer_id: `cus_test_${userId.substring(0, 14)}`,
        stripe_subscription_id: `sub_test_${userId.substring(0, 14)}`,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq('user_id', userId);
    
    if (error) throw error;
    
    log(`    → Upgraded to Premium (${billingCycle})`, 'green');
  } catch (error) {
    log(`    → Failed to upgrade: ${error instanceof Error ? error.message : 'Unknown'}`, 'red');
  }
}

async function addSubscriptionsForUser(userId: string, count: number) {
  if (count === 0) return;
  
  try {
    const subscriptions = [];
    
    for (let i = 0; i < count; i++) {
      const sample = sampleSubscriptions[i % sampleSubscriptions.length];
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + (i * 3)); // Stagger renewal dates
      
      subscriptions.push({
        user_id: userId,
        name: sample.name,
        amount: sample.amount,
        billing_cycle: i % 2 === 0 ? 'monthly' : 'annual',
        renewal_date: renewalDate.toISOString(),
        category: sample.category,
        logo_url: sample.logo_url,
        is_active: true,
        notes: `Test subscription ${i + 1}`,
      });
    }
    
    const { error } = await supabase
      .from('recurring_items')
      .insert(subscriptions);
    
    if (error) throw error;
    
    log(`    → Added ${count} subscriptions`, 'green');
  } catch (error) {
    log(`    → Failed to add subscriptions: ${error instanceof Error ? error.message : 'Unknown'}`, 'red');
  }
}

async function addTestTransaction(userId: string) {
  try {
    const { data: userSub } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (!userSub) return;
    
    const { error } = await supabase
      .from('payment_transactions')
      .insert({
        user_subscription_id: userSub.id,
        stripe_payment_intent_id: `pi_test_${userId.substring(0, 20)}`,
        stripe_charge_id: `ch_test_${userId.substring(0, 20)}`,
        amount: 4.99,
        currency: 'usd',
        status: 'succeeded',
        payment_method_type: 'card',
        description: 'Test payment transaction',
      });
    
    if (error) throw error;
    
    log(`    → Added test transaction`, 'green');
  } catch (error) {
    log(`    → Failed to add transaction: ${error instanceof Error ? error.message : 'Unknown'}`, 'red');
  }
}

async function addAnalyticsEvents(userId: string) {
  try {
    const events = [
      { event_type: 'limit_reached', event_context: 'add_subscription' },
      { event_type: 'paywall_viewed', event_context: 'subscription_limit' },
      { event_type: 'plan_selected', event_context: 'monthly_plan' },
      { event_type: 'payment_initiated', event_context: 'stripe_checkout' },
      { event_type: 'payment_completed', event_context: 'successful_payment' },
    ];
    
    const analyticsData = events.map(event => ({
      user_id: userId,
      event_type: event.event_type,
      event_context: event.event_context,
      event_data: { test: true, seeded: true },
    }));
    
    const { error } = await supabase
      .from('usage_tracking_events')
      .insert(analyticsData);
    
    if (error) throw error;
    
    log(`    → Added ${events.length} analytics events`, 'green');
  } catch (error) {
    log(`    → Failed to add analytics: ${error instanceof Error ? error.message : 'Unknown'}`, 'red');
  }
}

// ============================================================================
// Main Seeding Logic
// ============================================================================

async function seedTestData() {
  printHeader('Test Data Seeding Script');
  
  log('\nThis script will create test users and data for development.', 'yellow');
  log('WARNING: Only run in development or staging environments!', 'red');
  
  // Verify environment
  if (!supabaseUrl || !supabaseKey) {
    log('\n❌ Missing Supabase environment variables', 'red');
    process.exit(1);
  }
  
  log(`\nConnected to: ${supabaseUrl}`, 'blue');
  
  const confirmed = await confirmAction('\nContinue with seeding?');
  if (!confirmed) {
    log('Seeding cancelled.', 'yellow');
    process.exit(0);
  }
  
  // Seed test users
  printHeader('Creating Test Users');
  
  log('\nTest users to create:', 'cyan');
  testUsers.forEach((user, index) => {
    log(`  ${index + 1}. ${user.email}`, 'reset');
    log(`     ${user.description}`, 'blue');
  });
  
  log('');
  
  const createdUsers: Array<{ id: string; testUser: TestUser }> = [];
  
  for (const testUser of testUsers) {
    const userId = await createTestUser(testUser);
    
    if (userId) {
      createdUsers.push({ id: userId, testUser });
      
      // Wait a bit for user_subscriptions trigger to create record
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Upgrade to premium if needed
      if (testUser.tier === 'premium') {
        const billingCycle = testUser.email.includes('monthly') ? 'monthly' : 'annual';
        await upgradeToPremium(userId, billingCycle);
      }
      
      // Add subscriptions
      if (testUser.subscriptionCount > 0) {
        await addSubscriptionsForUser(userId, testUser.subscriptionCount);
      }
      
      // Add test transaction for premium users
      if (testUser.tier === 'premium') {
        await addTestTransaction(userId);
      }
      
      // Add analytics events
      await addAnalyticsEvents(userId);
    }
  }
  
  // Summary
  printHeader('Seeding Complete');
  
  log(`\n✅ Successfully created ${createdUsers.length} test users`, 'green');
  
  log('\nTest User Credentials:', 'cyan');
  log('Email: [as shown above]', 'reset');
  log('Password: TestPassword123!', 'reset');
  
  log('\nTest Data Summary:', 'cyan');
  testUsers.forEach(user => {
    log(`  • ${user.email}`, 'blue');
    log(`    ${user.description}`, 'reset');
  });
  
  log('\nNext Steps:', 'yellow');
  log('  1. Log in with any test user email', 'reset');
  log('  2. Test different subscription scenarios', 'reset');
  log('  3. Test payment flows with Stripe test cards', 'reset');
  log('  4. Verify limit enforcement', 'reset');
  
  log('\nCleanup:', 'yellow');
  log('  To remove test data, run:', 'reset');
  log('  npm run cleanup-test-data', 'reset');
  log('  Or manually delete users from Supabase Dashboard', 'reset');
  
  log('\nDocumentation:', 'blue');
  log('  • Integration Testing Guide: docs/INTEGRATION_TESTING_GUIDE.md', 'reset');
  log('  • Paywall Setup Guide: docs/PAYWALL_SETUP_GUIDE.md', 'reset');
}

// ============================================================================
// Cleanup Function
// ============================================================================

async function cleanupTestData() {
  printHeader('Cleanup Test Data');
  
  log('\nThis will delete all test users and their data.', 'yellow');
  log('WARNING: This action cannot be undone!', 'red');
  
  const confirmed = await confirmAction('\nAre you sure you want to delete all test data?');
  if (!confirmed) {
    log('Cleanup cancelled.', 'yellow');
    process.exit(0);
  }
  
  try {
    // Get all test user IDs
    const testEmails = testUsers.map(u => u.email);
    
    log('\nDeleting test data...', 'cyan');
    
    // Note: We can't delete auth.users via client SDK
    // But we can delete their related data
    
    let deletedCount = 0;
    
    for (const email of testEmails) {
      try {
        // This would require getting user ID first, which requires auth
        // In practice, this cleanup would be done via Supabase Dashboard
        // or using the admin SDK
        log(`  → ${email}: Use Supabase Dashboard to delete`, 'yellow');
      } catch (error) {
        log(`  ❌ Failed to delete ${email}`, 'red');
      }
    }
    
    log('\n⚠️  Manual cleanup required:', 'yellow');
    log('  1. Go to Supabase Dashboard → Authentication → Users', 'reset');
    log('  2. Search for "test-" email addresses', 'reset');
    log('  3. Delete each test user', 'reset');
    log('  4. Related data will be cascade-deleted', 'reset');
    
  } catch (error) {
    log(`\n❌ Cleanup failed: ${error instanceof Error ? error.message : 'Unknown'}`, 'red');
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isCleanup = args.includes('--cleanup') || args.includes('-c');
  
  try {
    if (isCleanup) {
      await cleanupTestData();
    } else {
      await seedTestData();
    }
  } catch (error) {
    log(`\n❌ Fatal error: ${error instanceof Error ? error.message : 'Unknown'}`, 'red');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
main().catch(console.error);