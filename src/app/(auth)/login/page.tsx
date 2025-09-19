'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSignInWithEmailAndPassword, useSignInWithGoogle } from 'react-firebase-hooks/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React, { useEffect, useState } from 'react';
import { doc, runTransaction, serverTimestamp, updateDoc, getDoc, collection, setDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';

import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import type { User } from '@/lib/types';


const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' }),
});

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [signInWithEmailAndPassword, , loading, error] = useSignInWithEmailAndPassword(auth);
  const [signInWithGoogle, , googleLoading] = useSignInWithGoogle(auth);
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    // Generate and store a device ID on component mount
    let id = localStorage.getItem('deviceId');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('deviceId', id);
    }
    setDeviceId(id);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const res = await signInWithEmailAndPassword(values.email, values.password);
      if (res && deviceId) {
        const userDocRef = doc(db, 'users', res.user.uid);

        await runTransaction(db, async (transaction) => {
          const userDoc = await transaction.get(userDocRef);

          const deviceData = {
            id: deviceId,
            type: 'web',
            loggedInAt: new Date(), // Use client time initially
          };

          if (!userDoc.exists()) {
            // This case handles users whose document creation failed on signup.
            // We create their document now with default values.
            transaction.set(userDocRef, {
              uid: res.user.uid,
              email: res.user.email,
              name: res.user.displayName || values.email.split('@')[0],
              photoURL: res.user.photoURL || null,
              status: 'online',
              about: '',
              devices: [deviceData],
              background: 'galaxy',
              useCustomBackground: true,
              friends: [],
              friendRequestsSent: [],
              friendRequestsReceived: [],
              blockedUsers: [],
              mutedConversations: [],
            });
          } else {
            // This handles existing users. We ensure all fields are present.
            const userData = userDoc.data() as User;
            let existingDevices = userData.devices || [];

            const otherDevices = existingDevices.filter(d => d.id !== deviceId);
            const updatedDevices = [...otherDevices, deviceData];

            // This object contains all fields that should exist on a user document.
            // If any are missing from the existing user, they will be added.
            const fullUserData = {
              devices: updatedDevices,
              status: 'online',
              friends: userData.friends || [],
              friendRequestsSent: userData.friendRequestsSent || [],
              friendRequestsReceived: userData.friendRequestsReceived || [],
              blockedUsers: userData.blockedUsers || [],
              mutedConversations: userData.mutedConversations || [],
              about: userData.about || '',
              background: userData.background || 'galaxy',
              useCustomBackground: userData.useCustomBackground !== false,
              photoURL: userData.photoURL || res.user.photoURL || null,
              name: userData.name || res.user.displayName || values.email.split('@')[0],
              email: userData.email || res.user.email,
            };

            transaction.update(userDocRef, fullUserData);
          }
        });

        // Instead of placing serverTimestamp() inside the parent array (unsupported),
        // create/update a device document under users/{uid}/devices/{deviceId} so we can
        // safely use serverTimestamp() on a document field.
        const devicesCol = collection(db, 'users', res.user.uid, 'devices');
        const deviceDocRef = doc(devicesCol, deviceId);
        await setDoc(deviceDocRef, {
          id: deviceId,
          type: 'web',
          loggedInAt: serverTimestamp(),
        });

        router.push('/');
      }
    } catch (e: any) {
        console.error("Login submission error:", e);
        let errorMessage = 'An unexpected error occurred. Please try again.';
        if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
            errorMessage = 'Invalid credentials. Please check your email and password.';
        } else if (e.message) {
            errorMessage = e.message;
        }
        toast({
            title: 'Error logging in',
            description: errorMessage,
            variant: 'destructive',
        });
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      // Use popup method explicitly
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
      const res = await signInWithPopup(auth, provider);
      if (res && deviceId) {
        const userDocRef = doc(db, 'users', res.user.uid);

        await runTransaction(db, async (transaction) => {
          const userDoc = await transaction.get(userDocRef);

          const deviceData = {
            id: deviceId,
            type: 'web',
            loggedInAt: new Date(), // Use client time initially
          };

          if (!userDoc.exists()) {
            transaction.set(userDocRef, {
              uid: res.user.uid,
              email: res.user.email,
              name: res.user.displayName || (res.user.email ? res.user.email.split('@')[0] : 'New User'),
              photoURL: res.user.photoURL || null,
              status: 'online',
              about: '',
              devices: [deviceData],
              background: 'galaxy',
              useCustomBackground: true,
              friends: [],
              friendRequestsSent: [],
              friendRequestsReceived: [],
              blockedUsers: [],
              mutedConversations: [],
            });
          } else {
            const userData = userDoc.data() as User;
            let existingDevices = userData.devices || [];
            const otherDevices = existingDevices.filter(d => d.id !== deviceId);
            const updatedDevices = [...otherDevices, deviceData];

            const fullUserData = {
              devices: updatedDevices,
              status: 'online',
              friends: userData.friends || [],
              friendRequestsSent: userData.friendRequestsSent || [],
              friendRequestsReceived: userData.friendRequestsReceived || [],
              blockedUsers: userData.blockedUsers || [],
              mutedConversations: userData.mutedConversations || [],
              about: userData.about || '',
              background: userData.background || 'galaxy',
              useCustomBackground: userData.useCustomBackground !== false,
              photoURL: userData.photoURL || res.user.photoURL || null,
              name: userData.name || res.user.displayName || (res.user.email ? res.user.email.split('@')[0] : 'New User'),
              email: userData.email || res.user.email,
            };
            transaction.update(userDocRef, fullUserData);
          }
        });

        const devicesCol = collection(db, 'users', res.user.uid, 'devices');
        const deviceDocRef = doc(devicesCol, deviceId);
        await setDoc(deviceDocRef, {
          id: deviceId,
          type: 'web',
          loggedInAt: serverTimestamp(),
        });

        router.push('/');
      }
    } catch (e: any) {
        console.error("Google Sign-In error:", e);
        let errorMessage = 'An unexpected error occurred. Please try again.';
        if (e.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Google sign-in was cancelled.';
        } else if (e.message) {
            errorMessage = e.message;
        }
        toast({
            title: 'Error signing in with Google',
            description: errorMessage,
            variant: 'destructive',
        });
    }
  };

  useEffect(() => {
    if (error) {
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid credentials. Please check your email and password.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        title: 'Error logging in',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [error, toast]);


  return (
    <>
      <Toaster />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl">Welcome Back</CardTitle>
              <CardDescription>
                Enter your email below to log in to your account
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="m@example.com"
                        {...field}
                        disabled={loading || googleLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} disabled={loading || googleLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button className="w-full" type="submit" disabled={loading || googleLoading}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  'Signing in...'
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link
                  href="/signup"
                  className={cn(
                    "font-medium text-primary underline-offset-4 hover:underline",
                    (loading || googleLoading) && "pointer-events-none opacity-50"
                  )}
                  aria-disabled={loading || googleLoading}
                  tabIndex={(loading || googleLoading) ? -1 : undefined}
                >
                  Sign up
                </Link>
              </div>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </>
  );
}