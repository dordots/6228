
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Save, X, Plus, Trash2 } from "lucide-react";

export default function DroneSetTypeForm({ droneSetType, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(
    droneSetType || {
      type_name: "",
      component_slots: {}
    }
  );

  const [newSlotName, setNewSlotName] = useState("");
  const [newSlotType, setNewSlotType] = useState("");

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddSlot = () => {
    if (!newSlotName.trim() || !newSlotType.trim()) {
      alert("Both slot name and component type are required.");
      return;
    }

    if (formData.component_slots[newSlotName]) {
      alert(`Slot "${newSlotName}" already exists.`);
      return;
    }

    setFormData(prev => ({
      ...prev,
      component_slots: {
        ...prev.component_slots,
        [newSlotName.trim()]: newSlotType.trim()
      }
    }));

    setNewSlotName("");
    setNewSlotType("");
  };

  const handleRemoveSlot = (slotName) => {
    setFormData(prev => {
      const newSlots = { ...prev.component_slots };
      delete newSlots[slotName];
      return {
        ...prev,
        component_slots: newSlots
      };
    });
  };

  const handleEditSlot = (oldSlotName, newSlotName, newSlotType) => {
    if (!newSlotName.trim() || !newSlotType.trim()) {
      return;
    }

    setFormData(prev => {
      const newSlots = { ...prev.component_slots };

      // If slot name changed and new name already exists, show error
      if (oldSlotName !== newSlotName && newSlots[newSlotName]) {
        alert(`Slot "${newSlotName}" already exists.`);
        return prev;
      }

      // Remove old slot if name changed
      if (oldSlotName !== newSlotName) {
        delete newSlots[oldSlotName];
      }

      // Add/update slot
      newSlots[newSlotName] = newSlotType;

      return {
        ...prev,
        component_slots: newSlots
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.type_name.trim()) {
      alert("Type name is required.");
      return;
    }

    if (Object.keys(formData.component_slots).length === 0) {
      alert("At least one component slot is required.");
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type_name">Type Name *</Label>
            <Input
              id="type_name"
              value={formData.type_name}
              onChange={(e) => handleChange("type_name", e.target.value)}
              placeholder="e.g., Avetta, Evo, Matrice"
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Component Slots *</Label>

            {/* Existing Slots */}
            {Object.entries(formData.component_slots).length > 0 && (
              <div className="space-y-2 mb-4">
                {Object.entries(formData.component_slots).map(([slotName, componentType]) => (
                  <ExistingSlotRow
                    key={slotName}
                    slotName={slotName}
                    componentType={componentType}
                    onEdit={handleEditSlot}
                    onRemove={handleRemoveSlot}
                  />
                ))}
              </div>
            )}

            {/* Add New Slot */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 space-y-3 bg-slate-50">
              <div className="text-sm font-medium text-slate-700">Add New Slot</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="slot_name" className="text-xs">Slot Name</Label>
                  <Input
                    id="slot_name"
                    value={newSlotName}
                    onChange={(e) => setNewSlotName(e.target.value)}
                    placeholder="e.g., drone 1, goggles"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSlot();
                      }
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="component_type" className="text-xs">Component Type</Label>
                  <Input
                    id="component_type"
                    value={newSlotType}
                    onChange={(e) => setNewSlotType(e.target.value)}
                    placeholder="e.g., Avetta Drone"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSlot();
                      }
                    }}
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={handleAddSlot}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Slot
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" className="bg-sky-600 hover:bg-sky-700">
          <Save className="w-4 h-4 mr-2" />
          {droneSetType ? 'Update' : 'Create'} Type
        </Button>
      </div>
    </form>
  );
}

function ExistingSlotRow({ slotName, componentType, onEdit, onRemove }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSlotName, setEditedSlotName] = useState(slotName);
  const [editedComponentType, setEditedComponentType] = useState(componentType);

  const handleSave = () => {
    if (!editedSlotName.trim() || !editedComponentType.trim()) {
      alert("Both slot name and component type are required.");
      return;
    }
    onEdit(slotName, editedSlotName.trim(), editedComponentType.trim());
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedSlotName(slotName);
    setEditedComponentType(componentType);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-3 bg-white border border-sky-200 rounded-lg">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input
            value={editedSlotName}
            onChange={(e) => setEditedSlotName(e.target.value)}
            placeholder="Slot name"
            className="text-sm"
          />
          <Input
            value={editedComponentType}
            onChange={(e) => setEditedComponentType(e.target.value)}
            placeholder="Component type"
            className="text-sm"
          />
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={handleSave} className="text-green-600 hover:text-green-700">
          <Save className="w-4 h-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={handleCancel} className="text-slate-600 hover:text-slate-700">
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-slate-500">Slot Name</div>
          <div className="text-sm font-medium text-slate-900">{slotName}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Component Type</div>
          <div className="text-sm text-slate-700">{componentType}</div>
        </div>
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditing(true)} className="text-sky-600 hover:text-sky-700">
        <Save className="w-4 h-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(slotName)} className="text-red-600 hover:text-red-700">
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
