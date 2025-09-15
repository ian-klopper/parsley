# OAuth Configuration Guide

## Google OAuth 2.0 Client Setup

### Configuration Details:
- **Name:** `parsley`
- **Project:** Your Google Cloud Project

### Authorized JavaScript Origins:
```
https://parsley-three.vercel.app
```

### Authorized Redirect URIs (BOTH are required):
```
https://parsley-three.vercel.app/auth/callback
https://drwytmbsonrfbzxpjkzm.supabase.co/auth/v1/callback
```

**IMPORTANT**: You must add BOTH redirect URIs above. The first one is for your app's callback, and the second one is for Supabase's internal OAuth handling.

## Supabase Auth Configuration

Go to [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → Authentication → Settings:

### Site URL:
```
https://parsley-three.vercel.app
```

### Redirect URLs:
```
https://parsley-three.vercel.app/auth/callback
https://parsley-three.vercel.app/**
```

## Complete Setup Checklist:

- [ ] Google OAuth client configured with correct origins and redirect URIs
- [ ] Supabase Auth settings updated with production domain
- [ ] All environment variables added to Vercel
- [ ] Project redeployed after environment variable changes
- [ ] Wait 5-10 minutes for OAuth settings to propagate
- [ ] Test authentication flow

## If Authentication Still Fails:

1. Check browser console for specific error messages
2. Verify environment variables are visible in Vercel function logs
3. Test with incognito/private browsing mode
4. Check Supabase Auth logs for detailed error information