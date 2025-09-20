import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let app: App;

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    // In Replit environment, Firebase Admin SDK can use default credentials
    // or we can use environment variables for service account
    try {
      app = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        // In production, you would use a service account key
        // credential: cert({
        //   projectId: process.env.FIREBASE_PROJECT_ID,
        //   clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        //   privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        // }),
      });
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
      throw error;
    }
  } else {
    app = getApps()[0];
  }
  return app;
}

// Get Admin Firestore instance
export function getAdminFirestore() {
  if (!app) {
    initializeFirebaseAdmin();
  }
  return getFirestore(app);
}

// Get Admin Auth instance
export function getAdminAuth() {
  if (!app) {
    initializeFirebaseAdmin();
  }
  return getAuth(app);
}

// Initialize on import
initializeFirebaseAdmin();