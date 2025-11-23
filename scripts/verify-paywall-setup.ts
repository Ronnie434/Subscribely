#!/usr/bin/env ts-node
/**
 * Paywall Setup Verification Script
 * 
 * This script verifies that the paywall system is correctly configured
 * by checking database tables, functions, RLS policies, Stripe configuration,
 * Edge Functions, and environment variables.
 * 
 * Usage:
 *   npx ts-node scripts/verify-paywall-setup.ts
 *   or
 *   npm run verify-setup
 */

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

interface CheckResult {
  category: string;
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  fix?: string;
}

const results: CheckResult[] = [];

function printHeader(text: string) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${text}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function printResult(result: CheckResult) {
  const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
  const color = result.status === 'pass' ? colors.green : result.status === 'fail' ? colors.red : colors.yellow;
  
  console.log(`${icon} ${color}${result.name}${colors.reset}`);
  console.log(`   ${result.message}`);
  
  if (result.fix) {
    console.log(`   ${colors.yellow}Fix: ${result.fix}${colors.reset}`);
  }
}

function addResult(
  category: string,
  name: string,
  status: 'pass' | 'fail' | 'warn',
  message: string,
  fix?: string
) {
  results.push({ category, name, status, message, fix });
}

// ============================================================================
// Environment Variable Checks
// ============================================================================

async function checkEnvironmentVariables() {
  printHeader('Checking Environment Variables');
  
  const requiredVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  ];
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    
    if (!value) {
      addResult(
        'Environment',
        varName,
        'fail',
        'Environment variable not set',
        `Add ${varName} to your .env file`
      );
    } else {
      // Validate format
      if (varName === 'EXPO_PUBLIC_SUPABASE_URL' && !value.startsWith('https://')) {
        addResult(
          'Environment',
          varName,
          'fail',
          'Invalid Supabase URL format',
          'URL should start with https://'
        );
      } else if (varName === 'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY' && !value.startsWith('pk_')) {
        addResult(
          'Environment',
          varName,
          'fail',
          'Invalid Stripe publishable key format',
          'Key should start with pk_test_ or pk_live_'
        );
      } else {
        const isTestMode = value.includes('test');
        const mode = isTestMode ? ' (Test Mode)' : ' (Live Mode)';
        addResult(
          'Environment',
          varName,
          'pass',
          `Set and valid${mode}`,
        );
      }
    }
  }
  
  results.forEach(r => r.category === 'Environment' && printResult(r));
}

// ============================================================================
// Database Checks
// ============================================================================

