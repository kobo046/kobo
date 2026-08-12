#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This command must be run on a Mac."
  exit 1
fi

for command_name in node npm xcodebuild pod; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    case "$command_name" in
      node|npm)
        echo "Node.js 20 or newer is required: https://nodejs.org/"
        ;;
      xcodebuild)
        echo "Install Xcode from the Mac App Store, then open it once."
        ;;
      pod)
        echo "CocoaPods is required. Install Homebrew, then run: brew install cocoapods"
        ;;
    esac
    exit 1
  fi
done

node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( node_major < 20 )); then
  echo "Node.js 20 or newer is required. Current version: $(node --version)"
  exit 1
fi

xcode_version="$(xcodebuild -version | awk '/^Xcode / { print $2; exit }')"
xcode_major="${xcode_version%%.*}"
if [[ -z "$xcode_major" ]] || (( xcode_major < 16 )); then
  echo "Xcode 16 or newer is required. Current version: ${xcode_version:-unknown}"
  exit 1
fi

echo "Preparing dependencies..."
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "Running tests and release checks..."
npm run validate

echo "Syncing the latest website into the iOS project..."
npm run cap:sync:ios

echo "iOS project is ready. Opening Xcode..."
open ios/App/App.xcworkspace
