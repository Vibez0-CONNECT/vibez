'use client';
import { auth } from '@/lib/firebase';
import { signOut as firebaseSignOut, Auth, getRedirectResult } from 'firebase/auth';
import React, { createContext, ReactNode, useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { usePathname, useRouter } from 'next/navigation';
import { VibezLogo } from '../vibez-logo';
import { GalaxyBackground } from '../galaxy-background';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';


interface AuthContextType {
  user: any;
  loading: boolean;
  error?: Error;
  signOut: () => Promise<void>;
  auth: Auth;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_ROUTES = ['/login', '/signup', '/verify-email'];

function LoadingScreen() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-black relative">
            <GalaxyBackground />
            <div className="relative z-10">
              <VibezLogo />
            </div>
        </div>
    )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, authLoading, error] = useAuthState(auth);
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Check for redirect result on initial load
    getRedirectResult(auth)
      .finally(() => {
        setIsProcessingRedirect(false);
      });
  }, []);

  useEffect(() => {
    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isLoading = authLoading || isProcessingRedirect;

    if (!isLoading) {
      if (user && isAuthRoute) {
        router.replace('/');
      } else if (!user && !isAuthRoute) {
        router.replace('/login');
      } else if (user && !isAuthRoute) {
        // Always enforce email verification
        if (user && user.emailVerified === false) {
          // Check if user document has emailVerified field set to true
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().emailVerified !== true) {
            // User exists but email not verified, sign them out
            await signOut();
            router.push('/login?message=Please verify your email before logging in.');
            return;
          }
        }
      }
    }
  }, [user, authLoading, isProcessingRedirect, pathname, router]);

  const signOut = async () => {
    await firebaseSignOut(auth);
    // Don't push here, let the useEffect handle it.
  };

  const isLoading = authLoading || isProcessingRedirect;
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  // Show loading screen if we're still loading or if we're about to redirect.
  if (isLoading || (!user && !isAuthRoute) || (user && isAuthRoute)) {
    return <LoadingScreen />
  }

  return (
    <AuthContext.Provider value={{ user, loading: authLoading, error, signOut, auth }}>
      {children}
    </AuthContext.Provider>
  );
}