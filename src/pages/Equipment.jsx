
import React, { useState, useEffect, useMemo } from "react";
import { Equipment } from "@/api/entities";
import { Soldier } from "@/api/entities";
import { User } from "@/api/entities";
import { ActivityLog } from "@/api/entities"; // Added ActivityLog import
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Trash2, ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  // DialogTrigger, // Removed DialogTrigger
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

import EquipmentForm from "../components/equipment/EquipmentForm";
import EquipmentTable from "../components/equipment/EquipmentTable";
import EquipmentFilters from "../components/equipment/EquipmentFilters";
import RenameTypeDialog from "../components/common/RenameTypeDialog"; // New Import
import { Edit } from "lucide-react"; // New Import

// Define equipment types that are typically serialized and require unique serial numbers
const SERIALIZED_ITEMS = ['weapon', 'electronic', 'vehicle', 'communication_device', 'optic'];

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({ type: "all", condition: "all", assignment: "all", division: "all" }); // Added assignment filter
  const [isLoading, setIsLoading] = useState(true);
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false); // Added state for bulk delete confirmation
  const [reassigningEquipment, setReassigningEquipment] = useState(null); // New state for reassigning
  const [currentUser, setCurrentUser] = useState(null); // State to store the current user
  const [showRenameDialog, setShowRenameDialog] = useState(false); // New State

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Fetch current user to determine permissions
      const user = await User.me();
      setCurrentUser(user); // Store current user in state

      const isAdmin = user?.role === 'admin';
      const isManager = user?.custom_role === 'manager';
      const isDivisionManager = user?.custom_role === 'division_manager';
      const isTeamLeader = user?.custom_role === 'team_leader';
      const userDivision = user?.division;
      const userTeam = user?.team;

      // Build filter based on role hierarchy
      let filter = {};
      if (isAdmin || isManager) {
        filter = {}; // See everything
      } else if (isDivisionManager && userDivision) {
        filter = { division_name: userDivision }; // See division only
      } else if (isTeamLeader && userDivision && userTeam) {
        filter = { division_name: userDivision, team_name: userTeam }; // See team only
      } else if (userDivision) {
        filter = { division_name: userDivision }; // Fallback
      }

      const [equipmentData, soldiersData] = await Promise.allSettled([
        Equipment.filter(filter, "-created_date"), // Apply division filter and sort
        Soldier.filter(filter) // Apply division filter
      ]);

      setEquipment(equipmentData.status === 'fulfilled' && Array.isArray(equipmentData.value) ? equipmentData.value : []);
      setSoldiers(soldiersData.status === 'fulfilled' && Array.isArray(soldiersData.value) ? soldiersData.value : []);

    } catch (error) {
      console.error("Error loading data:", error);
      setEquipment([]);
      setSoldiers([]);
    }
    setIsLoading(false);
  };

  const equipmentTypes = useMemo(() => {
    const safeEquipment = Array.isArray(equipment) ? equipment : [];
    return [...new Set(safeEquipment.map(e => e.equipment_type).filter(Boolean))].sort();
  }, [equipment]);

  const handleRenameType = async (originalType, newType) => {
    if (currentUser?.role !== 'admin' && currentUser?.custom_role !== 'manager') {
      alert("You do not have permission to perform this action.");
      return;
    }

    const equipmentToUpdate = equipment.filter(e => e.equipment_type === originalType);
    if (equipmentToUpdate.length === 0) {
      alert("No equipment found with the original type.");
      return;
    }

    try {
      const updatePromises = equipmentToUpdate.map(e => Equipment.update(e.id, { equipment_type: newType }));
      await Promise.all(updatePromises);

      await ActivityLog.create({
        activity_type: 'UPDATE',
        entity_type: 'Equipment',
        details: `Bulk renamed Equipment type from '${originalType}' to '${newType}'. Affected ${equipmentToUpdate.length} items.`,
        user_full_name: currentUser?.full_name || 'System',
        division_name: 'N/A'
      }).catch(() => {
        // Ignore ActivityLog errors
      });
    } catch (error) {
      console.error("Error renaming equipment types:", error);
      // Continue to close dialog and refresh even if there's an error
    } finally {
      setShowRenameDialog(false);
      await loadData();
    }
  };


  const filteredEquipment = useMemo(() => {
    if (!Array.isArray(equipment)) return [];
    const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];

    return equipment.filter(item => {
      if (!item) return false;

      const assignedSoldier = safeSoldiers.find(s => s && s.soldier_id === item.assigned_to);
      const assignedSoldierName = assignedSoldier ? `${assignedSoldier.first_name} ${assignedSoldier.last_name}` : '';
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch = !searchTerm ||
        (item.equipment_type && item.equipment_type.toLowerCase().includes(searchLower)) ||
        (item.serial_number && String(item.serial_number).toLowerCase().includes(searchLower)) ||
        (assignedSoldierName && assignedSoldierName.toLowerCase().includes(searchLower)) ||
        (item.division_name && item.division_name.toLowerCase().includes(searchLower)) ||
        (item.assigned_to && String(item.assigned_to).toLowerCase().includes(searchLower));

      const matchesType = filters.type === "all" || item.equipment_type === filters.type;
      const matchesCondition = filters.condition === "all" || item.condition === filters.condition;
      const matchesAssignment = filters.assignment === "all" ||
        (filters.assignment === 'assigned' && !!item.assigned_to) ||
        (filters.assignment === 'unassigned' && !item.assigned_to);
      const matchesDivision = filters.division === "all" || item.division_name === filters.division;

      return matchesSearch && matchesType && matchesCondition && matchesAssignment && matchesDivision;
    });
  }, [equipment, soldiers, searchTerm, filters]);


  const handleSubmit = async (equipmentData) => {
    try {
      const user = await User.me(); // Fetched user for activity log
      const activityDetails = editingEquipment
        ? `Updated equipment: ${equipmentData.equipment_type} (ID: ${editingEquipment.id || 'N/A'})`
        : `Created new equipment: ${equipmentData.equipment_type}`;

      if (editingEquipment) {
        const updateData = {
          ...equipmentData,
          updated_date: new Date().toISOString()
        };
        await Equipment.update(editingEquipment.id, updateData);
      } else {
        // Only check for duplicate serial numbers if the equipment type requires one (is in SERIALIZED_ITEMS)
        if (equipmentData.serial_number && SERIALIZED_ITEMS.includes(equipmentData.equipment_type)) {
          const existing = await Equipment.filter({ serial_number: equipmentData.serial_number });
          if (existing.length > 0) {
            alert(`Error: Equipment with Serial Number "${equipmentData.serial_number}" already exists.`);
            return;
          }
        }

        // Enrich equipment data with all required system fields
        const createData = {
          ...equipmentData,
          created_by: user.email || user.full_name,
          created_by_id: user.id || user.uid,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
          is_sample: "false"
        };
        await Equipment.create(createData);
      }

      await ActivityLog.create({
        activity_type: editingEquipment ? "UPDATE" : "CREATE",
        entity_type: "Equipment",
        details: activityDetails,
        user_full_name: user?.full_name || 'System',
        division_name: equipmentData.division_name
      }).catch(() => {
        // Ignore ActivityLog errors
      });
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      // Continue to close dialog and refresh even if there's an error
    } finally {
      setShowForm(false);
      setEditingEquipment(null);
      loadData();
    }
  };

  const handleEdit = (equipmentItem) => {
    setEditingEquipment(equipmentItem);
    setShowForm(true);
  };

  const handleDelete = async (equipmentItem) => {
    if (!currentUser?.permissions?.can_delete_equipment && currentUser?.role !== 'admin') {
        alert("You do not have permission to delete this equipment.");
        return;
    }
    try {
      const user = await User.me(); // Fetched user for activity log
      await ActivityLog.create({
        activity_type: "DELETE",
        entity_type: "Equipment",
        details: `Deleted equipment: ${equipmentItem.equipment_type} (ID: ${equipmentItem.id})`,
        user_full_name: user?.full_name || 'System', // Use user?.full_name with fallback
        division_name: equipmentItem.division_name
      });
      await Equipment.delete(equipmentItem.id);
      loadData();
    } catch (error) {
      console.error("Error deleting equipment:", error);
      alert("An error occurred while deleting the equipment item.");
    }
  };

  const checkForDuplicates = () => {
    const safeEquipment = Array.isArray(equipment) ? equipment : [];
    // Only check for duplicates if serial_number is not empty
    const equipmentWithSerial = safeEquipment.filter(e => e && e.serial_number && e.serial_number.trim() !== '');

    const idCounts = equipmentWithSerial.reduce((acc, e) => {
      const serial = e.serial_number.trim();
      acc[serial] = (acc[serial] || 0) + 1;
      return acc;
    }, {});

    const foundDuplicates = Object.entries(idCounts)
      .filter(([, count]) => count > 1)
      .map(([serialNum, count]) => ({ serial_number: serialNum, count }));

    setDuplicates(foundDuplicates);
    setShowDuplicates(true);
  };

  const handleSort = (column) => {
    let direction = 'asc';
    if (sortConfig.key === column && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: column, direction });
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === sortedEquipment.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(sortedEquipment.map(e => e.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!currentUser?.permissions?.can_delete_equipment && currentUser?.role !== 'admin') {
        alert("You do not have permission to delete equipment.");
        return;
    }
    try {
      const user = await User.me(); // Fetched user for activity log
      for (const id of selectedItems) {
        const equipmentToDelete = equipment.find(e => e.id === id);
        if (equipmentToDelete) {
          await ActivityLog.create({
            activity_type: "DELETE",
            entity_type: "Equipment",
            details: `Deleted equipment: ${equipmentToDelete.equipment_type} (ID: ${id})`,
            user_full_name: user?.full_name || 'System', // Use user?.full_name with fallback
            division_name: equipmentToDelete.division_name
          });
          await Equipment.delete(id);
        }
      }
      setSelectedItems([]);
      setShowBulkDeleteConfirm(false); // Make sure this line exists
      loadData();
    } catch (error) {
      console.error("Error deleting equipment:", error);
      alert("An error occurred during bulk deletion. Some items may not have been deleted.");
    }
  };

  const sortedEquipment = React.useMemo(() => {
    let sortableItems = [...filteredEquipment];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Special handling for 'assigned_to' to sort by soldier name
        if (sortConfig.key === 'assigned_to') {
          const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
          const soldierA = safeSoldiers.find(s => s.soldier_id === aValue);
          const soldierB = safeSoldiers.find(s => s.soldier_id === bValue);
          aValue = soldierA ? `${soldierA.first_name} ${soldierA.last_name}` : '';
          bValue = soldierB ? `${soldierB.first_name} ${soldierB.last_name}` : ''; // Fixed typo here
        }

        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        // Convert to strings for comparison
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredEquipment, sortConfig, soldiers]);

  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.custom_role === 'manager' || currentUser?.custom_role === 'division_manager';

  return (
    <div className="p-6 space-y-6">
      <RenameTypeDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        itemTypes={equipmentTypes}
        entityName="Equipment"
        onRename={handleRenameType}
      />
      <AlertDialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Serial Numbers Found</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicates.length > 0 ? (
                <>
                  <p>The following Serial Numbers have been used more than once. Please correct them to ensure data integrity.</p>
                  <ul className="mt-4 space-y-2">
                    {duplicates.map(d => (
                      <li key={d.serial_number} className="flex justify-between items-center">
                        <span>Serial Number: <strong>{d.serial_number}</strong></span>
                        <Badge variant="destructive">Used {d.count} times</Badge>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                "No duplicate Serial Numbers found in the current inventory for serialized items."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDuplicates(false)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Equipment Management</h1>
          <p className="text-slate-600">Track and manage all company equipment inventory</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedItems.length > 0 && (
            // Controlled AlertDialog for bulk delete confirmation
            <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!currentUser?.permissions?.can_delete_equipment && currentUser?.role !== 'admin'}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected ({selectedItems.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Bulk Delete</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedItems.length} selected equipment items? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isAdminOrManager && (
            <Button variant="outline" onClick={() => setShowRenameDialog(true)}>
              <Edit className="w-4 h-4 mr-2" /> Rename Type
            </Button>
          )}
          <Button variant="outline" onClick={checkForDuplicates}>Check Duplicates</Button>
          <Button
            onClick={() => { setEditingEquipment(null); setShowForm(true); }}
            className="bg-green-700 hover:bg-green-800 text-white"
            disabled={!currentUser?.permissions?.['equipment.create'] && currentUser?.role !== 'admin'}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Equipment
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
                {editingEquipment ? 'Edit Equipment' : 'Add New Equipment'}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-safe">
            <div className="px-4 md:px-6 py-4 pb-8">
              <EquipmentForm
                equipment={editingEquipment}
                soldiers={soldiers}
                allEquipment={equipment} // Pass the full equipment list
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
            <CardTitle className="text-slate-900">Equipment Inventory</CardTitle>
            <div className="flex gap-3 w-full md:w-auto">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search equipment..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="text-sm text-slate-600 font-medium whitespace-nowrap">
                  {filteredEquipment.length} items
                </div>
              </div>
            </div>
            <EquipmentFilters filters={filters} onFilterChange={setFilters} equipment={equipment} soldiers={soldiers} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <EquipmentTable
            equipment={sortedEquipment}
            soldiers={soldiers}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isLoading={isLoading}
            sortConfig={sortConfig}
            onSort={handleSort}
            selectedItems={selectedItems}
            onSelectItem={handleSelectItem}
            onSelectAll={handleSelectAll}
          />
        </CardContent>
      </Card>
    </div>
  );
}
