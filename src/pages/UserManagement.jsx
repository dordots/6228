
import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Soldier } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Shield, Mail, Calendar, Search, UserPlus, Settings, Edit, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

const DEFAULT_PERMISSIONS = {
  can_create_soldiers: false,
  can_edit_soldiers: true,
  can_delete_soldiers: false,
  can_create_weapons: false,
  can_edit_weapons: false,
  can_delete_weapons: false,
  can_create_gear: false,
  can_edit_gear: false,
  can_delete_gear: false,
  can_create_drones: false,
  can_edit_drones: false,
  can_delete_drones: false,
  can_create_drone_components: false,
  can_edit_drone_components: false,
  can_delete_drone_components: false,
  can_create_equipment: false,
  can_edit_equipment: false,
  can_delete_equipment: false,
  can_import_data: false,
  can_manage_users: false,
  can_sign_equipment: true,
  can_view_reports: true,
  can_perform_maintenance: true,
  can_view_history: true,
  can_transfer_equipment: false,
  can_deposit_equipment: true,
  can_release_equipment: true,
  can_export_data: false,
  can_perform_daily_verification: false,
};

const MANAGER_PERMISSIONS = {
  can_create_soldiers: true,
  can_edit_soldiers: true,
  can_delete_soldiers: false,
  can_create_weapons: true,
  can_edit_weapons: true,
  can_delete_weapons: false,
  can_create_gear: true,
  can_edit_gear: true,
  can_delete_gear: false,
  can_create_drones: true,
  can_edit_drones: true,
  can_delete_drones: false,
  can_create_drone_components: true,
  can_edit_drone_components: true,
  can_delete_drone_components: false,
  can_create_equipment: true,
  can_edit_equipment: true,
  can_delete_equipment: true,
  can_import_data: true,
  can_manage_users: false,
  can_sign_equipment: true,
  can_view_reports: true,
  can_perform_maintenance: true,
  can_view_history: true, // This was already true in the provided code snippet, ensuring it remains so.
  can_transfer_equipment: true,
  can_deposit_equipment: true,
  can_release_equipment: true,
  can_export_data: true,
  can_perform_daily_verification: true,
};

const ADMIN_PERMISSIONS = {
  can_create_soldiers: true,
  can_edit_soldiers: true,
  can_delete_soldiers: true,
  can_create_weapons: true,
  can_edit_weapons: true,
  can_delete_weapons: true,
  can_create_gear: true,
  can_edit_gear: true,
  can_delete_gear: true,
  can_create_drones: true,
  can_edit_drones: true,
  can_delete_drones: true,
  can_create_drone_components: true,
  can_edit_drone_components: true,
  can_delete_drone_components: true,
  can_create_equipment: true,
  can_edit_equipment: true,
  can_delete_equipment: true,
  can_import_data: true,
  can_manage_users: true,
  can_sign_equipment: true,
  can_view_reports: true,
  can_perform_maintenance: true,
  can_view_history: true,
  can_transfer_equipment: true,
  can_deposit_equipment: true,
  can_release_equipment: true,
  can_export_data: true,
  can_perform_daily_verification: true,
};

