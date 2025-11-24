# Smart Subscription Tracker

A modern, cloud-enabled recurring expense tracking app built with React Native, Expo, and Supabase. Track your recurring items and monthly expenses across devices, manage renewals, and keep your data secure in the cloud.

## 🌟 Features

### Core Features
- **Recurring Item Management**: Add, edit, and delete recurring items with ease
- **Monthly Summary**: View total monthly costs and breakdown by category
- **Renewal Reminders**: Get notified when recurring items are about to renew
- **Export Reports**: Export your recurring item data as CSV files
- **Statistics Dashboard**: Detailed analytics with category breakdown, spending insights, and renewal timeline
- **Theme Customization**: Light, Dark, and Auto modes with system theme detection
- **Onboarding**: Interactive tutorial for new users
- **User Profiles**: Customizable avatars and account management
- **Modern UI**: Clean, intuitive interface with smooth animations
- **Haptic Feedback**: Enhanced user experience with haptic feedback

### Backend & Sync (NEW! 🎉)
- **Cloud Storage**: Your data is securely stored in Supabase
- **User Authentication**: Secure login with email/password authentication
- **Multi-Device Sync**: Access your recurring items from any device
- **Data Isolation**: Each user's data is completely private and secure
- **Local Caching**: Data cached locally with cloud synchronization when online
- **Real-time Updates**: Changes sync instantly across your devices

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development) or physical iOS device

### Installation

1. Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd smart-subscription-tracker
npm install
```

2. Set up backend (Supabase):
   - **Quick Start**: Follow [`QUICK_START.md`](QUICK_START.md:1) (~10 minutes)
   - **Detailed Guide**: See [`SUPABASE_SETUP_GUIDE.md`](SUPABASE_SETUP_GUIDE.md:1)
   - Create a Supabase project at [supabase.com](https://supabase.com)
   - Run the database migration from [`database/supabase_migration.sql`](database/supabase_migration.sql:1)
   - Copy `.env.example` to `.env` and add your Supabase credentials

3. Start the Expo development server:
```bash
npm start
```

4. Run on your preferred platform:
```bash
npm run ios      # iOS Simulator
npm run android  # Android Emulator
npm run web      # Web browser
```

Or scan the QR code with the Expo Go app on your device.

## 📁 Project Structure

```
├── components/              # Reusable UI components
├── screens/                 # Screen components
├── utils/                   # Utility functions
├── types/                   # TypeScript type definitions
├── constants/               # Theme and constants
├── navigation/              # Navigation setup
├── config/                  # Configuration files
│   └── supabase.ts         # Supabase client setup
├── database/               # Database migrations
│   └── supabase_migration.sql
├── App.tsx                  # Root component
├── app.json                 # Expo configuration
├── .env.example            # Environment variables template
├── QUICK_START.md          # Quick setup guide
├── SUPABASE_SETUP_GUIDE.md # Detailed backend setup
└── package.json            # Dependencies
```

## 🛠️ Technologies Used

### Frontend
- **React Native**: Cross-platform mobile app framework
- **Expo**: Development platform and build system
- **TypeScript**: Type safety and better developer experience
- **React Navigation**: Navigation library

### Backend & Data
- **Supabase**: Backend-as-a-Service (PostgreSQL database)
- **Supabase Auth**: User authentication and session management
- **Row Level Security**: Database-level data isolation
- **AsyncStorage**: Local data caching and offline support

### Libraries & Utilities
- **Date-fns**: Date manipulation and formatting
- **Expo Secure Store**: Secure storage for auth tokens
- **Expo Auth Session**: OAuth authentication flows
- **Expo Sharing**: File sharing functionality
- **Expo Haptics**: Haptic feedback
- **expo-notifications**: Renewal reminder notifications
- **expo-file-system**: CSV file generation
- **react-native-reanimated**: Smooth UI animations
- **@react-native-community/datetimepicker**: Date selection

## Usage

1. **Add a Recurring Item**: Tap the + button on the home screen
2. **Edit a Recurring Item**: Tap on any recurring item card
3. **Delete a Recurring Item**: Long press on a recurring item card
4. **Export Data**: Tap the "Export CSV" button on the home screen
5. **View Summary**: Monthly totals and upcoming renewals are displayed at the top

## Categories

- Streaming (Netflix, Hulu, etc.)
- Cloud Storage (iCloud, Dropbox, etc.)
- Music (Spotify, Apple Music, etc.)
- Software
- News
- Other

## 🚀 Future Features

Features planned for future releases:

- **Google OAuth**: Social login with Google authentication
- **Full Offline Support**: Offline-first architecture with automatic sync queue
- **Budget Alerts**: Get notified when spending exceeds set limits
- **Recurring Item Sharing**: Family plan tracking and cost splitting
- **Payment Method Tracking**: Track which card/account is used for each recurring item
- **Price History**: Track recurring item price changes over time

## 📚 Documentation

- **[Quick Start Guide](QUICK_START.md)** - Get up and running in 10 minutes
- **[Supabase Setup Guide](SUPABASE_SETUP_GUIDE.md)** - Detailed backend configuration
- **[Backend Research](BACKEND_RESEARCH_RECOMMENDATIONS.md)** - Why we chose Supabase

## 🚀 Development Roadmap

- ✅ **Phase 1**: Foundation Setup - Backend infrastructure and dependencies
- ✅ **Phase 2**: Authentication Implementation - Email/password login and signup
- ✅ **Phase 3**: Data Migration & CRUD - Sync local data to cloud
- ✅ **Phase 4**: Real-time Sync - Live updates across devices
- ✅ **Phase 5**: Advanced Features - Statistics, themes, and onboarding
- ⏳ **Phase 6**: Testing & Polish - Comprehensive testing and optimization

## 🤝 Contributing

This project is currently in active development. Contributions, issues, and feature requests are welcome!

## 📄 License

This project is private and for personal use.


