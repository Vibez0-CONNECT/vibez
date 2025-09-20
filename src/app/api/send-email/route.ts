import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

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
});

type SmtpMessage = z.infer<typeof zSmtpMessage>;

function getAuthToken(): string {
  // Server-side only token access
  return process.env.REPL_IDENTITY || process.env.REPL_RENEWAL || '';
}

async function sendEmailServer(message: SmtpMessage): Promise<boolean> {
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
    const body = await request.json();
    
    // Validate the request body
    const parseResult = zSmtpMessage.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid email data' },
        { status: 400 }
      );
    }

    // Rate limiting check (basic IP-based)
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    // TODO: Implement proper rate limiting with Redis or similar
    
    // Send the email
    const success = await sendEmailServer(parseResult.data);
    
    return NextResponse.json({ success });
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}