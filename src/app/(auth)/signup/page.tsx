
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCreateUserWithEmailAndPassword, useUpdateProfile, useSignInWithGoogle } from 'react-firebase-hooks/auth';
import { doc, setDoc, serverTimestamp, collection, updateDoc, getDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
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
  const [signInWithGoogle, , googleLoading] = useSignInWithGoogle(auth);

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

  const handleGoogleSignup = async () => {
    try {
      const result = await signInWithGoogle();
      
      if (result?.user) {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
          deviceId = uuidv4();
          localStorage.setItem('deviceId', deviceId);
        }
        
        const deviceData = {
          id: deviceId,
          type: 'web',
          loggedInAt: new Date(),
        };

        const userDocRef = doc(db, 'users', result.user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          // Create user document for new Google user
          await setDoc(userDocRef, {
            uid: result.user.uid,
            name: result.user.displayName || 'Google User',
            email: result.user.email,
            photoURL: result.user.photoURL,
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
            emailVerified: true, // Google accounts are pre-verified
          });

          // Create device document
          const devicesCol = collection(db, 'users', result.user.uid, 'devices');
          const deviceDocRef = doc(devicesCol, deviceId);
          await setDoc(deviceDocRef, {
            id: deviceId,
            type: 'web',
            loggedInAt: serverTimestamp(),
          });
        }

        toast({
          title: 'Welcome!',
          description: 'Successfully signed up with Google.',
        });
        
        router.push('/');
      }
    } catch (error: any) {
      console.error("Google signup error:", error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign up with Google.',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      // Check if REPL_IDENTITY is available for email sending
      const canSendEmails = typeof window !== 'undefined' && window.location.hostname.includes('replit.dev');
      
      if (!canSendEmails) {
        // In development, create account without email verification
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
          
          const deviceData = {
            id: deviceId,
            type: 'web',
            loggedInAt: new Date(),
          };

          const userDocRef = doc(db, 'users', res.user.uid);

          // Create user document with emailVerified: true in development
          await setDoc(userDocRef, {
            uid: res.user.uid,
            name: values.name,
            email: values.email,
            photoURL: null,
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
            emailVerified: true, // Skip verification in development
          });

          // Create device document with server timestamp
          const devicesCol = collection(db, 'users', res.user.uid, 'devices');
          const deviceDocRef = doc(devicesCol, deviceId);
          await setDoc(deviceDocRef, {
            id: deviceId,
            type: 'web',
            loggedInAt: serverTimestamp(),
          });

          toast({
            title: 'Account Created!',
            description: 'Welcome to Vibez! (Development mode - email verification skipped)',
          });
          
          // Redirect to main app
          router.push('/');
        }
      } else {
        // Production flow with email verification
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
            devices: [deviceData],
            background: 'galaxy',
            useCustomBackground: true,
            friends: [],
            friendRequestsSent: [],
            friendRequestsReceived: [],
            blockedUsers: [],
            mutedConversations: [],
            emailVerified: false,
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
            
            // If email fails, mark user as verified and let them in
            await updateDoc(userDocRef, {
              emailVerified: true,
            });
            
            toast({
              title: 'Account Created!',
              description: 'Email service unavailable, but your account is ready to use.',
            });
            
            router.push('/');
          }
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
              <Button className="w-full" type="submit" disabled={loading || googleLoading}>
                {loading ? 'Creating account...' : 'Create account'}
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
                onClick={handleGoogleSignup}
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  'Signing up...'
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
