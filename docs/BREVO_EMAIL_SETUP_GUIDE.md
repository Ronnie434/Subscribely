# Brevo Email Setup Guide for Renvo

This guide will help you configure Brevo for sending transactional emails (welcome and account deletion emails) in your Renvo app.

---

## Step 1: Get Your Brevo API Key

### 1.1 Log into Brevo
1. Go to [https://app.brevo.com](https://app.brevo.com)
2. Log in with your Brevo account credentials

### 1.2 Navigate to API Settings
1. Click on your **profile icon** in the top-right corner
2. Select **"SMTP & API"** from the dropdown menu
3. Or directly navigate to: [https://app.brevo.com/settings/keys/api](https://app.brevo.com/settings/keys/api)

### 1.3 Create or Copy API Key
1. If you already have an API key:
   - Click the **"eye" icon** to reveal it
   - Click **"Copy"** to copy it to clipboard
   
2. If you need to create a new API key:
   - Click **"Generate a new API key"**
   - Give it a name like "Renvo Production"
   - Click **"Generate"**
   - **IMPORTANT**: Copy the key immediately - you won't be able to see it again!

**Your API key should look like:**
```
xkeysib-abc123def456...
```

---

## Step 2: Verify Your Sending Domain (Optional but Recommended)

### 2.1 Add Your Domain
1. Go to **"Senders & IP"** → **"Domains"**
2. Click **"Add a domain"**
3. Enter your domain: `renvo.app`
4. Follow the instructions to add DNS records

### 2.2 DNS Configuration
Add these DNS records to your domain registrar:

**SPF Record:**
```
Type: TXT
Name: @
Value: v=spf1 include:spf.brevo.com ~all
```

**DKIM Record:**
```
Type: TXT
Name: mail._domainkey
Value: (provided by Brevo)
```

### 2.3 Verification
- Wait 24-48 hours for DNS propagation
- Brevo will automatically verify your domain
- You'll receive confirmation email when verified

**Note**: Until domain is verified, you can use:
- **From Email**: `noreply@renvo.app` (will show via brevo.com)
- **From Name**: `Renvo`

---

## Step 3: Configure Supabase Edge Functions

### 3.1 Option A: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Visit [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your Renvo project

2. **Navigate to Edge Functions Secrets**
   - Click **"Edge Functions"** in the left sidebar
   - Click **"Manage secrets"** or go to **"Project Settings"** → **"Edge Functions"**

3. **Add BREVO_API_KEY Secret**
   - Click **"Add new secret"**
   - **Name**: `BREVO_API_KEY`
   - **Value**: Paste your Brevo API key (the one you copied earlier)
   - Click **"Add secret"**

4. **Verify Secret is Added**
   - You should see `BREVO_API_KEY` in your secrets list
   - The value will be hidden for security

### 3.2 Option B: Using Supabase CLI

If you prefer using the CLI:

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Set the secret
supabase secrets set BREVO_API_KEY=xkeysib-your-api-key-here

# Verify it was set
supabase secrets list
```

You should see output like:
```
NAME              VALUE (ENCRYPTED)
BREVO_API_KEY     *********************
```

---

## Step 4: Configure Sender Information

### 4.1 Add FROM_EMAIL Secret (Optional)

If you want to use a custom sender email:

**Supabase Dashboard:**
1. Add another secret in Edge Functions
2. **Name**: `FROM_EMAIL`
3. **Value**: `noreply@renvo.app` (or your verified email)

**Supabase CLI:**
```bash
supabase secrets set FROM_EMAIL=noreply@renvo.app
```

### 4.2 Default Sender Configuration

If you don't set `FROM_EMAIL`, the code will use:
- **Email**: `noreply@renvo.app`
- **Name**: `Renvo`

---

## Step 5: Test Email Configuration

### 5.1 Test Brevo API Key

You can test if your API key works using this curl command:

```bash
curl --request GET \
  --url https://api.brevo.com/v3/account \
  --header 'accept: application/json' \
  --header 'api-key: YOUR_BREVO_API_KEY'
```

Expected response:
```json
{
  "email": "your-brevo-account-email@example.com",
  "firstName": "Your Name",
  "lastName": "Last Name",
  ...
}
```

### 5.2 Send Test Email via Brevo

Once configured, you can test from Brevo dashboard:
1. Go to **"Campaigns"** → **"Transactional"** → **"Templates"**
2. Create a test template
3. Send a test email to yourself

---

## Step 6: Configure Supabase Auth Email Templates

### 6.1 Access Email Templates
1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Select the template you want to customize:
   - **Confirm signup** (for welcome emails)
   - **Reset password** (already configured)
   - **Change email address**
   - **Magic link**

### 6.2 Update Welcome Email Template

1. Click **"Confirm signup"** template
2. Replace the default template with:

**Subject:**
```
Welcome to Renvo — Let's Keep Your Money Safe
```

**Body (HTML):**
```html
<h2>Hi {{ .Name }},</h2>

<p>Thanks for joining Renvo. You just took the first step toward eliminating surprise charges, forgotten subscriptions, and those "wait… why was my card charged?" moments.</p>

<h3>Here's what happens next:</h3>
<ul>
  <li>Renvo will start tracking your subscriptions, bills, and autopayments.</li>
  <li>You'll get early alerts before charges happen — not after.</li>
  <li>You'll see a clear forecast of your upcoming expenses so nothing blindsides you.</li>
</ul>

<p>Your dashboard is ready whenever you are.</p>
<p>If you want your setup to work flawlessly, link your accounts and let Renvo do the heavy lifting.</p>

<p>Have questions? Just reply — we actually read every message.</p>

<p><strong>Welcome aboard,</strong><br>
The Renvo Team</p>

<p><a href="{{ .ConfirmationURL }}">Confirm your email address</a></p>
```

3. Click **"Save"** to update the template

### 6.3 Test Welcome Email
1. Create a new test user account through your app
2. Check the email inbox
3. Verify the email content matches your template

---

## Step 7: Brevo Email Limits & Pricing

### Free Plan
- **300 emails/day**
- **Unlimited contacts**
- **Email support**

Perfect for:
- Development and testing
- Small user base
- Initial launch

### Starter Plan ($25/month)
- **20,000 emails/month**
- **Unlimited daily sending**
- **No Brevo logo**
- **Email support**

### Business Plan ($65/month)
- **40,000 emails/month**
- **Advanced features**
- **Phone support**

**Recommendation for Renvo:**
- Start with **Free plan** for development
- Upgrade to **Starter** when you hit 300 emails/day
- Monitor usage in Brevo dashboard

---

## Troubleshooting

### Issue: "Invalid API Key" Error

**Causes:**
- Incorrect API key copied
- API key not yet propagated to Edge Functions
- API key was regenerated/deleted in Brevo

**Solutions:**
1. Verify API key in Brevo dashboard
2. Check Edge Functions secrets in Supabase
3. Regenerate API key if needed and update secret
4. Redeploy Edge Functions after updating secret

### Issue: Emails Not Sending

**Checks:**
1. Verify `BREVO_API_KEY` is set in Supabase secrets
2. Check Brevo account is active (not suspended)
3. Verify you haven't hit daily limit (300 on free plan)
4. Check Brevo logs: [https://app.brevo.com/log](https://app.brevo.com/log)
5. Check Edge Function logs in Supabase

### Issue: Emails Going to Spam

**Solutions:**
1. Verify your sending domain (SPF/DKIM records)
2. Use a proper "From" name and email
3. Add unsubscribe link (for bulk emails)
4. Warm up your sending domain gradually
5. Avoid spam trigger words in subject/body

### Issue: Domain Not Verifying

**Common Problems:**
1. DNS records not propagated (wait 24-48 hours)
2. Incorrect DNS record values
3. DNS record on wrong subdomain

**Steps:**
1. Double-check DNS records in your registrar
2. Use DNS checker: [https://mxtoolbox.com](https://mxtoolbox.com)
3. Wait for propagation (can take up to 48 hours)
4. Contact Brevo support if still failing

---

## Monitoring & Analytics

### Brevo Dashboard
- **Statistics**: Track sent, delivered, opened, clicked
- **Logs**: View all email activity and errors
- **API usage**: Monitor your API request count

### Supabase Logs
- Check Edge Function logs for email sending errors
- Monitor function execution times
- Track success/failure rates

---

## Security Best Practices

1. **Never commit API keys to code**
   - Always use environment variables
   - Keep keys in Supabase secrets

2. **Rotate API keys periodically**
   - Generate new key every 6-12 months
   - Update Supabase secret immediately

3. **Monitor email sending**
   - Set up alerts for unusual activity
   - Review logs regularly

4. **Rate limiting**
   - Implement rate limiting in Edge Functions
   - Prevent abuse/spam

---

## Next Steps

After completing this setup:

1. ✅ **Brevo API key configured** in Supabase
2. ✅ **Sender domain verified** (optional but recommended)
3. ✅ **Welcome email template** updated in Supabase Auth
4. ✅ Ready to proceed with email functionality implementation

Now you're ready to implement the email sending functions!

---

## Support Resources

- **Brevo Documentation**: [https://developers.brevo.com](https://developers.brevo.com)
- **Brevo Support**: [https://help.brevo.com](https://help.brevo.com)
- **Supabase Edge Functions**: [https://supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)
- **Supabase Auth Templates**: [https://supabase.com/docs/guides/auth/auth-email-templates](https://supabase.com/docs/guides/auth/auth-email-templates)

---

**Created**: 2024
**Last Updated**: 2024
**Version**: 1.0