# Database Migration System

This project includes an automated database migration system to help you manage schema changes systematically.

## Quick Setup

### 1. Environment Variables

Make sure you have these in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Required for migrations
```

### 2. Run Initial Setup

```bash
# Make setup script executable and run it
chmod +x scripts/setup-database.sh
./scripts/setup-database.sh
```

OR run manually:

```bash
# Install dependencies (if not already done)
npm install

# Check migration status
npm run db:migrate:status

# Run migrations
npm run db:migrate
```

## Usage

### Running Migrations

```bash
# Run all pending migrations
npm run db:migrate

# Check which migrations have been applied
npm run db:migrate:status
```

### Creating New Migrations

```bash
# Create a new migration file
npm run db:migrate:create "add_new_table"

# This creates: migrations/20240912123456_add_new_table.sql
```

### Example Migration File

```sql
-- Migration: Add user preferences table
-- Created: 2024-09-12T12:34:56.000Z
-- 
-- Description: Adds a table to store user preferences
--

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) NOT NULL,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can manage their own preferences" ON public.user_preferences
  FOR ALL USING (user_id = auth.uid());
```

## Migration System Features

### ✅ **Automatic Tracking**
- Keeps track of which migrations have been applied
- Prevents running the same migration twice
- Verifies migration integrity with checksums

### ✅ **Safe Execution**
- Only runs new migrations
- Maintains transaction safety
- Provides detailed logging

### ✅ **Development Workflow**
- Easy to create new migrations
- Clear status reporting
- Handles migration conflicts

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Run all pending migrations |
| `npm run db:migrate:status` | Show migration status |
| `npm run db:migrate:create <name>` | Create new migration |

## Current Migrations

1. **20240912000001_initial_schema.sql** - Creates all initial tables and policies
2. **20240912000002_create_admin_user.sql** - Creates the initial admin user

## Best Practices

### 1. **Migration Naming**
- Use descriptive names: `add_user_preferences`, `update_jobs_table`
- Migrations run in alphabetical order (timestamp ensures this)

### 2. **Migration Content**
- Make changes backwards compatible when possible
- Use `IF NOT EXISTS` for CREATE statements
- Include rollback instructions in comments

### 3. **Testing**
- Test migrations on a copy of production data
- Verify the migration doesn't break existing functionality
- Check that the app still works after migration

### 4. **Production Deployment**
- Run migrations before deploying code changes
- Keep migrations small and focused
- Monitor for any issues during migration

## Troubleshooting

### Migration Fails
- Check your Supabase service role key is correct
- Verify your SQL syntax
- Check the error logs for specific issues

### Migration Already Applied Error
- Check `npm run db:migrate:status` to see current state
- Don't modify migration files after they've been applied
- Create a new migration for additional changes

### Permission Errors
- Ensure you're using the service role key (not anon key)
- Check that your Supabase project has the necessary permissions

## Security Notes

- The service role key bypasses RLS for migration execution
- Migrations run with full database privileges
- Keep migration files in version control
- Review migrations carefully before applying to production