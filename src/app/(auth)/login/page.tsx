
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSignInWithEmailAndPassword } from 'react-firebase-hooks/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React, { useEffect, useState } from 'react';
import { doc, runTransaction, serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';
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
  const [signInWithEmailAndPassword, user, loading, error] =
    useSignInWithEmailAndPassword(auth);
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

        // After the transaction, update the server timestamp for the current device.
        const updatedDoc = await getDoc(userDocRef);
        const finalDevices = (updatedDoc.data()?.devices || []).map((d: any) => 
            d.id === deviceId ? { ...d, loggedInAt: serverTimestamp() } : d
        );
        await updateDoc(userDocRef, { devices: finalDevices });

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
                        disabled={loading}
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
                      <Input type="password" {...field} disabled={loading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link
                  href="/signup"
                  className={cn(
                    "font-medium text-primary underline-offset-4 hover:underline",
                    loading && "pointer-events-none opacity-50"
                  )}
                  aria-disabled={loading}
                  tabIndex={loading ? -1 : undefined}
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
