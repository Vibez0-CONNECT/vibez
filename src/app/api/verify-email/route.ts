// This file is no longer needed as we're using Firebase's built-in email verification
// If you need custom email functionality in the future, you can recreate this file
export async function GET() {
  return new Response('This endpoint has been deprecated in favor of Firebase Auth email verification', {
    status: 410
  });
}

export async function POST() {
  return new Response('This endpoint has been deprecated in favor of Firebase Auth email verification', {
    status: 410
  });
}