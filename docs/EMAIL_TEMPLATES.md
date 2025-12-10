# Email Templates for Renvo

This document contains the email templates for Renvo's transactional emails.

---

## 1. Welcome Email (Supabase Auth Template)

### Configuration Location
Supabase Dashboard → Authentication → Email Templates → **"Confirm signup"**

### Subject Line
```
Welcome to Renvo — Let's Keep Your Money Safe
```

### HTML Template

```html
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
                Hi {{ .Data.name }},
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
              <td align="center" style="padding-top: 35px;">
                <a href="{{ .ConfirmationURL }}"
                   style="background:#007AFF; color:#fff; padding:14px 28px; text-decoration:none;
                          border-radius:8px; font-size:16px; font-weight:600; display:inline-block;">
                  Confirm Your Email
                </a>
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
                If you didn't create a Renvo account, you can safely ignore this email.
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>

  </body>
</html>
```

### Text Version (Fallback)

```
Hi {{ .Data.name }},

Thanks for joining Renvo. You just took the first step toward eliminating surprise charges, forgotten subscriptions, and those "wait… why was my card charged?" moments.

Here's what happens next:
• You can start tracking your subscriptions, bills, and autopayments in Renvo.
• You'll get early alerts before charges happen — not after.
• You'll see a clear forecast of your upcoming expenses so nothing blindsides you.

Your dashboard is ready whenever you are.
To unlock everything Renvo can do, connect your accounts and let the system start analyzing your upcoming charges.

Have questions? Just reply — we actually read every message.

Welcome aboard,
The Renvo Team

Confirm your email address: {{ .ConfirmationURL }}

---
If you didn't create a Renvo account, you can safely ignore this email.
```


## 2. Password Reset Email (Supabase Auth Template)

### Configuration Location
Supabase Dashboard → Authentication → Email Templates → **"Reset password"**

### Subject Line
```
Reset Your Renvo Password
```

### HTML Template

```html
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
                Reset Your Password
              </td>
            </tr>

            <tr>
              <td style="font-size:16px; line-height:1.6; color:#444; padding-top:10px;">
                Hi there,
              </td>
            </tr>

            <tr>
              <td style="font-size:16px; line-height:1.6; color:#444; padding-top:10px;">
                We received a request to reset your password for your Renvo account.
                Click the button below to create a new password.
              </td>
            </tr>

            <tr>
              <td align="center" style="padding-top: 35px;">
                <a href="{{ .ConfirmationURL }}" 
                   style="background:#007AFF; color:#fff; padding:14px 28px; text-decoration:none; 
                          border-radius:8px; font-size:16px; font-weight:600; display:inline-block;">
                  Reset Password
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding-top: 30px; padding: 20px; background:#fff3cd; border-radius:8px; margin-top:20px;">
                <p style="font-size:14px; font-weight:600; color:#856404; margin:0 0 8px 0;">🔒 Security Notice</p>
                <p style="font-size:14px; color:#856404; margin:0; line-height:1.5;">
                  This link will expire in <strong>1 hour</strong>. If you didn't request this password reset, you can safely ignore this email.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding-top: 30px; font-size:14px; color:#666; line-height:1.6;">
                <strong>Trouble clicking the button?</strong><br>
                Copy and paste this URL into your browser:<br>
                <span style="color:#007AFF; word-break: break-all;">{{ .ConfirmationURL }}</span>
              </td>
            </tr>

            <tr>
              <td style="padding-top: 30px; font-size:16px; color:#111; font-weight:600;">
                Stay secure,<br>
                The Renvo Team
              </td>
            </tr>

          </table>

          <!-- Footer -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin-top:20px;">
            <tr>
              <td style="text-align:center; font-size:12px; color:#777; line-height:1.4;">
                If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top: 15px;">
                <a href="mailto:support@therenvo.com" style="color:#007AFF; font-size:12px; text-decoration:none;">
                  Contact Support
                </a>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>

  </body>
</html>
```

### Text Version (Fallback)

```
Reset Your Password

Hi there,

We received a request to reset your password for your Renvo account.
Click the link below to create a new password:

{{ .ConfirmationURL }}

🔒 SECURITY NOTICE
This link will expire in 1 hour. If you didn't request this password reset, you can safely ignore this email.

If you're having trouble with the link, copy and paste the full URL into your browser.

If you didn't request this reset, please contact us at support@therenvo.com

Stay secure,
The Renvo Team

---
If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
```

---

---

## 2. Account Deletion Email (Brevo via Edge Function)

### Configuration Location
Implemented in: `supabase/functions/_shared/brevo.ts`
Function: `generateDeletionEmail()`

### Subject Line
```
Your Renvo Account Has Been Deleted
```

