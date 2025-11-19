#!/bin/bash

# Build script for Swift Reminders CLI

set -e

echo "Building Swift Reminders CLI..."

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BIN_DIR="$SCRIPT_DIR/bin"

# Create bin directory if it doesn't exist
mkdir -p "$BIN_DIR"

# Compile Swift files
swiftc \
  -o "$BIN_DIR/reminders-cli" \
  -framework EventKit \
  -framework Foundation \
  "$SCRIPT_DIR/Models.swift" \
  "$SCRIPT_DIR/RemindersManager.swift" \
  "$SCRIPT_DIR/main.swift"

echo "Build complete! Binary: $BIN_DIR/reminders-cli"
