# Renvo – Track Recurring Expenses Smartly

> Manage, predict, and pay for every recurring expense from a single secure workspace powered by React Native, Expo, Supabase, and Stripe.

Renvo (formerly Subscribely) is a cross-platform app that helps people understand their recurring spend, stay ahead of renewals, and upgrade to premium financial tooling when they outgrow the free tier. This repository hosts the mobile app, Supabase database assets, Stripe-connected edge functions, documentation, and the public marketing site.

## Table of Contents
- [Why Renvo](#why-renvo)
- [Feature Highlights](#feature-highlights)
- [Plans & Paywall](#plans--paywall)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Screens & Flows](#screens--flows)
- [Repository Tour](#repository-tour)
- [Backend Assets](#backend-assets)
- [Documentation Hub](#documentation-hub)
- [Getting Started](#getting-started)
- [Development Scripts](#development-scripts)
- [Testing](#testing)
- [Notifications & Automations](#notifications--automations)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Why Renvo
- **Single source of truth** – Supabase keeps subscriptions, paywall state, and audit data in sync across iOS, Android, and web.
- **Predictable renewals** – Smart reminders, projected spend, and CSV exports let users proactively cancel or budget.
- **Upgrade-ready** – Stripe-managed paywall experiences (plan selection, billing portal, refunds) are available out of the box.
- **Privacy-first** – Row Level Security, secure session storage, and minimal permissions ensure user data stays isolated.

## Feature Highlights

### Tracking & management
- Add, edit, pause, resume, or delete recurring items with custom colors, icons, categories, and notes directly from `HomeScreen.tsx`, `AddSubscriptionScreen.tsx`, and `EditSubscriptionScreen.tsx`.
- Automatic migration from legacy AsyncStorage to Supabase (`AuthContext` + `migrateLocalSubscriptions`) keeps historical data intact.
- Real-time updates via `useRealtimeSubscriptions` ensure changes made on one device immediately appear everywhere.
- Inline paywall banners, modals, and upgrade prompts surface the free-tier limits at the moment of need.

### Intelligence & insights
- The Stats screen (`screens/StatsScreen.tsx`) summarizes breakouts by category, billing cadence, and renewal timelines.
- `utils/calculations.ts` powers monthly/yearly totals, per-item monthly equivalents, and net cash-flow projections.
- CSV export flows (`utils/export.ts`) let power users share data with accountants or budgeting tools in a couple taps.
- Onboarding, toast notifications, and haptic cues (see `components/` and `contexts/`) create a polished first-run experience.

### Reliability & automation
- Cloud-first storage with local caching (`utils/storage.ts`) keeps the app usable offline and resilient to Supabase outages.
- Renewal reminders leverage `expo-notifications` and run 24 hours before the due date at 9:00 AM local time.
- Usage tracking (`services/usageTrackingService.ts`) and analytics (`services/analyticsService.ts`) capture the entire paywall funnel for experimentation.
- Authentication hardens duplicate-email detection, inactivity timeouts, and secure token storage via SecureStore + AsyncStorage (`contexts/AuthContext.tsx`).

### Premium extras
- Free plan users track up to five recurring items; Premium unlocks unlimited tracking, advanced insights, and export tooling.
- Stripe-powered purchase, cancellation, refund, and billing-portal flows live in `services/paymentService.ts` and Supabase edge functions.
- Subscription-tier helpers (`services/subscriptionLimitService.ts`, `services/recurringItemLimitService.ts`) enforce limits and keep paywalls honest.
- Built-in upgrade UI (Paywall modal, Upgrade prompt, Plan selection, Payment screen, Subscription mgmt. screen) shortens the journey from intent to conversion.

## Plans & Paywall

| Plan | Included | Notes |
| --- | --- | --- |
| **Free** | Track up to 5 recurring items, basic analytics, renewal reminders, CSV export, light/dark/auto themes | Defined in `config/stripe.ts` (`FREE_TIER`). |
| **Premium Monthly** ($4.99) | Everything in Free + unlimited items, advanced stats, priority support, paywall limits removed | Configured via `SUBSCRIPTION_PLANS.monthly`. |
| **Premium Yearly** ($39, save ~34%) | Same as Monthly plus annual discount messaging | Configured via `SUBSCRIPTION_PLANS.yearly`. |

Stripe price IDs, billing copy, and refund policies live in `config/stripe.ts`, while the enforcement logic uses Supabase RPCs (`can_user_add_subscription`, `recurringItemLimitService`) and cached status (`utils/subscriptionCache.ts`).

## Architecture at a Glance
- **Frontend:** React 19 + React Native 0.81.5, Expo SDK 54, TypeScript 5, React Navigation tabs/stacks, Reanimated 3/4, gesture handler, Safe Area Context, Expo Haptics, Blur, Linear Gradient, SecureStore, FileSystem, Sharing, AuthSession, Lottie, etc.
- **State & Context:** `AuthContext`, `ThemeContext`, and `ToastContext` coordinate auth, theming, and global toasts; hooks like `useRealtimeSubscriptions` and `useInactivityTimer` encapsulate real-time sync and session security.
- **Backend:** Supabase Postgres with Row Level Security, Supabase Auth, RPC functions, `recurring_items` tables, `usage_tracking_events`, and SQL migrations under `database/`.
- **Edge Functions:** Located in `supabase/functions/*`, each function (create/cancel subscriptions, switch billing cycle, request refunds, manage billing portal, Stripe webhooks, debug tooling) proxies secure operations to Stripe.
- **Payments:** `services/paymentService.ts`, `services/subscriptionTierService.ts`, and `components` (PlanSelection, PaywallModal, UpgradePrompt) orchestrate purchase flows using `@stripe/stripe-react-native`.
- **Automation:** `utils/notificationService.ts` schedules/cancels reminder notifications; `utils/storage.ts` syncs subscriptions between Supabase and AsyncStorage; `services/usageTrackingService.ts` logs paywall funnel metrics.
- **Website:** `/website` hosts the static marketing microsite (HTML + CSS + JS) so the product story matches the mobile experience.

## Screens & Flows
- **Onboarding** – multi-screen walkthrough detailing Renvo’s value prop.
- **Authentication** – Login, Sign Up, Forgot/Reset Password, duplicate-email protection, inactivity lockouts.
- **Home** – searchable list of recurring items, totals, renewal chips, inline limits, paywall prompts, skeleton loaders, haptic interactions.
- **Add / Edit Recurring Item** – form with categories, billing cadence, reminders, icons/colors, notes, and domain detection.
- **Stats** – category charts, billing-cycle splits, trending spend, upcoming renewals.
- **Plan Selection & Paywall** – highlight free vs Premium, yearly savings, Stripe purchase flows, upgrade prompts, limit-reached states.
- **Payment & Subscription Management** – change billing cycle, pause/resume, request refunds, open billing portal.
- **Settings** – theme, account info, logout, app info, support links.

## Repository Tour
```
├── app.json                  # Expo app config (name, bundle IDs, scheme `renvo`)
├── package.json              # Scripts, Expo 54, React 19, Jest, Testing Library
├── components/               # Buttons, cards, paywall UI, loaders, empty states
├── screens/                  # Home, Stats, Auth, PlanSelection, Payment, Settings, etc.
├── services/                 # Supabase CRUD, paywall limits, Stripe payments, analytics, usage tracking
├── contexts/                 # Auth, Theme, Toast providers
├── hooks/                    # Real-time subscriptions, inactivity timer, UX helpers
├── utils/                    # Calculations, storage, notifications, exports, domain helpers, caches
├── config/                   # Supabase and Stripe config helpers
├── navigation/               # Stack/tab navigators and linking
├── database/                 # SQL migrations & helper scripts (recurring items, paywall, cleanup jobs)
├── supabase/functions/       # Edge functions (Stripe + billing automation) with shared helpers
├── scripts/                  # Dev utilities (e.g., `test-payment-flow.ts`)
├── docs/                     # Deep-dives (notifications, paywall, rename, readiness, etc.)
├── website/                  # Marketing site assets (HTML/CSS/JS)
└── __tests__/                # Unit/UI tests (screens, utils, fixtures, mocks, helpers)
```

## Backend Assets

### Database migrations (`database/`)
- `supabase_migration.sql` – core schema (users, recurring_items, usage tracking, auth helpers).
- `recurring_items_migration_v1.sql` – normalization + paywall-ready recurring item schema.
- `paywall_migration.sql`, `paywall_test_data.sql`, `recurring_items_migration_v1.sql` – free vs premium enforcement, sample datasets.
- `check_email_exists_function.sql`, `add_cancel_at_column.sql`, `cleanup_*` scripts – supporting RPCs and data hygiene tasks.
- `paywall_rollback.sql`, `supabase/setup` docs – recovery and onboarding instructions.

### Supabase Edge Functions (`supabase/functions/`)
- `create-subscription` – start a Stripe subscription for Premium.
- `cancel-subscription` – cancel immediately or at period end.
- `switch-billing-cycle` – swap monthly/yearly plans with prorations.
- `request-refund` – handle refund requests.
- `get-billing-portal` – launch Stripe’s customer billing portal.
- `get-invoice-url` – retrieve invoice links for receipts.
- `stripe-webhook` – ingest Stripe events and update Supabase.
- `debug-config` – introspect environment configuration in staging.
- `_shared/stripe.ts` – shared Stripe helpers (client config, error handling).

All functions authenticate through Supabase (`supabase.functions.invoke`) so only signed-in users can touch their billing data.

## Documentation Hub
- `QUICK_START.md` – 10-minute setup for new contributors.
- `SUPABASE_SETUP_GUIDE.md` – how to provision Supabase, run migrations, and configure RLS.
- `PAYWALL_DB_SETUP.md`, `PRODUCTION_READINESS.md`, `PRE_SUBMISSION_CHECKLIST.md` – operational readiness.
- `PHASE_6_BUILD_CONFIGURATION_SUMMARY.md`, `EXTERNAL_CONFIGURATION_CHECKLIST.md` – rename audit trail (Subscribely → Renvo) across stores + tooling.
- `NOTIFICATION_TESTING_GUIDE.md`, `FORGOT_PASSWORD_ARCHITECTURE.md`, `PASSWORD_RESET_DEBUG_REPORT.md` – feature-specific runbooks.
- `subtrack_email_forwarding_feature.md`, `SUPABASE_SETUP_GUIDE.md`, `PAYWALL_TEST_DATA.md`, etc. – future roadmap explorations.

## Getting Started

### Prerequisites
- Node.js 18 LTS (Expo SDK 54 requirement) and npm 10+ or yarn.
- Expo CLI (`npx expo --version` ≥ 7) for Metro + dev client commands.
- Xcode + iOS Simulator (macOS) and/or Android Studio/Emulator, or physical devices with Expo Go.
- Supabase project (database + auth) and Stripe account with test mode enabled.

### 1. Clone & install
```bash
git clone <your-fork-or-origin> renvo
cd renvo
npm install
```

### 2. Environment variables
Copy `.env.example` to `.env` (Expo will read `EXPO_PUBLIC_*` keys automatically):
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_ID_MONTHLY=...
STRIPE_PRICE_ID_YEARLY=...
APP_URL=exp://localhost:8081
# Optional Google OAuth client IDs (web/ios/android)
```
Never ship real secrets to the client—only publishable keys should be prefixed with `EXPO_PUBLIC_`.

### 3. Supabase setup
1. Create a project at [supabase.com](https://supabase.com) and grab the URL + anon key.
2. Run the SQL files in `database/` (start with `supabase_migration.sql`, then `recurring_items_migration_v1.sql`, `paywall_migration.sql`, `check_email_exists_function.sql`, and any cleanup scripts you need).
3. Enable Row Level Security and confirm RPC functions (`can_user_add_subscription`, `check_email_exists`) exist.
4. Seed sample data via `paywall_test_data.sql` if you want demo accounts.

### 4. Stripe + edge functions
1. Create two products/prices (monthly & yearly) and paste their IDs into `.env`.
2. Configure the webhook endpoint to point to the deployed `stripe-webhook` Supabase function; store the signing secret in `.env`.
3. Deploy edge functions via `supabase functions deploy <name>` (or your CI) so the mobile app can call: `create-subscription`, `cancel-subscription`, `switch-billing-cycle`, `request-refund`, `get-billing-portal`, `get-invoice-url`, `debug-config`.
4. Use `scripts/test-payment-flow.ts` to smoke-test the create → webhook → Supabase happy path.

### 5. Run the app
```bash
npm start            # Expo CLI (Metro) with QR code
npm run ios          # Build & run on iOS simulator/device
npm run android      # Build & run on Android emulator/device
npm run web          # Launch web preview
```
Use the Expo Go app or a Dev Client (see `eas build --profile development`) for hardware testing.

### 6. Run tests
```bash
npm test             # Jest (runs @testing-library/react-native + jest-expo)
npm run test:unit    # Only utility/unit tests
npm run test:screens # Screen-focused UI tests
npm run test:ui      # Full UI pattern tests
```

### 7. Optional tooling
- `npx expo install` ensures platform-specific deps match SDK 54’s requirements.
- `npx eas build --profile <profile>` consumes `eas.json` for preview/production builds once credentials are configured.

## Development Scripts
- `npm start` – Expo dev server (Metro bundler, tunneling, QR codes).
- `npm run ios` / `npm run android` / `npm run web` – platform-specific builds via Expo Run commands.
- `npm test`, `npm run test:watch`, `npm run test:coverage`, `npm run test:update-snapshots` – Jest workflows.
- `npm run test:ui`, `npm run test:screens`, `npm run test:unit` – scoped suites (utils vs. screens vs. UI).
- `npm run test:debug` – run Jest with Node inspector attached.
- `npm run test:clear` – clear Jest cache (useful after dependency bumps).

## Testing
- Jest + `jest-expo` simulate the Expo runtime; `@testing-library/react-native` powers component tests.
- Tests live under `__tests__/` with fixtures (`__tests__/fixtures`), mocks (`__tests__/mocks`), utilities (`__tests__/utils`), and full-screen specs (`__tests__/screens`).
- `jest.config.js`, `jest.setup.js`, and `jest-preset.js` configure TypeScript, Reanimated mocks, and Expo shims.
- Snapshot updates run through `npm run test:update-snapshots`; keep them deterministic by mocking dates/currencies.

## Notifications & Automations
- `utils/notificationService.ts` schedules 9:00 AM reminders one day before renewal, configures Android channels, and gracefully skips stale or disabled items.
- `utils/storage.ts` automatically (re)schedules reminders whenever users add/edit/delete subscriptions, ensuring notifications stay in sync with Supabase.
- `services/usageTrackingService.ts` writes structured events into `usage_tracking_events` for paywall funnels (limit reached → paywall shown → plan selected → payment outcome).
- `services/analyticsService.ts` centralizes analytics calls so you can connect Mixpanel, Amplitude, or Firebase without touching view logic.

## Deployment
- Expo configuration (`app.json`) sets the display name (“Renvo”), scheme (`renvo`), runtime version (`1.0.0`), icons, splash screens, bundle identifiers (`com.ronnie39.renvo`), and Android permissions (notifications, vibration, boot).
- `eas.json` defines four build profiles:
  - `development` – dev client builds for physical-device debugging.
  - `ios-simulator` – simulator builds without provisioning.
  - `preview` – internal distribution with `APP_ENV=preview`.
  - `production` – App Store / Play Store submissions with automatic build-number/version-code bumps.
- Expo Updates (runtime version) keeps OTA releases aligned with native binaries.
- Native iOS assets under `ios/` (Renvo workspace + Xcode project) reflect the rename work; Android native code will be generated via `expo prebuild` using the same name.

## Contributing
This is an active private project. Please open an issue or discussion before submitting PRs so we can share access credentials (Supabase, Stripe, Expo) and align on scope. Follow the existing code style (TypeScript strictness, React Hooks lint rules) and keep sensitive keys out of commits.

## License
This codebase is private and not licensed for public redistribution. Contact the maintainers for partnership requests.
