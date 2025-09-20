import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import crypto from 'crypto';

const zSendVerificationRequest = z.object({
  email: z.string().email(),
  sessionId: z.string().optional(), // Optional session binding
});

const zVerifyCodeRequest = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  sessionId: z.string().optional(),
});

// Server-side rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function getVerificationSalt(): string {
  const salt = process.env.VERIFICATION_SALT;
  if (!salt) {
    throw new Error('VERIFICATION_SALT environment variable is required');
  }
  return salt;
}

function hashCode(code: string, email: string): string {
  const salt = getVerificationSalt();
  const toHash = `${code}:${email}:${salt}`;
  return crypto.createHash('sha256').update(toHash).digest('hex');
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 3; // Max 3 attempts per minute

  const record = rateLimitStore.get(identifier);
  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (record.count >= maxRequests) {
    return true;
  }

  record.count++;
  return false;
}

async function sendEmailDirectly(to: string, subject: string, html: string, text: string): Promise<boolean> {
  try {
    const token = process.env.REPL_IDENTITY || process.env.REPL_RENEWAL || '';
    if (!token) {
      console.error('No authentication token available for email service');
      return false;
    }

    const response = await fetch('https://smtp.replit.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        subject,
        html,
        text,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

async function sendVerificationCode(email: string, clientIP: string): Promise<boolean> {
  try {
    // Rate limiting per email and IP
    const emailKey = `email:${email}`;
    const ipKey = `ip:${clientIP}`;
    
    if (isRateLimited(emailKey) || isRateLimited(ipKey)) {
      return false;
    }

    const code = generateVerificationCode();
    const hashedCode = hashCode(code, email);
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000)); // 10 minutes

    const db = getAdminFirestore();
    
    // Store verification code with atomic transaction
    await db.runTransaction(async (transaction) => {
      const docRef = db.collection('verificationCodes').doc(email);
      
      transaction.set(docRef, {
        hashedCode,
        expiresAt,
        attempts: 0,
        createdAt: FieldValue.serverTimestamp(),
        clientIP, // For additional security tracking
      });
    });

    // Send email directly from server
    const html = `
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
    `;

    const text = `Welcome to Vibez! Your verification code is: ${code}. This code will expire in 10 minutes.`;

    return await sendEmailDirectly(email, 'Vibez - Email Verification Code', html, text);
  } catch (error) {
    console.error('Error sending verification code:', error);
    return false;
  }
}

async function verifyCode(email: string, code: string, clientIP: string): Promise<boolean> {
  try {
    const db = getAdminFirestore();
    
    return await db.runTransaction(async (transaction) => {
      const docRef = db.collection('verificationCodes').doc(email);
      const doc = await transaction.get(docRef);
      
      if (!doc.exists) {
        return false;
      }

      const data = doc.data()!;
      const { hashedCode, expiresAt, attempts, clientIP: storedIP } = data;

      // Check if expired
      if (expiresAt.toDate() < new Date()) {
        transaction.delete(docRef);
        return false;
      }

      // Additional security: check if same IP (optional, can be disabled for mobile users)
      // if (storedIP !== clientIP) {
      //   return false;
      // }

      // Check attempts (rate limiting)
      if (attempts >= 5) {
        transaction.delete(docRef);
        return false;
      }

      // Verify the code using constant-time comparison
      const inputHashedCode = hashCode(code, email);
      
      // Defensive length check before timingSafeEqual
      if (inputHashedCode.length !== hashedCode.length) {
        transaction.update(docRef, {
          attempts: attempts + 1,
        });
        return false;
      }
      
      const isCodeValid = crypto.timingSafeEqual(
        Buffer.from(inputHashedCode, 'hex'),
        Buffer.from(hashedCode, 'hex')
      );
      
      if (isCodeValid) {
        // Code is correct, delete the verification document
        transaction.delete(docRef);
        return true;
      } else {
        // Increment attempts
        transaction.update(docRef, {
          attempts: attempts + 1,
        });
        return false;
      }
    });
  } catch (error) {
    console.error('Error verifying code:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const clientIP = headersList.get('x-forwarded-for') || 
                     headersList.get('x-real-ip') || 
                     'unknown';

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

      const success = await sendVerificationCode(parseResult.data.email, clientIP);
      
      if (!success) {
        return NextResponse.json(
          { success: false, error: 'Rate limit exceeded or server error' },
          { status: 429 }
        );
      }
      
      return NextResponse.json({ success: true });
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
      const isValid = await verifyCode(email, code, clientIP);
      
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