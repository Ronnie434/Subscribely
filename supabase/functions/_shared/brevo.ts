/**
 * Brevo Email Service Helper
 * 
 * Provides utilities for sending transactional emails via Brevo API
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailOptions {
  to: EmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  sender?: EmailRecipient;
}

/**
 * Send email via Brevo API
 * 
 * @param options Email configuration options
 * @returns Promise with send result
 */
export async function sendEmail(options: EmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const brevoApiKey = Deno.env.get('BREVO_API_KEY');
  
  if (!brevoApiKey) {
    console.error('❌ BREVO_API_KEY not configured in environment');
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  const defaultSender = {
    email: 'noreply@therenvo.com',
    name: 'Renvo',
  };

  const payload = {
    sender: options.sender || defaultSender,
    to: options.to,
    subject: options.subject,
    htmlContent: options.htmlContent,
    textContent: options.textContent,
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ Brevo API error:', responseData);
      return {
        success: false,
        error: responseData.message || 'Failed to send email',
      };
    }

    console.log('✅ Email sent successfully:', responseData.messageId);
    return {
      success: true,
      messageId: responseData.messageId,
    };
  } catch (error) {
    console.error('❌ Error sending email via Brevo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate welcome email HTML content (for OAuth users)
 */
export function generateWelcomeEmail(firstName: string): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html lang="en" style="margin:0; padding:0; background:#f5f7fb;">
      <body style="margin:0; padding:0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f5f7fb; color:#111;">
        
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              
              <!-- Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background:#fff; border-radius:14px; padding: 40px; box-shadow: 0 4px 18px rgba(0,0,0,0.06);">
                
                <tr>
                  <td style="font-size:24px; font-weight:600; margin-bottom:20px; color:#111;">
                    Hi ${firstName},
                  </td>
                </tr>

                <tr>
                  <td style="font-size:16px; line-height:1.6; color:#444; padding-top:10px;">
                    Thanks for joining <strong>Renvo</strong>. You just took the first step toward eliminating surprise charges and forgotten subscriptions.
                    We're here to help you stay ahead of your recurring expenses — not react to them.
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 30px;">
                    <h3 style="font-size:18px; margin:0 0 12px 0; color:#111;">What's next?</h3>
                    <ul style="padding-left:20px; margin-top:10px; font-size:16px; color:#444; line-height:1.6;">
                      <li>Start adding your subscriptions, bills, and autopayments.</li>
                      <li>Once you link your accounts, Renvo sends early alerts before charges hit.</li>
                      <li>See a clear forecast of upcoming expenses — no surprises.</li>
                    </ul>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 20px; font-size:16px; color:#444; line-height:1.6;">
                    Your dashboard is ready whenever you are. Start adding your subscriptions to take control of your recurring expenses.
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-top: 40px;">
                    <a href="mailto:support@therenvo.com?subject=Question%20About%20Renvo"
                       style="background:#f0f0f0; color:#007AFF; padding:12px 24px; text-decoration:none;
                              border-radius:8px; font-size:14px; font-weight:600; display:inline-block; border:1px solid #007AFF;">
                      Contact Support
                    </a>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 20px; font-size:14px; color:#666; text-align:center;">
                    Have questions? We're here to help!
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 30px; font-size:16px; color:#111; font-weight:600;">
                    Welcome aboard,<br>
                    The Renvo Team
                  </td>
                </tr>

              </table>

              <!-- Footer -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin-top:20px;">
                <tr>
                  <td style="text-align:center; font-size:12px; color:#777; line-height:1.4;">
                    You're receiving this because you signed up for Renvo.
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

      </body>
    </html>
  `;

  const text = `
Hi ${firstName},

Thanks for joining Renvo. You just took the first step toward eliminating surprise charges and forgotten subscriptions.
We're here to help you stay ahead of your recurring expenses — not react to them.

What's next?
• Start adding your subscriptions, bills, and autopayments.
• Once you link your accounts, Renvo sends early alerts before charges hit.
• See a clear forecast of upcoming expenses — no surprises.

Your dashboard is ready whenever you are. Start adding your subscriptions to take control of your recurring expenses.

Have questions? We're here to help!
Contact us at: support@therenvo.com

Welcome aboard,
The Renvo Team

---
You're receiving this because you signed up for Renvo.
  `.trim();

  return { html, text };
}

/**
 * Generate account deletion email HTML content
 */
export function generateDeletionEmail(firstName: string, deletedAt: string, gracePeriodEnds: string): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html lang="en" style="margin:0; padding:0; background:#f5f7fb;">
      <body style="margin:0; padding:0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f5f7fb; color:#111;">
        
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              
              <!-- Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background:#fff; border-radius:14px; padding: 40px; box-shadow: 0 4px 18px rgba(0,0,0,0.06);">
                
                <tr>
                  <td style="font-size:24px; font-weight:600; margin-bottom:20px; color:#111;">
                    Your Renvo Account Has Been Deleted
                  </td>
                </tr>

                <tr>
                  <td style="font-size:16px; line-height:1.6; color:#444; padding-top:10px;">
                    Hi ${firstName},
                  </td>
                </tr>

                <tr>
                  <td style="font-size:16px; line-height:1.6; color:#444; padding:10px 0px;">
                    We've processed your account deletion request. Your Renvo account has been marked for deletion.
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 30px; padding: 20px; background:#fff3cd; border-radius:8px; margin-top:20px;">
                    <p style="font-size:16px; font-weight:600; color:#856404; margin:0 0 10px 0;">⚠️ 30-Day Grace Period</p>
                    <p style="font-size:14px; color:#856404; margin:0; line-height:1.5;">
                      Your account will be <strong>permanently deleted on ${gracePeriodEnds}</strong>.
                      You have <strong>30 days</strong> to change your mind and recover your account by simply signing back in.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 30px;">
                    <h3 style="font-size:18px; margin:0 0 12px 0; color:#111;">What happens next:</h3>
                    <ul style="padding-left:20px; margin-top:10px; font-size:16px; color:#444; line-height:1.6;">
                      <li>All your subscription data and alerts will stop immediately.</li>
                      <li>You won't receive any more reminders or notifications.</li>
                      <li>After 30 days, all your data will be <strong>permanently deleted</strong>.</li>
                      <li>If you want to return after deletion, you'll need to create a new account from scratch.</li>
                    </ul>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 30px; font-size:16px; color:#444; line-height:1.6;">
                    Changed your mind? Just sign back in within 30 days to restore your account.
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-top: 35px;">
                    <a href="mailto:support@therenvo.com?subject=Feedback%20on%20Account%20Deletion"
                       style="background:#007AFF; color:#fff; padding:14px 28px; text-decoration:none;
                              border-radius:8px; font-size:16px; font-weight:600; display:inline-block;">
                      Contact Support
                    </a>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 30px; font-size:14px; color:#666; line-height:1.6; text-align:center;">
                    If there's a reason you left that you'd like to share, we'd love to hear from you.
                    Your feedback helps us improve.
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 30px; font-size:16px; color:#111; font-weight:600;">
                    Take care,<br>
                    The Renvo Team
                  </td>
                </tr>

              </table>

              <!-- Footer -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin-top:20px;">
                <tr>
                  <td style="text-align:center; font-size:12px; color:#777; line-height:1.4;">
                    This email was sent to confirm your account deletion request.<br>
                    Deletion requested on ${deletedAt}
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

      </body>
    </html>
  `;

  const text = `
Your Renvo Account Has Been Deleted

Hi ${firstName},

We've processed your account deletion request. Your Renvo account has been marked for deletion.

⚠️ 30-DAY GRACE PERIOD
Your account will be permanently deleted on ${gracePeriodEnds}.
You have 30 days to change your mind and recover your account by simply signing back in.

What happens next:
• All your subscription data and alerts will stop immediately.
• You won't receive any more reminders or notifications.
• After 30 days, all your data will be permanently deleted.
• If you want to return after deletion, you'll need to create a new account from scratch.

Changed your mind? Just sign back in within 30 days to restore your account.

If there's a reason you left that you'd like to share, we'd love to hear from you.
Contact us at: support@therenvo.com

Take care,
The Renvo Team

---
This email was sent to confirm your account deletion request.
Deletion requested on ${deletedAt}
  `.trim();

  return { html, text };
}