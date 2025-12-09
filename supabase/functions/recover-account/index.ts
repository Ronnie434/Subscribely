/**
 * Recover Account Edge Function
 * 
 * Allows a user to restore their account within the 30-day grace period
 * 
 * Features:
 * - Validates user is authenticated
 * - Checks if account is marked for deletion
 * - Validates recovery is within 30-day grace period
 * - Restores account by clearing deleted_at timestamp
 * - Updates audit log to track recovery event
 * 
 * Request Body:
 * None required (authenticated user recovers their own account)
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Your account has been successfully recovered.",
 *   "profile": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "created_at": "2024-01-01T00:00:00Z",
 *     "updated_at": "2024-01-01T00:00:00Z"
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
    // Initialize Supabase client with service role for database operations
    const supabase = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    // ========================================================================
    // STEP 1: AUTHENTICATE USER
    // ========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return errorResponse('Missing authorization header', 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return errorResponse('Unauthorized', 401);
    }

    console.log(`🔐 User authenticated: ${user.id}`);

    // ========================================================================
    // STEP 2: CHECK IF ACCOUNT IS MARKED FOR DELETION
    // ========================================================================
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, deleted_at')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Failed to fetch profile:', profileError);
      return errorResponse('Failed to retrieve account information', 500);
    }

    if (!profile) {
      console.error('Profile not found for user:', user.id);
      return errorResponse('Account not found', 404);
    }

    // Check if account is actually marked for deletion
    if (!profile.deleted_at) {
      console.log(`ℹ️ Account is not marked for deletion: ${user.id}`);
      return errorResponse('Account is not marked for deletion', 404);
    }

    console.log(`📅 Account deletion timestamp: ${profile.deleted_at}`);

    // ========================================================================
    // STEP 3: VALIDATE RECOVERY IS WITHIN 30-DAY GRACE PERIOD
    // ========================================================================
    const deletedAt = new Date(profile.deleted_at);
    const now = new Date();
    const gracePeriodEnd = new Date(deletedAt);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

    console.log(`⏰ Current time: ${now.toISOString()}`);
    console.log(`⏳ Grace period ends: ${gracePeriodEnd.toISOString()}`);

    // Check if grace period has expired
    if (now > gracePeriodEnd) {
      console.error('Grace period has expired for user:', user.id);
      return errorResponse(
        'Recovery period has expired. Account will be permanently deleted.',
        400
      );
    }

    const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`✅ Recovery is valid. ${daysRemaining} days remaining in grace period.`);

    // ========================================================================
    // STEP 4: RECOVER THE ACCOUNT
    // ========================================================================
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ deleted_at: null })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to recover account:', updateError);
      return errorResponse('Failed to recover account', 500);
    }

    console.log(`✅ Account recovered successfully: ${user.id}`);

    // ========================================================================
    // STEP 5: UPDATE AUDIT LOG
    // ========================================================================
    // Update the existing deletion log to mark it as recovered
    const { error: logError } = await supabase
      .from('account_deletion_logs')
      .update({
        reason: `Account recovered on ${now.toISOString()}`,
        permanently_deleted_at: null  // Clear this to indicate recovery
      })
      .eq('user_id', user.id)
      .is('permanently_deleted_at', null)  // Only update if not already permanently deleted
      .order('created_at', { ascending: false })
      .limit(1);

    if (logError) {
      console.error('Failed to update recovery log entry:', logError);
      // Continue execution - logging failure shouldn't block recovery
    } else {
      console.log(`✅ Recovery event logged for user: ${user.id}`);
    }

    // ========================================================================
    // STEP 6: FETCH UPDATED PROFILE INFORMATION
    // ========================================================================
    const { data: updatedProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      console.error('Failed to fetch updated profile:', fetchError);
      // Return success anyway since recovery was successful
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Your account has been successfully recovered.',
          profile: {
            id: profile.id,
            email: profile.email,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ========================================================================
    // STEP 7: RETURN SUCCESS RESPONSE
    // ========================================================================
    console.log(`🎉 Account recovery complete for user: ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Your account has been successfully recovered.',
        profile: {
          id: updatedProfile.id,
          email: updatedProfile.email,
          created_at: updatedProfile.created_at,
          updated_at: updatedProfile.updated_at,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error recovering account:', error);
    return errorResponse(
      error.message || 'An unexpected error occurred',
      500
    );
  }
});