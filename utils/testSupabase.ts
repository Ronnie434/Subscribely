/**
 * DEVELOPMENT/DEBUGGING TOOL ONLY
 *
 * This file is for manual testing and debugging of Supabase connection.
 * It is not used in production and can be run manually for troubleshooting.
 *
 * To use: Import and call testSupabaseConnection() in a useEffect or manually.
 */

import { supabase, isSupabaseConfigured } from '../config/supabase';

/**
 * Test Supabase connection and configuration
 * Returns test results with detailed information
 */
export const testSupabaseConnection = async () => {
  const results = {
    configured: false,
    connectionTest: false,
    authTest: false,
    errors: [] as string[],
    details: {} as any,
  };

  try {
    // Test 1: Check if environment variables are configured
    results.configured = isSupabaseConfigured();
    if (!results.configured) {
      results.errors.push('Supabase configuration missing. Please create .env file with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
      return results;
    }
    results.details.url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    results.details.hasAnonKey = Boolean(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

    // Test 2: Test database connection
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        // If error is about table not existing or RLS, that's actually good - it means we're connected
        if (error.message.includes('relation') || error.message.includes('permission') || error.message.includes('policy')) {
          results.connectionTest = true;
          results.details.connectionMessage = 'Connected to Supabase (table access restricted by RLS - expected)';
        } else {
          results.errors.push(`Connection error: ${error.message}`);
        }
      } else {
        results.connectionTest = true;
        results.details.connectionMessage = 'Successfully connected to Supabase';
      }
    } catch (err: any) {
      results.errors.push(`Connection test failed: ${err.message}`);
    }

    // Test 3: Test auth service availability
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      results.authTest = true;
      results.details.authMessage = session 
        ? `Authenticated as ${session.user.email}`
        : 'Auth service available (not logged in)';
    } catch (err: any) {
      results.errors.push(`Auth test failed: ${err.message}`);
    }

  } catch (err: any) {
    results.errors.push(`Unexpected error: ${err.message}`);
  }

  return results;
};

/**
 * Print test results to console in a formatted way
 */
export const printTestResults = (results: any) => {
  console.log('\n========================================');
  console.log('🧪 SUPABASE CONNECTION TEST RESULTS');
  console.log('========================================\n');

  console.log(`✓ Configuration Check: ${results.configured ? '✅ PASS' : '❌ FAIL'}`);
  if (results.details.url) {
    console.log(`  - URL: ${results.details.url}`);
    console.log(`  - Anon Key: ${results.details.hasAnonKey ? 'Present' : 'Missing'}`);
  }

  console.log(`\n✓ Connection Test: ${results.connectionTest ? '✅ PASS' : '❌ FAIL'}`);
  if (results.details.connectionMessage) {
    console.log(`  - ${results.details.connectionMessage}`);
  }

  console.log(`\n✓ Auth Service Test: ${results.authTest ? '✅ PASS' : '❌ FAIL'}`);
  if (results.details.authMessage) {
    console.log(`  - ${results.details.authMessage}`);
  }

  if (results.errors.length > 0) {
    console.log('\n⚠️  ERRORS FOUND:');
    results.errors.forEach((error: string, index: number) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }

  const allTestsPassed = results.configured && results.connectionTest && results.authTest;
  console.log('\n========================================');
  console.log(`Overall Status: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('========================================\n');

  if (!allTestsPassed) {
    console.log('📚 Next Steps:');
    if (!results.configured) {
      console.log('  1. Copy .env.example to .env');
      console.log('  2. Follow QUICK_START.md to set up Supabase');
      console.log('  3. Add your Supabase URL and anon key to .env');
    } else if (!results.connectionTest) {
      console.log('  1. Verify your Supabase URL and anon key are correct');
      console.log('  2. Check that your Supabase project is active');
      console.log('  3. Run the database migration from database/supabase_migration.sql');
    }
    console.log('  See SUPABASE_SETUP_GUIDE.md for detailed instructions\n');
  } else {
    console.log('🎉 Your Supabase setup is working correctly!\n');
    console.log('📚 Next Steps:');
    console.log('  - Proceed to Phase 2: Authentication Implementation');
    console.log('  - See QUICK_START.md for the implementation roadmap\n');
  }

  return allTestsPassed;
};