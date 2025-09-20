'use client';
import { auth, db } from '@/lib/firebase';
import { signOut as firebaseSignOut, Auth, getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import React, { createContext, ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { VibezLogo } from '../vibez-logo';
import { GalaxyBackground } from '../galaxy-background';
import { getDoc, doc } from 'firebase/firestore';


interface AuthContextType {
  user: any;
  loading: boolean;
  error?: Error;
  signOut: () => Promise<void>;
  auth: Auth;
  userProfile: any;
  profileLoading: boolean;
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
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Custom auth state listener
  useEffect(() => {
    console.log('[AuthProvider] Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('[AuthProvider] Auth state changed:', firebaseUser ? 'User logged in' : 'No user');
      setUser(firebaseUser);
      setLoading(false);
      setError(null);
    }, (authError) => {
      console.error('[AuthProvider] Auth error:', authError);
      setError(authError);
      setUser(null);
      setLoading(false);
    });

    return () => {
      console.log('[AuthProvider] Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    } else {
      setUserProfile(null);
      setProfileLoading(false);
    }
  }, [user]);

  const fetchUserProfile = async () => {
    setProfileLoading(true);
    try {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserProfile(userDocSnap.data());
        } else {
          console.log("No such document!");
          setUserProfile(null); // Ensure profile is null if doc doesn't exist
        }
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setError(err);
      setUserProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };


  useEffect(() => {
    // Check for redirect result on initial load
    getRedirectResult(auth)
      .then((result) => {
        // If there was a redirect, the onAuthStateChanged listener will handle the user update
        // We just need to make sure we don't proceed with route protection until auth state is settled
      })
      .catch((error) => {
        console.error("Error getting redirect result:", error);
        setError(error);
      })
      .finally(() => {
        // This is to ensure we don't show the loading screen indefinitely if getRedirectResult fails
        // The actual loading state is managed by the onAuthStateChanged listener
      });
  }, []);


  useEffect(() => {
    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isLoading = loading || profileLoading;

    const handleAuth = async () => {
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
    };

    handleAuth();
  }, [user, loading, profileLoading, pathname, router]);

  const signOut = async () => {
    await firebaseSignOut(auth);
    // The onAuthStateChanged listener will update the user state.
    // No need to manually redirect here as the useEffect will handle it.
  };

  const isLoading = loading || profileLoading;
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  // Show loading screen if we're still loading or if we're about to redirect.
  if (isLoading || (!user && !isAuthRoute) || (user && isAuthRoute)) {
    return <LoadingScreen />
  }

  return (
    <AuthContext.Provider value={{ user, loading: loading, error, signOut, auth, userProfile, profileLoading }}>
      {children}
    </AuthContext.Provider>
  );
}