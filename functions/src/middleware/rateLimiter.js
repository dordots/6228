const { RateLimiterMemory } = require('rate-limiter-flexible');

/**
 * Rate Limiter Middleware for Authentication Security
 *
 * Prevents brute force attacks on:
 * - TOTP verification attempts
 * - Login attempts
 * - SMS verification code requests
 *
 * Uses in-memory rate limiting (resets on cold start - acceptable for MVP)
 * Can be upgraded to Firestore-based for distributed limiting if needed
 */

/**
 * TOTP Verification Rate Limiter
 * - 3 attempts per 5 minutes
 * - 15 minute block on exceed
 * - Prevents brute force on 6-digit TOTP codes (1M combinations)
 */
const totpLimiter = new RateLimiterMemory({
  points: 3,          // Number of attempts allowed
  duration: 300,      // Per 5 minutes (in seconds)
  blockDuration: 900, // Block for 15 minutes (in seconds)
});

/**
 * Login Attempts Rate Limiter
 * - 5 attempts per 5 minutes
 * - 30 minute block on exceed
 * - Prevents credential stuffing and dictionary attacks
 */
const loginLimiter = new RateLimiterMemory({
  points: 5,           // Number of attempts allowed
  duration: 300,       // Per 5 minutes (in seconds)
  blockDuration: 1800, // Block for 30 minutes (in seconds)
});

/**
 * SMS Request Rate Limiter
 * - 3 requests per 15 minutes
 * - 60 minute block on exceed
 * - Prevents SMS flooding and service abuse
 */
const smsLimiter = new RateLimiterMemory({
  points: 3,           // Number of SMS requests allowed
  duration: 900,       // Per 15 minutes (in seconds)
  blockDuration: 3600, // Block for 60 minutes (in seconds)
});

/**
 * Helper function to consume rate limit points
 * Returns a promise that resolves on success or rejects with retry info on failure
 *
 * @param {RateLimiterMemory} limiter - The rate limiter instance to use
 * @param {string} key - The key to track (usually user ID)
 * @returns {Promise<void>} - Resolves if allowed, rejects with retry info if blocked
 */
async function consumeRateLimit(limiter, key) {
  try {
    await limiter.consume(key);
    return { success: true };
  } catch (rejRes) {
    // rejRes contains:
    // - msBeforeNext: milliseconds until the rate limit resets
    // - remainingPoints: points remaining (will be negative if blocked)

    const secondsBeforeNext = Math.ceil(rejRes.msBeforeNext / 1000);
    const minutesBeforeNext = Math.ceil(secondsBeforeNext / 60);

    return {
      success: false,
      retryAfter: secondsBeforeNext,
      retryAfterMinutes: minutesBeforeNext,
      message: secondsBeforeNext > 60
        ? `Too many attempts. Try again in ${minutesBeforeNext} minute${minutesBeforeNext > 1 ? 's' : ''}.`
        : `Too many attempts. Try again in ${secondsBeforeNext} second${secondsBeforeNext > 1 ? 's' : ''}.`
    };
  }
}

/**
 * Helper function to reward successful attempts
 * Gives back 1 point to not penalize legitimate users who make an occasional mistake
 *
 * @param {RateLimiterMemory} limiter - The rate limiter instance
 * @param {string} key - The key to reward
 */
async function rewardSuccess(limiter, key) {
  try {
    await limiter.reward(key, 1);
  } catch (error) {
    // Ignore errors in reward (non-critical)
    console.warn('Failed to reward rate limit point:', error.message);
  }
}

module.exports = {
  totpLimiter,
  loginLimiter,
  smsLimiter,
  consumeRateLimit,
  rewardSuccess
};
