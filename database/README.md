# Database Migration Guide

## Overview
This directory contains the clean database rebuild files that replace all the old patched SQL files.

## Files in `/clean/` - Use These

### For Existing Databases (RECOMMENDED):

### 1. `SAFE-SCHEMA-UPDATE.sql`
- **Safely adds missing columns and tables to existing database**
- Adds auth_id column to users table
- Adds owner_id and last_activity to jobs table
- Creates job_collaborators and activity_logs tables if missing
- Includes all indexes, functions, and triggers
- **SAFE - Doesn't drop existing data**
- **Run this first**

### 2. `POPULATE-AUTH-IDS.sql`
- **Links existing users to Supabase Auth records**
- Matches users by email to populate auth_id field
- Shows which users couldn't be matched
- **Run this second**

### 3. `CLEAN-RPC-FUNCTIONS.sql`
- **All database functions for API operations**
- User management functions (role updates, etc.)
- Job management functions (get jobs for user)
- Collaborator management (add/remove collaborators)
- Ownership transfer functions
- **Run this third**

### 4. `DATA-MIGRATION.sql`
- **Final cleanup and data migration**
- Converts array-based collaborators to junction table
- Includes verification queries and data integrity checks
- **Run this fourth**

### For New Databases (Fresh Install):

### 1. `CLEAN-DATABASE-SCHEMA.sql`
- **Complete database schema from scratch**
- Only use this for completely new databases
- **WARNING: Drops existing tables**

## Migration Steps (For Existing Database)

### Step 1: Backup Your Database
```bash
# This is CRITICAL - always backup first!
# Use Supabase dashboard > Settings > Database > Backup
# Or if using direct PostgreSQL access:
pg_dump -h your_host -U your_user -d your_database > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Apply Safe Schema Update
```bash
# In Supabase SQL Editor, run:
database/clean/SAFE-SCHEMA-UPDATE.sql
```

### Step 3: Populate Auth IDs
```bash
# In Supabase SQL Editor, run:
database/clean/POPULATE-AUTH-IDS.sql
```

### Step 4: Apply RPC Functions
```bash
# In Supabase SQL Editor, run:
database/clean/CLEAN-RPC-FUNCTIONS.sql
```

### Step 5: Final Data Migration
```bash
# In Supabase SQL Editor, run:
database/clean/DATA-MIGRATION.sql
```

### Step 5: Test Your Application
- Verify login works without 500 errors
- Check that jobs, users, and collaborators display correctly
- Test admin functions and role management

## Files in `/old/` - Deprecated

These are the old patched files that caused the inconsistencies and API errors:
- `ADD-OWNER-ID-COLUMN.sql`
- `APPLY-THESE-DATABASE-FIXES.sql`
- `bootstrap-admin.sql`
- `complete-setup.sql`
- `CRITICAL-COMPLETE-FIX.sql`
- `get-jobs-for-user-rpc.sql`
- `jobs-schema-migration.sql`
- `make-admin.sql`
- `manual-setup.sql`
- `phase1-complete-database-fix.sql`
- `phase1-rls-fix.sql`
- `schema-consistency-fix.sql`
- `supabase-schema.sql`

**Do not use these files.** They are kept for reference only.

## What This Migration Fixes

✅ **API Errors**: Resolves 500 errors from `/api/users/me` and other endpoints
✅ **Schema Consistency**: Eliminates conflicts between different table definitions
✅ **Async/Await Issues**: Fixed missing awaits in API routes
✅ **Collaborator System**: Proper junction table instead of arrays
✅ **Job Ownership**: Consistent owner_id field throughout
✅ **TypeScript Types**: Updated to match new clean schema
✅ **RLS Policies**: Proper security policies for all tables

## Support

If you encounter issues during migration:
1. Check the verification queries output in `DATA-MIGRATION.sql`
2. Review application logs for any remaining API errors
3. Ensure all three SQL files were applied in order
4. Verify your application's TypeScript types are using the updated definitions

The migration eliminates all the patched inconsistencies and provides a clean, maintainable database foundation.