#!/bin/bash

# Automated Database Setup Script
# This script sets up the database and runs all migrations

set -e  # Exit on any error

echo "🚀 Setting up database..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local file not found!"
    echo "Please create .env.local with your Supabase credentials:"
    echo "NEXT_PUBLIC_SUPABASE_URL=your_supabase_url"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key"
    echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    exit 1
fi

# Make migration script executable
chmod +x scripts/migrate-database.js

echo "📊 Checking migration status..."
npm run db:migrate:status

echo ""
echo "🔄 Running database migrations..."
npm run db:migrate

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Update the admin user email in migrations/20240912000002_create_admin_user.sql if needed"
echo "2. Run 'npm run db:migrate' again if you made changes"
echo "3. Start your application with 'npm run dev'"