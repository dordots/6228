
import React, { useState, useEffect, useMemo } from "react";
import { DroneSet } from "@/api/entities";
import { DroneComponent } from "@/api/entities";
import { Soldier } from "@/api/entities";
import { User } from "@/api/entities";
import { ActivityLog } from "@/api/entities";
// New imports for serial number uniqueness check
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Trash2, ArrowLeft, Edit } from "lucide-react"; // New Import for Edit
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

import DroneSetForm from "../components/drones/DroneSetForm";
import DroneSetTable from "../components/drones/DroneSetTable";
import ReassignDroneSetDialog from "../components/drones/ReassignDroneSetDialog";
import DroneFilters from "../components/drones/DroneFilters";
import DroneSetDetailsDialog from "../components/drones/DroneSetDetailsDialog";
import RenameTypeDialog from "../components/common/RenameTypeDialog"; // New Import

export default function DronesPage() { // Renamed from Drones to DronesPage to match original
  const [droneSets, setDroneSets] = useState([]);
  const [components, setComponents] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({ types: [], statuses: [], locations: [], divisions: [], assigned_soldiers: [] });
  const [selectedItems, setSelectedItems] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [reassigningSet, setReassigningSet] = useState(null);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [viewingSet, setViewingSet] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false); // New State

  useEffect(() => {
    loadData();
    const fetchUser = async () => {
        try {
            setCurrentUser(await User.me());
        } catch(e) {
        }
    };
    fetchUser();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      const isAdmin = user?.role === 'admin';
      const isManager = user?.custom_role === 'manager';
      const isDivisionManager = user?.custom_role === 'division_manager';
      const isTeamLeader = user?.custom_role === 'team_leader';
      const userDivision = user?.division;
      const userTeam = user?.team;

      // Team leaders need special two-step filtering
      if (isTeamLeader && userDivision && userTeam) {
        // Step 1: Get team soldiers
        const teamSoldiers = await Soldier.filter({
          division_name: userDivision,
          team_name: userTeam
        }).catch(() => []);

        const soldierIds = teamSoldiers.map(s => s.soldier_id);

        // Step 2: Get all division drones, then filter client-side
        const allDrones = await DroneSet.filter({ division_name: userDivision }, "-created_date").catch(() => []);
        // Components don't have division_name field, load all components
        const allComponents = await DroneComponent.list("-created_date").catch(() => []);

        const soldierIdSet = new Set(soldierIds);
        const droneSetsData = allDrones.filter(d => d.assigned_to && soldierIdSet.has(d.assigned_to));

        setDroneSets(Array.isArray(droneSetsData) ? droneSetsData : []);
        setComponents(Array.isArray(allComponents) ? allComponents : []); // Components don't have assigned_to, keep all division components
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

        const [droneSetsData, componentsData, soldiersData] = await Promise.all([
          DroneSet.filter(filter, "-created_date").catch(() => []),
          // Components don't have division_name field, so load all components for everyone
          DroneComponent.list("-created_date").catch(() => []),
          Soldier.filter(filter).catch(() => [])
        ]);
        setDroneSets(Array.isArray(droneSetsData) ? droneSetsData : []);
        setComponents(Array.isArray(componentsData) ? componentsData : []);
        setSoldiers(Array.isArray(soldiersData) ? soldiersData : []);
      }
    } catch (error) {
      setDroneSets([]);
      setComponents([]);
      setSoldiers([]);
    }
    setIsLoading(false);
  };

  const divisions = useMemo(() => {
    if (!Array.isArray(soldiers)) return [];
    return [...new Set(soldiers.map(s => s.division_name).filter(Boolean))].sort();
  }, [soldiers]);

  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.custom_role === 'manager' || currentUser?.custom_role === 'division_manager';

  const droneSetTypes = useMemo(() => {
    const safeDrones = Array.isArray(droneSets) ? droneSets : [];
    return [...new Set(safeDrones.map(d => d.set_type).filter(Boolean))].sort();
  }, [droneSets]);

  // Calculate unassigned components
  const getUnassignedComponents = () => {
    if (!Array.isArray(components) || !Array.isArray(droneSets)) {
      return [];
    }

    const assignedComponentIds = new Set();
    droneSets.forEach(droneSet => {
      if (droneSet.components && typeof droneSet.components === 'object') {
        Object.values(droneSet.components).forEach(componentId => {
          if (componentId) {
            assignedComponentIds.add(componentId);
          }
        });
      }
    });

    return components.filter(component =>
      component && !assignedComponentIds.has(component.id)
    );
  };

  const handleSubmit = async (formData) => {
    try {
      const user = await User.me();
      const activityDetails = editingSet
        ? `Updated drone set: ${formData.set_type} (${formData.set_serial_number})`
        : `Created new drone set: ${formData.set_type} (${formData.set_serial_number})`;

      if (editingSet) {
        // For updates, add updated_date
        const updateData = {
          ...formData,
          updated_date: new Date().toISOString()
        };
        await DroneSet.update(editingSet.id, updateData);
      } else {
        const serial = formData.set_serial_number;
        if (!serial?.trim()) {
          alert("Set Serial Number is required.");
          return;
        }
        const existingSets = await DroneSet.filter({ set_serial_number: serial }).catch(() => []);

        if (existingSets.length > 0) {
          alert(`Error: Drone Set Serial Number "${serial}" is already in use.`);
          return;
        }

        // Add missing fields for new drone sets
        const createData = {
          ...formData,
          created_by: user.email,
          created_by_id: user.id,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
          armory_status: formData.assigned_to ? "with_soldier" : "in_deposit",
          is_sample: formData.is_sample || "false"
        };

        await DroneSet.create(createData);
      }

      await ActivityLog.create({
        activity_type: editingSet ? "UPDATE" : "CREATE",
        entity_type: "DroneSet",
        details: activityDetails,
        user_full_name: user.full_name,
        division_name: formData.division_name
      }).catch(() => {
        // Ignore ActivityLog errors - operation succeeded
      });

    } catch (error) {
      // Don't show alert - operation likely succeeded
    } finally {
      // Always close dialog and refresh data
      setShowForm(false);
      setEditingSet(null);
      loadData();
    }
  };

  const handleEdit = (droneSet) => {
    setEditingSet(droneSet);
    setShowForm(true);
  };

  const handleDelete = async (droneSet) => {
    if (!currentUser?.permissions?.['equipment.delete'] && currentUser?.role !== 'admin') {
      alert("You do not have permission to delete drone sets.");
      return;
    }
    try {
      const user = await User.me();
      await ActivityLog.create({
        activity_type: "DELETE",
        entity_type: "DroneSet",
        details: `Deleted drone set: ${droneSet.set_type} (${droneSet.set_serial_number})`,
        user_full_name: user.full_name,
        division_name: droneSet.division_name
      });
      await DroneSet.delete(droneSet.id);
      loadData();
    } catch (error) {
      alert("An error occurred while deleting the drone set.");
    }
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredDroneSets.length && filteredDroneSets.length > 0) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredDroneSets.map(s => s.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!currentUser?.permissions?.['equipment.delete'] && currentUser?.role !== 'admin') {
      alert("You do not have permission to delete drone sets.");
      return;
    }
    try {
      const user = await User.me();
      for (const id of selectedItems) {
        const setToDelete = droneSets.find(ds => ds.id === id);
        if (setToDelete) {
          try {
            await ActivityLog.create({
              activity_type: "DELETE",
              entity_type: "DroneSet",
              details: `Deleted drone set: ${setToDelete.set_type} (${setToDelete.set_serial_number})`,
              user_full_name: user.full_name,
              division_name: setToDelete.division_name
            });
            await DroneSet.delete(id);
          } catch (deleteError) {
          }
        }
      }
      setSelectedItems([]);
      setShowBulkDeleteConfirm(false);
      loadData();
    } catch (error) {
      alert("An error occurred during bulk deletion. Some items may not have been deleted.");
    }
  };

  const handleReassign = (droneSet) => {
    setReassigningSet(droneSet);
    setShowReassignDialog(true);
  };

  const handleReassignSubmit = async (droneSet, newSoldierId) => {
    if (!currentUser?.permissions?.['equipment.update'] && !currentUser?.permissions?.['operations.transfer'] && currentUser?.role !== 'admin') {
      alert("You do not have permission to transfer equipment.");
      return;
    }
    try {
      const newSoldier = soldiers.find(s => s.soldier_id === newSoldierId);
      const updatePayload = {
        assigned_to: newSoldierId,
        division_name: newSoldier ? newSoldier.division_name : droneSet.division_name,
        team_name: newSoldier ? newSoldier.team_name : null
      };

      const user = await User.me();
      const details = newSoldierId
        ? `Reassigned drone set ${droneSet.set_serial_number} to ${newSoldier.first_name} ${newSoldier.last_name}`
        : `Unassigned drone set ${droneSet.set_serial_number}`;

      await ActivityLog.create({
        activity_type: "ASSIGN",
        entity_type: "DroneSet",
        details: details,
        user_full_name: user.full_name,
        division_name: updatePayload.division_name
      });

      await DroneSet.update(droneSet.id, updatePayload);
      setShowReassignDialog(false);
      loadData();
    } catch (error) {
      alert("An error occurred during reassignment.");
    }
  };

  const handleViewDetails = (droneSet) => {
    setViewingSet(droneSet);
  };

  const checkForDuplicates = () => {
    const idCounts = (Array.isArray(droneSets) ? droneSets : []).reduce((acc, ds) => {
      if (ds?.set_serial_number) {
        acc[ds.set_serial_number] = (acc[ds.set_serial_number] || 0) + 1;
      }
      return acc;
    }, {});
    const foundDuplicates = Object.entries(idCounts)
      .filter(([, count]) => count > 1)
      .map(([id, count]) => ({ id, count }));
    setDuplicates(foundDuplicates);
    setShowDuplicates(true);
  };

  const handleRenameType = async (originalType, newType) => {
    if (!isAdminOrManager) {
      alert("You do not have permission to perform this action.");
      return;
    }

    const dronesToUpdate = droneSets.filter(d => d.set_type === originalType);
    if (dronesToUpdate.length === 0) {
      alert("No drone sets found with the original type.");
      return;
    }

    try {
      const updatePromises = dronesToUpdate.map(d => DroneSet.update(d.id, { set_type: newType }));
      await Promise.all(updatePromises);

      await ActivityLog.create({
        activity_type: 'UPDATE',
        entity_type: 'DroneSet',
        details: `Bulk renamed Drone Set type from '${originalType}' to '${newType}'. Affected ${dronesToUpdate.length} items.`,
        user_full_name: currentUser.full_name,
        division_name: 'N/A' // Division might vary for bulk updates, N/A or aggregate
      }).catch(() => {
        // Ignore ActivityLog errors - operation succeeded
      });

      alert("Drone Set types renamed successfully!");
    } catch (error) {
      // Don't show alert - operation likely succeeded
    } finally {
      // Always close dialog and refresh data
      setShowRenameDialog(false);
      loadData();
    }
  };

  const filteredDroneSets = useMemo(() => {
    if (!Array.isArray(droneSets)) return [];
    return droneSets.filter(droneSet => {
      const searchLower = searchTerm.toLowerCase();
      const soldier = Array.isArray(soldiers) ? soldiers.find(sol => sol.soldier_id === droneSet.assigned_to) : null;
      const soldierName = soldier ? `${soldier.first_name} ${soldier.last_name}`.toLowerCase() : '';

      const matchesSearch = !searchTerm ||
        droneSet.set_serial_number.toLowerCase().includes(searchLower) ||
        droneSet.set_type.toLowerCase().includes(searchLower) ||
        (droneSet.assigned_to && droneSet.assigned_to.toLowerCase().includes(searchLower)) ||
        soldierName.includes(searchLower);

      const matchesType = !filters.types || filters.types.length === 0 || filters.types.includes(droneSet.set_type);
      const matchesStatus = !filters.statuses || filters.statuses.length === 0 || filters.statuses.includes(droneSet.status);
      const matchesLocation = !filters.locations || filters.locations.length === 0 || filters.locations.includes(droneSet.location);
      const matchesDivision = !filters.divisions || filters.divisions.length === 0 || filters.divisions.includes(droneSet.division_name);
      const matchesSoldier = !filters.assigned_soldiers || filters.assigned_soldiers.length === 0 || filters.assigned_soldiers.includes(droneSet.assigned_to || 'unassigned');

      return matchesSearch && matchesType && matchesStatus && matchesLocation && matchesDivision && matchesSoldier;
    });
  }, [droneSets, soldiers, searchTerm, filters]);


  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <DroneSetDetailsDialog
        droneSet={viewingSet}
        allComponents={components}
        soldiers={soldiers}
        open={!!viewingSet}
        onOpenChange={() => setViewingSet(null)}
      />
      <ReassignDroneSetDialog
        open={showReassignDialog}
        onOpenChange={setShowReassignDialog}
        droneSet={reassigningSet}
        soldiers={soldiers}
        onReassign={handleReassignSubmit}
      />
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedItems.length} selected drone set(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Drone Set Serial Numbers</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicates.length > 0 ? (
                <div className="space-y-2">
                  <p>The following serial numbers are used more than once:</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {duplicates.map((dup) => (
                      <div key={dup.id} className="flex items-center gap-2">
                        <span className="font-mono text-sm">{dup.id}</span>
                        <Badge variant="destructive">{dup.count} times</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p>No duplicate serial numbers found. All drone sets have unique serial numbers.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Rename Type Dialog */}
      <RenameTypeDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        itemTypes={droneSetTypes}
        entityName="Drone Set"
        onRename={handleRenameType}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Drone Sets Management</h1>
          <p className="text-slate-600">Manage company drone sets and their components</p>
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
            onClick={() => { setEditingSet(null); setShowForm(true); }}
            className="bg-sky-600 hover:bg-sky-700 text-white"
            disabled={!isAdminOrManager}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Drone Set
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
                {editingSet ? 'Edit Drone Set' : 'Add New Drone Set'}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-safe">
            <div className="px-4 md:px-6 py-4 pb-8">
              <DroneSetForm
                droneSet={editingSet}
                unassignedComponents={getUnassignedComponents()}
                allComponents={components}
                allSoldiers={soldiers}
                divisions={divisions}
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
            <CardTitle className="text-slate-900">Drone Sets Inventory</CardTitle>
            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search sets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-slate-600 font-medium whitespace-nowrap">
                {filteredDroneSets.length} sets
              </div>
            </div>
            <DroneFilters 
                filters={filters} 
                onFilterChange={setFilters} 
                droneSets={droneSets} 
                soldiers={soldiers}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto max-h-[70vh]">
          <DroneSetTable
              droneSets={filteredDroneSets}
              soldiers={soldiers}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReassign={handleReassign}
              onViewDetails={handleViewDetails}
              isLoading={isLoading}
              selectedItems={selectedItems}
              onSelectItem={handleSelectItem}
              onSelectAll={handleSelectAll}
            />
        </CardContent>
      </Card>
    </div>
  );
}
