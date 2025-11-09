# Pre-Submission Checklist for Apple App Store

Complete this checklist before submitting Smart Subscription Tracker to the App Store. Each item must be verified to ensure a smooth review process.

**Last Updated**: January 9, 2025  
**Target Version**: 1.0.0

---

## 📋 Technical Requirements

### App Functionality
- [ ] App builds successfully without errors
- [ ] App runs without crashes on iOS 13.0+
- [ ] Tested on physical iPhone device
- [ ] Tested on iPad (if supporting tablets)
- [ ] All features work as expected
- [ ] No placeholder content or "TODO" items visible
- [ ] No console.log errors in production
- [ ] All user flows tested end-to-end
- [ ] Network connectivity properly handled
- [ ] Offline functionality works (if applicable)
- [ ] App responds appropriately to interruptions (calls, notifications)

### Authentication & Data
- [ ] User registration works correctly
- [ ] Login with email/password functions properly
- [ ] Google OAuth login works (if implemented)
- [ ] Password reset functionality tested
- [ ] Logout works and clears sensitive data
- [ ] Production Supabase instance configured
- [ ] Database migrations run successfully
- [ ] Real-time subscriptions sync properly
- [ ] Data persists correctly across app restarts
- [ ] User data is properly isolated (can't see other users' data)

### UI/UX
- [ ] All screens render correctly on iPhone SE (smallest screen)
- [ ] All screens render correctly on iPhone 15 Pro Max (largest screen)
- [ ] Dark mode works properly (if supported)
- [ ] Light mode works properly
- [ ] Font sizes are readable
- [ ] Buttons and interactive elements are tappable (44x44pt minimum)
- [ ] Loading states are shown appropriately
- [ ] Error messages are user-friendly
- [ ] Success messages are shown when appropriate
- [ ] Navigation is intuitive and consistent
- [ ] No UI elements overlap or cut off
- [ ] Safe area insets respected (notch, home indicator)

### Performance
- [ ] App launches in under 3 seconds
- [ ] No memory leaks detected
- [ ] Images load efficiently
- [ ] Smooth scrolling (60 FPS)
- [ ] No stuttering or lag during animations
- [ ] API requests are optimized
- [ ] App size under 150MB

### Notifications
- [ ] Push notification permissions requested appropriately
- [ ] Local notifications work for subscription reminders
- [ ] Notification content is accurate
- [ ] Tapping notification opens correct screen
- [ ] User can disable notifications in settings
- [ ] App handles notification permissions gracefully if denied

### Permissions
- [ ] Only necessary permissions are requested
- [ ] Permission requests include clear explanations
- [ ] App functions without optional permissions
- [ ] Privacy-sensitive features have usage descriptions
- [ ] App Tracking Transparency handled properly

### Error Handling
- [ ] Network errors handled gracefully
- [ ] Invalid input validated
- [ ] Server errors show user-friendly messages
- [ ] Timeout errors handled
- [ ] No crashes from edge cases
- [ ] Error boundaries in place for critical sections

---

## 🎨 Assets & Media

### App Icon
- [ ] App icon created (1024x1024 PNG)
- [ ] No transparency in icon
- [ ] No rounded corners (iOS adds them)
- [ ] Icon looks good at all sizes
- [ ] Icon follows App Store guidelines
- [ ] Icon added to `app.json` or assets folder

### Screenshots
- [ ] Screenshots prepared for 6.7" display (iPhone 15 Pro Max): 1290x2796px
- [ ] Screenshots prepared for 6.5" display (iPhone 14 Plus): 1284x2778px
- [ ] At least 3 screenshots prepared (10 maximum)
- [ ] Screenshots show actual app interface
- [ ] No placeholder or mock data in screenshots
- [ ] Screenshots highlight key features
- [ ] Text in screenshots is readable
- [ ] Screenshots include status bar (optional but recommended)
- [ ] iPad screenshots prepared (if supporting iPad)

### Splash Screen
- [ ] Splash screen configured
- [ ] Matches first screen of app
- [ ] Loads quickly

### Optional Assets
- [ ] App preview video created (15-30 seconds, optional)
- [ ] Promotional artwork prepared (optional)

---

## 📝 Content & Metadata

### App Information
- [ ] App name finalized: "Smart Subscription Tracker"
- [ ] Subtitle created (30 characters max)
- [ ] App description written (4000 characters max)
- [ ] App description is accurate and compelling
- [ ] Keywords selected (100 characters max, comma-separated)
- [ ] Primary category selected: Finance
- [ ] Secondary category selected: Productivity (optional)
- [ ] Age rating determined and accurate
- [ ] Content rights verified

### Privacy & Legal
- [ ] Privacy Policy created and reviewed
- [ ] Privacy Policy hosted online (accessible URL)
- [ ] Privacy Policy URL added to `app.json`
- [ ] Privacy Policy URL added to App Store Connect
- [ ] Data collection practices accurately described
- [ ] GDPR compliance verified (if applicable)
- [ ] CCPA compliance verified (if applicable)
- [ ] Support URL configured
- [ ] Support email accessible

### What's New
- [ ] "What's New" text written for v1.0.0
- [ ] Describes key features for initial release
- [ ] Professional and concise

---

## ⚙️ Configuration Files

### app.json
- [ ] Bundle identifier updated: `com.YOURNAME.smartsubscriptiontracker`
- [ ] Version set to "1.0.0"
- [ ] Build number set to "1"
- [ ] App name correct
- [ ] Owner field updated with Expo username
- [ ] Privacy permissions defined
- [ ] Icon and splash configured
- [ ] EAS project ID added
- [ ] Scheme configured
- [ ] No placeholder values remaining

