#!/bin/sh

# Fail immediately if any command fails
set -e

# Install CocoaPods using Homebrew
# (Xcode Cloud has Homebrew pre-installed)
brew install cocoapods

# Install dependencies and generate the .xcconfig files
pod install

echo "CocoaPods installation complete."