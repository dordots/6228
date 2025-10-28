const functions = require("firebase-functions");
const admin = require("firebase-admin");
const OTPAuth = require("otpauth");
const QRCode = require("qrcode");
const { totpLimiter, smsLimiter, consumeRateLimit, rewardSuccess } = require("./middleware/rateLimiter");

const db = admin.firestore();

/**
 * Generate TOTP secret and QR code for 2FA setup
 */
exports.generateTotp = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const uid = context.auth.uid;

  // Rate limiting: Prevent SMS/TOTP generation flooding
  // 3 requests per 15 minutes, 60 minute block on exceed
  const rateLimitResult = await consumeRateLimit(smsLimiter, uid);
  if (!rateLimitResult.success) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      rateLimitResult.message
    );
  }

  try {
    // Get user data
    const user = await admin.auth().getUser(uid);
    
    // Generate a new secret
    const secret = new OTPAuth.Secret({ size: 20 });
    
    // Create TOTP instance
    const totp = new OTPAuth.TOTP({
      issuer: "Armory System",
      label: user.email || user.phoneNumber || uid,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: secret,
    });
    
    // Generate QR code
    const otpauthUri = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);
    
    // Store temporary secret in user's custom claims
    await admin.auth().setCustomUserClaims(uid, {
      ...user.customClaims,
      totp_temp_secret: secret.base32,
    });
    
    return {
      qrCodeUrl: qrCodeDataUrl,
      secret: secret.base32,
      otpauthUri: otpauthUri,
    };
  } catch (error) {
    console.error("Error generating TOTP:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to generate TOTP secret"
    );
  }
});

/**
 * Verify TOTP token
 */
