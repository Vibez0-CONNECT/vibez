
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCreateUserWithEmailAndPassword, useUpdateProfile } from 'react-firebase-hooks/auth';
import { doc, setDoc, serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React from 'react';
import { v4 as uuidv4 } from 'uuid';

import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
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

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' }),
});

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [createUserWithEmailAndPassword, , loading] =
    useCreateUserWithEmailAndPassword(auth);
  const [updateProfile] = useUpdateProfile(auth);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const res = await createUserWithEmailAndPassword(
        values.email,
        values.password
      );
      if (res) {
        await updateProfile({ displayName: values.name });
        
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
          deviceId = uuidv4();
          localStorage.setItem('deviceId', deviceId);
        }
        
        // Use a client-side timestamp initially to avoid the Firestore error.
        const deviceData = {
          id: deviceId,
          type: 'web',
          loggedInAt: new Date(),
        };

        const userDocRef = doc(db, 'users', res.user.uid);

        // Use setDoc to create the user document with the correct structure.
        await setDoc(userDocRef, {
          uid: res.user.uid,
          name: values.name,
          email: values.email,
          photoURL: null,
          status: 'online',
          about: '',
          devices: [deviceData], // Initialize with client-side timestamp
          background: 'galaxy',
          useCustomBackground: true,
          friends: [],
          friendRequestsSent: [],
          friendRequestsReceived: [],
          blockedUsers: [],
          mutedConversations: [],
        });

        // After the document is created, update it with the server timestamp.
        // This is the correct pattern to avoid the "serverTimestamp in array" error.
        const userDoc = await getDoc(userDocRef);
        const existingDevices = userDoc.data()?.devices || [];
        const updatedDevices = existingDevices.map((d: any) => 
            d.id === deviceId ? { ...d, loggedInAt: serverTimestamp() } : d
        );
        await updateDoc(userDocRef, { devices: updatedDevices });

        router.push('/');
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use. Please log in or use a different email.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        title: 'Error creating account',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Toaster />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl">Create an account</CardTitle>
              <CardDescription>
                Enter your information to create an account
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Name" {...field} disabled={loading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      <Input type="password" {...field} disabled={loading}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Login
                </Link>
              </div>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </>
  );
}
