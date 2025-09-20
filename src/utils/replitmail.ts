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

// Client-side email sending function that calls our secure API route
export async function sendEmail(message: SmtpMessage): Promise<boolean> {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('Failed to send email:', response.statusText);
      return false;
    }

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Generate random verification code
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification email
export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  const message: SmtpMessage = {
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

  return await sendEmail(message);
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<boolean> {
  const message: SmtpMessage = {
    to: email,
    subject: 'Vibez - Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">Reset Your Password</h2>
        <p style="color: #666; font-size: 16px;">
          We received a request to reset your password for your Vibez account. Click the button below to set a new password:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          If the button doesn't work, you can copy and paste this link into your browser:
        </p>
        <p style="color: #007bff; font-size: 14px; word-break: break-all;">
          ${resetLink}
        </p>
        <p style="color: #666; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
        </p>
        <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
          Best regards,<br>
          The Vibez Team
        </p>
      </div>
    `,
    text: `Reset your Vibez password by visiting this link: ${resetLink}. This link will expire in 1 hour.`
  };

  return await sendEmail(message);
}