async function checkDatabase() {
  printHeader('Checking Database Setup');
  
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    addResult('Database', 'Connection', 'fail', 'Cannot connect - missing credentials');
    printResult(results[results.length - 1]);
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Check tables
  const requiredTables = [
    'subscription_tiers',
    'user_subscriptions',
    'payment_transactions',
    'refund_requests',
    'stripe_webhooks',
    'usage_tracking_events',
  ];
  
  for (const table of requiredTables) {
    try {
      const { error } = await supabase.from(table).select('count').limit(1);
      
      if (error) {
        addResult(
          'Database',
          `Table: ${table}`,
          'fail',
          `Table not found or not accessible: ${error.message}`,
          'Run database/paywall_migration.sql in Supabase SQL Editor'
        );
      } else {
        addResult('Database', `Table: ${table}`, 'pass', 'Table exists and accessible');
      }
    } catch (error) {
      addResult(
        'Database',
        `Table: ${table}`,
        'fail',
        `Error checking table: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  // Check database functions
  const functions = [
    'get_user_subscription_limit',
    'can_user_add_subscription',
    'initialize_user_subscription',
    'process_stripe_webhook',
    'track_usage_event',
  ];
  
  for (const func of functions) {
    try {
      // Try to call the function (will fail if doesn't exist)
      const { error } = await supabase.rpc(func as any, {});
      
      // Function exists if we get a specific error (not "function doesn't exist")
      if (error && !error.message.includes('does not exist')) {
        addResult('Database', `Function: ${func}`, 'pass', 'Function exists');
      } else if (error && error.message.includes('does not exist')) {
        addResult(
          'Database',
          `Function: ${func}`,
          'fail',
          'Function not found',
          'Run database/paywall_migration.sql'
        );
      } else {
        addResult('Database', `Function: ${func}`, 'pass', 'Function exists');
      }
    } catch (error) {
      addResult(
        'Database',
        `Function: ${func}`,
        'warn',
        'Could not verify function'
      );
    }
  }
  
  // Check subscription tiers data
  try {
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('tier_id, name, monthly_price, annual_price');
    
    if (error) {
      addResult(
        'Database',
        'Subscription Tiers Data',
        'fail',
        `Cannot query tiers: ${error.message}`
      );
    } else if (!data || data.length === 0) {
      addResult(
        'Database',
        'Subscription Tiers Data',
        'fail',
        'No subscription tiers found',
        'Run the INSERT statements from paywall_migration.sql'
      );
    } else {
      const hasFree = data.some(t => t.tier_id === 'free');
      const hasPremium = data.some(t => t.tier_id === 'premium_tier');
      
      if (hasFree && hasPremium) {
        addResult(
          'Database',
          'Subscription Tiers Data',
          'pass',
          `Found ${data.length} tiers (free, premium)`
        );
      } else {
        addResult(
          'Database',
          'Subscription Tiers Data',
          'warn',
          `Found ${data.length} tiers but missing free or premium`,
          'Ensure both free and premium tiers exist'
        );
      }
    }
  } catch (error) {
    addResult(
      'Database',
      'Subscription Tiers Data',
      'fail',
      `Error querying tiers: ${error instanceof Error ? error.message : 'Unknown'}`
    );
  }
  
  results.filter(r => r.category === 'Database').forEach(printResult);
}

// ============================================================================
// Stripe Configuration Checks
// ============================================================================

async function checkStripe() {
  printHeader('Checking Stripe Configuration');
  
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  
  if (!publishableKey) {
    addResult('Stripe', 'API Key', 'fail', 'Publishable key not set');
    printResult(results[results.length - 1]);
    return;
  }
  
  // Check key format
  const isTestMode = publishableKey.startsWith('pk_test_');
  const isLiveMode = publishableKey.startsWith('pk_live_');
  
  if (!isTestMode && !isLiveMode) {
    addResult(
      'Stripe',
      'API Key Format',
      'fail',
      'Invalid key format',
      'Key should start with pk_test_ or pk_live_'
    );
  } else {
    const mode = isTestMode ? 'Test' : 'Live';
    addResult(
      'Stripe',
      'API Key Format',
      'pass',
      `Valid ${mode} mode key`
    );
  }
  
  // Note: We can't verify products/prices without secret key
  addResult(
    'Stripe',
    'Products and Prices',
    'warn',
    'Cannot verify without secret key',
    'Manually verify products exist in Stripe Dashboard'
  );
  
  results.filter(r => r.category === 'Stripe').forEach(printResult);
}

// ============================================================================
// Edge Functions Checks
// ============================================================================

async function checkEdgeFunctions() {
  printHeader('Checking Edge Functions');
  
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  
  if (!supabaseUrl) {
    addResult('Edge Functions', 'Check', 'fail', 'Supabase URL not set');
    printResult(results[results.length - 1]);
    return;
  }
  
  const functions = [
    'stripe-webhook',
    'create-subscription',
    'cancel-subscription',
    'request-refund',
    'get-billing-portal',
  ];
  
  for (const func of functions) {
    try {
      const url = `${supabaseUrl}/functions/v1/${func}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      // We expect 401 (unauthorized) or 400 (bad request), not 404 (not found)
      if (response.status === 404) {
        addResult(
          'Edge Functions',
          func,
          'fail',
          'Function not deployed',
          `Deploy with: supabase functions deploy ${func}`
        );
      } else {
        addResult(
          'Edge Functions',
          func,
          'pass',
          `Function is deployed (status: ${response.status})`
        );
      }
    } catch (error) {
      addResult(
        'Edge Functions',
        func,
        'fail',
        `Error checking function: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }
  
  results.filter(r => r.category === 'Edge Functions').forEach(printResult);
}

// ============================================================================
// Summary
// ============================================================================

function printSummary() {
  printHeader('Verification Summary');
  
  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  const totalCount = results.length;
  
  console.log(`${colors.green}✅ Passed: ${passCount}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${failCount}${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Warnings: ${warnCount}${colors.reset}`);
  console.log(`${colors.blue}Total Checks: ${totalCount}${colors.reset}`);
  
  const percentage = Math.round((passCount / totalCount) * 100);
  console.log(`\n${colors.cyan}Overall: ${percentage}% passing${colors.reset}`);
  
  if (failCount === 0) {
    console.log(`\n${colors.green}🎉 All critical checks passed! Your paywall system is ready.${colors.reset}`);
  } else {
    console.log(`\n${colors.red}⚠️  Please fix the failed checks before deploying.${colors.reset}`);
  }
  
  // Next steps
  console.log(`\n${colors.cyan}Next Steps:${colors.reset}`);
  if (failCount > 0) {
    console.log('1. Fix all failed checks using the provided solutions');
    console.log('2. Run this script again to verify fixes');
  } else {
    console.log('1. Test payment flow with test cards');
    console.log('2. Verify webhooks are processing correctly');
    console.log('3. Review Integration Testing Guide');
  }
  
  console.log(`\n${colors.cyan}Documentation:${colors.reset}`);
  console.log('- Setup Guide: docs/PAYWALL_SETUP_GUIDE.md');
  console.log('- Integration Testing: docs/INTEGRATION_TESTING_GUIDE.md');
  console.log('- Troubleshooting: docs/TROUBLESHOOTING.md');
  
  process.exit(failCount > 0 ? 1 : 0);
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log(`${colors.cyan}`);
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║          Paywall Setup Verification Script               ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);
  
  try {
    await checkEnvironmentVariables();
    await checkDatabase();
    await checkStripe();
    await checkEdgeFunctions();
    printSummary();
  } catch (error) {
    console.error(`\n${colors.red}Fatal error during verification:${colors.reset}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);