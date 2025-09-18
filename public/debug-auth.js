// Debug script to test the current authentication state
console.log('=== AUTH DEBUG SCRIPT ===');

// Check if we're in a browser
if (typeof window !== 'undefined') {
  // Check localStorage for any Supabase data
  console.log('🔍 Checking localStorage for Supabase data...');
  const localStorageKeys = Object.keys(localStorage).filter(key => 
    key.includes('supabase') || key.includes('auth')
  );
  
  console.log('Auth-related localStorage keys:', localStorageKeys);
  localStorageKeys.forEach(key => {
    console.log(`${key}:`, localStorage.getItem(key));
  });

  // Check cookies
  console.log('\n🍪 Checking document.cookie for auth cookies...');
  const cookies = document.cookie.split(';').filter(cookie => 
    cookie.includes('supabase') || cookie.includes('auth') || cookie.includes('session')
  );
  console.log('Auth-related cookies:', cookies);

  // Check current URL
  console.log('\n🌐 Current URL:', window.location.href);
  console.log('Pathname:', window.location.pathname);
  console.log('Search params:', window.location.search);

  // Try to get current Supabase session
  if (window.supabase) {
    console.log('\n🔐 Checking Supabase session...');
    window.supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session error:', error);
      } else {
        console.log('Current session:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          expiresAt: session?.expires_at
        });
      }
    });
  }
}