const SOLDIER_PERMISSIONS = {
  can_create_soldiers: false,
  can_edit_soldiers: false,
  can_delete_soldiers: false,
  can_create_weapons: false,
  can_edit_weapons: false,
  can_delete_weapons: false,
  can_create_gear: false,
  can_edit_gear: false,
  can_delete_gear: false,
  can_create_drones: false,
  can_edit_drones: false,
  can_delete_drones: false,
  can_create_drone_components: false,
  can_edit_drone_components: false,
  can_delete_drone_components: false,
  can_create_equipment: false,
  can_edit_equipment: false,
  can_delete_equipment: false,
  can_import_data: false,
  can_manage_users: false,
  can_sign_equipment: false,
  can_view_reports: false,
  can_perform_maintenance: false,
  can_view_history: false,
  can_transfer_equipment: false,
  can_deposit_equipment: false,
  can_release_equipment: false,
  can_export_data: false,
  can_perform_daily_verification: false,
  can_view_own_equipment: true, // This is a new permission specific to soldiers
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);

  useEffect(() => {
    loadData();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (error) {
      console.error("Error loading current user:", error);
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

      if (Array.isArray(soldiersData)) {
        const uniqueDivisions = [...new Set(soldiersData.map(s => s.division_name).filter(Boolean))];
        setDivisions(uniqueDivisions.sort());
      } else {
        setDivisions([]);
      }

    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load users or divisions");
      setUsers([]);
      setDivisions([]);
    }
    setIsLoading(false);
  };

  const handleRoleUpdate = async (userId, newCompositeRole) => {
    try {
      let updatePayload = {};
      switch (newCompositeRole) {
        case 'admin':
          updatePayload = {
            role: 'admin',
            custom_role: 'user', // Admins are a primary role, custom role is secondary
            permissions: ADMIN_PERMISSIONS,
          };
          break;
        case 'manager':
          updatePayload = {
            role: 'user', // Managers have the base 'user' role
            custom_role: 'manager', // But are identified by their 'manager' custom_role
            permissions: MANAGER_PERMISSIONS,
          };
          break;
        case 'user':
          updatePayload = {
            role: 'user',
            custom_role: 'user',
            permissions: DEFAULT_PERMISSIONS,
          };
          break;
        case 'soldier':
          updatePayload = {
            role: 'user', // Soldiers have the base 'user' role
            custom_role: 'soldier', // But are identified by their 'soldier' custom_role
            permissions: SOLDIER_PERMISSIONS,
          };
          break;
      }
      await User.update(userId, updatePayload);
      await loadData();
    } catch (error) {
      console.error("Error updating user role:", error);
      setError("Failed to update user role. " + (error.response?.data?.detail || error.message));
    }
  };

  const handleSavePermissions = async (userId, updatedData) => {
    try {
      await User.update(userId, updatedData);
      setShowPermissionsDialog(false);
      setEditingUser(null);
      await loadData();
    } catch (error) {
      console.error("Error updating user permissions:", error);
      setError("Failed to update user permissions");
    }
  };

  const openPermissionsDialog = (user) => {
    setEditingUser(user);
    setShowPermissionsDialog(true);
  };

  const filteredUsers = users.filter(user => {
    if (!user) return false;
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.full_name && user.full_name.toLowerCase().includes(searchLower)) ||
      (user.email && user.email.toLowerCase().includes(searchLower))
    );
  });

  const getCompositeRole = (user) => {
    if (!user) return 'soldier'; // Changed default for display
    if (user.role === 'admin') return 'admin';
    if (user.custom_role === 'manager') return 'manager';
    if (user.custom_role === 'soldier') return 'soldier'; // Added explicit check
    return 'user';
  };

  const getRoleBadge = (user) => {
    const compositeRole = getCompositeRole(user);
    if (compositeRole === 'admin') {
      return <Badge className="bg-red-100 text-red-800 border-red-200">Admin</Badge>;
    }
    if (compositeRole === 'manager') {
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Manager</Badge>;
    }
    if (compositeRole === 'soldier') {
        return <Badge className="bg-green-100 text-green-800 border-green-200">Soldier</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200">User</Badge>;
  };

  const isCurrentUserAdmin = currentUser?.role === 'admin' || currentUser?.permissions?.can_manage_users;

  if (!isCurrentUserAdmin) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access denied. You need administrator privileges to view this page.
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
          <p className="text-slate-600">Manage user access and permissions for the ARMORY system</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            {users.length} total users
          </Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Permissions Dialog */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="w-full max-w-[95vw] md:max-w-4xl h-[95vh] md:max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-4 md:px-6 py-4 border-b shrink-0 bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPermissionsDialog(false)}
                className="md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-lg md:text-xl">
                Manage Permissions - {editingUser?.full_name}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-safe">
            <div className="px-4 md:px-6 py-4 pb-8">
              {editingUser && (
                <UserPermissionsForm
                  user={editingUser}
                  divisions={divisions}
                  onSave={handleSavePermissions}
                  onCancel={() => setShowPermissionsDialog(false)}
                />
              )}
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
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Joined Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
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
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user)}
                      </TableCell>
                      <TableCell>
                        {user.department || 'Not set'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {user.created_date ? format(new Date(user.created_date), 'MMM d, yyyy') : 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {user.id !== currentUser?.id && (
                            <>
                              <Select
                                value={getCompositeRole(user)}
                                onValueChange={(newRole) => handleRoleUpdate(user.id, newRole)}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="soldier">Soldier</SelectItem>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="manager">Manager</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPermissionsDialog(user)}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Permissions
                              </Button>
                            </>
                          )}
                          {user.id === currentUser?.id && (
                            <span className="text-sm text-slate-500">Current user</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UserPermissionsForm({ user, divisions, onSave, onCancel }) {
  const [permissions, setPermissions] = useState(() => ({
    ...DEFAULT_PERMISSIONS,
    ...(user?.permissions || {})
  }));
  const [department, setDepartment] = useState(user?.department || '');

  const handlePermissionChange = (permission, checked) => {
    setPermissions(prev => ({
      ...prev,
      [permission]: checked
    }));
  };

  const handleSave = () => {
    const updatedData = {
      permissions,
      // Ensure that an empty string from the Select is treated as null for the backend
      department: department === null || department.trim() === '' ? null : department
    };
    onSave(user.id, updatedData);
  };

  const permissionGroups = [
    {
      name: "Personnel Management",
      permissions: [
        { key: "can_create_soldiers", label: "Create Soldiers" },
        { key: "can_edit_soldiers", label: "Edit Soldiers" },
        { key: "can_delete_soldiers", label: "Delete Soldiers" }
      ]
    },
    {
      name: "Weapons Management",
      permissions: [
        { key: "can_create_weapons", label: "Create Weapons" },
        { key: "can_edit_weapons", label: "Edit Weapons" },
        { key: "can_delete_weapons", label: "Delete Weapons" }
      ]
    },
    {
      name: "Gear Management",
      permissions: [
        { key: "can_create_gear", label: "Create Gear" },
        { key: "can_edit_gear", label: "Edit Gear" },
        { key: "can_delete_gear", label: "Delete Gear" }
      ]
    },
    {
      name: "Drones & Components Management",
      permissions: [
        { key: "can_create_drones", label: "Create Drone Sets" },
        { key: "can_edit_drones", label: "Edit Drone Sets" },
        { key: "can_delete_drones", label: "Delete Drone Sets" },
        { key: "can_create_drone_components", label: "Create Drone Components" },
        { key: "can_edit_drone_components", label: "Edit Drone Components" },
        { key: "can_delete_drone_components", label: "Delete Drone Components" },
      ]
    },
    {
      name: "Standard Equipment Management",
      permissions: [
        { key: "can_create_equipment", label: "Create Equipment" },
        { key: "can_edit_equipment", label: "Edit Equipment" },
        { key: "can_delete_equipment", label: "Delete Equipment" },
      ]
    },
    {
      name: "Armory Operations",
      permissions: [
        { key: "can_deposit_equipment", label: "Deposit Equipment to Armory" },
        { key: "can_release_equipment", label: "Release Equipment from Armory" },
        { key: "can_perform_daily_verification", label: "Perform Daily Verification" },
      ]
    },
    {
      name: "System Access",
      permissions: [
        { key: "can_sign_equipment", label: "Sign Equipment to Soldiers" },
        { key: "can_view_reports", label: "View Reports & Dashboard" },
        { key: "can_view_history", label: "View Activity History" },
        { key: "can_perform_maintenance", label: "Perform Maintenance" },
        { key: "can_transfer_equipment", label: "Transfer Equipment Between Divisions" },
        { key: "can_import_data", label: "Import Data from CSV" },
        { key: "can_export_data", label: "Export Data to CSV/ZIP" },
        { key: "can_manage_users", label: "Manage Users" },
        { key: "can_view_own_equipment", label: "View Own Equipment" }, // New permission for soldiers
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="division-select" className="block text-sm font-medium text-slate-700 mb-2">
          Division
        </label>
        <Select
          value={department === null ? '' : department}
          onValueChange={(value) => setDepartment(value === '' ? null : value)}
        >
          <SelectTrigger id="division-select">
            <SelectValue placeholder="Select a division" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>No Division</SelectItem>
            {divisions.map((div) => (
              <SelectItem key={div} value={div}>
                {div}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        <h3 className="font-medium text-slate-900">Permissions</h3>
        {permissionGroups.map((group) => (
          <Card key={group.name} className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-700">{group.name}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {group.permissions.map((perm) => (
                  <div key={perm.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={perm.key}
                      checked={permissions[perm.key] || false}
                      onCheckedChange={(checked) => handlePermissionChange(perm.key, checked)}
                    />
                    <label
                      htmlFor={perm.key}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {perm.label}
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
          Save Permissions
        </Button>
      </div>
    </div>
  );
}
