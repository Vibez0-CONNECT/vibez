
'use client';

import { ChatLayout } from '@/components/chat-layout';
import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  console.log('[Home] Auth state - loading:', loading, 'user:', user ? 'logged in' : 'not logged in');

  useEffect(() => {
    console.log('[Home] Auth effect - loading:', loading, 'user:', user ? 'logged in' : 'not logged in');
    
    // Add a small delay before redirecting to prevent rapid redirects
    if (!loading && !user) {
      const timeoutId = setTimeout(() => {
        console.log('[Home] Redirecting to login');
        router.push('/login');
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  if (loading) {
    console.log('[Home] Showing loading state');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if no user (redirect will happen)
  if (!user) {
    console.log('[Home] No user, waiting for redirect');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  console.log('[Home] Rendering ChatLayout');
  return <ChatLayout />;
}
