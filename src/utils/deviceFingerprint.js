/**
 * Device Fingerprint Utility
 *
 * Generates a simple browser fingerprint for device identification.
 * This is used to implement "Remember this device" for TOTP verification.
 *
 * Note: This is NOT cryptographically secure fingerprinting.
 * It's meant to differentiate between different devices/browsers,
 * not to uniquely identify users across sessions.
 *
 * For a production military system, consider using a library like
 * FingerprintJS for more robust fingerprinting.
 */

/**
 * Generate a simple device fingerprint based on browser characteristics
 * @returns {string} A hash representing this device/browser
 */
export const getDeviceFingerprint = () => {
  // Collect various browser/device characteristics
  const components = [
    navigator.userAgent || '',
    navigator.language || '',
    new Date().getTimezoneOffset().toString(),
    screen.colorDepth?.toString() || '',
    `${screen.width}x${screen.height}`,
    navigator.hardwareConcurrency?.toString() || '',
    navigator.platform || ''
  ];

  // Join all components
  const fingerprintString = components.join('|');

  // Simple hash function (djb2 algorithm)
  let hash = 5381;
  for (let i = 0; i < fingerprintString.length; i++) {
    const char = fingerprintString.charCodeAt(i);
    hash = ((hash << 5) + hash) + char; // hash * 33 + char
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to base36 for shorter string
  return Math.abs(hash).toString(36);
};

/**
 * Get a more detailed device info string (for logging/debugging)
 * @returns {object} Device information
 */
export const getDeviceInfo = () => {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset()
  };
};
