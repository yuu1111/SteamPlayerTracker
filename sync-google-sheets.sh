#!/bin/bash
# Shell script to sync CSV data to Google Sheets
# Syncs local CSV files with Google Sheets (sorted by timestamp)

echo "Steam Player Tracker - Google Sheets Sync"
echo "========================================="
echo ""

# Display bash version
echo "Bash Version: $BASH_VERSION"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    echo ""
    echo "Press any key to exit..."
    read -n 1 -s
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not available"
    echo "Please make sure Node.js is properly installed"
    echo ""
    echo "Press any key to exit..."
    read -n 1 -s
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found"
    echo "Please run this script from the project root directory"
    echo ""
    echo "Press any key to exit..."
    read -n 1 -s
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found"
    echo "Please copy .env.example to .env and configure it"
    echo ""
fi

echo "Starting Google Sheets sync..."
echo ""

# Run the sync command
if npm run sync-google-sheets; then
    echo ""
    echo "Google Sheets sync completed successfully!"
    exit_code=0
else
    echo ""
    echo "Google Sheets sync failed with exit code: $?"
    exit_code=1
fi

echo ""
echo "Press any key to exit..."
read -n 1 -s

exit $exit_code