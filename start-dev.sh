#!/bin/bash

echo "🚀 Starting Parsley Development Server"
echo "======================================="
echo ""

# Check if port 8080 is already in use
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 8080 is already in use. Killing existing process..."
    lsof -ti:8080 | xargs kill -9
    sleep 2
fi

# Check environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Missing required environment variables"
    echo "Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set"
    exit 1
fi

echo "✅ Environment variables are set"
echo ""

# Run database checks
echo "🔍 Running system tests..."
node test-system-complete.js

if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️  Some tests failed. Would you like to apply database fixes? (y/n)"
    read -r response
    if [[ "$response" == "y" ]]; then
        echo "🔧 Applying database fixes..."
        node fix-database-complete.js
        echo ""
        echo "🔍 Re-running tests..."
        node test-system-complete.js
    fi
fi

echo ""
echo "🎯 Starting Next.js server on port 8080..."
echo "============================================"
echo ""

# Start the development server on port 8080
PORT=8080 npm run dev