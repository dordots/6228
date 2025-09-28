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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Shield, Mail, Calendar, Search, UserPlus, Settings, Edit, ArrowLeft, Building, UsersIcon } from "lucide-react";
import { format } from "date-fns";

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

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);

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
        // Extract unique divisions
        const uniqueDivisions = [...new Set(soldiersData.map(s => s.division_name).filter(Boolean))];
        setDivisions(uniqueDivisions.sort());
        
        // Extract unique teams
        const uniqueTeams = [...new Set(soldiersData.map(s => s.team_name).filter(Boolean))];
        setTeams(uniqueTeams.sort());
      } else {
        setDivisions([]);
        setTeams([]);
      }

    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load users or divisions");
      setUsers([]);
      setDivisions([]);
      setTeams([]);
    }
    setIsLoading(false);
  };

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
      console.error("Error updating user role:", error);
      setError("Failed to update user role. " + (error.response?.data?.detail || error.message));
    }
  };

  const handleAssignmentUpdate = async (userId, division, team) => {
    try {
      await User.update(userId, {
        permissions: {
          division: division || null,
          team: team || null
        }
      });
      setShowAssignmentDialog(false);
      setEditingUser(null);
      await loadData();
    } catch (error) {
      console.error("Error updating user assignment:", error);
      setError("Failed to update user assignment");
    }
  };

  const openAssignmentDialog = (user) => {
    setEditingUser(user);
    setShowAssignmentDialog(true);
  };

  const filteredUsers = users.filter(user => {
    if (!user) return false;
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.full_name && user.full_name.toLowerCase().includes(searchLower)) ||
      (user.email && user.email.toLowerCase().includes(searchLower)) ||
      (user.phoneNumber && user.phoneNumber.includes(searchLower))
    );
  });

  const getUserRole = (user) => {
    if (!user) return 'soldier';
    return user.custom_role || user.role || 'soldier';
  };

  const getRoleBadge = (user) => {
    const role = getUserRole(user);
    const roleConfig = ROLES[role];
    if (!roleConfig) return <Badge>Unknown Role</Badge>;
    
    return <Badge className={roleConfig.badge}>{roleConfig.label}</Badge>;
  };

  const isCurrentUserAdmin = currentUser?.role === 'admin';
  const isCurrentUserDivisionManager = currentUser?.custom_role === 'division_manager';
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
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Assignment Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>
              Update Assignment - {editingUser?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingUser && (
              <UserAssignmentForm
                user={editingUser}
                divisions={divisions}
                teams={teams}
                onSave={handleAssignmentUpdate}
                onCancel={() => setShowAssignmentDialog(false)}
                canAssignDivision={isCurrentUserAdmin}
                currentUserDivision={currentUser?.division}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Information */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Role Permissions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(ROLES).map(([key, role]) => (
              <div key={key} className="p-3 border rounded-lg">
                <Badge className={`${role.badge} mb-2`}>{role.label}</Badge>
                <p className="text-sm text-slate-600">{role.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
                          {user.division ? (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Building className="w-3 h-3" />
                              {user.division}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">Not assigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.team ? (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <UsersIcon className="w-3 h-3" />
                              {user.team}
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
                          <div className="flex gap-2">
                            {canEditUser && user.id !== currentUser?.id ? (
                              <>
                                <Select
                                  value={role}
                                  onValueChange={(newRole) => handleRoleUpdate(
                                    user.id, 
                                    newRole,
                                    user.division,
                                    user.team
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
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAssignmentDialog(user)}
                                >
                                  <Edit className="w-4 h-4 mr-1" />
                                  Assign
                                </Button>
                              </>
                            ) : (
                              <span className="text-sm text-slate-500">
                                {user.id === currentUser?.id ? 'Current user' : 'No permission'}
                              </span>
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
    </div>
  );
}

function UserAssignmentForm({ user, divisions, teams, onSave, onCancel, canAssignDivision, currentUserDivision }) {
  const [division, setDivision] = useState(user?.division || 'none');
  const [team, setTeam] = useState(user?.team || 'none');
  
  // Filter divisions based on user's permission
  const availableDivisions = canAssignDivision ? divisions : [currentUserDivision].filter(Boolean);
  
  // Filter teams based on selected division
  const availableTeams = teams; // In a real app, you'd filter by division

  const handleSave = () => {
    // Convert 'none' back to null when saving
    onSave(
      user.id, 
      division === 'none' ? null : division, 
      team === 'none' ? null : team
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="division">Division</Label>
        <Select
          value={division}
          onValueChange={setDivision}
          disabled={!canAssignDivision && division !== currentUserDivision}
        >
          <SelectTrigger id="division">
            <SelectValue placeholder="Select a division" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Division</SelectItem>
            {availableDivisions.map((div) => (
              <SelectItem key={div} value={div}>
                {div}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="team">Team</Label>
        <Select
          value={team}
          onValueChange={setTeam}
        >
          <SelectTrigger id="team">
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Team</SelectItem>
            {availableTeams.map((tm) => (
              <SelectItem key={tm} value={tm}>
                {tm}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
          Save Assignment
        </Button>
      </div>
    </div>
  );
}