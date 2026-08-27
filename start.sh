#!/bin/bash

# GoLangGraph Studio Interface Startup Script
# This script starts the Vite development server for the GoLangGraph Studio interface

echo "🚀 Starting GoLangGraph Studio Interface..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Set default environment variables if not already set
export VITE_API_URL=${VITE_API_URL:-"http://localhost:8080"}

echo "🔧 Configuration:"
echo "   API URL: $VITE_API_URL"
echo ""

echo "📋 Prerequisites:"
echo "   ✓ Node.js 20.19+ installed"
echo "   • GoLangGraph server running at $VITE_API_URL"
echo ""

echo "🌐 The interface will open at: http://localhost:5173"
echo "🛑 To stop the server, press Ctrl+C"
echo ""

# Start the development server
npm start
