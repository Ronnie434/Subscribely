
# Renvo — Email-to-Subscription Auto-Add Feature
**Purpose:** Provide a privacy-friendly, low-cost way for users to forward subscription emails to a unique app email address. Renvo will parse those emails with an AI parser, map them to the correct user, and auto-add or suggest subscription entries in the user's account (Supabase).

---

## Table of Contents
1. Overview
2. User Flow
3. Architecture Diagram (text)
4. Supabase Schema Changes
5. Email Ingestion (Forwarding) Setup
6. Supabase Edge Function: webhook handler (code)
7. AI Parsing Layer
   - Prompt templates
   - Example parser function (Node.js)
   - Local Ollama vs OpenRouter tradeoffs
8. Duplicate Detection & Matching Logic
9. Notification Flow
10. Security & Anti-Abuse
11. Data Retention & Privacy
12. Monitoring & Logging
13. Cost Estimates
14. Testing Checklist
15. Rollout & Phased Roadmap
16. Appendix: Example Email JSON & Sample AI Responses

---

## 1. Overview
Users forward subscription receipts or confirmation emails to a unique forwarding address (e.g., `ronak@subs.renvo.ai`) or a shared inbox (`subscriptions@renvo.ai`). The system receives the email via webhook, maps the sender to a user account, sends the email body to an AI parser which extracts structured fields (vendor, amount, currency, billing date, frequency, subscription id if found), and then inserts or updates the subscription row in Supabase. Optionally, notify user and ask for confirmation for ambiguous cases.

---

## 2. User Flow
1. User signs up and is shown a **unique forwarding alias** (recommended) or a shared inbox.
2. User forwards the subscription email to that alias.
3. Mail forwarding provider posts the email content to `/api/email/ingest`.
4. Edge function:
   - Validates request (signature / headers).
   - Matches `from` (sender) or `envelope.from` with user or alias.
   - Submits plaintext content to AI parser.
   - Receives structured JSON and validates fields.
   - Inserts/updates `subscriptions` table.
   - Sends push notification or in-app notification.
5. User reviews the new subscription in the app. For ambiguous cases, mark as "pending" until user confirms.

---

## 3. Architecture Diagram (text)
```
User's Email Client
   └─ forwards → subs@renvo.ai (or user-specific alias)
        └─ ForwardEmail / Resend / Mailgun (webhook) →
           Supabase Edge Function (POST /email/ingest)
             ├─ Validate & Map → Supabase (users table)
             ├─ Queue or Call AI Parser (Ollama local / OpenRouter)
             ├─ Parse result → Insert/Update subscriptions table
             └─ Notify user (Expo / FCM)
```

---

## 4. Supabase Schema Changes

### Tables
**users** (existing)
```sql
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  forwarding_alias text UNIQUE, -- optional: unique alias per user e.g. ronak+abc@subs.renvo.ai
  device_token text, -- for push notifications
  created_at timestamptz DEFAULT now()
);
```

**email_ingest_queue** (optional; helps retry and auditing)
```sql
CREATE TABLE IF NOT EXISTS email_ingest_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  raw_email jsonb,
  status text DEFAULT 'pending', -- pending | processing | done | failed
  attempts int DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);
```

**subscriptions** (core)
```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  vendor text,
  vendor_normalized text, -- normalized vendor name
  amount numeric(12,2),
  currency text,
  billing_date date, -- next expected billing date (nullable)
  frequency text, -- monthly | yearly | weekly | unknown
  source text, -- e.g. 'email_forward'
  raw_source jsonb, -- minimal raw metadata (do NOT store whole email body unless necessary)
  confidence numeric DEFAULT 0, -- parser confidence 0..1
  status text DEFAULT 'active', -- active | pending | cancelled
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

Add indexes for quick lookups:
```sql
CREATE INDEX idx_subs_user_vendor ON subscriptions(user_id, vendor_normalized);
```

---

## 5. Email Ingestion (Forwarding) Setup

### Provider Options (cost-conscious)
- **ForwardEmail.net** (free tier / donation): simple, supports webhooks, custom domain aliases.
- **Resend** (cheap, pay-per-email): reliable webhook and attachments, predictable billing.
- **Mailgun / AWS SES** (more configuration, more ops).

**Recommendation:** Start with ForwardEmail.net (or Resend if you want stable SLA). Use custom alias per user to avoid spoofing:
- Generate alias: `user+<randomtoken>@subs.renvo.ai` or `randomtoken@subs.renvo.ai`.
- Show the alias to user inside app with copy button and small instructions.

**DNS / Domain Setup**
- Create a subdomain like `subs.renvo.ai`.
- Configure MX records to the chosen provider (ForwardEmail or Resend docs).
- Configure SPF/DKIM if supported to improve deliverability and verify metadata.

**Webhook Configuration**
- Configure provider to POST incoming email payload to: `https://api.renvo.app/email/ingest` (use Supabase Edge Function URL).
- Ensure you enable signing headers (if supported) or include a secret to verify requests.

