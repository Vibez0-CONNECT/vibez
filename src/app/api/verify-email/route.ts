
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import crypto from 'crypto';

const zSendVerificationRequest = z.object({
  email: z.string().email(),
});

const zVerifyCodeRequest = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

// In-memory storage for development (use Redis in production)
const verificationStore = new Map<string, { 
  code: string; 
  expiresAt: number; 
  attempts: number; 
}>();

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

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
    // Try multiple auth tokens
    const tokens = [
      process.env.NEXT_PUBLIC_REPLIT_AUTH_TOKEN,
      process.env.REPL_IDENTITY,
      process.env.REPL_RENEWAL,
      process.env.REPLIT_TOKEN
    ].filter(Boolean);

    if (tokens.length === 0) {
      console.error('No authentication token available for email service');
      return false;
    }

    for (const token of tokens) {
      try {
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

        if (response.ok) {
          console.log('Email sent successfully');
          return true;
        }
        
        console.log(`Token failed with status: ${response.status}`);
      } catch (error) {
        console.log(`Token failed with error:`, error);
        continue;
      }
    }

    return false;
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
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store verification code in memory
    verificationStore.set(email, {
      code,
      expiresAt,
      attempts: 0,
    });

    // Send email directly
    const html = `
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
    `;

    const text = `Welcome to Vibez! Your verification code is: ${code}. This code will expire in 10 minutes.`;

    return await sendEmailDirectly(email, 'Vibez - Email Verification Code', html, text);
  } catch (error) {
    console.error('Error sending verification code:', error);
    return false;
  }
}

async function sendPasswordResetEmail(email: string): Promise<boolean> {
  try {
    const resetCode = generateVerificationCode();
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes for password reset
    
    // Store reset code
    verificationStore.set(`reset:${email}`, {
      code: resetCode,
      expiresAt,
      attempts: 0,
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #6366f1; margin: 0;">Vibez</h1>
        </div>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
          <h2 style="margin: 0 0 20px 0;">Reset Your Password</h2>
          <p style="margin: 0 0 30px 0; font-size: 16px;">You requested a password reset. Use the code below to reset your password:</p>
          <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
            ${resetCode}
          </div>
          <p style="margin: 20px 0 0 0; font-size: 14px; opacity: 0.9;">This code will expire in 30 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    `;

    const text = `Password reset code for Vibez: ${resetCode}. This code will expire in 30 minutes.`;

    return await sendEmailDirectly(email, 'Vibez - Password Reset Code', html, text);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}

async function verifyCode(email: string, code: string): Promise<boolean> {
  try {
    const record = verificationStore.get(email);
    
    if (!record) {
      return false;
    }

    const { code: storedCode, expiresAt, attempts } = record;

    // Check if expired
    if (Date.now() > expiresAt) {
      verificationStore.delete(email);
      return false;
    }

    // Check attempts (rate limiting)
    if (attempts >= 5) {
      verificationStore.delete(email);
      return false;
    }

    // Verify the code
    if (code === storedCode) {
      // Code is correct, delete the verification record
      verificationStore.delete(email);
      return true;
    } else {
      // Increment attempts
      record.attempts += 1;
      verificationStore.set(email, record);
      return false;
    }
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
          { success: false, error: 'Failed to send email. Please try again.' },
          { status: 500 }
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
      const isValid = await verifyCode(email, code);
      
      return NextResponse.json({ success: isValid });
    }

    if (action === 'reset-password') {
      const body = await request.json();
      const parseResult = zSendVerificationRequest.safeParse(body);
      
      if (!parseResult.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid email address' },
          { status: 400 }
        );
      }

      const success = await sendPasswordResetEmail(parseResult.data.email);
      
      return NextResponse.json({ success });
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
