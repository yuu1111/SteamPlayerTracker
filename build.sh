#!/bin/bash

# Steam Player Tracker Build Script for Linux/macOS

echo -e "\033[36mSteam Player Tracker - Build Script\033[0m"
echo -e "\033[36m===================================\033[0m"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "\033[31mError: npm is not installed\033[0m"
    echo -e "\033[33mPlease install Node.js from https://nodejs.org/\033[0m"
    exit 1
fi

echo -e "\033[32mnpm version: $(npm --version)\033[0m"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "\n\033[33mInstalling dependencies...\033[0m"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "\033[31mError: Failed to install dependencies\033[0m"
        exit 1
    fi
fi

# Clean previous build
echo -e "\n\033[33mCleaning previous build...\033[0m"
npm run clean

# Build the project
echo -e "\n\033[33mBuilding project...\033[0m"
npm run build

if [ $? -eq 0 ]; then
    echo -e "\n\033[32mBuild completed successfully!\033[0m"
else
    echo -e "\n\033[31mBuild failed!\033[0m"
    exit 1
fi