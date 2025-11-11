import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Soldier } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Users, Shield, Mail, Calendar, Search, UserPlus, Settings, Building, UsersIcon, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { firebaseFunctions } from "@/firebase/functions";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const { deleteUser, getRolePermissionsConfig, updateRolePermissionsConfig } = firebaseFunctions;

// Define roles with their display properties
const ROLES = {
  admin: {
    label: "Admin",
    badge: "bg-red-100 text-red-800 border-red-200",
    description: "Full system access"
  },
  division_manager: {
    label: "Division Manager",
    badge: "bg-purple-100 text-purple-800 border-purple-200",
    description: "Manage division resources and personnel"
  },
  team_leader: {
    label: "Team Leader",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Manage team members and equipment"
  },
  soldier: {
    label: "Soldier",
    badge: "bg-green-100 text-green-800 border-green-200",
    description: "View personal equipment and profile"
  }
};

const ROLE_ORDER = ['admin', 'division_manager', 'team_leader', 'soldier'];

const PERMISSION_ORDER = [
  'personnel.view',
  'personnel.create',
  'personnel.update',
  'personnel.delete',
  'equipment.view',
  'equipment.create',
  'equipment.update',
  'equipment.delete',
  'equipment.assign_components',
  'operations.sign',
  'operations.deposit',
  'operations.release',
  'operations.transfer',
  'operations.verify',
  'operations.maintain',
  'system.history',
  'system.reports',
  'system.export',
  'system.import',
  'system.users',
];

const PERMISSION_DEFINITIONS = {
  'equipment.assign_components': {
    label: 'Assign Components',
    description: 'Allow assigning serialized components to kits and equipment sets.',
    category: 'Equipment',
  },
  'equipment.create': {
    label: 'Create Equipment',
    description: 'Allow creating new equipment or inventory records.',
    category: 'Equipment',
  },
  'equipment.delete': {
    label: 'Delete Equipment',
    description: 'Allow deleting equipment records from the inventory.',
    category: 'Equipment',
  },
  'equipment.update': {
    label: 'Update Equipment',
    description: 'Allow editing equipment details, status, or assignments.',
    category: 'Equipment',
  },
  'equipment.view': {
    label: 'View Equipment',
    description: 'Allow viewing equipment and inventory lists.',
    category: 'Equipment',
  },
  'operations.deposit': {
    label: 'Deposit Equipment',
    description: 'Allow recording equipment deposits into storage locations.',
    category: 'Operations',
  },
  'operations.maintain': {
    label: 'Maintain Equipment',
    description: 'Allow creating or updating maintenance tasks.',
    category: 'Operations',
  },
  'operations.release': {
    label: 'Release Equipment',
    description: 'Allow releasing stored equipment back to soldiers.',
    category: 'Operations',
  },
  'operations.sign': {
    label: 'Sign Equipment',
    description: 'Allow signing equipment to or from soldiers.',
    category: 'Operations',
  },
  'operations.transfer': {
    label: 'Transfer Equipment',
    description: 'Allow transferring equipment between units or divisions.',
    category: 'Operations',
  },
  'operations.verify': {
    label: 'Verify Equipment',
    description: 'Allow running verification workflows or daily checks.',
    category: 'Operations',
  },
  'personnel.create': {
    label: 'Create Personnel',
    description: 'Allow creating new personnel or soldier records.',
    category: 'Personnel',
  },
  'personnel.delete': {
    label: 'Delete Personnel',
    description: 'Allow deleting personnel or soldier records.',
    category: 'Personnel',
  },
  'personnel.update': {
    label: 'Update Personnel',
    description: 'Allow editing personnel or soldier details.',
    category: 'Personnel',
  },
  'personnel.view': {
    label: 'View Personnel',
    description: 'Allow viewing personnel and soldier information.',
    category: 'Personnel',
  },
  'system.export': {
    label: 'Export Data',
    description: 'Allow exporting reports or data sets from the system.',
    category: 'System',
  },
  'system.history': {
    label: 'View History',
    description: 'Allow viewing audit history and activity logs.',
    category: 'System',
  },
  'system.import': {
    label: 'Import Data',
    description: 'Allow importing data into the system.',
    category: 'System',
  },
  'system.reports': {
    label: 'View Reports',
    description: 'Allow viewing dashboards and analytical reports.',
    category: 'System',
  },
  'system.users': {
    label: 'Manage Users',
    description: 'Allow managing user accounts, roles, and permissions.',
    category: 'System',
  },
};

