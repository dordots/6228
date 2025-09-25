const functions = require("firebase-functions");
const admin = require("firebase-admin");
const OTPAuth = require("otpauth");
const QRCode = require("qrcode");

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

  const { token } = data;
  if (!token) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "TOTP token is required"
    );
  }

  const uid = context.auth.uid;

  try {
    // Get user data
    const user = await admin.auth().getUser(uid);
    
    // Get the secret (either temporary or permanent)
    const tempSecret = user.customClaims?.totp_temp_secret;
    const permanentSecret = user.customClaims?.totp_secret;
    
    const secret = tempSecret || permanentSecret;
    
    if (!secret) {
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
      await admin.auth().setCustomUserClaims(uid, {
        ...user.customClaims,
        totp_secret: tempSecret,
        totp_temp_secret: null,
        totp_enabled: true,
      });
      
      // Update user profile in Firestore
      await db.collection("users").doc(uid).set({
        totp_enabled: true,
        totp_enabled_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
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
      const allowedFields = ["linked_soldier_id", "custom_role", "permissions"];
      
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