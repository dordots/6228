import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import { verifyTotp } from '@/api/functions';
import { User } from '@/api/entities';

export default function TotpVerificationPrompt({ onSuccess, isSetup = false }) {
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!token || token.length !== 6) {
      setErrorMessage("Please enter a 6-digit code.");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await verifyTotp({ token, isSetup });
      console.log('TOTP verification response:', response); // Debug log
      
      // Check if the response indicates success
      // The Firebase wrapper returns {success: true, data: {success: true, message: "..."}}
      if (response.success && response.data?.success) {
        onSuccess();
      } else if (response.success === false) {
        // Handle error from Firebase wrapper
        console.error('TOTP verification failed:', response);
        
        // Check if the error is about missing TOTP secret
        if (response.error && response.error.includes('No TOTP secret found')) {
          setNeedsSetup(true);
          setErrorMessage('2FA setup incomplete. Please complete the setup first.');
        } else {
          setErrorMessage(response.error || 'Invalid verification code. Please try again.');
        }
      } else {
        // Handle case where Firebase function returned success: false
        setErrorMessage(response.data?.message || 'Invalid verification code. Please try again.');
      }
    } catch (error) {
      console.error("Error during TOTP verification:", error);
      // Handle any unexpected errors
      const errorMessage = error.details?.message || error.message || 'An unknown error occurred. Please try again.';
      
      // Check if the error is about missing TOTP secret
      if (errorMessage.includes('No TOTP secret found')) {
        setNeedsSetup(true);
        setErrorMessage('2FA setup incomplete. Please complete the setup first.');
      } else {
        setErrorMessage(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setToken(value);
  };
  
  const handleResetSetup = async () => {
    try {
      // Reset the user's TOTP status to force re-setup
      await User.updateMyUserData({ totp_enabled: false });
      // Reload the page to trigger the setup flow
      window.location.reload();
    } catch (error) {
      console.error('Error resetting TOTP setup:', error);
      setErrorMessage('Failed to reset 2FA setup. Please try again.');
    }
  };
  
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-slate-100">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleVerify}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Verification Code</Label>
              <Input
                id="token"
                type="text"
                maxLength="6"
                placeholder="123456"
                value={token}
                onChange={handleInputChange}
                required
                autoFocus
              />
            </div>
            {errorMessage && (
              <div className="space-y-2">
                <p className="text-sm text-red-500">{errorMessage}</p>
                {needsSetup && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium">Setup Required</p>
                        <p className="mt-1">Your 2FA setup is incomplete. Click below to start the setup process.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isLoading || needsSetup}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
            </Button>
            {needsSetup && (
              <Button 
                type="button" 
                variant="outline" 
                className="w-full" 
                onClick={handleResetSetup}
              >
                Complete 2FA Setup
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}