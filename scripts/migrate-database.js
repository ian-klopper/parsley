#!/usr/bin/env node

/**
 * Automated Database Schema Migration Script
 * 
 * This script automatically applies database migrations to your Supabase instance.
 * It tracks which migrations have been applied and only runs new ones.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key needed for admin operations
const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Create migrations tracking table if it doesn't exist
 */
async function createMigrationsTable() {
  // First, try to select from the table to see if it exists
  const { error: selectError } = await supabase
    .from('schema_migrations')
    .select('id')
    .limit(1);
    
  // If the table doesn't exist, we'll get a specific error
  if (selectError && selectError.code === 'PGRST106') {
    console.log('📝 Creating migrations tracking table...');
    console.log('⚠️  Please run this SQL in your Supabase dashboard:');
    console.log(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum TEXT NOT NULL
      );
      
      -- Enable RLS
      ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
      
      -- Allow service role to access
      CREATE POLICY "Service role can manage migrations" ON public.schema_migrations
        FOR ALL USING (true);
    `);
    throw new Error('Please create the schema_migrations table in Supabase SQL Editor first');
  } else if (selectError) {
    console.error('❌ Error checking migrations table:', selectError);
    throw selectError;
  }
}

/**
 * Calculate checksum for migration file content
 */
function calculateChecksum(content) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations() {
  const { data, error } = await supabase
    .from('schema_migrations')
    .select('filename, checksum');

  if (error) {
    console.error('❌ Error fetching applied migrations:', error);
    throw error;
  }

  return data || [];
}

/**
 * Execute SQL migration
 */
async function executeMigration(filename, content) {
  console.log(`📝 Applying migration: ${filename}`);
  
  const { error } = await supabase.rpc('exec_sql', { sql: content });
  
  if (error) {
    console.error(`❌ Error applying migration ${filename}:`, error);
    throw error;
  }

  // Record successful migration
  const checksum = calculateChecksum(content);
  const { error: insertError } = await supabase
    .from('schema_migrations')
    .insert({ filename, checksum });

  if (insertError) {
    console.error(`❌ Error recording migration ${filename}:`, insertError);
    throw insertError;
  }

  console.log(`✅ Successfully applied: ${filename}`);
}

/**
 * Main migration function
 */
async function runMigrations() {
  try {
    console.log('🚀 Starting database migration...');
    
    // Ensure migrations directory exists
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
      console.log(`📁 Created migrations directory: ${MIGRATIONS_DIR}`);
    }

    // Create migrations tracking table
    await createMigrationsTable();
    console.log('✅ Migrations tracking table ready');

    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations();
    const appliedFilenames = appliedMigrations.map(m => m.filename);

    // Get all migration files
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure chronological order

    if (migrationFiles.length === 0) {
      console.log('📝 No migration files found');
      return;
    }

    let appliedCount = 0;

    // Process each migration file
    for (const filename of migrationFiles) {
      if (appliedFilenames.includes(filename)) {
        // Verify checksum
        const content = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
        const currentChecksum = calculateChecksum(content);
        const appliedMigration = appliedMigrations.find(m => m.filename === filename);
        
        if (appliedMigration.checksum !== currentChecksum) {
          console.warn(`⚠️  Migration ${filename} has been modified since it was applied!`);
          console.warn('   This could indicate a problem. Consider creating a new migration.');
        } else {
          console.log(`⏭️  Skipping already applied: ${filename}`);
        }
        continue;
      }

      // Apply new migration
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
      await executeMigration(filename, content);
      appliedCount++;
    }

    if (appliedCount === 0) {
      console.log('✅ Database is up to date - no migrations needed');
    } else {
      console.log(`✅ Successfully applied ${appliedCount} migration(s)`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

/**
 * Create a new migration file
 */
function createMigration(name) {
  if (!name) {
    console.error('❌ Please provide a migration name');
    console.log('Usage: node migrate-database.js create <migration_name>');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
  const filepath = path.join(MIGRATIONS_DIR, filename);

  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- 
-- Description: Add your migration description here
--

-- Add your SQL commands here
-- Example:
-- ALTER TABLE users ADD COLUMN new_field TEXT;

-- Remember to:
-- 1. Make changes backwards compatible when possible
-- 2. Test migrations on a copy of production data
-- 3. Consider the impact on existing data
`;

  // Ensure migrations directory exists
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }

  fs.writeFileSync(filepath, template);
  console.log(`✅ Created migration file: ${filename}`);
  console.log(`📝 Edit the file and add your SQL commands: ${filepath}`);
}

/**
 * Show migration status
 */
async function showStatus() {
  try {
    console.log('📊 Migration Status:');
    
    const appliedMigrations = await getAppliedMigrations();
    const migrationFiles = fs.existsSync(MIGRATIONS_DIR) 
      ? fs.readdirSync(MIGRATIONS_DIR).filter(file => file.endsWith('.sql')).sort()
      : [];

    if (migrationFiles.length === 0) {
      console.log('📝 No migration files found');
      return;
    }

    console.log('\nMigrations:');
    migrationFiles.forEach(filename => {
      const isApplied = appliedMigrations.some(m => m.filename === filename);
      const status = isApplied ? '✅ Applied' : '⏳ Pending';
      console.log(`  ${status} - ${filename}`);
    });

    const pendingCount = migrationFiles.length - appliedMigrations.length;
    console.log(`\n📈 Summary: ${appliedMigrations.length} applied, ${pendingCount} pending`);

  } catch (error) {
    console.error('❌ Error checking status:', error);
    process.exit(1);
  }
}

// CLI Interface
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case 'create':
    createMigration(arg);
    break;
  case 'status':
    showStatus();
    break;
  case 'migrate':
  case undefined:
    runMigrations();
    break;
  default:
    console.log('Usage:');
    console.log('  node migrate-database.js           # Run pending migrations');
    console.log('  node migrate-database.js migrate   # Run pending migrations');
    console.log('  node migrate-database.js create <name>  # Create new migration');
    console.log('  node migrate-database.js status    # Show migration status');
    break;
}