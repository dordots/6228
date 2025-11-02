const admin = require('firebase-admin');

/**
 * Middleware to verify Firebase App Check tokens on Cloud Functions
 * This ensures that only requests from legitimate apps with valid App Check tokens
 * can call your Cloud Functions.
 */
function verifyAppCheck(req, res, next) {
  // Skip App Check verification in emulator/development mode
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    console.log('⚠️  App Check: Skipping in emulator mode');
    return next();
  }

  // Get the App Check token from the request header
  const appCheckToken = req.header('X-Firebase-AppCheck');

  if (!appCheckToken) {
    console.error('❌ App Check: Missing token');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing App Check token'
    });
  }

  // Verify the App Check token
  admin.appCheck()
    .verifyToken(appCheckToken)
    .then((appCheckClaims) => {
      // Token is valid
      console.log('✅ App Check: Token verified', {
        appId: appCheckClaims.app_id,
        alreadyConsumed: appCheckClaims.already_consumed
      });
      return next();
    })
    .catch((error) => {
      // Token is invalid
      console.error('❌ App Check: Token verification failed', error);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid App Check token'
      });
    });
}

/**
 * Optional: Consume App Check tokens (one-time use)
 * Use this for sensitive operations that should only be performed once
 */
function verifyAndConsumeAppCheck(req, res, next) {
  // Skip App Check verification in emulator/development mode
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    console.log('⚠️  App Check: Skipping in emulator mode');
    return next();
  }

  const appCheckToken = req.header('X-Firebase-AppCheck');

  if (!appCheckToken) {
    console.error('❌ App Check: Missing token');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing App Check token'
    });
  }

  // Verify and consume the token (one-time use)
  admin.appCheck()
    .verifyToken(appCheckToken, { consume: true })
    .then((appCheckClaims) => {
      if (appCheckClaims.already_consumed) {
        console.error('❌ App Check: Token already consumed');
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'App Check token already used'
        });
      }

      console.log('✅ App Check: Token verified and consumed', {
        appId: appCheckClaims.app_id
      });
      return next();
    })
    .catch((error) => {
      console.error('❌ App Check: Token verification failed', error);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid App Check token'
      });
    });
}

module.exports = {
  verifyAppCheck,
  verifyAndConsumeAppCheck
};
