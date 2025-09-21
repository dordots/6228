import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { verifyTotp } from '@/api/functions';

export default function TotpVerificationPrompt({ onSuccess, isSetup = false }) {
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
      // The function call now directly returns the response body on success
      if (response.data.success) {
        onSuccess();
      } else {
        // This case might not be hit if errors are always thrown, but good for robustness
        setErrorMessage(response.data.message || 'Invalid token. Please try again.');
      }
    } catch (error) {
      console.error("Error during TOTP verification:", error);
      const serverError = error.response?.data?.message || 'An unknown error occurred. Please try again.';
      setErrorMessage(serverError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setToken(value);
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
              <p className="text-sm text-red-500">{errorMessage}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}