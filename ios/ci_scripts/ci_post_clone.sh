#!/bin/sh
set -e

echo "🏗️ Starting ci_post_clone.sh (Expo Workflow)..."

# 1. Install CocoaPods, Node, and Yarn
echo "🍺 Installing dependencies (CocoaPods, Node, Yarn)..."
brew install cocoapods node yarn

# 2. Install Node Modules (Requires root folder)
# Start in ios/ci_scripts, go up two levels to the project root
cd ../.. 

if [ -f "package.json" ]; then
    echo "📦 'package.json' found. Installing Node modules..."
    if [ -f "yarn.lock" ]; then
        yarn install --frozen-lockfile
    else
        npm ci
    fi
fi

# 3. Use Expo to Configure Native Files
echo "🏗️ Running Expo Native Setup..."
# The --no-install flag prevents it from running pod install twice
expo prebuild --platform ios --no-install

# 4. Install Pods
# Go back into the ios folder where the Podfile lives
cd ios

echo "🥥 Installing Pods..."
pod install

echo "✅ ci_post_clone.sh completed successfully."