const PERMISSION_GROUPS = [
  {
    id: 'personnel',
    title: 'Personnel',
    description: 'Controls access to soldier and staff records.',
    permissions: ['personnel.view', 'personnel.create', 'personnel.update', 'personnel.delete'],
  },
  {
    id: 'equipment',
    title: 'Equipment',
    description: 'Controls inventory management and assignment actions.',
    permissions: ['equipment.view', 'equipment.create', 'equipment.update', 'equipment.delete', 'equipment.assign_components'],
  },
  {
    id: 'operations',
    title: 'Operations',
    description: 'Controls day-to-day armory workflows.',
    permissions: ['operations.sign', 'operations.deposit', 'operations.release', 'operations.transfer', 'operations.verify', 'operations.maintain'],
  },
  {
    id: 'system',
    title: 'System',
    description: 'Controls system-level governance and tooling.',
    permissions: ['system.history', 'system.reports', 'system.export', 'system.import', 'system.users'],
  },
];

const createBasePermissionTemplate = () => {
  return PERMISSION_ORDER.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});
};

const buildAdminPermissions = () => {
  const template = createBasePermissionTemplate();
  PERMISSION_ORDER.forEach((key) => {
    template[key] = true;
  });
  return template;
};

const buildDivisionManagerPermissions = () => {
  const template = createBasePermissionTemplate();
  [
    'personnel.view',
    'personnel.update',
    'equipment.view',
    'equipment.update',
    'operations.sign',
    'operations.transfer',
    'operations.verify',
    'operations.maintain',
    'system.reports',
    'system.history',
    'system.export',
  ].forEach((key) => {
    template[key] = true;
  });
  return template;
};

const buildTeamLeaderPermissions = () => {
  const template = createBasePermissionTemplate();
  [
    'personnel.view',
    'personnel.update',
    'equipment.view',
    'equipment.update',
    'operations.sign',
    'operations.verify',
    'system.reports',
    'system.history',
  ].forEach((key) => {
    template[key] = true;
  });
  return template;
};

const buildSoldierPermissions = () => {
  const template = createBasePermissionTemplate();
  ['personnel.view', 'equipment.view', 'system.history'].forEach((key) => {
    template[key] = true;
  });
  return template;
};

const DEFAULT_ROLE_PERMISSION_STATE = {
  admin: {
    scope: 'global',
    permissions: buildAdminPermissions(),
  },
  division_manager: {
    scope: 'division',
    permissions: buildDivisionManagerPermissions(),
  },
  team_leader: {
    scope: 'team',
    permissions: buildTeamLeaderPermissions(),
  },
  soldier: {
    scope: 'self',
    permissions: buildSoldierPermissions(),
  },
};

const mergeRolePermissionsWithDefaults = (incoming = {}) => {
  const merged = {};
  ROLE_ORDER.forEach((roleKey) => {
    const defaults = DEFAULT_ROLE_PERMISSION_STATE[roleKey];
    const incomingRole = incoming[roleKey] || {};
    const incomingPermissions = incomingRole.permissions || incomingRole;

    merged[roleKey] = {
      scope: incomingRole.scope || defaults.scope,
      permissions: PERMISSION_ORDER.reduce((acc, key) => {
        if (typeof incomingPermissions?.[key] === 'boolean') {
          acc[key] = incomingPermissions[key];
        } else if (typeof defaults.permissions?.[key] === 'boolean') {
          acc[key] = defaults.permissions[key];
        } else {
          acc[key] = false;
        }
        return acc;
      }, {}),
    };
  });
  return merged;
};

