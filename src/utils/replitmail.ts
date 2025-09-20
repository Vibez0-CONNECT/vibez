import { z } from "zod";

export const zSmtpMessage = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())])
    .describe("Recipient email address(es)"),
  cc: z.union([z.string().email(), z.array(z.string().email())])
    .optional()
    .describe("CC recipient email address(es)"),
  subject: z.string().describe("Email subject"),
  text: z.string().optional().describe("Plain text body"),
  html: z.string().optional().describe("HTML body"),
  attachments: z.array(
    z.object({
      filename: z.string().describe("File name"),
      content: z.string().describe("Base64 encoded content"),
      contentType: z.string().optional().describe("MIME type"),
      encoding: z.enum(["base64", "7bit", "quoted-printable", "binary"])
        .default("base64"),
    })
  )
  .optional()
  .describe("Email attachments"),
});

export type SmtpMessage = z.infer<typeof zSmtpMessage>;

// Send verification email using secure server-side API
export async function sendVerificationEmail(email: string): Promise<boolean> {
  try {
    const response = await fetch('/api/verify-email?action=send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
}

// Verify email code using secure server-side API
export async function verifyEmailCode(email: string, code: string): Promise<boolean> {
  try {
    const response = await fetch('/api/verify-email?action=verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code }),
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error verifying email code:', error);
    return false;
  }
}

// Generate random verification code (for display purposes only)
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}