### eas.json
- [ ] Production build profile configured
- [ ] iOS-specific settings correct
- [ ] Auto-increment enabled for buildNumber
- [ ] Apple ID added to submit configuration
- [ ] ASC App ID added (from App Store Connect)
- [ ] Apple Team ID added

### .env.production
- [ ] Production Supabase URL configured
- [ ] Production Supabase anon key configured
- [ ] Production Google OAuth credentials (if using)
- [ ] No development credentials in production file
- [ ] File is in .gitignore (security check)

### .gitignore
- [ ] .env.production added
- [ ] EAS build artifacts ignored
- [ ] Sensitive files excluded
- [ ] No credentials committed to Git

---

## 🏢 Apple Developer Account

### Account Setup
- [ ] Enrolled in Apple Developer Program ($99/year)
- [ ] Enrollment status: Active
- [ ] Payment method on file
- [ ] Developer Agreement accepted
- [ ] Paid Applications Agreement accepted (if applicable)

### App Store Connect
- [ ] App created in App Store Connect
- [ ] App ID registered
- [ ] Bundle ID matches app.json
- [ ] SKU created (unique identifier)
- [ ] App information filled out
- [ ] Export compliance information reviewed
- [ ] Tax forms completed (if selling app)

### Certificates & Profiles
- [ ] Distribution certificate generated
- [ ] Provisioning profile created
- [ ] Credentials managed via EAS (recommended)

---

## 🧪 Testing

### Device Testing
- [ ] Tested on iPhone SE (small screen)
- [ ] Tested on iPhone 15 Pro Max (large screen)
- [ ] Tested on iPad (if supporting)
- [ ] Tested with poor network connection
- [ ] Tested in airplane mode
- [ ] Tested with different iOS versions (13.0+)

### User Testing
- [ ] Beta tested with at least 5 users
- [ ] Feedback collected and addressed
- [ ] Critical bugs fixed
- [ ] No known show-stopping issues

### Test Accounts
- [ ] Demo account created for Apple reviewers
- [ ] Demo account credentials documented
- [ ] Demo account has sample data
- [ ] Demo account can access all features

---

## 🎯 App Review Preparation

### App Review Information
- [ ] Contact information provided
- [ ] Phone number provided
- [ ] Email for communication provided
- [ ] Demo account credentials provided
- [ ] Special instructions for reviewers (if needed)
- [ ] Notes section filled out (if needed)

### Export Compliance
- [ ] Determined if app uses encryption
- [ ] If yes, reviewed export compliance requirements
- [ ] If no, marked appropriately in submission

### App Store Guidelines
- [ ] Reviewed [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [ ] App follows all guidelines
- [ ] No prohibited content
- [ ] No misleading claims
- [ ] Accurate metadata
- [ ] Appropriate business model
- [ ] Follows design guidelines

### Common Rejection Reasons Checked
- [ ] App doesn't crash
- [ ] Links work correctly
- [ ] App description matches functionality
- [ ] Screenshots show actual app
- [ ] Privacy policy accessible
- [ ] Demo account works
- [ ] No broken features
- [ ] Accurate metadata
- [ ] Follows platform conventions

---

## 🚀 Build & Submission

### Build Process
- [ ] EAS CLI installed and updated
- [ ] Logged into Expo account
- [ ] Project linked to EAS
- [ ] Production build successful
- [ ] Build downloaded and tested
- [ ] No build warnings

### TestFlight (Recommended)
- [ ] Submitted to TestFlight first
- [ ] Internal testing completed
- [ ] External testing completed (optional)
- [ ] Beta feedback addressed
- [ ] Crash reports reviewed

### Final Submission
- [ ] All required fields completed in App Store Connect
- [ ] Screenshots uploaded
- [ ] App icon uploaded
- [ ] Privacy information accurate
- [ ] Pricing and availability set
- [ ] Release type selected (manual or automatic)
- [ ] Ready to submit for review

---

## 📊 Post-Submission Monitoring

### Monitoring Setup
- [ ] App Store Connect app installed on phone
- [ ] Email notifications enabled
- [ ] Ready to respond to Apple within 24 hours
- [ ] Team aware of submission

### Analytics (Optional)
- [ ] Analytics SDK integrated (if desired)
- [ ] Crash reporting configured (Sentry recommended)
- [ ] App performance monitoring setup

---

## ✅ Final Verification

### Pre-Flight Check
- [ ] Read through entire checklist
- [ ] All checkboxes marked
- [ ] No outstanding issues
- [ ] App tested one final time
- [ ] Confident in submission

### Team Approval
- [ ] Stakeholders reviewed app
- [ ] Final approval received
- [ ] Marketing team notified
- [ ] Support team prepared

---

## 🎉 Ready to Submit!

If all items above are checked, you're ready to submit to the App Store!

**Next Steps:**
1. Review the [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
2. Build production version: `eas build --platform ios --profile production`
3. Submit to App Store: `eas submit --platform ios --latest`
4. Monitor App Store Connect for status updates

**Estimated Review Time:** 1-3 days

**Good luck! 🚀**

---

## 📞 Support Resources

- **EAS Documentation**: https://docs.expo.dev/build/introduction/
- **App Store Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **Human Interface Guidelines**: https://developer.apple.com/design/human-interface-guidelines/
- **App Store Connect Help**: https://help.apple.com/app-store-connect/

---

## Version History

| Version | Date | Status |
|---------|------|--------|
| 1.0.0 | 2025-01-09 | Ready for submission |

---

**Notes:**
- Keep this checklist updated as you make changes
- Use this for every new version submission
- Check all items before submission to minimize rejection risk