'use client'

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signInWithGoogle } from "@/lib/auth";
import { useState } from "react";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      focusable="false"
      data-prefix="fab"
      data-icon="google"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 488 512"
    >
      <path
        fill="currentColor"
        d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 21.2 173.4 58.2L337.5 152C312.5 129.5 282.8 116 248 116c-70.7 0-128.2 57.5-128.2 128s57.5 128 128.2 128c80.4 0 112.3-61 115.8-92.4H248v-80.1h236.1c2.3 12.7 3.9 26.9 3.9 41.9z"
      ></path>
    </svg>
  );
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    
    const result = await signInWithGoogle();
    
    if (!result.success) {
      setError(result.error || 'Failed to sign in');
      setIsLoading(false);
    }
    // If successful, the redirect will happen automatically
  };

  return (
    <main className="flex items-center justify-center h-screen bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
          <CardDescription>to continue to Parsley</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <GoogleIcon className="mr-2 h-4 w-4" />
              {isLoading ? 'Signing in...' : 'Sign in with Google'}
            </Button>
            
            {error && (
              <div className="text-sm text-destructive text-center">
                {error}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
