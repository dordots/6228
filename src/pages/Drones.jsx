
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
  const [filters, setFilters] = useState({ type: "all", status: "all", armory_status: "all", assignment: "all", division: "all" });
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
            console.error("Failed to fetch user", e);
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
      const userDivision = user?.department;
      
      const filter = (isAdmin || isManager) ? {} : (userDivision ? { division_name: userDivision } : {});

      const [droneSetsData, componentsData, soldiersData] = await Promise.all([
        DroneSet.filter(filter, "-created_date").catch(() => []),
        DroneComponent.filter(filter).catch(() => []),
        Soldier.filter(filter).catch(() => [])
      ]);
      setDroneSets(Array.isArray(droneSetsData) ? droneSetsData : []);
      setComponents(Array.isArray(componentsData) ? componentsData : []);
      setSoldiers(Array.isArray(soldiersData) ? soldiersData : []);
    } catch (error) {
      console.error("Error loading data:", error);
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

  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.custom_role === 'manager'; // New variable for permission checks

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
    const user = await User.me();
    const activityDetails = editingSet
      ? `Updated drone set: ${formData.set_type} (${formData.set_serial_number})`
      : `Created new drone set: ${formData.set_type} (${formData.set_serial_number})`;

    if (editingSet) {
      await DroneSet.update(editingSet.id, formData);
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
      await DroneSet.create(formData);
    }

    await ActivityLog.create({
      activity_type: editingSet ? "UPDATE" : "CREATE",
      entity_type: "DroneSet",
      details: activityDetails,
      user_full_name: user.full_name,
      division_name: formData.division_name
    });

    setShowForm(false);
    setEditingSet(null);
    loadData();
  };

  const handleEdit = (droneSet) => {
    setEditingSet(droneSet);
    setShowForm(true);
  };

  const handleDelete = async (droneSet) => {
    if (!currentUser?.permissions?.can_delete_drones && currentUser?.role !== 'admin') {
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
      console.error("Error deleting drone set:", error);
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
    if (!currentUser?.permissions?.can_delete_drones && currentUser?.role !== 'admin') {
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
            console.error(`Error deleting drone set ${id}:`, deleteError);
          }
        }
      }
      setSelectedItems([]);
      setShowBulkDeleteConfirm(false);
      loadData();
    } catch (error) {
      console.error("Error during bulk deletion process:", error);
      alert("An error occurred during bulk deletion. Some items may not have been deleted.");
    }
  };

  const handleReassign = (droneSet) => {
    setReassigningSet(droneSet);
    setShowReassignDialog(true);
  };

  const handleReassignSubmit = async (droneSet, newSoldierId) => {
    if (!currentUser?.permissions?.can_transfer_equipment && currentUser?.role !== 'admin') {
      alert("You do not have permission to transfer equipment.");
      return;
    }
    try {
      const newSoldier = soldiers.find(s => s.soldier_id === newSoldierId);
      const updatePayload = {
        assigned_to: newSoldierId,
        division_name: newSoldier ? newSoldier.division_name : droneSet.division_name
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
      console.error("Error reassigning drone set:", error);
      alert("An error occurred during reassignment.");
    }
  };

  const handleViewDetails = (droneSet) => {
    setViewingSet(droneSet);
  };

  const checkForDuplicates = async () => {
    alert("Checking for duplicates functionality not yet implemented.");
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
      });

      alert("Drone Set types renamed successfully!");
      setShowRenameDialog(false);
      await loadData();
    } catch (error) {
      console.error("Error renaming drone set types:", error);
      alert("An error occurred during the renaming process.");
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

      const matchesType = filters.type === 'all' || droneSet.set_type === filters.type;
      const matchesStatus = filters.status === 'all' || droneSet.status === filters.status;
      const matchesArmory = filters.armory_status === "all" || (droneSet.armory_status || 'with_soldier') === filters.armory_status;
      const matchesAssignment = filters.assignment === "all" ||
        (filters.assignment === 'assigned' && !!droneSet.assigned_to) ||
        (filters.assignment === 'unassigned' && !droneSet.assigned_to);
      const matchesDivision = filters.division === 'all' || droneSet.division_name === filters.division;

      return matchesSearch && matchesType && matchesStatus && matchesArmory && matchesAssignment && matchesDivision;
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
          <p className="text-slate-600">Manage company drone sets and their components</p> {/* Updated description slightly */}
        </div>
        <div className="flex gap-2 flex-wrap"> {/* Added flex-wrap for smaller screens */}
          {selectedItems.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!currentUser?.permissions?.can_delete_drones && currentUser?.role !== 'admin'}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedItems.length})
            </Button>
          )}
          {isAdminOrManager && (
            <Button variant="outline" onClick={() => setShowRenameDialog(true)}>
              <Edit className="w-4 h-4 mr-2" /> Rename Type
            </Button>
          )}
          <Button variant="outline" onClick={checkForDuplicates}>Check Duplicates</Button>
          <Button
            onClick={() => { setEditingSet(null); setShowForm(true); }}
            className="bg-sky-600 hover:bg-sky-700 text-white"
            disabled={!currentUser?.permissions?.can_create_drones && currentUser?.role !== 'admin'}
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
