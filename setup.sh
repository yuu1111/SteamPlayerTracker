#!/bin/bash

# Steam Player Tracker Setup Script for Linux/macOS

echo -e "\033[36mSteam Player Tracker - Setup Script\033[0m"
echo -e "\033[36m====================================\033[0m"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "\033[31mError: npm is not installed\033[0m"
    echo -e "\033[33mPlease install Node.js from https://nodejs.org/\033[0m"
    exit 1
fi

echo -e "\033[32mnpm version: $(npm --version)\033[0m"

# Install dependencies
echo -e "\n\033[33mInstalling dependencies...\033[0m"
npm install
if [ $? -ne 0 ]; then
    echo -e "\033[31mError: Failed to install dependencies\033[0m"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "\n\033[33mCreating .env file from template...\033[0m"
    
    if [ -f ".env.example" ]; then
        cp ".env.example" ".env"
        echo -e "\033[32m.env file created successfully\033[0m"
        echo -e "\n\033[33mPlease edit the .env file to configure your settings:\033[0m"
        echo -e "\033[37m- Set STEAM_APP_ID to your desired game's App ID\033[0m"
        echo -e "\033[37m- Configure Google Sheets settings if needed\033[0m"
        echo -e "\033[37m- Adjust collection schedule and file paths as needed\033[0m"
    else
        echo -e "\033[31mError: .env.example file not found\033[0m"
        exit 1
    fi
else
    echo -e "\n\033[32m.env file already exists - skipping creation\033[0m"
fi

# Create logs directory if it doesn't exist
if [ ! -d "logs" ]; then
    echo -e "\n\033[33mCreating logs directory...\033[0m"
    mkdir -p logs
    echo -e "\033[32mLogs directory created\033[0m"
else
    echo -e "\n\033[32mLogs directory already exists\033[0m"
fi

# Build the project
echo -e "\n\033[33mBuilding project...\033[0m"
npm run build

if [ $? -eq 0 ]; then
    echo -e "\n\033[32mSetup completed successfully!\033[0m"
    echo -e "\n\033[36mNext steps:\033[0m"
    echo -e "\033[37m1. Edit .env file to configure your settings\033[0m"
    echo -e "\033[37m2. Run ./start.sh to start the tracker\033[0m"
    echo -e "\033[37m3. Check logs/steam-tracker.log for operation logs\033[0m"
else
    echo -e "\n\033[31mBuild failed!\033[0m"
    exit 1
fi