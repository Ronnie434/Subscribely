/**
 * Send Deletion Email Edge Function
 *
 * Sends account deletion confirmation email via Brevo
 *
 * Request Body:
 * {
 *   "email": string,
 *   "firstName": string,
 *   "deletedAt": string (ISO date),
 *   "gracePeriodEnds": string (ISO date)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "messageId": "abc123..."
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/stripe.ts';
import { sendEmail, generateDeletionEmail } from '../_shared/brevo.ts';

interface RequestBody {
  email: string;
  firstName?: string;
  deletedAt?: string;
  gracePeriodEnds?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const {
      email,
      firstName = 'there',
      deletedAt,
      gracePeriodEnds
    }: RequestBody = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email address is required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log(`📧 Sending deletion email to: ${email}`);

    // Format dates for email display
    const deletedAtFormatted = deletedAt
      ? new Date(deletedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

    const gracePeriodEndsFormatted = gracePeriodEnds
      ? new Date(gracePeriodEnds).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

    // Generate email content
    const { html, text } = generateDeletionEmail(
      firstName,
      deletedAtFormatted,
      gracePeriodEndsFormatted
    );

    // Send email via Brevo
    const result = await sendEmail({
      to: [{ email, name: firstName }],
      subject: 'Your Renvo Account Has Been Deleted',
      htmlContent: html,
      textContent: text,
    });

    if (!result.success) {
      console.error('❌ Failed to send deletion email:', result.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || 'Failed to send email',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log(`✅ Deletion email sent successfully to ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error in send-deletion-email function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});