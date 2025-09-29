

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Shield, Users, Wrench, Target, BarChart3, User, Binoculars, Upload, ClipboardCheck, Joystick, Puzzle, ArrowLeft, Package, Home, ArrowRightLeft, History, Download, Lock, Calendar, LogOut } from "lucide-react";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import TotpVerificationPrompt from "@/components/auth/TotpVerificationPrompt";
import { User as UserEntity } from "@/api/entities";
import { Soldier } from "@/api/entities";
import SecuritySettings from "@/pages/SecuritySettings";
import SoldierLinkingDialog from "@/components/auth/SoldierLinkingDialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const getNavigationItems = (permissions, userRole, linkedSoldierId) => {
  // Soldier role - very limited navigation, only view their own equipment
  if (userRole === 'soldier') {
    return [
      {
        title: "My Equipment",
        url: createPageUrl("MyEquipment"),
        icon: Wrench,
      },
      {
        title: "My Weapons",
        url: createPageUrl("MyWeapons"),
        icon: Target,
      },
      {
        title: "My Gear",
        url: createPageUrl("MyGear"),
        icon: Binoculars,
      },
      {
        title: "My Drone Sets",
        url: createPageUrl("MyDrones"),
        icon: Joystick,
      },
      {
        title: "Security",
        url: createPageUrl("SecuritySettings"),
        icon: Lock,
      },
    ];
  }

  // Navigation items with new permission structure
  const allItems = [
    {
      title: "Signing",
      url: createPageUrl("SoldierManagement"),
      icon: User,
      permission: 'operations.sign',
    },
    {
      title: "Command Dashboard",
      url: createPageUrl("Dashboard"),
      icon: BarChart3,
      permission: 'system.reports',
    },
    {
      title: "Activity History",
      url: createPageUrl("History"),
      icon: History,
      permission: 'system.history',
    },
    { title: "Divisions", url: createPageUrl("Divisions"), icon: Shield },
    { 
      title: "Personnel", 
      url: createPageUrl("Soldiers"), 
      icon: Users,
      permission: 'personnel.view',
    },
    { 
      title: "Weapons", 
      url: createPageUrl("Weapons"), 
      icon: Target,
      permission: 'equipment.view',
    },
    { 
      title: "Serialized Gear", 
      url: createPageUrl("SerializedGear"), 
      icon: Binoculars,
      permission: 'equipment.view',
    },
    { 
      title: "Drones", 
      url: createPageUrl("Drones"), 
      icon: Joystick,
      permission: 'equipment.view',
    },
    { 
      title: "Drone Components", 
      url: createPageUrl("DroneComponents"), 
      icon: Puzzle,
      permission: 'equipment.view',
    },
    {
      title: "Armory Deposit/Release",
      url: createPageUrl("ArmoryDeposit"),
      icon: Package,
      permission: 'operations.deposit',
    },
    {
      title: "Let's Go Home",
      url: createPageUrl("SoldierRelease"),
      icon: Home,
      permission: 'operations.release',
    },
    {
      title: "Equipment Transfer",
      url: createPageUrl("EquipmentTransfer"),
      icon: ArrowRightLeft,
      permission: 'operations.transfer',
    },
    {
      title: "Daily Verification",
      url: createPageUrl("DailyVerification"),
      icon: ClipboardCheck,
      permission: 'operations.verify',
    },
    {
      title: "Verification History",
      url: createPageUrl("VerificationHistory"),
      icon: Calendar,
      permission: 'operations.verify',
    },
    {
      title: "Maintenance",
      url: createPageUrl("Maintenance"),
      icon: ClipboardCheck,
      permission: 'operations.maintain',
    },
    { 
      title: "Equipment", 
      url: createPageUrl("Equipment"), 
      icon: Wrench,
      permission: 'equipment.view',
    },
    {
      title: "Import Data",
      url: createPageUrl("Import"),
      icon: Upload,
      permission: 'system.import',
    },
    {
      title: "Data Export",
      url: createPageUrl("DataExport"),
      icon: Download,
      permission: 'system.export',
    },
    {
      title: "Security",
      url: createPageUrl("SecuritySettings"),
      icon: Lock,
    },
    {
      title: "User Management",
      url: createPageUrl("UserManagement"),
      icon: Users,
      permission: 'system.users',
    },
  ];

  if (!permissions) {
    // If permissions are not yet loaded (e.g., initial render), show items that don't require specific permissions.
    return allItems.filter(item => !item.permission);
  }

  // Admins see everything
  if (permissions.role === 'admin') {
      return allItems;
  }

  // For other roles, filter based on specific permissions
  return allItems.filter(item => {
    // If no specific permission is required for the item, it's always visible
    if (!item.permission) return true;
    // Otherwise, check if the user has the required permission
    return permissions[item.permission];
  });
};


