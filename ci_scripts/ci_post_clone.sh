#!/bin/sh

# Exit on error
set -e

echo "=== Xcode Cloud ci_post_clone.sh ==="
echo "Current directory: $(pwd)"

# Source .xcode.env to set up Node.js environment
# This sets the NODE_BINARY variable that the Podfile needs
if [ -f "ios/.xcode.env" ]; then
  echo "Sourcing ios/.xcode.env to configure Node.js..."
  source ios/.xcode.env
  export NODE_BINARY
  echo "NODE_BINARY set to: $NODE_BINARY"
else
  echo "Warning: ios/.xcode.env not found, using default node"
  export NODE_BINARY=$(command -v node)
fi

# Verify Node.js is available
if ! command -v node &> /dev/null; then
  echo "Error: Node.js not found in PATH"
  exit 1
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install npm dependencies
echo "Installing npm dependencies..."
npm ci

# Navigate to ios directory and install pods
echo "Installing CocoaPods dependencies..."
cd ios

# Verify CocoaPods is available
if ! command -v pod &> /dev/null; then
  echo "Error: CocoaPods not found"
  exit 1
fi

echo "CocoaPods version: $(pod --version)"

# Install pods with repo update to ensure latest specs
pod install --repo-update

echo "=== ci_post_clone.sh completed successfully ==="