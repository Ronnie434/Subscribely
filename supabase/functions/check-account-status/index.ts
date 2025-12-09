/**
 * Check Account Status Edge Function
 * 
 * Checks if a user account is marked for deletion by bypassing RLS policies.
 * This is necessary because RLS policies block reading deleted accounts.
 * 
 * Features:
 * - Uses service role to bypass RLS restrictions
 * - Returns deleted_at timestamp if account is marked for deletion
 * - Used during login to detect deleted accounts for recovery flow
 * 
 * Request: No body required (uses auth token)
 * 
 * Response:
 * {
 *   "deleted": boolean,
 *   "deletedAt": string | null,
 *   "email": string
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
    // Initialize Supabase client with service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    // ========================================================================
    // STEP 1: AUTHENTICATE USER
    // ========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[check-account-status] Missing authorization header');
      return errorResponse('Missing authorization header', 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[check-account-status] Authentication failed:', authError);
      return errorResponse('Unauthorized', 401);
    }

    console.log(`[check-account-status] 🔐 Checking account status for user: ${user.id}`);

    // ========================================================================
    // STEP 2: QUERY PROFILE WITH SERVICE ROLE (BYPASSES RLS)
    // ========================================================================
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('deleted_at, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[check-account-status] Failed to query profile:', profileError);
      return errorResponse('Failed to check account status', 500);
    }

    if (!profile) {
      console.error('[check-account-status] Profile not found for user:', user.id);
      return errorResponse('Profile not found', 404);
    }

    const isDeleted = profile.deleted_at !== null;
    
    console.log(`[check-account-status] Account status:`, {
      userId: user.id,
      deleted: isDeleted,
      deletedAt: profile.deleted_at,
    });

    // ========================================================================
    // STEP 3: RETURN ACCOUNT STATUS
    // ========================================================================
    return new Response(
      JSON.stringify({
        deleted: isDeleted,
        deletedAt: profile.deleted_at,
        email: profile.email || user.email,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[check-account-status] ❌ Error checking account status:', error);
    return errorResponse(
      error.message || 'An unexpected error occurred',
      500
    );
  }
});