---

## 6. Supabase Edge Function: webhook handler (code)

Below is a Node.js/TypeScript style example you can adapt to Supabase Edge Functions.

```js
// supabase/functions/email_ingest/index.ts
import { serve } from "std/server";
import fetch from "node-fetch"; // or global fetch if supported

serve(async (req) => {
  try {
    const body = await req.json(); // depends on provider payload format
    // Example fields: from, subject, text, html, envelope, headers
    const from = (body.from || body.envelope?.from || "").toLowerCase();
    const text = body.text || body["body-plain"] || body.html || "";

    // Basic abuse check
    if (!from || !text) return new Response("bad request", { status: 400 });

    // Map sender to user:
    const user = await findUserByForwardingAlias(from);
    if (!user) {
      // Optionally store in a temp table for manual review
      await insertToQueue(null, body);
      return new Response("user not found", { status: 200 });
    }

    // Insert to ingest queue
    const queueRow = await insertToQueue(user.id, body);

    // Call AI parser asynchronously (fire-and-forget or await)
    // For reliability, you may want to push to a background worker or call directly
    processEmailWithAI(queueRow.id);

    return new Response("ok");
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});

async function findUserByForwardingAlias(fromEmail) {
  // Example: match exact alias or match user's email
  const { data } = await fetch(`${DBASE_URL}/rest/v1/users?forwarding_alias=eq.${encodeURIComponent(fromEmail)}`, {
    headers: { apikey: DBASE_KEY }
  }).then(r => r.json());
  return data?.[0] || null;
}

async function insertToQueue(userId, raw) {
  const payload = { user_id: userId, raw_email: raw };
  const r = await fetch(`${DBASE_URL}/rest/v1/email_ingest_queue`, {
    method: "POST",
    headers: { apikey: DBASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return r.json();
}

async function processEmailWithAI(queueId) {
  // Implement calling LLM parser (Ollama / OpenRouter) and then insert/update subscriptions
  // Keep this implementation resilient and idempotent.
}
```

> Note: Adjust fetch to use Supabase REST or PostgREST endpoints with service role key (store securely in env). For better security use Supabase Admin SDK or Postgres direct connection via pg client inside the function.

---

## 7. AI Parsing Layer

### Fields to extract
- `vendor` (string)
- `amount` (float)
- `currency` (USD / INR / etc.)
- `billing_date` (date or textual like "Nov 1")
- `frequency` (monthly, yearly, weekly, one-time, unknown)
- `subscription_id` (if available)
- `confidence` (0..1)
- `notes` (short text)

### Prompt Template (concise for LLM)
Use a short instruction and request JSON-only output. Example:

```
You are an extractor. Input: raw email text. Output: JSON only.
Fields:
- vendor: short company name
- amount: number (float) or null
- currency: 3-letter currency code or null
- billing_date: ISO date (YYYY-MM-DD) if available or null
- frequency: monthly | yearly | weekly | one-time | unknown
- subscription_id: string or null
- confidence: 0.0-1.0
- notes: short text if ambiguity

Email:
```{{EMAIL_TEXT}}```
```

### Example Node.js parser function (OpenRouter)
```js
async function parseEmailWithOpenRouter(emailText) {
  const prompt = `...`; // use template above
  const res = await fetch("https://api.openrouter.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // example; pick cheaper model
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content || "";
  try {
    const parsed = JSON.parse(reply);
    return parsed;
  } catch (e) {
    // fallback: try to extract with simple regexes
    return null;
  }
}
```

### Local Ollama Parser (offline, cheaper)
- Host Ollama on a small VPS or local server.
- Use a lightweight model (Mistral 7B / Llama 3 8B) to reduce token costs.
- Pros: lower per-request cost, privacy.
- Cons: maintenance, model updates, GPU requirement for latency (CPU possible but slower).

**Recommendation:** Start with OpenRouter for simplicity and fallback to Ollama self-host when traffic grows.

---

## 8. Duplicate Detection & Matching Logic

### Normalization
- Normalize vendor names (`Netflix, Netflix Inc., Netflix.com` → `netflix`)
- Use simple fuzzy match (lowercase, strip punctuation, remove TLDs)
- Use amount + vendor + frequency + date proximity to detect duplicates

### Matching logic (pseudo)
1. Normalize vendor -> `v_norm`
2. Query `subscriptions` where `user_id = X` and `vendor_normalized = v_norm`
3. If match found and amounts are within 2% → Update `next_billing_date` and set `confidence = max(confidence, new_confidence)`
4. If no match → Insert new subscription with `status = pending` if `confidence < 0.7` else `active`

---

