# App Store Submission Assets & Metadata

Complete guide for preparing App Store Connect submission materials for Smart Subscription Tracker.

---

## 📱 Screenshot Requirements

### Required Sizes

Apple requires screenshots for specific device sizes. You must provide at least one set.

#### iPhone 6.7" Display (iPhone 15 Pro Max, 14 Pro Max)
- **Resolution**: 1290 x 2796 pixels
- **Status**: REQUIRED
- **Quantity**: 1-10 screenshots

#### iPhone 6.5" Display (iPhone 14 Plus, 13 Pro Max, 12 Pro Max, 11 Pro Max, XS Max)
- **Resolution**: 1284 x 2778 pixels
- **Status**: REQUIRED
- **Quantity**: 1-10 screenshots

#### iPhone 5.5" Display (iPhone 8 Plus, 7 Plus, 6s Plus)
- **Resolution**: 1242 x 2208 pixels
- **Status**: Optional
- **Quantity**: 1-10 screenshots

#### iPad Pro (3rd Gen) 12.9" Display
- **Resolution**: 2048 x 2732 pixels
- **Status**: Optional (if supporting iPad)
- **Quantity**: 1-10 screenshots

### Screenshot Guidelines

1. **Show actual app interface** - No mockups or marketing graphics
2. **High quality** - Crisp, clear, professional
3. **Localized** - Match app language
4. **Order matters** - First screenshot is most important
5. **Status bar** - Can include or exclude
6. **Portrait orientation** - Required for iPhone
7. **No transparency** - Use solid backgrounds

### Recommended Screenshot Sequence

For Smart Subscription Tracker, suggest this order:

1. **Dashboard/Home Screen** - Shows all subscriptions at a glance
2. **Add Subscription** - Demonstrates ease of adding
3. **Subscription Details** - Shows individual subscription view
4. **Statistics/Analytics** - Monthly cost overview
5. **Notifications** - Renewal reminders feature
6. **Settings** - Customization options

---

## 🎨 Creating Screenshots

### Method 1: Simulator Screenshots (Quick)

```bash
# Start iOS Simulator
expo start --ios

# In Simulator:
# 1. Choose device: Simulator -> Device -> iPhone 15 Pro Max
# 2. Set up sample data
# 3. Navigate to each screen
# 4. Take screenshot: Cmd + S
# 5. Screenshots saved to Desktop
```

### Method 2: Physical Device (Preferred)

1. Run app on physical iPhone 15 Pro Max
2. Take screenshots using Side Button + Volume Up
3. Screenshots saved to Photos
4. AirDrop to Mac

### Method 3: Screenshot Tools

**Fastlane Snapshot** (Automated):
```bash
npm install -g fastlane
fastlane snapshot init
# Configure Snapfile
fastlane snapshot
```

**App Store Screenshot Generator** (Online):
- https://screenshots.pro
- https://appscreenshot.io
- Upload screenshots, add frames/backgrounds

### Screenshot Best Practices

1. **Clean data**: Use realistic but perfect data
2. **Full screens**: Capture entire screen
3. **No sensitive info**: Remove personal data
4. **Good lighting**: If physical device
5. **Consistent style**: Same theme across all
6. **Highlight features**: Show key functionality

---

## 📝 App Store Metadata

### App Name
**Maximum**: 30 characters  
**Recommended**: Smart Subscription Tracker (28 chars)  
**Alternative**: SubTracker Pro (15 chars)

**Guidelines**:
- Must be unique
- No generic terms alone
- Accurately describes app
- Consistent with icon/branding

### Subtitle
**Maximum**: 30 characters  
**Recommended**: Track & Manage Subscriptions

**Alternatives**:
- Never Miss a Renewal (22)
- Manage Your Monthly Bills (25)
- Control Your Subscriptions (26)
- Budget Your Subscriptions (26)

### Promotional Text
**Maximum**: 170 characters  
**Purpose**: Appears above description, editable anytime

**Recommended**:
```
Take control of your subscriptions. Track renewal dates, monitor spending, and never miss a payment. Simple, powerful, and designed for iOS.
```

### Description
**Maximum**: 4000 characters  
**Purpose**: Full app description in App Store

**Recommended Structure**:

```
TAKE CONTROL OF YOUR SUBSCRIPTIONS

Smart Subscription Tracker helps you manage all your subscriptions in one place. Never miss a renewal date and stay on top of your monthly expenses.

KEY FEATURES

📊 Complete Overview
• See all your subscriptions at a glance
• View monthly, yearly, and lifetime costs
• Track spending trends over time
• Beautiful, intuitive dashboard

🔔 Smart Reminders
• Get notified before renewals
• Customize notification preferences
• Never miss a payment again
• Avoid unwanted charges

💰 Budget Management
• Monitor your subscription spending
• See which services cost the most
• Make informed decisions about what to keep
• Export data for financial planning

🎯 Easy to Use
• Add subscriptions in seconds
• Support for all major services
• Custom categories and colors
• Clean, modern design

🔐 Privacy First
• Your data stays yours
• Secure cloud sync
• No tracking or ads
• Industry-standard encryption

✨ Additional Features
• Dark mode support
• iCloud sync across devices
• Export to CSV/PDF
• Search and filter
• Monthly statistics

PERFECT FOR

• Managing streaming services (Netflix, Spotify, etc.)
• Tracking software subscriptions
• Monitoring gym memberships
• Managing magazine subscriptions
• Tracking any recurring payment

WHY CHOOSE SMART SUBSCRIPTION TRACKER?

Unlike spreadsheets or notes, our app is purpose-built for subscription management. With automatic renewal reminders and spending insights, you'll always know where your money is going.

PRIVACY & SECURITY

We take your privacy seriously. All data is encrypted and stored securely. We never sell your data or show ads. Your subscription information is private and only accessible to you.

SUPPORT

Need help? We're here for you. Contact us at support@yourapp.com or visit our website at yourapp.com/support.

Download Smart Subscription Tracker today and take control of your recurring expenses!

---

No subscription required. Free to download and use.
```

**Character count**: ~1,850 characters

### Keywords
**Maximum**: 100 characters (comma-separated)  
**Guidelines**: Relevant, no repeated words, no competitor names

**Recommended**:
```
subscription,tracker,manager,renewal,budget,monthly,bills,expense,finance,money,recurring,payment
```

**Character count**: 97 characters

**Keyword Strategy**:
- Primary: subscription, tracker, manager
- Secondary: renewal, budget, bills
- Supporting: expense, finance, recurring
- Avoid: app names, generic terms alone

---

## 🎭 App Icon

### Requirements
- **Size**: 1024 x 1024 pixels
- **Format**: PNG (no transparency)
- **Color Space**: RGB
- **Corners**: Square (iOS adds rounded corners)

### Design Guidelines
1. **Simple**: Recognizable at small sizes
2. **Unique**: Stands out in App Store
3. **Relevant**: Relates to subscription tracking
4. **Professional**: High quality, polished
5. **No text**: Icon should work without words
6. **Safe zone**: Keep important elements in center

### Icon Concepts for Subscription Tracker
- Calendar with dollar sign
- Repeating circle/cycle icon
- Wallet with notification badge
- Clock with currency symbol
- Layered cards representing subscriptions

### Icon Tools
- **Figma**: https://figma.com
- **Sketch**: https://sketch.com
- **Icon generators**: 
  - https://appicon.co
  - https://makeappicon.com

---

## 🎥 App Preview Video (Optional)

### Specifications
- **Duration**: 15-30 seconds
- **Orientation**: Portrait
- **Sizes**: Same as screenshot sizes
- **Format**: M4V, MP4, or MOV
- **Codec**: H.264 or HEVC

### Video Structure (20 seconds)
1. **0-3s**: Show app icon, open app
2. **4-8s**: Add a subscription
3. **9-13s**: View dashboard/overview
4. **14-17s**: Show notification
5. **18-20s**: View statistics, close on app name

### Video Best Practices
- No sound or music (most watch muted)
- Show actual app, not mockups
- Fast-paced, engaging
- Highlight key features
- Professional transitions
- Clear text overlays optional

---

## 📊 Category & Age Rating

### Primary Category
**Recommended**: Finance

**Why Finance**:
- Core functionality is financial tracking
- Helps users manage spending
- Budget-related features
- Fits user expectations

**Alternative**: Productivity

### Secondary Category (Optional)
**Recommended**: Productivity

### Age Rating

**Recommended**: 4+

**Questionnaire Answers**:
- Cartoon or Fantasy Violence: None
- Realistic Violence: None
- Sexual Content or Nudity: None
- Profanity or Crude Humor: None
- Horror or Fear Themes: None
- Alcohol, Tobacco, Drugs: None
- Simulated Gambling: None
- Medical/Treatment Information: None
- Mature/Suggestive Themes: None
- Unrestricted Web Access: No
- Gambling and Contests: No

**Result**: 4+ (suitable for all ages)

---

## 💵 Pricing & Availability

### Pricing
**Recommended**: Free

**Monetization Options for Future**:
- In-app purchases (premium features)
- Subscription (advanced analytics)
- One-time unlock
- Freemium model

### Availability
**Countries**: All territories (175+ countries)
**Pre-order**: Not recommended for v1.0

---

## 🔍 Search Optimization (ASO)

### App Store Optimization Strategy

1. **Title**: Include primary keyword
2. **Subtitle**: Include secondary keywords naturally
3. **Keywords**: Use all 100 characters
4. **Description**: Front-load important keywords
5. **Updates**: Refresh keywords with updates
6. **Ratings**: Encourage positive reviews

### Target Search Terms
- "subscription tracker"
- "subscription manager"
- "monthly expenses"
- "recurring bills"
- "subscription reminder"
- "budget app"

---

## 📄 Support & Legal