### Email Content
The deletion email is automatically generated using the `generateDeletionEmail()` function with:
- Personalized greeting using user's first name
- Confirmation of account deletion
- List of what this means for the user
- Invitation for feedback
- Professional styling with Renvo branding

**Implementation:** See [`supabase/functions/_shared/brevo.ts`](supabase/functions/_shared/brevo.ts:93) for the full template.

---

## 3. Available Template Variables

### Supabase Auth Templates
These variables are available in Supabase Auth email templates:

- `{{ .Email }}` - User's email address
- `{{ .ConfirmationURL }}` - Email confirmation link
- `{{ .Token }}` - Raw confirmation token
- `{{ .TokenHash }}` - Hashed token
- `{{ .SiteURL }}` - Your site URL
- `{{ .Data }}` - Custom user metadata (if provided during signup)
- `{{ .RedirectTo }}` - Redirect URL after confirmation

**Note**: User name is passed in signup metadata and can be accessed via `{{ .Data.name }}`. This is set in [`AuthContext.tsx`](contexts/AuthContext.tsx:410) during signup.

### Custom Templates (Brevo)
Variables are passed directly to the template function:

- `firstName` - User's first name
- `email` - User's email address
- `deletedAt` - Deletion timestamp (if applicable)

---

## 4. Email Styling Guidelines

### Colors
- **Primary Blue**: `#007AFF` (buttons, headers)
- **Text**: `#333333` (main text)
- **Gray**: `#666666` (secondary text)
- **Border**: `#e0e0e0` (dividers)
- **Background**: `#f5f5f5` (page background)

### Typography
- **Font Family**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
- **Line Height**: `1.6` (body text)
- **Headings**: Bold, larger size

### Layout
- **Max Width**: `600px` (optimal for email clients)
- **Padding**: `40px` (content container)
- **Border Radius**: `8px` (rounded corners)
- **Box Shadow**: `0 2px 4px rgba(0, 0, 0, 0.1)`

---

## 5. Testing Emails

### Test Welcome Email
1. Create a test user account through the app
2. Check email inbox (including spam folder)
3. Verify:
   - Subject line is correct
   - Content displays properly
   - Links work correctly
   - Styling is intact

### Test Deletion Email
1. Delete a test account through the app
2. Check email inbox
3. Verify:
   - Email is received
   - Content is personalized
   - Formatting is correct
   - No broken links or images

### Email Clients to Test
- ✅ Gmail (web)
- ✅ Apple Mail (iOS/macOS)
- ✅ Outlook (web/desktop)
- ✅ Yahoo Mail
- ✅ Mobile devices

---

## 6. Best Practices

### Subject Lines
- Keep under 50 characters
- Be clear and specific
- No spam trigger words
- Use sentence case

### Content
- Front-load important information
- Use short paragraphs
- Include clear call-to-action
- Maintain brand voice
- Always include unsubscribe option (for marketing emails)

### Technical
- Use inline CSS (better email client support)
- Provide text fallback
- Test across email clients
- Monitor deliverability
- Keep HTML simple

---

## 7. Email Deliverability

### SPF Record
Already configured via Brevo:
```
v=spf1 include:spf.brevo.com ~all
```

### DKIM
Configured automatically by Brevo when domain is verified.

### DMARC (Optional)
For enhanced security:
```
v=DMARC1; p=none; rua=mailto:dmarc@renvo.app
```

---

## 8. Monitoring & Analytics

### Brevo Dashboard
Track these metrics:
- **Sent**: Total emails sent
- **Delivered**: Successfully delivered emails
- **Opens**: Email open rate
- **Clicks**: Link click rate
- **Bounces**: Failed deliveries
- **Spam reports**: Users marking as spam

### Supabase Logs
Monitor Edge Function execution:
- Email sending success/failure
- API response times
- Error rates

---

## 9. Troubleshooting

### Emails Not Arriving
1. Check spam folder
2. Verify email address is correct
3. Check Brevo dashboard for delivery status
4. Review Edge Function logs
5. Verify BREVO_API_KEY is set

### Styling Issues
1. Test in multiple email clients
2. Use inline CSS
3. Avoid advanced CSS features
4. Provide text fallback

### Links Not Working
1. Verify URLs are correct
2. Check for URL encoding issues
3. Test on multiple devices
4. Ensure HTTPS is used

---

## 10. Future Enhancements

### Potential Additions
- [ ] Weekly subscription summary email
- [ ] Upcoming charges reminder (3 days before)
- [ ] Subscription renewal notifications
- [ ] Price increase alerts
- [ ] Feature announcements
- [ ] Re-engagement campaigns

### Email Preferences
Allow users to control:
- Email frequency
- Notification types
- Reminder timing
- Marketing emails (opt-in)

---

**Last Updated**: 2024
**Maintained By**: Renvo Development Team