export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState(null);
  const [linkedSoldier, setLinkedSoldier] = useState(null);
  const [showSoldierLinking, setShowSoldierLinking] = useState(false);
  const [isTotpVerified, setIsTotpVerified] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const user = await UserEntity.me();
        setCurrentUser(user);

        // Check if user has linked soldier
        if (user.linked_soldier_id) {
          try {
            const soldiers = await Soldier.filter({ soldier_id: user.linked_soldier_id });
            const soldier = soldiers[0];
            
            // Validate soldier object before setting
            if (soldier && typeof soldier === 'object' && soldier.soldier_id) {
              setLinkedSoldier(soldier);
            } else {
              console.warn("Invalid soldier object received:", soldier);
              setLinkedSoldier(null);
            }
          } catch (error) {
            console.error("Error loading linked soldier:", error);
            setLinkedSoldier(null); // Ensure it's null on error
          }
        } else {
            setLinkedSoldier(null); // No linked soldier ID
        }

        if (user.totp_enabled) {
          // Check both localStorage (persistent) and sessionStorage (session-only)
          const lastVerificationTimeLocal = localStorage.getItem('lastTotpVerificationTime');
          const lastVerificationTimeSession = sessionStorage.getItem('lastTotpVerificationTime');
          
          // Use the most recent verification time from either storage
          let lastVerificationTime = null;
          if (lastVerificationTimeLocal || lastVerificationTimeSession) {
            const localTime = lastVerificationTimeLocal ? new Date(lastVerificationTimeLocal).getTime() : 0;
            const sessionTime = lastVerificationTimeSession ? parseInt(lastVerificationTimeSession) : 0;
            lastVerificationTime = Math.max(localTime, sessionTime);
          }
          
          const twentyFourHours = 24 * 60 * 60 * 1000;

          if (lastVerificationTime && (Date.now() - lastVerificationTime) < twentyFourHours) {
            setIsTotpVerified(true); // Verified and within the 24-hour window
          } else {
            setIsTotpVerified(false); // Needs verification
          }
        } else {
          // If 2FA is not enabled, user must set it up first.
          setIsTotpVerified(false);
        }
      } catch (error) {
        // Not logged in or authentication failed.
        setCurrentUser(null);
        setLinkedSoldier(null); // Ensure no soldier is linked if auth fails
        setIsTotpVerified(true); // Allow login page to show
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuthStatus();
  }, []);

  // This effect runs periodically to check if the 24-hour session has expired
  useEffect(() => {
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const checkInterval = 5 * 60 * 1000; // Check every 5 minutes

    const intervalId = setInterval(() => {
      if (currentUser && currentUser.totp_enabled && isTotpVerified) {
        // Check both localStorage and sessionStorage
        const lastVerificationTimeLocal = localStorage.getItem('lastTotpVerificationTime');
        const lastVerificationTimeSession = sessionStorage.getItem('lastTotpVerificationTime');
        
        let lastVerificationTime = null;
        if (lastVerificationTimeLocal || lastVerificationTimeSession) {
          const localTime = lastVerificationTimeLocal ? new Date(lastVerificationTimeLocal).getTime() : 0;
          const sessionTime = lastVerificationTimeSession ? parseInt(lastVerificationTimeSession) : 0;
          lastVerificationTime = Math.max(localTime, sessionTime);
        }
        
        if (!lastVerificationTime || (Date.now() - lastVerificationTime) > twentyFourHours) {
          setIsTotpVerified(false); // Expire the verification
        }
      }
    }, checkInterval);

    return () => clearInterval(intervalId); // Cleanup on component unmount
  }, [currentUser, isTotpVerified]);

  const handleTotpSuccess = () => {
    // Verification time is now set in TotpVerificationPrompt based on remember preference
    setIsTotpVerified(true);

    // Show soldier linking dialog if not linked yet
    if (currentUser && !currentUser.linked_soldier_id && !linkedSoldier) {
      setTimeout(() => setShowSoldierLinking(true), 500);
    }
  };

  const handleTotpSetupComplete = async () => {
    // Refresh user data and proceed to verification
    try {
      const user = await UserEntity.me();
      setCurrentUser(user);
      // After setup, if the user now has a linked soldier, update it
      if (user.linked_soldier_id) {
          try {
            const soldiers = await Soldier.filter({ soldier_id: user.linked_soldier_id });
            const soldier = soldiers[0];
            
            // Validate soldier object before setting
            if (soldier && typeof soldier === 'object' && soldier.soldier_id) {
              setLinkedSoldier(soldier);
            } else {
              console.warn("Invalid soldier object received after TOTP setup:", soldier);
              setLinkedSoldier(null);
            }
          } catch (error) {
            console.error("Error loading linked soldier after TOTP setup:", error);
            setLinkedSoldier(null);
          }
      } else {
          setLinkedSoldier(null);
      }
      // If TOTP was just set up, mark as verified and store the verification time
      setIsTotpVerified(true);
      sessionStorage.setItem('lastTotpVerificationTime', Date.now().toString());
      
      // Force reload to ensure proper state transition after 2FA setup
      window.location.reload();
    } catch (error) {
      console.error("Error refreshing user after TOTP setup:", error);
    }
  };

  const handleSoldierLinked = async (soldier) => {
    try {
      setLinkedSoldier(soldier);
      setShowSoldierLinking(false);
      
      // Reload user data to get updated claims
      const updatedUser = await UserEntity.me();
      setCurrentUser(updatedUser);
      
      // Force a page reload to ensure all components get fresh data
      window.location.reload();
    } catch (error) {
      console.error("Error after soldier linking:", error);
    }
  };
  
  const handleLogout = async () => {
    try {
      await UserEntity.logout();
      // Clear session storage
      sessionStorage.removeItem('lastTotpVerificationTime');
      window.location.href = '/login';
    } catch (error) {
      console.error('Error logging out:', error);
      // Force redirect even if logout fails
      window.location.href = '/login';
    }
  };

  const navigationItems = getNavigationItems(
    currentUser?.role === 'admin' ? { role: 'admin' } : currentUser?.permissions,
    currentUser?.custom_role,
    currentUser?.linked_soldier_id
  );

  if (isCheckingAuth) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // If user is logged in but doesn't have 2FA enabled, force them to set it up
  if (currentUser && !currentUser.totp_enabled) {
    return (
      <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center">
        <div className="max-w-2xl w-full mx-4">
          <SecuritySettings onSetupComplete={handleTotpSetupComplete} isRequired={true} />
        </div>
      </div>
    );
  }

  // If user has TOTP enabled but not verified, show verification prompt
  if (currentUser && currentUser.totp_enabled && !isTotpVerified) {
    return <TotpVerificationPrompt onSuccess={handleTotpSuccess} />;
  }

  // Check if user has any role assigned
  if (currentUser && currentUser.totp_enabled && isTotpVerified) {
    // Check if user has no role or permissions
    const hasRole = currentUser.role || currentUser.custom_role;
    const hasAnyPermission = currentUser.permissions && Object.values(currentUser.permissions).some(p => p === true);
    
    if (!hasRole && !hasAnyPermission) {
      // User has no role and no permissions - show access denied
      return window.location.href = '/access-denied';
    }
    
    // Show soldier linking dialog if needed (non-admin users without linked soldier)
    if (!currentUser.linked_soldier_id && !linkedSoldier && currentUser.role !== 'admin' && currentUser.custom_role === 'soldier') {
      return (
        <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center">
          <SoldierLinkingDialog
            open={true}
            onOpenChange={setShowSoldierLinking}
            onLinked={handleSoldierLinked}
          />
        </div>
      );
    }
  }

  return (
    <ErrorBoundary>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-slate-50">
          <style>{`
            :root {
              --military-green: #2D5016;
              --navy-blue: #1E3A8A;
              --accent-gold: #D4AF37;
            }
          `}</style>

          <Sidebar className="border-r border-slate-200 bg-white">
            <SidebarHeader className="border-b border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-800 to-green-900 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">ARMORY</h2>
                  <p className="text-xs text-slate-600 font-medium tracking-wide">
                    {currentUser?.custom_role === 'soldier' ? 'PERSONAL EQUIPMENT' : 'EQUIPMENT MANAGEMENT'}
                  </p>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className="p-3">
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-3">
                  {currentUser?.custom_role === 'soldier' ? 'My Equipment' : 'Operations'}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1">
                    {navigationItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className={`hover:bg-green-50 hover:text-green-800 transition-all duration-200 rounded-lg font-medium ${
                            location.pathname === item.url ? 'bg-green-100 text-green-800 border border-green-200' : 'text-slate-700'
                          }`}
                        >
                          <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                            <item.icon className="w-5 h-5" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">
                    {linkedSoldier && linkedSoldier.first_name ? `${linkedSoldier.first_name} ${linkedSoldier.last_name || ''}` : 
                     currentUser?.custom_role === 'soldier' ? 'Soldier Account' : 'Command User'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {linkedSoldier && linkedSoldier.soldier_id ? `ID: ${linkedSoldier.soldier_id}` : 
                     currentUser?.email || currentUser?.phone || 'Equipment Manager'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {!linkedSoldier && currentUser && currentUser.custom_role !== 'soldier' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSoldierLinking(true)}
                    className="w-full text-xs"
                  >
                    Link Soldier Account
                  </Button>
                )}
                {showLogoutConfirm ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleLogout}
                      className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowLogoutConfirm(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLogoutConfirm(true)}
                    className="w-full text-xs"
                  >
                    <LogOut className="w-3 h-3 mr-1.5" />
                    Logout
                  </Button>
                )}
              </div>
            </SidebarFooter>
          </Sidebar>

          <main className="flex-1 flex flex-col relative z-0 overflow-auto">
            <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 shrink-0">
              <SidebarTrigger className="md:hidden hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200 -ml-2" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.history.back()}
                className="h-9 w-9 shrink-0"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3 md:hidden">
                <div className="w-8 h-8 bg-gradient-to-br from-green-800 to-green-900 rounded-md flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <h1 className="font-bold text-slate-900 text-lg">ARMORY</h1>
              </div>
            </header>

            <div className="flex-1">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </SidebarProvider>

      {/* Render the dialog at the top level, controlled by state, for manual linking */}
      <SoldierLinkingDialog
        open={showSoldierLinking}
        onOpenChange={setShowSoldierLinking}
        onLinked={handleSoldierLinked}
      />
    </ErrorBoundary>
  );
}

