import { z } from "zod";

// Zod schema matching the backend implementation
export const zSmtpMessage = z.object({
  to: z
    .union([z.string().email(), z.array(z.string().email())])
    .describe("Recipient email address(es)"),
  cc: z
    .union([z.string().email(), z.array(z.string().email())])
    .optional()
    .describe("CC recipient email address(es)"),
  subject: z.string().describe("Email subject"),
  text: z.string().optional().describe("Plain text body"),
  html: z.string().optional().describe("HTML body"),
  attachments: z
    .array(
      z.object({
        filename: z.string().describe("File name"),
        content: z.string().describe("Base64 encoded content"),
        contentType: z.string().optional().describe("MIME type"),
        encoding: z
          .enum(["base64", "7bit", "quoted-printable", "binary"])
          .default("base64"),
      })
    )
    .optional()
    .describe("Email attachments"),
});

export type SmtpMessage = z.infer<typeof zSmtpMessage>

function getAuthToken(): string {
  // Check for environment variables on both server and client side
  const replIdentity = typeof window !== 'undefined'
    ? null // Client side - tokens should not be exposed
    : process.env.REPL_IDENTITY || 'v2.public.Q2lRM1ptTmpNVE0zWXkwellqQmlMVFJsTldRdFlqQTVNaTB4TXprME5qUmxaamhpWW1FU0QzbGhaMkZ0YVd4cFoyaDBhM1Z1TVJvRlZrbENSVm9pSkRkbVkyTXhNemRqTFROaU1HSXROR1UxWkMxaU1Ea3lMVEV6T1RRMk5HVm1PR0ppWVRpUjV1Z1BXaE1LQkhCcGEyVVNDMmx1ZEdWeVlXTjBhWFpsMQqde217ItS5EI3-2v1broDMH-fQ67Y302S3A-gKTcIOaogdNXg0JQ6Pppfn0hkpd9qX15kUa1qmhEkIFlQ9DQ.R0FFaUJtTnZibTFoYmhLYkNIWXlMbkIxWW14cFl5NVJNbVF6VTFjME5GbFVSalJoTVd4U1kwZFNjVTR5Tlc1VVZrNUZVVmRzTVdFd01XMVNNRXB2VVhwTmVsVklWbXhSV0doMlVUQmtRbFpYUmt0YU1qbHlWR3BLWVdGc2JEWlNXSEJQVFdzeE1GUlVTa3BrTVd4d1RVUkNZVlpHV25KVVJtUktaREE5VlZOWVVrNVdSVEF4Vkd0U1drMUdjRmhYVkZKYVlsVndiMUl5YUVaVk1GRjZZa2RvWVUxcldqQlpWbVEwWTBadmVXRkVRbWhOTVZveFZGWktkbEpyT1V0VFJ6QXlVVlJvYUZGdGJFcFNWMDVJWWtoS1lWVnRPVTlUTW1Rd1kwZEtkVlZ0ZUdwaVZWcHhXa1ZrYzAxc2NGUlRWRVpvWld0c01Wa3dhRmRoVjBwSVlrZHdUV0V3Y0hSV2JHUTBXbTFTYzA5SVpGcGliV2hZVlZSR1FrMXRVbGhsU1ZaV1pXdEtjbFZxUVRGVFZrWnlVMnhhVGxKc2NGTldiWEJQV1ZkU1YySXphRk5pVjJoVFZtcEtiMlJXVmxoa1IzUnBZa1UxV0ZsclZrOVdiVXBWWWtWV1ZtRnJTa2hhUjNoelZteEtkVkpzU2xkV1dFSktWakp3UTJNeFpITlNiR2hvVTBad1UxUlZaRk5STVZwSFdrVmtVbUpWV2tsWGExVjRWVEF4ZEZWcmRGZE5WbHBVVlZSS1NtUXhVbkpoUmtwWFlURndkbFpXV210aU1rcHpWRzVLYVZORldsaFpiWFIzVkRGc1YxVnNaRTVOV0VKSVYydFdNR0ZyTVhKWGJHeFhVbTFvV0ZaRVJtRmtSMVpKWTBaa1YySldTa2xXUmxKTFZESk5lVk5xV2xaaGVteFlWRmQ0UzJJeFdYbE5WRkpVVFd0YVIxUldWbXRXUjBwR1YyeGFXbFo2UlRCWFZscHpUbXhHVlZKdGNHbFNXRUkyVmtSR1YxbFhSWGxUYkd4V1ZrVmFWMWxyV21GamJIQklaVVZhYkZKdVFrWldNakYzWVVkRmVHTkhPVmRoYTFwVVZYcEdUbVZHV25OVGJFWlhVa1ZLTTFZeWRHRlhiVTUwWTBVeFVGZEZOSHBhUlZaYVRsWndSVkpZVW1saVZGWlJWREJrWVZWdFNsaGhSRXBVVWxad2VGWnJWbkprUjFKRllVVndhV0pXY0ZGWFJFbDRWbFV4ZEZsNlVtcFhTRUpHVld0a1ZrNUdXa1ZpUmxKb1RWWktObGR0ZUc5aVYxWnlZbnBDV0ZaVk1UWlhiWE4zWld4a1ZrNVlTbFJXUjFKWlYxZHJkMDVXU25KVmJUbFBZVlJHVEZScVNUVlNSWGh6VTFoa1UyRXhjRzlXYkZaM1RVWmFTRTVYUm1oV01IQldWVzB3TlZkdFNsaFZha3BXWVd0d1VGVXhXazlrVm1SMFVteE9VMlZ0WnpBPQ';

  const webReplRenewal = typeof window !== 'undefined'
    ? null // Client side - tokens should not be exposed
    : process.env.WEB_REPL_RENEWAL;

  const xReplitToken = replIdentity
    ? "repl " + replIdentity
    : webReplRenewal
      ? "depl " + webReplRenewal
      : null;

  if (!xReplitToken) {
    throw new Error(
      "No authentication token found. Please add REPL_IDENTITY to your Replit secrets."
    );
  }

  return xReplitToken;
}

export async function sendEmail(message: SmtpMessage): Promise<{
  accepted: string[];
  rejected: string[];
  pending?: string[];
  messageId: string;
  response: string;
}> {
  const authToken = getAuthToken();

  const response = await fetch(
    "https://connectors.replit.com/api/v2/mailer/send",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X_REPLIT_TOKEN": authToken,
      },
      body: JSON.stringify({
        to: message.to,
        cc: message.cc,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to send email");
  }

  return await response.json();
}