import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Phone, ArrowLeft } from 'lucide-react';
import { parsePhoneNumber, isValidPhoneNumber, AsYouType } from 'libphonenumber-js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COUNTRY_CODES = [
  { code: 'IL', name: 'Israel', dial: '+972', flag: '🇮🇱' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
];

// Helper function to get redirect URL based on user role
const getRedirectUrl = async () => {
  try {
    const user = await User.me();
    // Redirect soldiers to their personal dashboard
    if (user?.custom_role === 'soldier') {
      return '/soldier-dashboard';
    }
    // All other roles go to main dashboard
    return '/';
  } catch (error) {
    // Default to dashboard on error
    return '/';
  }
};

export default function Login() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('IL');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [rateLimitTimer, setRateLimitTimer] = useState(0); // For rate limiting countdown

  // Format phone number as user types
  useEffect(() => {
    if (phoneNumber) {
      const formatter = new AsYouType(countryCode);
      setFormattedPhone(formatter.input(phoneNumber));
    } else {
      setFormattedPhone('');
    }
  }, [phoneNumber, countryCode]);

  // Cooldown timer for SMS resend
  useEffect(() => {
    if (cooldownTimer > 0) {
      const timer = setTimeout(() => setCooldownTimer(cooldownTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownTimer]);

  // Rate limit countdown timer
  useEffect(() => {
    if (rateLimitTimer > 0) {
      const timer = setTimeout(() => setRateLimitTimer(rateLimitTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [rateLimitTimer]);

  const getFullPhoneNumber = () => {
    const country = COUNTRY_CODES.find(c => c.code === countryCode);
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return `${country.dial}${cleanPhone}`;
  };

  const validatePhoneNumber = () => {
    const fullNumber = getFullPhoneNumber();
    return isValidPhoneNumber(fullNumber, countryCode);
  };

  // Helper to parse rate limit errors and extract retry time
  const parseRateLimitError = (errorMessage) => {
    // Example: "Too many attempts. Try again in 15 minutes." or "Too many attempts. Try again in 30 seconds."
    const minutesMatch = errorMessage.match(/(\d+)\s+minute/i);
    const secondsMatch = errorMessage.match(/(\d+)\s+second/i);

    if (minutesMatch) {
      return parseInt(minutesMatch[1]) * 60; // Convert to seconds
    } else if (secondsMatch) {
      return parseInt(secondsMatch[1]);
    }
    return 60; // Default to 60 seconds if parsing fails
  };

  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!verificationStep) {
      // Step 1: Send SMS
      if (!validatePhoneNumber()) {
        setError('Please enter a valid phone number');
        setLoading(false);
        return;
      }

      try {
        const fullNumber = getFullPhoneNumber();
        const result = await User.login({ emailOrPhone: fullNumber });
        
        if (result.requiresVerification) {
          setVerificationStep(true);
          setCooldownTimer(60); // 60 second cooldown
        } else {
          // Shouldn't happen for phone login
          window.location.href = await getRedirectUrl();
        }
      } catch (err) {
        // Handle Firebase rate limiting errors
        if (err.code === 'auth/too-many-requests') {
          // Set rate limit timer if available
          const waitMinutes = err.retryAfterMinutes || 15;
          setRateLimitTimer(waitMinutes * 60); // Convert to seconds
          setError(err.message || `Too many SMS requests. Please wait ${waitMinutes} minutes and try again.`);
        } else if (err.message?.includes('too-many-requests') || err.message?.includes('Too many attempts')) {
          setError(err.message);
        } else {
          setError(err.message || 'Failed to send verification code');
        }
      }
    } else {
      // Step 2: Verify code
      if (!verificationCode || verificationCode.length !== 6) {
        setError('Please enter a 6-digit verification code');
        setLoading(false);
        return;
      }

      try {
        const fullNumber = getFullPhoneNumber();
        const result = await User.login({
          emailOrPhone: fullNumber,
          verificationCode
        });

        if (!result.requiresVerification) {
          // Successful login
          window.location.href = await getRedirectUrl();
        }
      } catch (err) {
        // Check for rate limiting error
        if (err.code === 'functions/resource-exhausted') {
          const retrySeconds = parseRateLimitError(err.message);
          setRateLimitTimer(retrySeconds);
          setError(err.message);
        } else {
          setError(err.message || 'Invalid verification code');
        }
      }
    }

    setLoading(false);
  };

  const resendSMS = async () => {
    if (cooldownTimer > 0) return;
    
    setLoading(true);
    setError('');
    
    try {
      const fullNumber = getFullPhoneNumber();
      await User.login({ emailOrPhone: fullNumber });
      setCooldownTimer(60);
      setError(''); // Clear any previous errors
    } catch (err) {
      // Handle Firebase rate limiting errors
      if (err.code === 'auth/too-many-requests') {
        const waitMinutes = err.retryAfterMinutes || 15;
        setRateLimitTimer(waitMinutes * 60); // Convert to seconds
        setError(err.message || `Too many SMS requests. Please wait ${waitMinutes} minutes before trying again.`);
      } else if (err.message?.includes('too-many-requests') || err.message?.includes('Too many attempts')) {
        setError(err.message);
      } else {
        setError('Failed to resend code');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <img src="/logo.png" alt="Armory Logo" className="h-12 w-12 object-contain" />
          </div>
          <CardTitle className="text-2xl text-center">Armory System</CardTitle>
          <CardDescription className="text-center">
            {verificationStep
              ? 'Enter the code sent to your phone'
              : 'Sign in with your phone number'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Add reCAPTCHA container for phone auth */}
          <div id="recaptcha-container"></div>

          <form onSubmit={handlePhoneLogin} className="space-y-4">
              {!verificationStep ? (
                <>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select value={countryCode} onValueChange={setCountryCode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map(country => (
                          <SelectItem key={country.code} value={country.code}>
                            <span className="flex items-center gap-2">
                              <span>{country.flag}</span>
                              <span>{country.name}</span>
                              <span className="text-gray-500">{country.dial}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex gap-2">
                      <div className="flex items-center px-3 bg-gray-100 rounded-md">
                        <span className="text-sm font-medium">
                          {COUNTRY_CODES.find(c => c.code === countryCode)?.dial}
                        </span>
                      </div>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="50 123 4567"
                        value={formattedPhone}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        required
                        disabled={loading}
                        className="flex-1"
                        autoFocus
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="code">Verification Code</Label>
                    <Input
                      id="code"
                      type="text"
                      placeholder="123456"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      disabled={loading}
                      autoFocus
                      className="text-center text-2xl font-mono tracking-widest"
                      maxLength={6}
                    />
                    <div className="flex justify-between items-center text-sm">
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => setVerificationStep(false)}
                        className="p-0"
                      >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Change number
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        onClick={resendSMS}
                        disabled={cooldownTimer > 0 || loading}
                        className="p-0"
                      >
                        {cooldownTimer > 0 
                          ? `Resend in ${cooldownTimer}s` 
                          : 'Resend code'
                        }
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {error}
                    {rateLimitTimer > 0 && (
                      <div className="mt-2 font-semibold">
                        Time remaining: {rateLimitTimer > 60
                          ? `${Math.floor(rateLimitTimer / 60)}m ${rateLimitTimer % 60}s`
                          : `${rateLimitTimer}s`}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || rateLimitTimer > 0}
              >
                {rateLimitTimer > 0 ? (
                  <>
                    Blocked - Try again in {rateLimitTimer > 60 ? `${Math.ceil(rateLimitTimer / 60)}m` : `${rateLimitTimer}s`}
                  </>
                ) : loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {verificationStep ? 'Verifying...' : 'Sending code...'}
                  </>
                ) : (
                  <>
                    {verificationStep ? 'Verify & Sign In' : 'Send verification code'}
                  </>
                )}
              </Button>
            </form>
        </CardContent>
      </Card>
    </div>
  );
}