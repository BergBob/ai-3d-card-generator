#!/bin/bash
# AI 3D Card Generator - Linux Starter
# Double-click this file or run: ./start.sh

cd "$(dirname "$0")"

echo "🎨 AI 3D Card Generator"
echo "========================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "   Install via your package manager:"
    echo "   Ubuntu/Debian: sudo apt install nodejs npm"
    echo "   Fedora: sudo dnf install nodejs"
    echo "   Or download from https://nodejs.org/ (v18 or higher)"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js v18 or higher is required (you have $(node -v))"
    echo "   Please update from https://nodejs.org/"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "✅ Node.js $(node -v) found"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (first run only)..."
    npm install
    echo ""
fi

echo "🚀 Starting server..."
echo "   The app will open in your browser automatically."
echo "   To stop: close this window or press Ctrl+C"
echo ""

# Wait for server to start, then open browser
(sleep 4 && xdg-open "http://localhost:5173" 2>/dev/null || sensible-browser "http://localhost:5173" 2>/dev/null) &

# Start the app
npm run dev
