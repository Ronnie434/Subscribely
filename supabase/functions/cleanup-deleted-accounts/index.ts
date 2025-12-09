/**
 * Cleanup Deleted Accounts Edge Function
 * 
 * Permanently deletes user accounts after the 30-day grace period expires
 * 
 * Features:
 * - Scheduled job (called by Supabase cron)
 * - Secret key authentication for security
 * - Finds accounts marked for deletion over 30 days ago
 * - Permanently deletes all user data (subscriptions, profile, auth)
 * - Updates audit logs with permanent deletion timestamp
 * - Batch processing with per-account error handling
 * - Dry-run mode for testing without actual deletion
 * 
 * Authentication:
 * - Requires Authorization header with service role key or custom cleanup secret
 * - Use: Authorization: Bearer <SERVICE_ROLE_KEY>
 * 
 * Query Parameters:
 * - dry_run: Set to 'true' to test without actually deleting (optional)
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Cleanup completed",
 *   "summary": {
 *     "accountsFound": number,
 *     "accountsDeleted": number,
 *     "accountsFailed": number,
 *     "errors": Array<{ userId: string, error: string }>
 *   }
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  corsHeaders,
  errorResponse,
} from '../_shared/stripe.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for admin operations
    const supabase = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    // ========================================================================
    // STEP 1: AUTHENTICATE REQUEST
    // ========================================================================
    // This is a scheduled job - verify it's called with service role key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Missing authorization header');
      return errorResponse('Unauthorized: Missing authorization header', 401);
    }

    // Extract the token from Bearer auth
    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
    const cleanupSecret = Deno.env.get('CLEANUP_SECRET_KEY') ?? '';

    // Verify the token matches either the service role key or cleanup secret
    if (token !== serviceRoleKey && token !== cleanupSecret) {
      console.error('❌ Invalid authorization token');
      return errorResponse('Unauthorized: Invalid authorization token', 401);
    }

    console.log('🔐 Authorization verified for cleanup job');

    // ========================================================================
    // STEP 2: CHECK FOR DRY RUN MODE
    // ========================================================================
    const url = new URL(req.url);
    const isDryRun = url.searchParams.get('dry_run') === 'true';
    
    if (isDryRun) {
      console.log('🧪 DRY RUN MODE: No actual deletions will be performed');
    }

    // ========================================================================
    // STEP 3: FIND ACCOUNTS TO DELETE
    // ========================================================================
    // Find profiles where deleted_at is set and older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    console.log(`🔍 Searching for accounts marked for deletion before: ${thirtyDaysAgoISO}`);

    const { data: accountsToDelete, error: queryError } = await supabase
      .from('profiles')
      .select('id, email, deleted_at')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', thirtyDaysAgoISO);

    if (queryError) {
      console.error('❌ Failed to query profiles:', queryError);
      return errorResponse('Failed to query accounts for deletion', 500);
    }

    const accountsFound = accountsToDelete?.length ?? 0;
    console.log(`📊 Found ${accountsFound} account(s) to delete`);

    // If no accounts to delete, return early
    if (accountsFound === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No accounts found for deletion',
          summary: {
            accountsFound: 0,
            accountsDeleted: 0,
            accountsFailed: 0,
            errors: [],
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ========================================================================
    // STEP 4: PROCESS EACH ACCOUNT FOR DELETION
    // ========================================================================
    let accountsDeleted = 0;
    let accountsFailed = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const account of accountsToDelete) {
      const userId = account.id;
      const userEmail = account.email || 'unknown';
      
      console.log(`\n🗑️  Processing account: ${userId} (${userEmail})`);
      console.log(`   Deleted at: ${account.deleted_at}`);

      try {
        if (isDryRun) {
          console.log(`   ✅ [DRY RUN] Would delete account: ${userId}`);
          accountsDeleted++;
          continue;
        }

        // ====================================================================
        // STEP 4.1: DELETE ALL SUBSCRIPTIONS DATA
        // ====================================================================
        console.log(`   🔄 Deleting subscriptions for user: ${userId}`);
        
        const { error: subscriptionsError } = await supabase
          .from('subscriptions')
          .delete()
          .eq('user_id', userId);

        if (subscriptionsError) {
          console.error(`   ⚠️  Failed to delete subscriptions:`, subscriptionsError);
          // Continue anyway - we want to delete the account even if subscriptions fail
        } else {
          console.log(`   ✅ Subscriptions deleted`);
        }

        // ====================================================================
        // STEP 4.2: UPDATE AUDIT LOG BEFORE PROFILE DELETION
        // ====================================================================
        console.log(`   🔄 Updating account_deletion_logs for user: ${userId}`);
        
        const { error: logError } = await supabase
          .from('account_deletion_logs')
          .update({ permanently_deleted_at: new Date().toISOString() })
          .eq('user_id', userId)
          .is('permanently_deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1);

        if (logError) {
          console.error(`   ⚠️  Failed to update deletion log:`, logError);
          // Continue anyway - logging is important but not critical
        } else {
          console.log(`   ✅ Deletion log updated`);
        }

        // ====================================================================
        // STEP 4.3: DELETE PROFILE
        // ====================================================================
        console.log(`   🔄 Deleting profile for user: ${userId}`);
        
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);

        if (profileError) {
          throw new Error(`Failed to delete profile: ${profileError.message}`);
        }
        
        console.log(`   ✅ Profile deleted`);

        // ====================================================================
        // STEP 4.4: DELETE USER FROM AUTH.USERS
        // ====================================================================
        // This should cascade to other tables via foreign keys
        console.log(`   🔄 Deleting user from auth.users: ${userId}`);
        
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);

        if (authError) {
          throw new Error(`Failed to delete auth user: ${authError.message}`);
        }
        
        console.log(`   ✅ Auth user deleted (cascaded to related tables)`);

        // Successfully deleted
        accountsDeleted++;
        console.log(`   🎉 Account permanently deleted: ${userId}`);

      } catch (error) {
        // Log error and continue with next account
        accountsFailed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Failed to delete account ${userId}:`, errorMessage);
        
        errors.push({
          userId,
          error: errorMessage,
        });
      }
    }

    // ========================================================================
    // STEP 5: RETURN SUMMARY
    // ========================================================================
    const summary = {
      accountsFound,
      accountsDeleted,
      accountsFailed,
      errors,
    };

    console.log('\n📊 Cleanup Summary:');
    console.log(`   Found: ${accountsFound}`);
    console.log(`   Deleted: ${accountsDeleted}`);
    console.log(`   Failed: ${accountsFailed}`);
    
    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach(({ userId, error }) => {
        console.log(`   - ${userId}: ${error}`);
      });
    }

    const message = isDryRun 
      ? `Dry run completed - no actual deletions performed`
      : `Cleanup completed successfully`;

    return new Response(
      JSON.stringify({
        success: true,
        message,
        summary,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error in cleanup job:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
});