
import React, { useState, useEffect, useMemo } from "react";
import { SerializedGear } from "@/api/entities";
import { Soldier } from "@/api/entities";
import { User } from "@/api/entities";
import { ActivityLog } from "@/api/entities";
import { DroneSet } from "@/api/entities";
import { DroneComponent } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowLeft, Plus, Search, Trash2, Edit } from "lucide-react"; // Added Edit
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import GearForm from "../components/gear/GearForm";
import GearTable from "../components/gear/GearTable";
import GearFilters from "../components/gear/GearFilters";
import ReassignGearDialog from "../components/gear/ReassignGearDialog";
import RenameTypeDialog from "../components/common/RenameTypeDialog"; // New Import

export default function SerializedGearPage() {
  const [gear, setGear] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGear, setEditingGear] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({ types: [], conditions: [], divisions: [], armory_statuses: [], assigned_soldiers: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassigningGear, setReassigningGear] = useState(null);
  const [viewingComment, setViewingComment] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false); // New State

  useEffect(() => {
    loadData();
    const fetchUser = async () => {
        try {
            setCurrentUser(await User.me());
        } catch(e) {
            console.error("Failed to fetch user", e);
        }
    };
    fetchUser();

    const urlParams = new URLSearchParams(window.location.search);
    const typeFilter = urlParams.get('type');
    if (typeFilter) {
      setFilters(prev => ({ ...prev, types: [typeFilter] }));
    }
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setCurrentUser(currentUser);
      const isAdmin = currentUser?.role === 'admin';
      const isManager = currentUser?.custom_role === 'manager';
      const isDivisionManager = currentUser?.custom_role === 'division_manager';
      const isTeamLeader = currentUser?.custom_role === 'team_leader';
      const userDivision = currentUser?.division;
      const userTeam = currentUser?.team;

      // Team leaders need special two-step filtering
      if (isTeamLeader && userDivision && userTeam) {
        console.log('Team leader: Using two-step filtering approach for gear');

        // Step 1: Get team soldiers
        const teamSoldiers = await Soldier.filter({
          division_name: userDivision,
          team_name: userTeam
        }).catch(() => []);

        const soldierIds = teamSoldiers.map(s => s.soldier_id);
        console.log(`Team leader: Found ${soldierIds.length} team soldiers`);

        // Step 2: Get all division gear, then filter client-side
        const allGear = await SerializedGear.filter({ division_name: userDivision }, "-created_date").catch(() => []);
        console.log(`Team leader: Fetched ${allGear.length} division gear, filtering client-side...`);

        const soldierIdSet = new Set(soldierIds);
        const gearData = allGear.filter(g => g.assigned_to && soldierIdSet.has(g.assigned_to));

        console.log(`Team leader: After filtering, ${gearData.length} gear assigned to team members`);

        setGear(Array.isArray(gearData) ? gearData : []);
        setSoldiers(Array.isArray(teamSoldiers) ? teamSoldiers : []);
      } else {
        // Non-team-leader roles: standard filtering
        let filter = {};
        if (isAdmin || isManager) {
          filter = {}; // See everything
        } else if (isDivisionManager && userDivision) {
          filter = { division_name: userDivision }; // See division only
        } else if (userDivision) {
          filter = { division_name: userDivision }; // Fallback
        }

        const [gearData, soldiersData] = await Promise.all([
          SerializedGear.filter(filter, "-created_date").catch(() => []),
          Soldier.filter(filter).catch(() => [])
        ]);
        setGear(Array.isArray(gearData) ? gearData : []);
        setSoldiers(Array.isArray(soldiersData) ? soldiersData : []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setGear([]);
      setSoldiers([]);
    }
    setIsLoading(false);
  };

  const isAdminOrManager = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.custom_role === 'manager' || currentUser.custom_role === 'division_manager';
  }, [currentUser]);

  const gearTypes = useMemo(() => {
    const safeGear = Array.isArray(gear) ? gear : [];
    return [...new Set(safeGear.map(g => g.gear_type).filter(Boolean))].sort();
  }, [gear]);

  const handleRenameType = async (originalType, newType) => {
    if (!isAdminOrManager) {
      alert("You do not have permission to perform this action.");
      return;
    }

    const gearToUpdate = gear.filter(g => g.gear_type === originalType);
    if (gearToUpdate.length === 0) {
      alert("No gear found with the original type.");
      return;
    }

    try {
      const updatePromises = gearToUpdate.map(g => SerializedGear.update(g.id, { gear_type: newType }));
      await Promise.all(updatePromises);

      // Try to create activity log, but don't fail rename if it errors
      try {
        const adjustedTimestamp = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
        await ActivityLog.create({
          activity_type: 'UPDATE',
          entity_type: 'SerializedGear',
          details: `Bulk renamed Gear type from '${originalType}' to '${newType}'. Affected ${gearToUpdate.length} items.`,
          user_full_name: currentUser.full_name,
          client_timestamp: adjustedTimestamp,
          division_name: 'N/A' // Or infer a common division if all updated gear belong to one, otherwise 'N/A'
        });
      } catch (logError) {
        console.error("Failed to create activity log (gear rename succeeded):", logError);
      }

      alert("Gear types renamed successfully!");
      setShowRenameDialog(false);
      await loadData();
    } catch (error) {
      console.error("Error renaming gear types:", error);
      alert("An error occurred during the renaming process.");
    }
  };

  const handleSubmit = async (gearData) => {
    const user = await User.me();
    const adjustedTimestamp = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    const gearType = gearData.gear_type || "Unknown Type";
    const gearId = gearData.gear_id;
    
    const assignedSoldier = soldiers.find(s => s && s.soldier_id === gearData.assigned_to);
    const assignedSoldierName = assignedSoldier ? `${assignedSoldier.first_name} ${assignedSoldier.last_name}` : "unassigned";

    const divisionName = gearData.division_name || "Unknown Division";

    let activityDetails = "";

    if (editingGear) {
      activityDetails = `Updated gear: ${gearType} (${gearId}), assigned to ${assignedSoldierName}, in ${divisionName}.`;
      await SerializedGear.update(editingGear.id, gearData);
    } else {
      const serial = gearData.gear_id;
      if (!serial?.trim()) {
        alert("Gear ID is required.");
        return;
      }
      const existingGear = await SerializedGear.filter({ gear_id: serial }).catch(() => []);

      if (existingGear.length > 0) {
        alert(`Error: Gear ID "${serial}" is already in use.`);
        return;
      }

      // Find assigned soldier for enrichment
      const assignedSoldierForEnrichment = gearData.assigned_to
        ? soldiers.find(s => s && s.soldier_id === gearData.assigned_to)
        : null;

      // Enrich gear data with all required fields to match schema of imported/existing gear
      const enrichedGearData = {
        ...gearData,
        // Timestamp fields (ISO string format for consistency with imports)
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        // User tracking fields
        created_by: user.email || user.full_name,
        created_by_id: user.id || user.uid,
        // Default fields
        armory_status: gearData.armory_status || "with_soldier",
        is_sample: "false",
        last_signed_by: assignedSoldierForEnrichment
          ? `${assignedSoldierForEnrichment.first_name} ${assignedSoldierForEnrichment.last_name}`
          : ""
      };

      activityDetails = `Created new gear: ${gearType} (${gearId}), assigned to ${assignedSoldierName}, in ${divisionName}.`;
      await SerializedGear.create(enrichedGearData);
    }

    // Try to create activity log, but don't fail operation if it errors
    try {
      await ActivityLog.create({
        activity_type: editingGear ? "UPDATE" : "CREATE",
        entity_type: "SerializedGear",
        details: activityDetails,
        user_full_name: user.full_name,
        client_timestamp: adjustedTimestamp,
        division_name: gearData.division_name || 'N/A'
      });
    } catch (logError) {
      console.error("Failed to create activity log (gear operation succeeded):", logError);
    }

    setShowForm(false);
    setEditingGear(null);
    loadData();
  };

  const handleEdit = (gearItem) => {
    setEditingGear(gearItem);
    setShowForm(true);
  };

  const handleDelete = async (gearItem) => {
    if (!currentUser?.permissions?.['equipment.delete'] && currentUser?.role !== 'admin') {
      alert("You do not have permission to delete gear.");
      return;
    }
    try {
      const user = await User.me();
      const adjustedTimestamp = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

      const gearType = gearItem.gear_type || "Unknown Type";
      const gearId = gearItem.gear_id;
      const assignedSoldier = soldiers.find(s => s && s.soldier_id === gearItem.assigned_to);
      const assignedSoldierName = assignedSoldier ? `${assignedSoldier.first_name} ${assignedSoldier.last_name}` : "unassigned";

      const divisionName = gearItem.division_name || "Unknown Division";

      await SerializedGear.delete(gearItem.id);

      // Try to create activity log, but don't fail delete if it errors
      try {
        await ActivityLog.create({
          activity_type: "DELETE",
          entity_type: "SerializedGear",
          details: `Deleted gear: ${gearType} (${gearId}), previously assigned to ${assignedSoldierName}, in ${divisionName}.`,
          user_full_name: user.full_name,
          client_timestamp: adjustedTimestamp,
          division_name: gearItem.division_name || 'N/A'
        });
      } catch (logError) {
        console.error("Failed to create activity log (gear delete succeeded):", logError);
      }

      loadData();
    } catch (error) {
      console.error("Error deleting gear:", error);
      if (error.message?.includes('Object not found') || error.response?.status === 404) {
        loadData();
      } else {
        alert("An error occurred while deleting the gear item. The data has been refreshed.");
        loadData();
      }
    }
  };

  const checkForDuplicates = () => {
    const idCounts = Array.isArray(gear) ? gear.reduce((acc, g) => {
      if (g?.gear_id) acc[g.gear_id] = (acc[g.gear_id] || 0) + 1;
      return acc;
    }, {}) : {};
    const foundDuplicates = Object.entries(idCounts)
      .filter(([, count]) => count > 1)
      .map(([id, count]) => ({ id, count }));
    setDuplicates(foundDuplicates);
    setShowDuplicates(true);
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredGear.length && filteredGear.length > 0) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredGear.map(g => g.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!currentUser?.permissions?.['equipment.delete'] && currentUser?.role !== 'admin') {
      alert("You do not have permission to delete gear.");
      return;
    }
    try {
      const user = await User.me();
      let successCount = 0;
      let errorCount = 0;
      
      for (const id of selectedItems) {
        const gearToDelete = gear.find(g => g.id === id);
        if (gearToDelete) {
          try {
            const adjustedTimestamp = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
            const gearType = gearToDelete.gear_type || "Unknown Type";
            const gearId = gearToDelete.gear_id;
            const assignedSoldier = soldiers.find(s => s && s.soldier_id === gearToDelete.assigned_to);
            const assignedSoldierName = assignedSoldier ? `${assignedSoldier.first_name} ${assignedSoldier.last_name}` : "unassigned";

            const divisionName = gearToDelete.division_name || "Unknown Division";

            await SerializedGear.delete(id);
            successCount++;

            // Try to create activity log, but don't fail bulk delete if it errors
            try {
              await ActivityLog.create({
                activity_type: "DELETE",
                entity_type: "SerializedGear",
                details: `Deleted gear: ${gearType} (${gearId}), previously assigned to ${assignedSoldierName}, in ${divisionName}.`,
                user_full_name: user.full_name,
                client_timestamp: adjustedTimestamp,
                division_name: gearToDelete.division_name || 'N/A'
              });
            } catch (logError) {
              console.error("Failed to create activity log (gear bulk delete succeeded):", logError);
            }
          } catch (deleteError) {
            console.error(`Error deleting gear ${id}:`, deleteError);
            if (deleteError.message?.includes('Object not found') || deleteError.response?.status === 404) {
              successCount++;
            } else {
              errorCount++;
            }
          }
        }
      }
      
      setSelectedItems([]);
      setShowBulkDeleteConfirm(false);
      
      if (errorCount > 0) {
        alert(`Bulk deletion completed. ${successCount} gear items deleted successfully, ${errorCount} errors occurred. The data has been refreshed.`);
      }
      
      loadData();
    } catch (error) {
      console.error("Error deleting gear:", error);
      alert("An error occurred during bulk deletion. The data has been refreshed to show the current state.");
      setSelectedItems([]);
      setShowBulkDeleteConfirm(false);
      loadData();
    }
  };

  const handleReassign = (gearItem) => {
    setReassigningGear(gearItem);
    setShowReassignDialog(true);
  };

  const handleReassignSubmit = async (gearItem, newSoldierId, newDivisionName) => {
    if (!currentUser?.permissions?.['equipment.update'] && !currentUser?.permissions?.['operations.transfer'] && currentUser?.role !== 'admin') {
      alert("You do not have permission to reassign equipment.");
      return;
    }
    try {
      const newSoldier = soldiers.find(s => s && s.soldier_id === newSoldierId);
      
      const updatePayload = { 
        assigned_to: newSoldierId,
      };

      if (newSoldier) {
        updatePayload.last_signed_by = `${newSoldier.first_name} ${newSoldier.last_name}`;
        updatePayload.division_name = newSoldier.division_name;
        updatePayload.team_name = newSoldier.team_name;
      } else {
        updatePayload.last_signed_by = null;
        updatePayload.team_name = null;
        // Keep existing division name or set to a default if soldier is unassigned
        // For now, let's keep the existing division_name if soldier is unassigned
        // updatePayload.division_name = gearItem.division_name; 
      }

      await SerializedGear.update(gearItem.id, updatePayload);

      // Log activity for reassign
      const user = await User.me();
      const adjustedTimestamp = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const gearType = gearItem.gear_type || "Unknown Type";
      const gearId = gearItem.gear_id;
      const oldAssignedSoldier = soldiers.find(s => s && s.soldier_id === gearItem.assigned_to);
      const oldAssignedSoldierName = oldAssignedSoldier ? `${oldAssignedSoldier.first_name} ${oldAssignedSoldier.last_name}` : "unassigned";
      const newAssignedSoldierName = newSoldier ? `${newSoldier.first_name} ${newSoldier.last_name}` : "unassigned";
      
      await ActivityLog.create({
        activity_type: "UPDATE", // Reassign is an update
        entity_type: "SerializedGear",
        details: `Reassigned gear: ${gearType} (${gearId}) from ${oldAssignedSoldierName} to ${newAssignedSoldierName}.`,
        user_full_name: user.full_name,
        client_timestamp: adjustedTimestamp,
        division_name: newSoldier ? newSoldier.division_name : gearItem.division_name // Use new soldier's division or retain original
      });

      setShowReassignDialog(false);
      setReassigningGear(null);
      loadData();
    } catch (error) {
      console.error("Error reassigning gear:", error);
      alert("An error occurred while reassigning gear.");
    }
  };

  const handleViewComment = (gear) => {
    setViewingComment(gear);
  };

  const filteredGear = useMemo(() => {
    if (!Array.isArray(gear)) return [];

    const searchLower = searchTerm.toLowerCase();

    return gear.filter(gearItem => {
      if (!gearItem) return false;
      const assignedSoldier = Array.isArray(soldiers) ? soldiers.find(s => s && s.soldier_id === gearItem.assigned_to) : null;
      const assignedSoldierName = assignedSoldier ? `${assignedSoldier.first_name} ${assignedSoldier.last_name}` : '';
      const lastSignedByName = gearItem.last_signed_by ? String(gearItem.last_signed_by).toLowerCase() : '';
      const comments = gearItem.comments ? String(gearItem.comments).toLowerCase() : '';

      const matchesSearch =
        (gearItem.gear_type && String(gearItem.gear_type).toLowerCase().includes(searchLower)) ||
        (gearItem.gear_id && String(gearItem.gear_id).toLowerCase().includes(searchLower)) ||
        (assignedSoldierName && assignedSoldierName.toLowerCase().includes(searchLower)) ||
        (gearItem.division_name && String(gearItem.division_name).toLowerCase().includes(searchLower)) ||
        (gearItem.assigned_to && String(gearItem.assigned_to).toLowerCase().includes(searchLower)) ||
        (lastSignedByName && lastSignedByName.includes(searchLower)) ||
        comments.includes(searchLower);

      const matchesType = !filters.types || filters.types.length === 0 || filters.types.includes(gearItem.gear_type);
      const matchesCondition = !filters.conditions || filters.conditions.length === 0 || filters.conditions.includes(gearItem.status);
      const matchesDivision = !filters.divisions || filters.divisions.length === 0 || filters.divisions.includes(gearItem.division_name);
      const matchesArmory = !filters.armory_statuses || filters.armory_statuses.length === 0 || filters.armory_statuses.includes(gearItem.armory_status || 'with_soldier');
      const matchesAssignedTo = !filters.assigned_soldiers || filters.assigned_soldiers.length === 0 || filters.assigned_soldiers.includes(gearItem.assigned_to || 'unassigned');

      return matchesSearch && matchesType && matchesCondition && matchesDivision && matchesArmory && matchesAssignedTo;
    });
  }, [gear, soldiers, searchTerm, filters]);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <ReassignGearDialog
        open={showReassignDialog}
        onOpenChange={setShowReassignDialog}
        gear={reassigningGear}
        soldiers={soldiers}
        onReassign={handleReassignSubmit}
        onCancel={() => setReassigningGear(null)}
      />

      <RenameTypeDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        itemTypes={gearTypes}
        entityName="Gear"
        onRename={handleRenameType}
      />

       <AlertDialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Gear IDs</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicates.length > 0 ? (
                <>
                  <p>The following Gear IDs have been used more than once. Please correct them to ensure data integrity.</p>
                  <ul className="mt-4 space-y-2">
                    {duplicates.map(d => (
                      <li key={d.id} className="flex justify-between items-center">
                        <span>Gear ID: <strong>{d.id}</strong></span>
                        <Badge variant="destructive">Used {d.count} times</Badge>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                "No duplicate Gear IDs found."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDuplicates(false)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedItems.length} selected gear item(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Comment Viewer Dialog */}
      <Dialog open={!!viewingComment} onOpenChange={() => setViewingComment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comment for Gear: {viewingComment?.gear_id}</DialogTitle>
            <DialogDescription>
              {viewingComment?.gear_type}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{viewingComment?.comments || "No comment provided."}</p>
          </div>
        </DialogContent>
      </Dialog>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Serialized Gear Management</h1>
          <p className="text-slate-600">Track and manage specialized equipment with serial numbers</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedItems.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!isAdminOrManager}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedItems.length})
            </Button>
          )}
          {currentUser?.role === 'admin' && (
            <Button variant="outline" onClick={() => setShowRenameDialog(true)}>
              <Edit className="w-4 h-4 mr-2" /> Rename Type
            </Button>
          )}
          <Button variant="outline" onClick={checkForDuplicates}>Check Duplicates</Button>
          <Button
            onClick={() => { setEditingGear(null); setShowForm(true); }}
            className="bg-purple-700 hover:bg-purple-800 text-white"
            disabled={!isAdminOrManager}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Gear
          </Button>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-full max-w-[95vw] md:max-w-2xl h-[95vh] md:max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-4 md:px-6 py-4 border-b shrink-0 bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowForm(false)}
                    className="md:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <DialogTitle className="text-lg md:text-xl">
                    {editingGear ? 'Edit Serialized Gear' : 'Add New Serialized Gear'}
                  </DialogTitle>
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto overflow-x-hidden pb-safe">
                <div className="px-4 md:px-6 py-4 pb-8">
                <GearForm
                  gear={editingGear}
                  soldiers={soldiers}
                  existingGear={gear}
                  currentUser={currentUser}
                  onSubmit={handleSubmit}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            </div>
            </DialogContent>
          </Dialog>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <CardTitle className="text-slate-900">Serialized Gear Inventory</CardTitle>
            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search gear..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-slate-600 font-medium whitespace-nowrap">
                {filteredGear.length} items
              </div>
            </div>
            <GearFilters filters={filters} onFilterChange={setFilters} gear={gear} soldiers={soldiers} />
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-auto max-h-[70vh]">
            <GearTable
              gear={filteredGear}
              soldiers={soldiers}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReassign={handleReassign}
              onViewComment={handleViewComment}
              isAdminOrManager={isAdminOrManager}
              permissions={{
                canEdit: currentUser?.permissions?.['equipment.update'] || false,
                canReassign: currentUser?.permissions?.['equipment.update'] || currentUser?.permissions?.['operations.transfer'] || false,
                canDelete: currentUser?.permissions?.['equipment.delete'] || false
              }}
              selectedItems={selectedItems}
              onSelectItem={handleSelectItem}
              onSelectAll={handleSelectAll}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
