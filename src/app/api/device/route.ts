import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import crypto from 'crypto';

const zRegisterDeviceRequest = z.object({
  authToken: z.string(), // Firebase ID token
  deviceType: z.enum(['web', 'mobile', 'desktop']).default('web'),
});

// Generate a secure device ID
function generateSecureDeviceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Rate limiting for device registration
const deviceRateLimitStore = new Map<string, { count: number; resetTime: number }>();

function isDeviceRegistrationRateLimited(identifier: string): boolean {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const maxRequests = 3; // Max 3 device registrations per 5 minutes

  const record = deviceRateLimitStore.get(identifier);
  if (!record || now > record.resetTime) {
    deviceRateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (record.count >= maxRequests) {
    return true;
  }

  record.count++;
  return false;
}

// Get device info from request headers
function getDeviceInfo(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const clientIP = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  
  // Basic device type detection
  let deviceType: 'web' | 'mobile' | 'desktop' = 'web';
  if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
    deviceType = 'mobile';
  } else if (/Electron/.test(userAgent)) {
    deviceType = 'desktop';
  }

  return {
    userAgent,
    clientIP,
    deviceType,
  };
}

export async function POST(request: NextRequest) {
  try {
    const headersList = headers();
    const body = await request.json();
    
    const parseResult = zRegisterDeviceRequest.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const { authToken } = parseResult.data;
    const deviceInfo = getDeviceInfo(request);

    // Verify Firebase ID token
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(authToken);
    const userId = decodedToken.uid;

    // Rate limiting per user and IP
    const userKey = `user:${userId}`;
    const ipKey = `ip:${deviceInfo.clientIP}`;
    
    if (isDeviceRegistrationRateLimited(userKey) || isDeviceRegistrationRateLimited(ipKey)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Check for existing device ID from secure cookie
    const existingDeviceId = request.cookies.get('deviceId')?.value;
    const deviceId = existingDeviceId || generateSecureDeviceId();
    const isNewDevice = !existingDeviceId;
    
    const db = getAdminFirestore();
    
    // Register device in user's document and devices subcollection
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);
      
      const deviceData = {
        id: deviceId,
        type: deviceInfo.deviceType, // Use server-inferred device type for security
        userAgent: deviceInfo.userAgent,
        clientIP: deviceInfo.clientIP,
        loggedInAt: FieldValue.serverTimestamp(),
        lastActiveAt: FieldValue.serverTimestamp(),
      };

      if (userDoc.exists) {
        // Update existing user's devices array
        const userData = userDoc.data()!;
        const existingDevices = userData.devices || [];
        
        if (isNewDevice) {
          // Remove any existing device with same characteristics and add new one
          const otherDevices = existingDevices.filter((d: any) => 
            !(d.clientIP === deviceInfo.clientIP && d.userAgent === deviceInfo.userAgent)
          );
          
          // Limit total devices per user (security measure)
          const maxDevices = 10;
          const devicesToKeep = otherDevices.slice(-maxDevices + 1);
          const updatedDevices = [...devicesToKeep, deviceData];
          
          transaction.update(userRef, {
            devices: updatedDevices,
            status: 'online',
            lastActiveAt: FieldValue.serverTimestamp(),
          });
        } else {
          // Update existing device's timestamp
          const updatedDevices = existingDevices.map((d: any) => 
            d.id === deviceId 
              ? { ...d, lastActiveAt: new Date() } // Use client date for array field
              : d
          );
          
          transaction.update(userRef, {
            devices: updatedDevices,
            status: 'online',
            lastActiveAt: FieldValue.serverTimestamp(),
          });
        }
      } else {
        // Create user document if it doesn't exist (fallback)
        transaction.set(userRef, {
          uid: userId,
          email: decodedToken.email,
          name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
          photoURL: decodedToken.picture || null,
          status: 'online',
          about: '',
          devices: [deviceData],
          background: 'galaxy',
          useCustomBackground: true,
          friends: [],
          friendRequestsSent: [],
          friendRequestsReceived: [],
          blockedUsers: [],
          mutedConversations: [],
          emailVerified: decodedToken.email_verified || false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Create or update device document in subcollection
      const deviceRef = db.collection('users').doc(userId).collection('devices').doc(deviceId);
      if (isNewDevice) {
        transaction.set(deviceRef, deviceData);
      } else {
        // Update existing device with fresh timestamp
        transaction.update(deviceRef, {
          lastActiveAt: FieldValue.serverTimestamp(),
        });
      }
    });

    // Create secure device cookie
    const response = NextResponse.json({ 
      success: true, 
      deviceId,
      message: 'Device registered successfully' 
    });
    
    // Set HttpOnly cookie for device tracking
    response.cookies.set('deviceId', deviceId, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Device registration error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json(
        { success: false, error: 'Token expired' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}