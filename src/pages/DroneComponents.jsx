
import React, { useState, useEffect, useMemo } from "react";
import { DroneComponent } from "@/api/entities";
import { User } from "@/api/entities";
import { ActivityLog } from "@/api/entities";
import { DroneSet } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Trash2, ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


import DroneComponentTable from "../components/drones/DroneComponentTable";
import DroneComponentForm from "../components/drones/DroneComponentForm";
import DroneComponentFilters from "../components/drones/DroneComponentFilters";

export default function DroneComponents() {
  const [components, setComponents] = useState([]);
  const [droneSets, setDroneSets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [filters, setFilters] = useState({ type: "all", status: "all" });
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicates, setShowDuplicates] = useState(false);


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

  const existingComponentTypes = useMemo(() => {
    if (!Array.isArray(components)) return [];
    const types = new Set(components.map(c => c.component_type).filter(Boolean));
    return Array.from(types).sort();
  }, [components]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [data, sets] = await Promise.all([
        DroneComponent.list("-created_date"),
        DroneSet.list()
      ]);
      setComponents(data);
      setDroneSets(sets);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const loadComponents = async () => {
    setIsLoading(true);
    try {
      const data = await DroneComponent.list("-created_date");
      setComponents(data);
    } catch (error) {
      console.error("Error loading drone components:", error);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (componentData) => {
    const user = await User.me();
    const activityDetails = editingComponent
      ? `Updated drone component: ${componentData.component_type} (${componentData.component_id})`
      : `Created new drone component: ${componentData.component_type} (${componentData.component_id})`;

    if (editingComponent) {
      await DroneComponent.update(editingComponent.id, componentData);
    } else {
        const serial = componentData.component_id;
        const type = componentData.component_type;

        if (!serial?.trim()) {
            alert("Component ID is required.");
            return;
        }
        // Check for existing drone components with the same serial number AND type
        const existingComponents = await DroneComponent.filter({ 
            component_id: serial,
            component_type: type 
        }).catch(() => []);

        if (existingComponents.length > 0) {
            alert(`Error: A drone component with ID "${serial}" and Type "${type}" already exists.`);
            return;
        }
      await DroneComponent.create(componentData);
    }
    
    await ActivityLog.create({
      activity_type: editingComponent ? "UPDATE" : "CREATE",
      entity_type: "DroneComponent",
      details: activityDetails,
      user_full_name: user.full_name,
      division_name: user.department // Log component changes under user's division
    });

    setShowForm(false);
    setEditingComponent(null);
    loadData();
  };

  const handleEdit = (component) => {
    setEditingComponent(component);
    setShowForm(true);
  };

  const handleDelete = async (component) => {
    if (!currentUser?.permissions?.can_delete_drone_components && currentUser?.role !== 'admin') {
      alert("You do not have permission to delete drone components.");
      return;
    }
    try {
      const user = await User.me();
      await ActivityLog.create({
        activity_type: "DELETE",
        entity_type: "DroneComponent",
        details: `Deleted drone component: ${component.component_type} (${component.component_id})`,
        user_full_name: user.full_name,
        division_name: user.department // Log component changes under user's division
      });
      await DroneComponent.delete(component.id);
      loadData();
    } catch (error) {
      console.error("Error deleting drone component:", error);
      alert("An error occurred while deleting the drone component.");
    }
  };

  const checkForDuplicates = async () => {
    setIsLoading(true);
    try {
      const allComponents = await DroneComponent.list();
      const componentMap = new Map();
      
      // Group components by ID and Type
      allComponents.forEach(component => {
        if (!component.component_id || !component.component_type) return; // Skip invalid records
        const key = `${component.component_id}|${component.component_type}`;
        if (!componentMap.has(key)) {
          componentMap.set(key, []);
        }
        componentMap.get(key).push(component);
      });

      // Find duplicates (groups with more than one component)
      const duplicatesFound = [];
      for (const [key, components] of componentMap.entries()) {
        if (components.length > 1) {
          const [serial, type] = key.split('|');
          duplicatesFound.push({
            serial: serial,
            type: type,
            components: components
          });
        }
      }

      if (duplicatesFound.length > 0) {
        let alertMessage = "Found duplicate drone components (same ID and Type):\n";
        duplicatesFound.forEach(dup => {
          alertMessage += `\nID: ${dup.serial}, Type: ${dup.type}\n`;
          dup.components.forEach(c => {
            alertMessage += `  - Record ID: ${c.id}\n`;
          });
        });
        alert(alertMessage);
        setDuplicates(duplicatesFound);
        setShowDuplicates(true);
      } else {
        alert("No duplicate drone component ID/Type combinations found.");
        setDuplicates([]);
        setShowDuplicates(false);
      }
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      alert("An error occurred while checking for duplicates.");
    } finally {
      setIsLoading(false);
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
    if (selectedItems.length === filteredComponents.length && filteredComponents.length > 0) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredComponents.map(c => c.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!currentUser?.permissions?.can_delete_drone_components && currentUser?.role !== 'admin') {
      alert("You do not have permission to delete drone components.");
      return;
    }
    try {
      const user = await User.me();
      for (const id of selectedItems) {
        const componentToDelete = components.find(c => c.id === id);
        if (componentToDelete) {
          try {
            await ActivityLog.create({
              activity_type: "DELETE",
              entity_type: "DroneComponent",
              details: `Deleted drone component: ${componentToDelete.component_type} (${componentToDelete.component_id})`,
              user_full_name: user.full_name,
              division_name: user.department
            });
            await DroneComponent.delete(id);
          } catch (error) {
            console.error(`Error deleting component ${id}:`, error);
            // Continue with other deletions even if one fails
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

  const filteredComponents = useMemo(() => {
    if (!Array.isArray(components)) return [];
    return components.filter(component => {
      if (!component) return false;
      
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        (component.component_id && String(component.component_id).toLowerCase().includes(searchLower)) ||
        (component.component_type && String(component.component_type).toLowerCase().includes(searchLower));
      
      const matchesType = filters.type === 'all' || component.component_type === filters.type;
      const matchesStatus = filters.status === 'all' || component.status === filters.status;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [components, searchTerm, filters]);


  if (!currentUser) {
    return <div className="p-4 md:p-6 text-center text-slate-500">Loading user information...</div>
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedItems.length} selected component(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Drone Components</h1>
          <p className="text-slate-600">Manage individual drone parts and accessories.</p>
        </div>
        <div className="flex gap-2">
          {selectedItems.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!currentUser?.permissions?.can_delete_drone_components && currentUser?.role !== 'admin'}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedItems.length})
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={checkForDuplicates}
            className="text-gray-700 hover:text-gray-800 border-gray-300 hover:border-gray-400"
          >
            Check Duplicates
          </Button>
          <Button
            onClick={() => { setEditingComponent(null); setShowForm(true); }}
            className="bg-sky-600 hover:bg-sky-700 text-white"
            disabled={!currentUser?.permissions?.can_create_drone_components && currentUser?.role !== 'admin'}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Component
          </Button>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-full max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 md:px-6 py-4 border-b shrink-0">
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
                {editingComponent ? 'Edit Drone Component' : 'Add New Drone Component'}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 md:px-6">
            <DroneComponentForm
              component={editingComponent}
              onSubmit={handleSubmit}
              onCancel={() => setShowForm(false)}
              droneSets={droneSets}
              existingTypes={existingComponentTypes}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-slate-200 shadow-sm mt-6">
        <CardHeader className="border-b border-slate-200">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <CardTitle className="text-slate-900">Drone Component Inventory</CardTitle>
            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search components..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
               <div className="text-sm text-slate-600 font-medium whitespace-nowrap">
                  {filteredComponents.length} components
                </div>
            </div>
            <DroneComponentFilters filters={filters} onFilterChange={setFilters} components={components} />
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-auto max-h-[70vh]">
            <DroneComponentTable
              components={filteredComponents}
              droneSets={droneSets}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isLoading={isLoading}
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
