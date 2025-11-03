import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, AlertCircle, Phone, Mail } from 'lucide-react';
import { User } from '@/api/entities';

export default function AccessDenied() {
  const handleLogout = async () => {
    try {
      await User.logout();
      window.location.href = '/login';
    } catch (error) {
    }
  };

  const handleContactAdmin = () => {
    // Could open email client or show contact info
    window.location.href = 'mailto:admin@armory.com?subject=Access Request&body=I need access to the Armory Management System.';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Shield className="h-16 w-16 text-gray-400" />
              <AlertCircle className="h-8 w-8 text-red-500 absolute -bottom-1 -right-1" />
            </div>
          </div>
          <CardTitle className="text-2xl text-red-600">Access Denied</CardTitle>
          <CardDescription className="text-base mt-2">
            You don't have permission to access this system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">Why am I seeing this?</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Your account has not been assigned a role</li>
              <li>• You need to be linked to a soldier profile</li>
              <li>• Your permissions haven't been configured</li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">What to do next?</h3>
            <p className="text-sm text-blue-800 mb-3">
              Contact your system administrator to request access. They will need to:
            </p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>1. Assign you a role (Soldier, Manager, or Admin)</li>
              <li>2. Link your account to your soldier profile</li>
              <li>3. Configure your permissions</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleContactAdmin}
              className="w-full"
              variant="default"
            >
              <Mail className="w-4 h-4 mr-2" />
              Contact Administrator
            </Button>
            
            <Button 
              onClick={handleLogout}
              variant="outline"
              className="w-full"
            >
              Sign Out
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              If you believe this is an error, please contact your unit's IT support
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}