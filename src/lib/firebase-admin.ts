
import { getApps, initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let firebaseAdmin: any;

// Initialize Firebase Admin with service account or fallback
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    try {
      // Try to use service account if available
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      
      if (serviceAccount) {
        const serviceAccountKey = JSON.parse(serviceAccount) as ServiceAccount;
        firebaseAdmin = initializeApp({
          credential: cert(serviceAccountKey),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
      } else {
        // Fallback: Use project ID only (limited functionality but won't crash)
        firebaseAdmin = initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
      }
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
      // Create a minimal app for development
      firebaseAdmin = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vibez-dev',
      });
    }
  }
  return firebaseAdmin;
}

export function getAdminFirestore() {
  try {
    const app = initializeFirebaseAdmin();
    return getFirestore(app);
  } catch (error) {
    console.error('Error getting Firestore admin:', error);
    throw new Error('Firebase Admin not properly configured');
  }
}
