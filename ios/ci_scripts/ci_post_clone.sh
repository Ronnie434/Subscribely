#!/bin/zsh

# 1. Install Node Dependencies
echo "Installing Node dependencies..."
npm install # Use 'yarn install' if you prefer yarn
npm run expo-post-install # Some Expo dependencies require a post-install step

# 2. Go to the iOS directory
cd ios

# 3. Install CocoaPods
echo "Installing CocoaPods..."
# Use an explicit version if you know your project requires it, otherwise this works.
pod install

# 4. Clean up any conflicting code signing settings
# This is the crucial step to fix code 65
echo "Cleaning up local signing settings for CI..."
cd .. # Go back to root
xcodebuild -workspace ios/Renvo.xcworkspace -scheme Renvo \
    -configuration Release \
    -xcconfig /dev/null \
    ONLY_ACTIVE_ARCH=NO \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGN_ENTITLEMENTS=""