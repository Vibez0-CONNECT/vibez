
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCreateUserWithEmailAndPassword, useUpdateProfile } from 'react-firebase-hooks/auth';
import { doc, setDoc, serverTimestamp, collection, updateDoc, getDoc } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React from 'react';
import { v4 as uuidv4 } from 'uuid';

import { auth, db } from '@/lib/firebase';
import { sendEmail } from '@/utils/replitmail';
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

// Generate a 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

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

  const sendVerificationEmail = async (email: string, code: string) => {
    try {
      await sendEmail({
        to: email,
        subject: 'Vibez - Email Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #6366f1; margin: 0;">Vibez</h1>
            </div>
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
              <h2 style="margin: 0 0 20px 0;">Verify Your Email</h2>
              <p style="margin: 0 0 30px 0; font-size: 16px;">Welcome to Vibez! Please use the verification code below to complete your registration:</p>
              <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
                ${code}
              </div>
              <p style="margin: 20px 0 0 0; font-size: 14px; opacity: 0.9;">This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
            </div>
          </div>
        `,
        text: `Welcome to Vibez! Your verification code is: ${code}\n\nThis code will expire in 10 minutes. If you didn't request this, please ignore this email.`,
      });
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      // First, create the user account
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

        // Create user document with emailVerified: false
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
          emailVerified: false, // Add email verification status
        });

        // Create device document with server timestamp
        const devicesCol = collection(db, 'users', res.user.uid, 'devices');
        const deviceDocRef = doc(devicesCol, deviceId);
        await setDoc(deviceDocRef, {
          id: deviceId,
          type: 'web',
          loggedInAt: serverTimestamp(),
        });

        // Generate verification code and send email
        const verificationCode = generateVerificationCode();
        
        try {
          await sendVerificationEmail(values.email, verificationCode);
          
          // Sign out the user so they can't access the app until verified
          await auth.signOut();
          
          toast({
            title: 'Account Created!',
            description: 'Please check your email for the verification code.',
          });
          
          // Redirect to verification page with email and code
          router.push(`/verify-email?email=${encodeURIComponent(values.email)}&code=${verificationCode}`);
        } catch (emailError) {
          console.error('Error sending verification email:', emailError);
          toast({
            title: 'Account Created',
            description: 'Account created but failed to send verification email. Please contact support.',
            variant: 'destructive',
          });
          // Still redirect to login since account was created
          router.push('/login');
        }
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
