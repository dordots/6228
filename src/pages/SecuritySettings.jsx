
import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { generateTotp } from '@/api/functions';
import { verifyTotp } from '@/api/functions'; // Keep original separate import
import { Loader2, ShieldCheck, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SecuritySettings({ onSetupComplete, isRequired = false }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // General loading for initial fetch, generate secret, etc.
    const navigate = useNavigate();

    // TOTP specific states (refactored from original setupData and verificationCode)
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [secret, setSecret] = useState('');
    const [token, setToken] = useState(''); // Represents the 6-digit code for verification

    const [error, setError] = useState('');     // General error message for all operations
    const [success, setSuccess] = useState(''); // General success message for all operations
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            setError('');
            setSuccess('');
            setIsLoading(true); // Set loading for initial user data fetch
            try {
                const currentUser = await User.me();
                setUser(currentUser);
            } catch (err) {
                setError("Could not load user data.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchUser();
    }, []);

    const handleGenerateSecret = async () => {
        setError('');
        setSuccess('');
        setIsLoading(true);
        setQrCodeUrl(''); // Clear any previous QR code
        setSecret('');    // Clear any previous secret
        setToken('');     // Clear token input for new setup
        try {
            const response = await generateTotp();
            // Handle Firebase wrapper response structure
            if (response.success && response.data) {
                setQrCodeUrl(response.data.qrCodeUrl);
                setSecret(response.data.secret);
            } else {
                setError(response.error || "Failed to generate a new secret. Please try again.");
            }
        } catch (err) {
            setError("Failed to generate a new secret. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyToken = async () => { // Renamed from handleVerifyAndEnable as per outline
        if (token.length !== 6) {
            setError("Please enter a valid 6-digit code.");
            return;
        }
        setError('');
        setSuccess('');
        setIsLoading(true);
        try {
            const response = await verifyTotp({ token: token, isSetup: true });

            // Handle Firebase wrapper response structure
            if (response.success && response.data?.success) {
                const message = isRequired ?
                    "2-Factor Authentication has been successfully set up! You can now access the application." :
                    "2-Factor Authentication has been successfully enabled!";
                setSuccess(message);
                setUser(prev => ({ ...prev, totp_enabled: true }));
                setQrCodeUrl(''); // Clear setup data after successful verification
                setSecret('');
                setToken('');
                
                // Reload user data to get updated claims (force refresh to get latest from server)
                try {
                    const updatedUser = await User.me(true); // Force refresh token
                    setUser(updatedUser);
                } catch (err) {
                }
                
                // For required setup, call onSetupComplete after a short delay to allow UI update
                if (isRequired && onSetupComplete) {
                    // Small delay to show success message before redirecting
                    setTimeout(() => {
                        onSetupComplete();
                    }, 1500);
                }
            } else {
                const errorMessage = response.error || response.data?.message || "Invalid verification code. Please try again.";
                setError(errorMessage);
            }
        } catch (err) {
            setError("An error occurred during verification. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await User.logout();
            // Server-side verification will be cleared on logout automatically
            navigate('/login');
        } catch (error) {
            setError('Failed to logout. Please try again.');
        }
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                    <ShieldCheck className="h-8 w-8 text-slate-800" /> {/* Updated icon */}
                    {isRequired ? "Set Up Required Security" : "Security Settings"}
                </h1>
                <p className="text-slate-600">
                    {isRequired ?
                        "Two-factor authentication is required for all users. Please set it up to continue." :
                        "Manage your account security settings, including two-factor authentication."
                    }
                </p>
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
                    <CardDescription>
                        {isRequired
                            ? "To protect your account, you must set up two-factor authentication."
                            : "Add an extra layer of security to your account using an authenticator app."}
                    </CardDescription>
                    {isRequired && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <p className="text-sm text-blue-800">
                                <strong>Why is this required?</strong> Two-factor authentication adds an extra layer of security to protect sensitive armory data and prevent unauthorized access.
                            </p>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="space-y-6">
                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
                            <p>{error}</p>
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md">
                            <p>{success}</p>
                        </div>
                    )}

                    {isLoading && !user ? ( // Show a simple loading indicator for initial user data fetch
                        <div className="flex flex-col space-y-3 p-4">
                            <div className="h-4 w-3/4 bg-slate-200 animate-pulse rounded"></div>
                            <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded"></div>
                            <div className="h-10 w-48 bg-slate-200 animate-pulse rounded"></div>
                        </div>
                    ) : (
                        !user?.totp_enabled ? (
                            <div>
                                <p className="mb-4 text-slate-700">
                                    {!qrCodeUrl ? "Click the button below to generate a new QR code for your authenticator app (like Google Authenticator, Authy, or 1Password)." : "Scan the QR code below with your authenticator app, then enter the 6-digit code to verify."}
                                </p>
                                {!qrCodeUrl ? (
                                    <Button onClick={handleGenerateSecret} disabled={isLoading}>
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Generate 2FA Secret
                                    </Button>
                                ) : (
                                    <div className="flex flex-col md:flex-row items-start gap-6">
                                        <div className="p-4 bg-white border rounded-lg">
                                            {/* Assuming qrCodeUrl is a base64 or URL */}
                                            <img src={qrCodeUrl} alt="TOTP QR Code" className="w-32 h-32 md:w-48 md:h-48" />
                                        </div>
                                        <div className="space-y-4 flex-1">
                                            <p className="text-sm text-slate-600">If you can't scan the QR code, you can manually enter this secret key into your authenticator app:</p>
                                            <div className="bg-slate-100 p-3 rounded-md font-mono text-center tracking-widest text-slate-800 break-all">{secret}</div>
                                            <div className="space-y-2">
                                                <Input
                                                    type="text"
                                                    placeholder="6-digit code"
                                                    value={token}
                                                    onChange={(e) => setToken(e.target.value)}
                                                    className="max-w-xs text-lg tracking-widest"
                                                    maxLength={6} // Enforce 6-digit length
                                                />
                                                <Button onClick={handleVerifyToken} disabled={isLoading || token.length !== 6}>
                                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                    Verify & Enable 2FA
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 bg-green-50 p-4 rounded-lg border border-green-200">
                                <ShieldCheck className="w-8 h-8 text-green-600 shrink-0" />
                                <div>
                                    <h3 className="font-semibold text-green-800">Two-Factor Authentication is Enabled</h3>
                                    <p className="text-sm text-green-700">Your account is protected with an additional layer of security.</p>
                                </div>
                            </div>
                        )
                    )}
                    {isRequired && user?.totp_enabled && (
                        <div className="mt-4">
                            <Button 
                                onClick={() => {
                                    if (onSetupComplete) {
                                        onSetupComplete();
                                    } else {
                                        window.location.href = '/dashboard';
                                    }
                                }} 
                                className="w-full"
                            >
                                Continue to Dashboard
                            </Button>
                        </div>
                    )}
                    {isRequired && !user?.totp_enabled && (
                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <div className="text-center">
                                {showLogoutConfirm ? (
                                    <div className="flex gap-3 items-center justify-center">
                                        <span className="text-sm text-slate-600">Are you sure you want to logout?</span>
                                        <Button
                                            onClick={handleLogout}
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            Yes, logout
                                        </Button>
                                        <Button
                                            onClick={() => setShowLogoutConfirm(false)}
                                            variant="ghost"
                                            size="sm"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        onClick={() => setShowLogoutConfirm(true)}
                                        variant="ghost"
                                        className="text-slate-600 hover:text-slate-800"
                                    >
                                        <LogOut className="w-4 h-4 mr-2" />
                                        Cancel Setup & Logout
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
