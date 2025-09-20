import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import crypto from 'crypto';

const zSmtpMessage = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  subject: z.string(),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(
    z.object({
      filename: z.string(),
      content: z.string(),
      contentType: z.string().optional(),
      encoding: z.enum(["base64", "7bit", "quoted-printable", "binary"]).default("base64"),
    })
  ).optional(),
  // Add HMAC for authentication
  hmac: z.string(),
  timestamp: z.number(),
});

type SmtpMessage = z.infer<typeof zSmtpMessage>;

// Server-side rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function getAuthToken(): string {
  return process.env.REPL_IDENTITY || process.env.REPL_RENEWAL || '';
}

function getServerSecret(): string {
  const secret = process.env.EMAIL_HMAC_SECRET;
  if (!secret) {
    throw new Error('EMAIL_HMAC_SECRET environment variable is required');
  }
  return secret;
}

function verifyHMAC(message: Omit<SmtpMessage, 'hmac'>, receivedHmac: string): boolean {
  try {
    const secret = getServerSecret();
    const payload = JSON.stringify(message);
    const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    
    // Guard against length mismatches before timingSafeEqual
    if (expectedHmac.length !== receivedHmac.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(Buffer.from(expectedHmac, 'hex'), Buffer.from(receivedHmac, 'hex'));
  } catch (error) {
    // Return false for any HMAC verification errors (malformed hex, etc.)
    return false;
  }
}

function isRateLimited(clientIP: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 5; // Max 5 emails per minute per IP

  const record = rateLimitStore.get(clientIP);
  if (!record || now > record.resetTime) {
    rateLimitStore.set(clientIP, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (record.count >= maxRequests) {
    return true;
  }

  record.count++;
  return false;
}

async function sendEmailServer(message: Omit<SmtpMessage, 'hmac' | 'timestamp'>): Promise<boolean> {
  try {
    const token = getAuthToken();
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
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('Failed to send email:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const headersList = await headers();
    const clientIP = headersList.get('x-forwarded-for') || 
                     headersList.get('x-real-ip') || 
                     'unknown';

    // Check rate limiting
    if (isRateLimited(clientIP)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    
    // Validate the request body
    const parseResult = zSmtpMessage.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid email data' },
        { status: 400 }
      );
    }

    const { hmac, timestamp, ...emailData } = parseResult.data;

    // Check timestamp (prevent replay attacks)
    const now = Date.now();
    if (Math.abs(now - timestamp) > 5 * 60 * 1000) { // 5 minutes tolerance
      return NextResponse.json(
        { success: false, error: 'Request timestamp expired' },
        { status: 401 }
      );
    }

    // Verify HMAC
    if (!verifyHMAC({ ...emailData, timestamp }, hmac)) {
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      );
    }
    
    // Send the email
    const success = await sendEmailServer(emailData);
    
    return NextResponse.json({ success });
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export helper function for server-side email sending
export function createEmailHMAC(message: Omit<SmtpMessage, 'hmac'>): string {
  const secret = getServerSecret();
  const payload = JSON.stringify(message);
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}