exports.verifyTotp = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { token, rememberDevice, deviceFingerprint } = data;
  if (!token) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "TOTP token is required"
    );
  }

  const uid = context.auth.uid;

  // Rate limiting: Prevent brute force attacks on TOTP codes
  // 3 attempts per 5 minutes, 15 minute block on exceed
  const rateLimitResult = await consumeRateLimit(totpLimiter, uid);
  if (!rateLimitResult.success) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      rateLimitResult.message
    );
  }

  try {
    // Get user data
    const user = await admin.auth().getUser(uid);

    // Debug logging
    console.log(`[TOTP Debug] User ${uid} claims:`, {
      totp_enabled: user.customClaims?.totp_enabled,
      has_temp_secret: !!user.customClaims?.totp_temp_secret,
      has_permanent_secret: !!user.customClaims?.totp_secret,
    });

    // Get the secret (either temporary or permanent)
    const tempSecret = user.customClaims?.totp_temp_secret;
    const permanentSecret = user.customClaims?.totp_secret;

    const secret = tempSecret || permanentSecret;

    if (!secret) {
      console.error(`[TOTP Error] No secret found for user ${uid}. Claims:`, user.customClaims);
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No TOTP secret found. Please generate a new secret first."
      );
    }
    
    // Create TOTP instance
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
    
    // Validate token with a window of 1 (allows for time drift)
    const delta = totp.validate({ token, window: 1 });
    
    if (delta === null) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid TOTP token"
      );
    }
    
    // If using temporary secret, make it permanent
    if (tempSecret) {
      console.log(`[TOTP Debug] Converting temp secret to permanent for user ${uid}`);

      const newClaims = {
        ...user.customClaims,
        totp_secret: tempSecret,
        totp_temp_secret: null,
        totp_enabled: true,
      };

      await admin.auth().setCustomUserClaims(uid, newClaims);

      // Verify the claims were set correctly
      const updatedUser = await admin.auth().getUser(uid);
      console.log(`[TOTP Debug] After update, user ${uid} claims:`, {
        totp_enabled: updatedUser.customClaims?.totp_enabled,
        has_temp_secret: !!updatedUser.customClaims?.totp_temp_secret,
        has_permanent_secret: !!updatedUser.customClaims?.totp_secret,
      });

      // Update user profile in Firestore
      await db.collection("users").doc(uid).set({
        totp_enabled: true,
        totp_enabled_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } else {
      console.log(`[TOTP Debug] Using permanent secret for user ${uid}`);
    }

    // Successful verification - reward with 1 point back
    // This prevents penalizing legitimate users who occasionally make mistakes
    await rewardSuccess(totpLimiter, uid);

    // If "Remember Device" was checked, store verification in Firestore
    // This prevents client-side manipulation (localStorage bypass)
    if (rememberDevice && deviceFingerprint) {
      console.log(`\n========================================`);
      console.log(`[TOTP DEVICE VERIFICATION] Starting storage process`);
      console.log(`  User UID: ${uid}`);
      console.log(`  Remember Device: ${rememberDevice}`);
      console.log(`  Device Fingerprint: ${deviceFingerprint}`);

      const twentyFourHours = 24 * 60 * 60 * 1000;
      const verifiedUntil = Date.now() + twentyFourHours;

      console.log(`  Verification will expire at: ${new Date(verifiedUntil).toISOString()}`);

      // Get the authenticated user to find their phone/email
      console.log(`\n[TOTP] STEP 1: Getting Firebase Auth user details...`);
      const authUser = await admin.auth().getUser(uid);
      console.log(`  Auth User Details:`);
      console.log(`    - UID: ${authUser.uid}`);
      console.log(`    - Email: ${authUser.email || 'N/A'}`);
      console.log(`    - Phone: ${authUser.phoneNumber || 'N/A'}`);

      // Find user document in Firestore by phone number or email
      let userDocRef = null;
      let foundBy = null;

      // Try to find by phone number first
      if (authUser.phoneNumber) {
        console.log(`\n[TOTP] STEP 2: Searching for user document by phone number...`);
        console.log(`  Query: db.collection('users').where('phoneNumber', '==', '${authUser.phoneNumber}')`);

        try {
          const usersByPhone = await db.collection("users")
            .where("phoneNumber", "==", authUser.phoneNumber)
            .limit(1)
            .get();

          console.log(`  Query result: Found ${usersByPhone.size} document(s)`);

          if (!usersByPhone.empty) {
            userDocRef = usersByPhone.docs[0].ref;
            foundBy = 'phone';
            const docData = usersByPhone.docs[0].data();
            console.log(`  ✅ Found user document!`);
            console.log(`    - Document ID: ${userDocRef.id}`);
            console.log(`    - Display Name: ${docData.displayName || 'N/A'}`);
            console.log(`    - Linked Soldier: ${docData.linked_soldier_id || 'N/A'}`);
          } else {
            console.log(`  ❌ No document found with phoneNumber='${authUser.phoneNumber}'`);
          }
        } catch (error) {
          console.error(`  ❌ Error searching by phone:`, error);
        }
      } else {
        console.log(`\n[TOTP] STEP 2: Skipping phone search (no phone number in auth)`);
      }

      // If not found by phone, try by email
      if (!userDocRef && authUser.email) {
        console.log(`\n[TOTP] STEP 3: Searching for user document by email...`);
        console.log(`  Query: db.collection('users').where('email', '==', '${authUser.email}')`);

        try {
          const usersByEmail = await db.collection("users")
            .where("email", "==", authUser.email)
            .limit(1)
            .get();

          console.log(`  Query result: Found ${usersByEmail.size} document(s)`);

          if (!usersByEmail.empty) {
            userDocRef = usersByEmail.docs[0].ref;
            foundBy = 'email';
            const docData = usersByEmail.docs[0].data();
            console.log(`  ✅ Found user document!`);
            console.log(`    - Document ID: ${userDocRef.id}`);
            console.log(`    - Display Name: ${docData.displayName || 'N/A'}`);
            console.log(`    - Linked Soldier: ${docData.linked_soldier_id || 'N/A'}`);
          } else {
            console.log(`  ❌ No document found with email='${authUser.email}'`);
          }
        } catch (error) {
          console.error(`  ❌ Error searching by email:`, error);
        }
      } else if (!userDocRef) {
        console.log(`\n[TOTP] STEP 3: Skipping email search (no email in auth or already found)`);
      }

      // If still not found, fall back to uid (for safety)
      if (!userDocRef) {
        console.log(`\n[TOTP] STEP 4: Using fallback - document ID = UID`);
        console.log(`  Creating reference: db.collection('users').doc('${uid}')`);
        userDocRef = db.collection("users").doc(uid);
        foundBy = 'uid';
      }

      // Store verification status in the found user document
      console.log(`\n[TOTP] STEP 5: Storing verification data...`);
      console.log(`  Target document: ${userDocRef.id}`);
      console.log(`  Found by: ${foundBy}`);
      console.log(`  Data to store:`);
      console.log(`    - totp_verified_until: ${new Date(verifiedUntil).toISOString()}`);
      console.log(`    - totp_device_fingerprint: ${deviceFingerprint}`);
      console.log(`    - totp_verified_at: [server timestamp]`);

      try {
        await userDocRef.set({
          totp_verified_until: admin.firestore.Timestamp.fromMillis(verifiedUntil),
          totp_device_fingerprint: deviceFingerprint,
          totp_verified_at: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`\n[TOTP] ✅ SUCCESS: Verification data stored successfully!`);
        console.log(`  Document: users/${userDocRef.id}`);
        console.log(`  Method: ${foundBy}`);
        console.log(`========================================\n`);
      } catch (error) {
        console.error(`\n[TOTP] ❌ ERROR: Failed to store verification data!`);
        console.error(`  Error:`, error);
        console.error(`========================================\n`);
        throw error;
      }
    } else {
      console.log(`[TOTP] Skipping device verification storage (rememberDevice=${rememberDevice}, deviceFingerprint=${deviceFingerprint})`);
    }

    return {
      success: true,
      message: "TOTP verification successful",
    };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    console.error("Error verifying TOTP:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to verify TOTP token"
    );
  }
});

/**
 * Update user data (custom claims)
 * Used for linking soldiers to user accounts and other user updates
 */
exports.updateUserData = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const { userId, updates } = data;
    const requestingUserId = context.auth.uid;
    const isAdmin = context.auth.token.role === "admin";

    // If userId is not provided, update the requesting user
    const targetUserId = userId || requestingUserId;

    // Check permissions: users can update themselves, admins can update anyone
    if (targetUserId !== requestingUserId && !isAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You can only update your own user data"
      );
    }

    try {
      // Get current user data
      const user = await admin.auth().getUser(targetUserId);
      const currentClaims = user.customClaims || {};

      // Allowed fields to update
      const allowedFields = ["linked_soldier_id", "custom_role", "permissions", "totp_enabled", "totp_temp_secret"];
      
      // Filter updates to only allowed fields
      const filteredUpdates = {};
      for (const field of allowedFields) {
        if (updates.hasOwnProperty(field)) {
          filteredUpdates[field] = updates[field];
        }
      }

      // Merge updates with existing claims
      const newClaims = {
        ...currentClaims,
        ...filteredUpdates,
      };

      // Update custom claims
      await admin.auth().setCustomUserClaims(targetUserId, newClaims);

      // Log activity
      await db.collection("activity_logs").add({
        entity_type: "user",
        action: "update_user_data",
        entity_id: targetUserId,
        performed_by: requestingUserId,
        details: {
          updates: filteredUpdates,
        },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        message: "User data updated successfully",
        updates: filteredUpdates,
      };
    } catch (error) {
      console.error("Error updating user data:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Failed to update user data: ${error.message}`
      );
    }
  });