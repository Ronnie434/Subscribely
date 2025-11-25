#!/bin/sh

# 1. Fail immediately if any command fails
set -e

echo "🏗️ Starting ci_post_clone.sh..."

# 2. Install CocoaPods and Node/Yarn using Homebrew
# Xcode Cloud has Homebrew pre-installed.
echo "🍺 Installing dependencies (CocoaPods, Node, Yarn)..."
brew install cocoapods node yarn

# 3. Install Node Modules (Required for React Native)
# We are currently in /ios/ci_scripts.
# We need to go up two levels to find package.json (the project root).
cd ../..

if [ -f "package.json" ]; then
    echo "📦 'package.json' found. Installing Node modules..."
    
    # Prefer Yarn if a lockfile exists, otherwise use npm
    if [ -f "yarn.lock" ]; then
        yarn install --frozen-lockfile
    else
        npm ci
    fi
else
    echo "⚠️ No package.json found. Skipping Node install."
fi

# 4. Install CocoaPods
# Go back into the ios folder where the Podfile lives
cd ios

echo "🥥 Installing Pods..."
pod install

echo "✅ ci_post_clone.sh completed successfully."