const cloneRolePermissionsState = (source = DEFAULT_ROLE_PERMISSION_STATE) => {
  const normalized = mergeRolePermissionsWithDefaults(source);
  const result = {};
  ROLE_ORDER.forEach((roleKey) => {
    result[roleKey] = {
      scope: normalized[roleKey].scope,
      permissions: { ...normalized[roleKey].permissions },
    };
  });
  return result;
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [soldierMap, setSoldierMap] = useState({}); // Map of soldier_id to soldier data
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [newUserData, setNewUserData] = useState({
    phoneNumber: "",
    role: "soldier"
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [rolePermissionsConfig, setRolePermissionsConfig] = useState(() => cloneRolePermissionsState());
  const [rolePermissionsMeta, setRolePermissionsMeta] = useState(null);
  const [rolePermissionsLoading, setRolePermissionsLoading] = useState(false);
  const [rolePermissionsSaving, setRolePermissionsSaving] = useState(false);
  const [rolePermissionsDirty, setRolePermissionsDirty] = useState(false);
  const [selectedRole, setSelectedRole] = useState('admin');
const [mainTab, setMainTab] = useState('users');

  const isCurrentUserAdmin = currentUser?.role === 'admin';
  const isCurrentUserDivisionManager = currentUser?.custom_role === 'division_manager';
  const canEditRolePermissions = isCurrentUserAdmin;

  useEffect(() => {
    loadData();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (error) {
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersData, soldiersData] = await Promise.all([
        User.list(),
        Soldier.list()
      ]);

      setUsers(Array.isArray(usersData) ? usersData : []);
      setSoldiers(Array.isArray(soldiersData) ? soldiersData : []);

      if (Array.isArray(soldiersData)) {
        // Create a map for quick lookup by email and phone
        const soldierLookup = {};
        soldiersData.forEach(soldier => {
          // Map by email (lowercase for case-insensitive matching)
          if (soldier.email) {
            soldierLookup[soldier.email.toLowerCase()] = soldier;
          }
          // Map by phone number
          if (soldier.phone_number) {
            soldierLookup[soldier.phone_number] = soldier;
          }
        });
        setSoldierMap(soldierLookup);
      } else {
        setSoldierMap({});
      }

    } catch (error) {
      setError("Failed to load users or soldiers");
      setUsers([]);
      setSoldiers([]);
      setSoldierMap({});
    }
    setIsLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    const loadRolePermissions = async () => {
      if (!isCurrentUserAdmin) {
        if (isMounted) {
          setRolePermissionsLoading(false);
          setRolePermissionsConfig(cloneRolePermissionsState());
          setRolePermissionsMeta(null);
          setRolePermissionsDirty(false);
        }
        return;
      }

      setRolePermissionsLoading(true);
      console.log("[RolePermissions] Loading configuration...");
      const response = await getRolePermissionsConfig();

      if (!isMounted) {
        return;
      }

      if (response.success) {
        const { roles, metadata } = response.data || {};
        const merged = mergeRolePermissionsWithDefaults(roles || {});
        setRolePermissionsConfig(cloneRolePermissionsState(merged));
        setRolePermissionsMeta(metadata || null);
        setRolePermissionsDirty(false);
        console.log("[RolePermissions] Configuration loaded", {
          roleKeys: Object.keys(roles || {}),
          metadata,
        });
      } else {
        setError(`Failed to load role permissions. ${response.error || ""}`.trim());
        setRolePermissionsConfig(cloneRolePermissionsState());
        setRolePermissionsMeta(null);
        console.log("[RolePermissions] Failed to load configuration", response.error);
      }

      setRolePermissionsLoading(false);
    };

    loadRolePermissions();

    return () => {
      isMounted = false;
    };
  }, [isCurrentUserAdmin]);

  useEffect(() => {
    if (isCurrentUserAdmin) {
      setMainTab((prev) => (prev === 'roles' ? prev : 'roles'));
    } else {
      setMainTab('users');
    }
  }, [isCurrentUserAdmin]);

  const handleRoleUpdate = async (userId, newRole, division, team) => {
    try {
      await User.update(userId, {
        role: newRole,
        division: division || null,
        team: team || null
      });
      await loadData();
      setError("");
    } catch (error) {
      setError("Failed to update user role. " + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      setError("");
      const result = await deleteUser({
        uid: userToDelete.id
      });

      // The createFunction wrapper returns { success, data } where data contains the actual function result
      if (result.success && result.data?.success) {
        setSuccess(`User ${userToDelete.full_name || userToDelete.phoneNumber} deleted successfully from Authentication and Firestore`);
        await loadData();
      } else {
        setError(`Failed to delete user: ${result.error || result.data?.error || 'Unknown error'}`);
      }
    } catch (error) {
      setError(`Failed to delete user: ${error.message}`);
    } finally {
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };


  const handleCreateUser = async () => {
    setError("");
    setSuccess("");

    if (!newUserData.phoneNumber) {
      setError("Phone number is required");
      return;
    }

    try {
      await User.create({
        phoneNumber: newUserData.phoneNumber,
        role: newUserData.role,
        customRole: newUserData.role
      });

      setSuccess("User created successfully!");
      setShowCreateUserDialog(false);
      setNewUserData({
        phoneNumber: "",
        role: "soldier"
      });
      await loadData();
    } catch (error) {
      setError("Failed to create user: " + (error.message || "Unknown error"));
    }
  };

  const formatUpdatedAt = (value) => {
    if (!value) return null;
    try {
      if (typeof value === "string") {
        return format(new Date(value), "MMM d, yyyy HH:mm");
      }
      if (value?._seconds) {
        return format(new Date(value._seconds * 1000), "MMM d, yyyy HH:mm");
      }
      return String(value);
    } catch (err) {
      return String(value);
    }
  };

  const handlePermissionToggle = (roleKey, permissionKey, value) => {
    setRolePermissionsConfig((prev) => {
      const currentRole = prev[roleKey];
      if (!currentRole || currentRole.permissions[permissionKey] === value) {
        return prev;
      }
      return {
        ...prev,
        [roleKey]: {
          ...currentRole,
          permissions: {
            ...currentRole.permissions,
            [permissionKey]: value,
          },
        },
      };
    });
    setRolePermissionsDirty(true);
  };

  const handleResetRolePermissions = (roleKey) => {
    if (!ROLE_ORDER.includes(roleKey)) return;
    const defaults = cloneRolePermissionsState({ [roleKey]: DEFAULT_ROLE_PERMISSION_STATE[roleKey] });
    setRolePermissionsConfig((prev) => ({
      ...prev,
      [roleKey]: defaults[roleKey],
    }));
    setRolePermissionsDirty(true);
  };

  const handleSaveRolePermissions = async () => {
    if (!canEditRolePermissions || !rolePermissionsDirty) return;
    setRolePermissionsSaving(true);
    setError("");
    try {
      const startTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      const payload = {
        roles: ROLE_ORDER.reduce((acc, roleKey) => {
          const roleConfig = rolePermissionsConfig[roleKey] || DEFAULT_ROLE_PERMISSION_STATE[roleKey];
          acc[roleKey] = {
            scope: roleConfig.scope,
            permissions: { ...roleConfig.permissions },
          };
          return acc;
        }, {}),
      };
      console.log("[RolePermissions] Save started", { payload });

      const response = await updateRolePermissionsConfig(payload);
      const endTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      console.log("[RolePermissions] Save request completed", {
        success: response.success,
        durationMs: endTime - startTime,
      });

      if (!response.success) {
        setError(`Failed to update role permissions. ${response.error || ""}`.trim());
      } else {
        const { roles: updatedRoles, metadata } = response.data || {};
        const merged = mergeRolePermissionsWithDefaults(updatedRoles || {});
        setRolePermissionsConfig(cloneRolePermissionsState(merged));
        setRolePermissionsMeta(metadata || null);
        setRolePermissionsDirty(false);
        setSuccess("Role permissions updated successfully.");
      }
    } catch (saveError) {
      console.log("[RolePermissions] Save error", saveError);
      setError("Failed to update role permissions. " + (saveError?.message || ""));
    } finally {
      setRolePermissionsSaving(false);
      console.log("[RolePermissions] Save flow complete");
    }
  };

  const handleMainTabChange = (value) => {
    if (!isCurrentUserAdmin && value === 'roles') return;
    setMainTab(value);
  };

  const getUserRole = (user) => {
    if (!user) return 'soldier';
    return user.custom_role || user.role || 'soldier';
  };

  const filteredUsers = users.filter(user => {
    if (!user) return false;

    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      (user.full_name && user.full_name.toLowerCase().includes(searchLower)) ||
      (user.email && user.email.toLowerCase().includes(searchLower)) ||
      (user.phoneNumber && user.phoneNumber.includes(searchLower))
    );

    // Role filter
    const userRole = getUserRole(user);
    const matchesRole = roleFilter === "all" || userRole === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (user) => {
    const role = getUserRole(user);
    const roleConfig = ROLES[role];
    if (!roleConfig) return <Badge>Unknown Role</Badge>;

    return <Badge className={roleConfig.badge}>{roleConfig.label}</Badge>;
  };

  // Find soldier matching user by email or phone
  const findMatchingSoldier = (user) => {
    if (!user) return null;

    // Try to match by email first (case-insensitive)
    if (user.email) {
      const soldier = soldierMap[user.email.toLowerCase()];
      if (soldier) return soldier;
    }

    // Try to match by phone number
    if (user.phoneNumber) {
      const soldier = soldierMap[user.phoneNumber];
      if (soldier) return soldier;
    }

    return null;
  };

  // Get division from matching soldier
  const getUserDivision = (user) => {
    const soldier = findMatchingSoldier(user);
    return soldier?.division_name || null;
  };

  // Get team from matching soldier
  const getUserTeam = (user) => {
    const soldier = findMatchingSoldier(user);
    return soldier?.team_name || null;
  };

  const canManageUsers = isCurrentUserAdmin || isCurrentUserDivisionManager;

  if (!canManageUsers) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access denied. You need administrator or division manager privileges to view this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-600">Manage user access and assignments for the ARMORY system</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            {users.length} total users
          </Badge>
          {isCurrentUserAdmin && (
            <Button onClick={() => setShowCreateUserDialog(true)} className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Create User
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

    <Tabs
      value={isCurrentUserAdmin ? mainTab : 'users'}
      onValueChange={handleMainTabChange}
      className="space-y-6"
    >
      <TabsList className="flex flex-wrap gap-2">
        <TabsTrigger value="users">Users</TabsTrigger>
        {isCurrentUserAdmin && <TabsTrigger value="roles">Role Permissions</TabsTrigger>}
      </TabsList>

    <TabsContent value="users" className="space-y-6">
      {/* Create User Dialog */}
      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Create New User
            </DialogTitle>
            <DialogDescription>
              Create a new user account with phone authentication
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="+972501234567"
                value={newUserData.phoneNumber}
                onChange={(e) => setNewUserData({...newUserData, phoneNumber: e.target.value})}
              />
              <p className="text-xs text-slate-500">Format: +972XXXXXXXXX</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newUserData.role} onValueChange={(value) => setNewUserData({...newUserData, role: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLES).map(([key, role]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span>{role.label}</span>
                        <span className="text-xs text-slate-500">- {role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreateUser} className="flex-1">
                Create User
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateUserDialog(false);
                  setNewUserData({
                    phoneNumber: "",
                    role: "soldier"
                  });
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Current Users */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Current Users
            </CardTitle>
            <div className="flex items-center gap-4">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {Object.entries(ROLES).map(([key, role]) => (
                    <SelectItem key={key} value={key}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[70vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50 z-10">
                <TableRow>
                  <TableHead className="sticky left-0 z-20 bg-slate-50">User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Joined Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const role = getUserRole(user);
                    const canEditUser = isCurrentUserAdmin ||
                      (isCurrentUserDivisionManager && user.division === currentUser?.division);
                    // Prevent editing other admins (but allow editing yourself)
                    const isTargetUserAdmin = role === 'admin';
                    const canEditThisUser = canEditUser && (user.id === currentUser?.id || !isTargetUserAdmin);

                    return (
                      <TableRow key={user.id} className={`group ${user.id === currentUser?.id ? 'bg-blue-50' : ''}`}>
                        <TableCell className="font-medium sticky left-0 z-10 bg-white group-hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                              <Users className="w-4 h-4 text-slate-600" />
                            </div>
                            <span>{user.full_name || 'Unknown User'}</span>
                            {user.id === currentUser?.id && (
                              <Badge variant="outline" className="text-xs">You</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {user.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span className="text-sm">{user.email}</span>
                              </div>
                            )}
                            {user.phoneNumber && (
                              <div className="text-sm text-slate-600">{user.phoneNumber}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getRoleBadge(user)}
                        </TableCell>
                        <TableCell>
                          {getUserDivision(user) ? (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Building className="w-3 h-3" />
                              {getUserDivision(user)}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">Not assigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getUserTeam(user) ? (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <UsersIcon className="w-3 h-3" />
                              {getUserTeam(user)}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {user.created_date ? format(new Date(user.created_date), 'MMM d, yyyy') : 'Unknown'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 items-center">
                            {canEditThisUser ? (
                              <>
                                <Select
                                  value={role}
                                  onValueChange={(newRole) => handleRoleUpdate(
                                    user.id,
                                    newRole,
                                    getUserDivision(user),
                                    getUserTeam(user)
                                  )}
                                  disabled={!isCurrentUserAdmin}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="soldier">Soldier</SelectItem>
                                    <SelectItem value="team_leader">Team Leader</SelectItem>
                                    <SelectItem value="division_manager">Division Manager</SelectItem>
                                    {isCurrentUserAdmin && (
                                      <SelectItem value="admin">Admin</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                                {isCurrentUserAdmin && !isTargetUserAdmin && user.id !== currentUser?.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteClick(user)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </>
                            ) : isTargetUserAdmin ? (
                              <span className="text-sm text-slate-500">Admin (protected)</span>
                            ) : (
                              <span className="text-sm text-slate-500">No permission</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete user <strong>{userToDelete?.full_name || userToDelete?.phoneNumber}</strong>?
              <br />
              <br />
              This will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Their account from Firebase Authentication</li>
                <li>Their user profile from the Firestore users collection</li>
              </ul>
              <br />
              <strong className="text-red-600">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabsContent>

    {isCurrentUserAdmin && (
      <TabsContent value="roles" className="space-y-6">
        {/* Role Information */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Role Permissions
            </CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              Configure which capabilities are enabled for each role across the armory.
            </p>
          </CardHeader>
          <CardContent className="p-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {ROLE_ORDER.map((key) => {
                const role = ROLES[key];
                return (
                  <div key={key} className="p-3 border rounded-lg bg-slate-50">
                    <Badge className={`${role.badge} mb-2`}>{role.label}</Badge>
                    <p className="text-sm text-slate-600">{role.description}</p>
                  </div>
                );
              })}
            </div>

            {rolePermissionsMeta?.updatedAt && (
              <div className="text-xs text-slate-500">
                Last updated {formatUpdatedAt(rolePermissionsMeta.updatedAt)}
                {rolePermissionsMeta.updatedByDisplayName && (
                  <> by {rolePermissionsMeta.updatedByDisplayName}</>
                )}
              </div>
            )}

            <div className="text-sm text-slate-600">
              {canEditRolePermissions
                ? "Toggle permissions for each role and save to apply changes immediately."
                : "Only administrators can edit role permissions. The values below are read-only."}
            </div>

            {rolePermissionsLoading ? (
              <div className="space-y-3">
                <div className="h-5 rounded bg-slate-200 animate-pulse" />
                <div className="h-24 rounded bg-slate-200 animate-pulse" />
                <div className="h-24 rounded bg-slate-200 animate-pulse" />
              </div>
            ) : (
              <Tabs
                value={ROLE_ORDER.includes(selectedRole) ? selectedRole : ROLE_ORDER[0]}
                onValueChange={setSelectedRole}
              >
                <TabsList className="flex flex-wrap gap-2">
                  {ROLE_ORDER.map((roleKey) => (
                    <TabsTrigger key={roleKey} value={roleKey}>
                      {ROLES[roleKey].label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {ROLE_ORDER.map((roleKey) => {
                  const roleData = rolePermissionsConfig[roleKey] || DEFAULT_ROLE_PERMISSION_STATE[roleKey];
                  const scopeLabel = roleData?.scope || DEFAULT_ROLE_PERMISSION_STATE[roleKey]?.scope || 'self';

                  return (
                    <TabsContent key={roleKey} value={roleKey} className="space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Scope</p>
                          <p className="text-sm text-slate-500 capitalize">{scopeLabel}</p>
                        </div>
                        {!canEditRolePermissions && (
                          <Badge variant="outline" className="text-xs">Read only</Badge>
                        )}
                      </div>

                      {PERMISSION_GROUPS.map((group) => (
                        <div key={group.id} className="space-y-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{group.title}</p>
                            <p className="text-xs text-slate-500">{group.description}</p>
                          </div>
                          <div className="space-y-2">
                            {group.permissions.map((permissionKey) => {
                              const definition = PERMISSION_DEFINITIONS[permissionKey];
                              const currentValue = roleData?.permissions?.[permissionKey] === true;

                              return (
                                <div
                                  key={permissionKey}
                                  className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">
                                      {definition?.label || permissionKey}
                                    </p>
                                    <p className="text-xs text-slate-600">{definition?.description}</p>
                                  </div>
                                  <Switch
                                    checked={currentValue}
                                    onCheckedChange={(value) => handlePermissionToggle(roleKey, permissionKey, value)}
                                    disabled={!canEditRolePermissions || rolePermissionsSaving}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}

            {canEditRolePermissions && (
              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 md:flex-row md:items-center md:justify-between">
                <Button
                  variant="outline"
                  onClick={() => handleResetRolePermissions(ROLE_ORDER.includes(selectedRole) ? selectedRole : ROLE_ORDER[0])}
                  disabled={rolePermissionsSaving || rolePermissionsLoading}
                >
                  Reset {ROLES[ROLE_ORDER.includes(selectedRole) ? selectedRole : ROLE_ORDER[0]].label} to Defaults
                </Button>
                <div className="flex items-center gap-3">
                  {rolePermissionsDirty && (
                    <span className="text-sm text-amber-600">Unsaved changes</span>
                  )}
                  <Button
                    onClick={handleSaveRolePermissions}
                    disabled={!rolePermissionsDirty || rolePermissionsSaving}
                  >
                    {rolePermissionsSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Role Permissions"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    )}

    </Tabs>
  </div>
  );
}