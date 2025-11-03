import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertCircle, LogOut } from "lucide-react";
import { verifyTotp } from '@/api/functions';
import { User } from '@/api/entities';
import { useNavigate } from 'react-router-dom';

export default function TotpVerificationPrompt({ onSuccess, isSetup = false }) {
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true); // Default to checked
  const navigate = useNavigate();

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!token || token.length !== 6) {
      setErrorMessage("Please enter a 6-digit code.");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");

    try {
      // Pass rememberDevice to server for server-side verification storage
      const response = await verifyTotp({ token, isSetup, rememberDevice });

      // Check if the response indicates success
      // The Firebase wrapper returns {success: true, data: {success: true, message: "..."}}
      if (response.success && response.data?.success) {
        // SUCCESS: Server has stored verification status in custom claims
        // No need to store in localStorage anymore - server is source of truth
        onSuccess();
      } else if (response.success === false) {
        // Handle error from Firebase wrapper

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
      setErrorMessage('Failed to reset 2FA setup. Please try again.');
    }
  };
  
  const handleLogout = async () => {
    try {
      await User.logout();
      // Server-side verification will be cleared on logout automatically
      navigate('/login');
    } catch (error) {
      setErrorMessage('Failed to logout. Please try again.');
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
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember" 
                checked={rememberDevice}
                onCheckedChange={setRememberDevice}
              />
              <Label 
                htmlFor="remember" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Remember this device for 24 hours
              </Label>
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
            {/* Help section */}
            <div className="pt-3 mt-3 border-t text-center">
              <p className="text-xs text-slate-500 mb-2">Lost access to your authenticator?</p>
              <div className="flex justify-center gap-4 text-xs">
                <a href="tel:+972XXXXXXXX" className="text-blue-600 hover:underline">
                  Call IT: +972-XX-XXXXXXX
                </a>
                <span className="text-slate-400">|</span>
                <a href="mailto:support@armory.mil" className="text-blue-600 hover:underline">
                  Email Support
                </a>
              </div>
            </div>
            <div className="relative">
              {showLogoutConfirm ? (
                <div className="flex gap-2 items-center w-full">
                  <span className="text-sm text-slate-600">Are you sure?</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-red-600 hover:text-red-700"
                  >
                    Yes, logout
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLogoutConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-slate-600 hover:text-slate-800"
                  onClick={() => setShowLogoutConfirm(true)}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              )}
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}