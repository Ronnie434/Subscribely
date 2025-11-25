#!/bin/sh
set -e

# Start in the project root directory
cd ../.. 

echo "🏗️ Starting ci_post_clone.sh setup..."

# Create .env file from Xcode Cloud environment variables
echo "📝 Creating .env file from environment variables..."

# Validate required variables
if [ -z "$EXPO_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ ERROR: EXPO_PUBLIC_SUPABASE_URL not set in Xcode Cloud environment"
    exit 1
fi

if [ -z "$EXPO_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "❌ ERROR: EXPO_PUBLIC_SUPABASE_ANON_KEY not set in Xcode Cloud environment"
    exit 1
fi

# Create the .env file
cat > .env << EOF
EXPO_PUBLIC_SUPABASE_URL=${EXPO_PUBLIC_SUPABASE_URL}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${EXPO_PUBLIC_SUPABASE_ANON_KEY}
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=${EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY}
EOF

echo "✅ Environment file created successfully"

# 1. Install Node and Cocoapods (Missing from your current run)
echo "🍺 Installing Node and CocoaPods via Homebrew..."
# Node is required for npm/yarn and for the Podfile to function
if ! command -v brew &> /dev/null; then
    echo "Homebrew not found. Skipping brew install."
else
    brew install cocoapods node
fi

# 2. Install Node Dependencies
echo "Installing Node dependencies..."
if [ -f "yarn.lock" ]; then
    yarn install --frozen-lockfile
else
    npm ci
fi

# 3. Expo Native Setup (If needed, you can remove this after a successful build)
# Since you ran prebuild locally, you *shouldn't* need to run it again unless dependencies change.
# If you keep it, use npx:
# npx expo prebuild --platform ios --no-install 

# 4. Install CocoaPods (From the project root)
echo "Installing CocoaPods..."
cd ios
# This ensures that Pods are installed after Node modules are guaranteed to be present
pod install
cd .. # Go back to root

# 5. Clean up local signing settings for CI
# Note: Changing 'xcodebuild -project' to 'xcodebuild -workspace' for Expo/Pods
echo "🧹 Cleaning up local signing settings for CI..."

# The xcodebuild command is expecting Renvo.xcworkspace to exist in ios/. 
# We are currently in the project root.
xcodebuild -workspace ios/Renvo.xcworkspace -scheme Renvo \
    -configuration Release \
    ONLY_ACTIVE_ARCH=NO \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGN_ENTITLEMENTS=""