### Support URL
**Required**: Yes  
**Recommended**: Create dedicated page

**Options**:
- Dedicated support site: `https://yourapp.com/support`
- GitHub Issues: `https://github.com/yourusername/smart-subscription-tracker/issues`
- Email redirect: `https://yourapp.com` (with mailto link)

**Must include**:
- How to use app
- FAQ section
- Contact information
- Privacy policy link

### Marketing URL (Optional)
**Recommended**: Product page

**Example**: `https://yourapp.com`

**Should include**:
- Feature highlights
- Screenshots
- Download link
- Testimonials (after launch)

### Privacy Policy URL
**Required**: Yes  
**Location**: Must be publicly accessible

**Options**:
1. GitHub Pages: `https://yourusername.github.io/privacy`
2. Website: `https://yourapp.com/privacy`
3. Hosting service: Use any web host

**Content**: Use `PRIVACY_POLICY.md` from project

---

## ✍️ What's New (Version 1.0.0)

### First Version Description

**Recommended**:
```
Welcome to Smart Subscription Tracker! 🎉

This is our initial release, bringing you powerful subscription management tools:

• Track unlimited subscriptions
• Get renewal reminders
• View spending statistics
• Export your data
• Dark mode support
• Secure cloud sync

Thank you for being an early adopter! We'd love to hear your feedback.
```

---

## 🎯 Marketing Materials Checklist

### Required for Submission
- [ ] 6.7" screenshots (1-10)
- [ ] 6.5" screenshots (1-10)
- [ ] App icon (1024x1024)
- [ ] App name (30 chars max)
- [ ] Subtitle (30 chars max)
- [ ] Description (4000 chars max)
- [ ] Keywords (100 chars max)
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] Primary category
- [ ] Age rating

### Optional but Recommended
- [ ] Promotional text (170 chars)
- [ ] App preview video
- [ ] iPad screenshots
- [ ] Secondary category
- [ ] Marketing URL
- [ ] Localized metadata (other languages)

### Post-Launch
- [ ] Press kit
- [ ] Social media graphics
- [ ] Landing page
- [ ] Blog post announcement
- [ ] Email to early supporters

---

## 🌍 Localization

### Initial Release
**Recommended**: English only

### Future Localization
Consider adding:
- Spanish (large market)
- French
- German
- Japanese
- Chinese (Simplified)

**Per Language**:
- Screenshots (if text visible)
- App name (if applicable)
- Description
- Keywords
- What's New

---

## 📝 Review Response Templates

### Positive Review (5 stars)
```
Thank you so much for the kind words! We're thrilled you're enjoying Smart Subscription Tracker. If you have any suggestions for future updates, please reach out at support@yourapp.com. 🎉
```

### Constructive Feedback (3-4 stars)
```
Thank you for your feedback! We're always working to improve. If you can share more details about [specific issue], please email us at support@yourapp.com so we can help. We appreciate you!
```

### Negative Review (1-2 stars)
```
We're sorry to hear about your experience. Please email us at support@yourapp.com with more details so we can help resolve this issue. We're committed to making things right!
```

---

## 📅 Launch Timeline

### Recommended Schedule

**Week 1-2**: Preparation
- Create screenshots
- Write metadata
- Set up support channels
- Host privacy policy

**Week 3**: TestFlight Beta
- Internal testing
- External testing (optional)
- Collect feedback

**Week 4**: Submission
- Submit to App Store
- Monitor for questions
- Prepare for launch

**Week 5+**: Launch
- App approved
- Release to App Store
- Marketing push
- Monitor reviews

---

## 🎓 Resources

### Official Apple Resources
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Product Page](https://developer.apple.com/app-store/product-page/)
- [Marketing Guidelines](https://developer.apple.com/app-store/marketing/guidelines/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

### Screenshot Tools
- [App Store Screenshot Templates](https://developer.apple.com/app-store/product-page/)
- [Screenshots.pro](https://screenshots.pro)
- [AppLaunchpad](https://theapplaunchpad.com/)

### ASO Tools
- [App Annie](https://www.appannie.com/)
- [Sensor Tower](https://sensortower.com/)
- [AppTweak](https://www.apptweak.com/)

---

## 💡 Pro Tips

1. **First impression matters**: Make your first screenshot count
2. **Tell a story**: Screenshots should show user journey
3. **Use real data**: Realistic but polished
4. **Test descriptions**: Get feedback before submitting
5. **Keywords research**: Check competitor keywords
6. **Update regularly**: Refresh metadata with updates
7. **A/B test**: Try different screenshots after launch
8. **Monitor analytics**: Use App Store Connect analytics
9. **Respond to reviews**: Shows you care
10. **Be patient**: First review takes longest

---

**Questions?** Refer to the [Deployment Guide](DEPLOYMENT_GUIDE.md) or [Pre-Submission Checklist](../PRE_SUBMISSION_CHECKLIST.md).

Good luck with your App Store submission! 🚀