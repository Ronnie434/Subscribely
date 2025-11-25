#!/bin/sh
# Last updated: 2025-11-24 18:10 PST
# This script runs after Xcode Cloud clones the repository

# Exit on error
set -e

echo "============================================"
echo "=== Xcode Cloud ci_post_clone.sh START ==="
echo "============================================"
echo "Script location: $0"
echo "Current directory: $(pwd)"
echo "Current user: $(whoami)"
echo "Date/Time: $(date)"
echo ""

# Source .xcode.env to set up Node.js environment
# This sets the NODE_BINARY variable that the Podfile needs
echo "--- Configuring Node.js Environment ---"
if [ -f "ios/.xcode.env" ]; then
  echo "✓ Found ios/.xcode.env"
  echo "Sourcing ios/.xcode.env to configure Node.js..."
  source ios/.xcode.env
  export NODE_BINARY
  echo "✓ NODE_BINARY set to: $NODE_BINARY"
else
  echo "⚠ Warning: ios/.xcode.env not found, using default node"
  export NODE_BINARY=$(command -v node)
  echo "Using fallback NODE_BINARY: $NODE_BINARY"
fi
echo ""

# Verify Node.js is available
echo "--- Verifying Node.js Installation ---"
if ! command -v node &> /dev/null; then
  echo "❌ Error: Node.js not found in PATH"
  echo "PATH: $PATH"
  exit 1
fi

echo "✓ Node.js found"
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Node.js path: $(which node)"
echo ""

# Install npm dependencies
echo "--- Installing npm dependencies ---"
echo "Running: npm ci"
npm ci
echo "✓ npm dependencies installed successfully"
echo ""

# Navigate to ios directory and install pods
echo "--- Installing CocoaPods dependencies ---"
echo "Changing directory to: ios"
cd ios
echo "Current directory: $(pwd)"
echo ""

# Verify CocoaPods is available
if ! command -v pod &> /dev/null; then
  echo "❌ Error: CocoaPods not found"
  echo "PATH: $PATH"
  exit 1
fi

echo "✓ CocoaPods found"
echo "CocoaPods version: $(pod --version)"
echo "CocoaPods path: $(which pod)"
echo ""

# Install pods with repo update to ensure latest specs
echo "Running: pod install --repo-update"
pod install --repo-update
echo "✓ CocoaPods dependencies installed successfully"
echo ""

echo "============================================"
echo "=== ci_post_clone.sh COMPLETED SUCCESS ==="
echo "============================================"