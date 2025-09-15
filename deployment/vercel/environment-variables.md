# Vercel Environment Variables

Copy these environment variables to your Vercel project settings:

## Steps to Configure:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `parsley` project
3. Go to **Settings** → **Environment Variables**
4. Add each variable below
5. **Redeploy** the project after adding all variables

## Required Environment Variables:

### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=https://drwytmbsonrfbzxpjkzm.supabase.co
```

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjEzMjIsImV4cCI6MjA3MzAzNzMyMn0.YLFfJpQijIekgTsS3HAW4Ph4pnUeKIP3TievrX6eFc0
```

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao
```

### Site Configuration
```
NEXT_PUBLIC_SITE_URL=https://parsley-three.vercel.app
```

## Important Notes:

- **NEXT_PUBLIC_** prefixed variables are exposed to the browser
- **SUPABASE_SERVICE_ROLE_KEY** is server-side only (no NEXT_PUBLIC_ prefix)
- Make sure to set all variables in the **Production** environment
- After adding variables, trigger a new deployment for changes to take effect

## Troubleshooting:

If you still get OAuth 401 errors after setting these variables:

1. Verify all variables are set correctly in Vercel
2. Check that the Supabase Auth settings include your production domain
3. Wait 5-10 minutes for OAuth changes to propagate
4. Clear browser cache and try again