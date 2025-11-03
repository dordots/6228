
import React, { useState, useEffect, useMemo } from "react";
import { DroneSetType } from "@/api/entities";
import { User } from "@/api/entities";
import { ActivityLog } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Trash2, ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

import DroneSetTypeForm from "../components/drones/DroneSetTypeForm";
import DroneSetTypeTable from "../components/drones/DroneSetTypeTable";

export default function DroneSetTypesPage() {
  const [droneSetTypes, setDroneSetTypes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

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
      const data = await DroneSetType.list("-created_date");
      setDroneSetTypes(Array.isArray(data) ? data : []);
    } catch (error) {
      setDroneSetTypes([]);
    }
    setIsLoading(false);
  };

  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.custom_role === 'manager' || currentUser?.custom_role === 'division_manager';

  const handleSubmit = async (formData) => {
    try {
      const user = await User.me();
      const activityDetails = editingType
        ? `Updated drone set type: ${formData.type_name}`
        : `Created new drone set type: ${formData.type_name}`;

      if (editingType) {
        const updateData = {
          ...formData,
          updated_date: new Date().toISOString()
        };
        await DroneSetType.update(editingType.id, updateData);
      } else {
        // Check for duplicate type names
        const existingTypes = await DroneSetType.filter({ type_name: formData.type_name }).catch(() => []);
        if (existingTypes.length > 0) {
          alert(`Error: Drone Set Type "${formData.type_name}" already exists.`);
          return;
        }

        const createData = {
          ...formData,
          created_by: user.email,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString()
        };
        await DroneSetType.create(createData);
      }

      await ActivityLog.create({
        activity_type: editingType ? "UPDATE" : "CREATE",
        entity_type: "DroneSetType",
        details: activityDetails,
        user_full_name: user.full_name,
        division_name: "N/A"
      }).catch(() => {
        // Ignore ActivityLog errors
      });

    } catch (error) {
    } finally {
      setShowForm(false);
      setEditingType(null);
      loadData();
    }
  };

  const handleEdit = (type) => {
    setEditingType(type);
    setShowForm(true);
  };

  const handleDelete = async (type) => {
    if (!isAdminOrManager) {
      alert("You do not have permission to delete drone set types.");
      return;
    }
    try {
      const user = await User.me();

      // Delete the type FIRST
      await DroneSetType.delete(type.id);

      // Then try to log activity (but don't fail if it doesn't work)
      try {
        await ActivityLog.create({
          activity_type: "DELETE",
          entity_type: "DroneSetType",
          details: `Deleted drone set type: ${type.type_name}`,
          user_full_name: user.full_name,
          division_name: user.division || "N/A"
        });
      } catch (logError) {
      }

      loadData();
    } catch (error) {
      alert("An error occurred while deleting the drone set type.");
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
    if (selectedItems.length === filteredTypes.length && filteredTypes.length > 0) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredTypes.map(t => t.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!isAdminOrManager) {
      alert("You do not have permission to delete drone set types.");
      return;
    }
    try {
      const user = await User.me();
      for (const id of selectedItems) {
        const typeToDelete = droneSetTypes.find(t => t.id === id);
        if (typeToDelete) {
          try {
            // Delete the type FIRST
            await DroneSetType.delete(id);

            // Then try to log activity (but don't fail if it doesn't work)
            try {
              await ActivityLog.create({
                activity_type: "DELETE",
                entity_type: "DroneSetType",
                details: `Deleted drone set type: ${typeToDelete.type_name}`,
                user_full_name: user.full_name,
                division_name: user.division || "N/A"
              });
            } catch (logError) {
            }
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

  const filteredTypes = useMemo(() => {
    if (!Array.isArray(droneSetTypes)) return [];
    return droneSetTypes.filter(type => {
      if (!type) return false;
      const searchLower = searchTerm.toLowerCase();
      return !searchTerm || type.type_name.toLowerCase().includes(searchLower);
    });
  }, [droneSetTypes, searchTerm]);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedItems.length} selected drone set type(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Drone Set Types</h1>
          <p className="text-slate-600">Create and manage custom drone set configurations</p>
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
          <Button
            onClick={() => { setEditingType(null); setShowForm(true); }}
            className="bg-sky-600 hover:bg-sky-700 text-white"
            disabled={!isAdminOrManager}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Type
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
                {editingType ? 'Edit Drone Set Type' : 'Add New Drone Set Type'}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-safe">
            <div className="px-4 md:px-6 py-4 pb-8">
              <DroneSetTypeForm
                droneSetType={editingType}
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
            <CardTitle className="text-slate-900">Existing Drone Set Types</CardTitle>
            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-slate-600 font-medium whitespace-nowrap">
                {filteredTypes.length} types
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto max-h-[70vh]">
          <DroneSetTypeTable
            droneSetTypes={filteredTypes}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isLoading={isLoading}
            selectedItems={selectedItems}
            onSelectItem={handleSelectItem}
            onSelectAll={handleSelectAll}
            isAdminOrManager={isAdminOrManager}
          />
        </CardContent>
      </Card>
    </div>
  );
}
