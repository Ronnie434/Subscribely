#!/bin/sh
set -e

echo "🏗️ Starting ci_post_clone.sh..."

# Install CocoaPods and Node/Yarn using Homebrew
echo "🍺 Installing dependencies (CocoaPods, Node, Yarn)..."
brew install cocoapods node yarn

# 1. Install Node Modules
# We start in ios/ci_scripts, go up two levels to the project root
cd ../.. 

if [ -f "package.json" ]; then
    echo "📦 'package.json' found. Installing Node modules..."
    if [ -f "yarn.lock" ]; then
        yarn install --frozen-lockfile
    else
        npm ci
    fi
fi

# 2. **ADD THIS BLOCK** - Generate the JS Bundle
echo "📦 Generating main.jsbundle..."
mkdir -p ios
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios

# 3. Install Pods
# Go back into the ios folder where the Podfile lives
cd ios

echo "🥥 Installing Pods..."
pod install

echo "✅ ci_post_clone.sh completed successfully."