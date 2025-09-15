import { supabase } from './supabase'

export async function signInWithGoogle() {
  const isLocal = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  const isCloudWorkstation = typeof window !== 'undefined' &&
    window.location.hostname.includes('cloudworkstations.dev');

  const isCodespaces = typeof window !== 'undefined' &&
    window.location.hostname.includes('app.github.dev');

  let baseUrl;
  if (isLocal) {
    baseUrl = `http://localhost:8080`;
  } else if (isCloudWorkstation) {
    baseUrl = `https://${window.location.host}`;
  } else if (isCodespaces) {
    baseUrl = `https://${window.location.host}`;
  } else if (typeof window !== 'undefined') {
    // In production, use the actual window location
    baseUrl = `${window.location.protocol}//${window.location.host}`;
  } else {
    // Fallback to environment variable
    baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://parsley-three.vercel.app';
  }

  const redirectTo = `${baseUrl}/auth/callback`;

  // Enhanced logging
  console.log('=== OAuth Sign In Debug ===');
  console.log('Environment:', {
    isLocal,
    isCloudWorkstation,
    isCodespaces,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'SSR',
    protocol: typeof window !== 'undefined' ? window.location.protocol : 'SSR',
    baseUrl,
    redirectTo
  });

  console.log('Starting OAuth with Supabase...');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    }
  })

  console.log('OAuth response:', {
    hasData: !!data,
    hasError: !!error,
    dataUrl: data?.url,
    error: error?.message
  });

  if (error) {
    console.error('Error signing in with Google:', error.message, error);
    return { success: false, error: error.message }
  }

  if (data?.url) {
    console.log('OAuth URL generated:', data.url);

    // Parse the OAuth URL to check redirect_to parameter
    try {
      const oauthUrl = new URL(data.url);
      const redirectParam = oauthUrl.searchParams.get('redirect_to');
      console.log('OAuth URL redirect_to param:', redirectParam);
    } catch (e) {
      console.error('Failed to parse OAuth URL:', e);
    }
  }

  console.log('OAuth initiated successfully, redirecting to:', data?.url);
  return { success: true, data }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    console.error('Error signing out:', error.message)
    return { success: false, error: error.message }
  }
  
  return { success: true }
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    console.error('Error getting current user:', error.message)
    return { user: null, error: error.message }
  }
  
  return { user, error: null }
}