## 9. Notification Flow
- On success (confidence >= 0.7): send push notification "Added subscription: Netflix - $15.49 monthly"
- If `confidence < 0.7`: create subscription row with `status = pending` and notify "We found a possible subscription. Tap to review."
- Consider an in-app inbox or activity feed for users to accept/reject pending items.

---

## 10. Security & Anti-Abuse
- **Unique per-user alias** to reduce spoofing. Avoid using user's real email as alias.
- **Webhook signing**: use provider signature and your own secret to validate incoming requests.
- **Rate limit**: prevent spamming by limiting number of emails per alias per hour.
- **Spam filtering**: if classifier deems message spam, mark and discard.
- **Do not store full email body** long-term. Extract and store only necessary fields. Purge raw text after X days (e.g., 7 days).
- **GDPR / CCPA considerations**: allow users to delete their data including any stored email metadata.

---

## 11. Data Retention & Privacy
- Raw email body: keep for at most 7 days for troubleshooting, then delete.
- Parsed JSON & subscription rows: retain per your normal retention policy.
- Logging: redact personal data in logs (email addresses, payment details).
- Offer a user setting "delete forwarded emails after processing" (on by default).

---

## 12. Monitoring & Logging
- Capture metrics: emails received, successful parses, failed parses, avg parse latency, AI errors.
- Use lightweight monitoring: Supabase logs + Sentry (free tier) or simple log file to Supabase table.
- Alerting: on parse failure rate > X% or queue backlog > Y.

---

## 13. Cost Estimates (example for 10k emails/month)
- **ForwardEmail / Resend**: $0 - $3
- **OpenRouter (parsing)**: $5 - $25 (depends on model & tokens)
- **Supabase**: included in plan (or small incremental)
- **Notifications**: negligible
- **Total**: ~$10 - $30 / month (can be optimized lower with local model)

---

## 14. Testing Checklist
- [ ] Forward email with plain text receipt
- [ ] Forward email with HTML receipt
- [ ] Forward email from alternate `from` address (billing@vendor.com)
- [ ] Forward emails with different currencies
- [ ] Spam/marketing email forwarded
- [ ] Duplicate detection (forward same receipt twice)
- [ ] Edge cases: amount in words, multiple currencies, refunds
- [ ] Signature verification failure path (simulate)
- [ ] User alias rotation / revoke alias

---

## 15. Rollout & Phased Roadmap

### Phase 0 — Prototype (1–2 weeks)
- Implement webhook ingestion using ForwardEmail + Supabase Edge Function
- Minimal AI parsing with OpenRouter cheap model
- Insert parsed items as `pending` and display in app for review
- Notify user with in-app message

### Phase 1 — MVP (2–4 weeks)
- Unique per-user alias generation and UI
- Confidence scoring and `active` vs `pending` flow
- Duplicate detection + simple normalization
- Basic monitoring and retry logic

### Phase 2 — Optimization (4–8 weeks)
- Move parser to self-hosted Ollama for lower cost / privacy
- Improve ML heuristics for vendor normalization
- Add receipt screenshot upload parsing (OCR + LLM)
- Add user settings: auto-accept high-confidence and manual review for low-confidence

### Phase 3 — Growth & Edge Features (ongoing)
- Offer account linking (optional) for more automation (Plaid-like)
- Provide cancellation assistance (if legally feasible)
- Region-specific currency handling and localized parsing models

---

## 16. Appendix: Example Email JSON & Sample AI Responses

### Example provider POST payload (Resend style)
```json
{
  "from": "billing@netflix.com",
  "to": ["ronak+abc@subs.renvo.ai"],
  "subject": "Your Netflix payment receipt",
  "text": "Hi Ronak, your payment of $15.49 for Netflix subscription on Nov 1, 2025 is complete. Next billing date: Dec 1, 2025.",
  "html": "<p>Hi Ronak, your payment of <strong>$15.49</strong> ...</p>"
}
```

### Example AI output (JSON)
```json
{
  "vendor": "Netflix",
  "amount": 15.49,
  "currency": "USD",
  "billing_date": "2025-12-01",
  "frequency": "monthly",
  "subscription_id": null,
  "confidence": 0.92,
  "notes": ""
}
```

---

## Final Notes
- Keep the UX friction minimal: make alias copyable and give a short onboarding snippet: *"Forward receipts to this alias — we'll add subscriptions automatically."*
- Start with a conservative auto-accept confidence threshold (e.g., 0.8). Allow users to change behavior in settings.
- Log and review failed parses often; iteratively improve your prompt and normalization mappings.

---

If you'd like, I can:
- Generate the **Supabase Edge Function** full code (TypeScript) for `/email/ingest`.
- Generate the **AI parser microservice** code (Node.js) for using OpenRouter and/or Ollama.
- Export this markdown as a downloadable file now.

Which of these would you like me to produce next?
