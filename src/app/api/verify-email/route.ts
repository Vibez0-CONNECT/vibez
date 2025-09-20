import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import crypto from 'crypto';

const zSendVerificationRequest = z.object({
  email: z.string().email(),
});

const zVerifyCodeRequest = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

// Hash the verification code for security
function hashCode(code: string, email: string): string {
  return crypto.createHash('sha256').update(code + email + process.env.VERIFICATION_SALT || 'default-salt').digest('hex');
}

// Generate random verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification code
async function sendVerificationCode(email: string): Promise<boolean> {
  try {
    const code = generateVerificationCode();
    const hashedCode = hashCode(code, email);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store hashed verification code in Firestore
    await setDoc(doc(db, 'verificationCodes', email), {
      hashedCode,
      expiresAt,
      attempts: 0,
      createdAt: serverTimestamp(),
    });

    // Send email with the plain code
    const emailMessage = {
      to: email,
      subject: 'Vibez - Email Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; text-align: center;">Verify Your Email</h2>
          <p style="color: #666; font-size: 16px;">
            Welcome to Vibez! Please use the verification code below to complete your account setup:
          </p>
          <div style="background: #f8f9fa; border: 2px dashed #e9ecef; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="font-size: 32px; color: #007bff; margin: 0; letter-spacing: 5px;">${code}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">
            This code will expire in 10 minutes. If you didn't request this verification, please ignore this email.
          </p>
          <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
            Best regards,<br>
            The Vibez Team
          </p>
        </div>
      `,
      text: `Welcome to Vibez! Your verification code is: ${code}. This code will expire in 10 minutes.`
    };

    const emailResponse = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailMessage),
    });

    return emailResponse.ok;
  } catch (error) {
    console.error('Error sending verification code:', error);
    return false;
  }
}

// Verify the code
async function verifyCode(email: string, code: string): Promise<boolean> {
  try {
    const verificationDoc = await getDoc(doc(db, 'verificationCodes', email));
    
    if (!verificationDoc.exists()) {
      return false;
    }

    const data = verificationDoc.data();
    const { hashedCode, expiresAt, attempts } = data;

    // Check if expired
    if (expiresAt.toDate() < new Date()) {
      await deleteDoc(doc(db, 'verificationCodes', email));
      return false;
    }

    // Check attempts (rate limiting)
    if (attempts >= 5) {
      return false;
    }

    // Verify the code
    const inputHashedCode = hashCode(code, email);
    if (inputHashedCode === hashedCode) {
      // Code is correct, delete the verification document
      await deleteDoc(doc(db, 'verificationCodes', email));
      return true;
    } else {
      // Increment attempts
      await setDoc(doc(db, 'verificationCodes', email), {
        ...data,
        attempts: attempts + 1,
      });
      return false;
    }
  } catch (error) {
    console.error('Error verifying code:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'send') {
      const body = await request.json();
      const parseResult = zSendVerificationRequest.safeParse(body);
      
      if (!parseResult.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid email address' },
          { status: 400 }
        );
      }

      const success = await sendVerificationCode(parseResult.data.email);
      return NextResponse.json({ success });
    }

    if (action === 'verify') {
      const body = await request.json();
      const parseResult = zVerifyCodeRequest.safeParse(body);
      
      if (!parseResult.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid verification data' },
          { status: 400 }
        );
      }

      const { email, code } = parseResult.data;
      const isValid = await verifyCode(email, code);
      
      return NextResponse.json({ success: isValid });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Verification API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}