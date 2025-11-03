import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2 } from "lucide-react";

export default function AdminRequired({ children, fallback = null, permission = null }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
      } catch (error) {
        setCurrentUser(null);
      }
      setIsLoading(false);
    };

    loadCurrentUser();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-600">Checking permissions...</span>
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'admin';
  const hasPermission = permission ? currentUser?.permissions?.[permission] : true;
  const hasAccess = isAdmin || hasPermission;

  if (!hasAccess) {
    return fallback || (
      <div className="p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access denied. You don't have permission to access this feature.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return children;
}