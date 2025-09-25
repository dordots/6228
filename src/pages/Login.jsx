import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, Phone, Mail, ArrowLeft } from 'lucide-react';
import { parsePhoneNumber, isValidPhoneNumber, AsYouType } from 'libphonenumber-js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COUNTRY_CODES = [
  { code: 'IL', name: 'Israel', dial: '+972', flag: '🇮🇱' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
];

export default function Login() {
  const [loginMethod, setLoginMethod] = useState('phone'); // 'phone' or 'email'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('IL');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState(0);

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

  const getFullPhoneNumber = () => {
    const country = COUNTRY_CODES.find(c => c.code === countryCode);
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return `${country.dial}${cleanPhone}`;
  };

  const validatePhoneNumber = () => {
    const fullNumber = getFullPhoneNumber();
    return isValidPhoneNumber(fullNumber, countryCode);
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
          window.location.href = '/';
        }
      } catch (err) {
        console.error('Phone login error:', err);
        setError(err.message || 'Failed to send verification code');
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
          window.location.href = '/';
        }
      } catch (err) {
        console.error('Verification error:', err);
        setError(err.message || 'Invalid verification code');
      }
    }

    setLoading(false);
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await User.login({ emailOrPhone: email, password });
      
      if (result.requiresVerification) {
        setError('Phone verification not implemented for email login');
        setLoading(false);
        return;
      }

      // Successful login
      window.location.href = '/';
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
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
      setError('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const switchLoginMethod = () => {
    setLoginMethod(loginMethod === 'phone' ? 'email' : 'phone');
    setError('');
    setVerificationStep(false);
    setVerificationCode('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl text-center">Armory System</CardTitle>
          <CardDescription className="text-center">
            {loginMethod === 'phone' 
              ? verificationStep 
                ? 'Enter the code sent to your phone'
                : 'Sign in with your phone number'
              : 'Sign in with email and password'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Add reCAPTCHA container for phone auth */}
          <div id="recaptcha-container"></div>
          
          {loginMethod === 'phone' ? (
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
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
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
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@armory.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          )}
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or</span>
              </div>
            </div>
            
            <Button
              type="button"
              variant="outline"
              className="w-full mt-4"
              onClick={switchLoginMethod}
            >
              {loginMethod === 'phone' ? (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Sign in with Email
                </>
              ) : (
                <>
                  <Phone className="mr-2 h-4 w-4" />
                  Sign in with Phone
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}