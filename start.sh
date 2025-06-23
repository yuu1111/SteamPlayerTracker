#!/bin/bash

# Steam Player Tracker Start Script for Linux/macOS

echo -e "\033[36mSteam Player Tracker - Start Script\033[0m"
echo -e "\033[36m===================================\033[0m"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "\033[31mError: .env file not found\033[0m"
    echo -e "\033[33mPlease create a .env file based on .env.example\033[0m"
    exit 1
fi

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo -e "\033[33mBuild not found. Running build script...\033[0m"
    ./build.sh
    if [ $? -ne 0 ]; then
        exit 1
    fi
fi

# Start the application
echo -e "\n\033[32mStarting Steam Player Tracker...\033[0m"
npm start