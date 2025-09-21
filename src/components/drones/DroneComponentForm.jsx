
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Save, X, Plus } from "lucide-react";

const BASE_COMPONENT_TYPES = [
    "Avetta Drone",
    "Avetta Goggles",
    "Avetta Remote",
    "Evo Drone",
    "Evo Remote Control",
    "Evo Bomb Dropper",
];

export default function DroneComponentForm({ component, onSubmit, onCancel, existingTypes = [] }) {
  const [formData, setFormData] = useState(
    component || {
      component_id: "",
      component_type: "", // Initialize to empty for new components to allow selection or custom input
      status: "Operational",
    }
  );

  const [showCustomType, setShowCustomType] = useState(false);
  const [customType, setCustomType] = useState("");

  const allTypes = useMemo(() => {
    // Combine base types and existing types, remove duplicates, and sort alphabetically
    return [...new Set([...BASE_COMPONENT_TYPES, ...existingTypes])].sort();
  }, [existingTypes]);

  const handleSubmit = (e) => {
    e.preventDefault();
    let finalComponentType;

    if (showCustomType) {
      finalComponentType = customType;
    } else {
      finalComponentType = formData.component_type;
    }

    if (!finalComponentType?.trim()) {
      alert("Component Type is required.");
      return;
    }

    const finalData = {
      ...formData,
      component_type: finalComponentType,
    };
    
    onSubmit(finalData);
  };

  const handleTypeSelect = (value) => {
    if (value === '__custom__') {
      setShowCustomType(true);
      setFormData({ ...formData, component_type: '' }); // Clear selected type when switching to custom
      setCustomType(''); // Clear custom type input
    } else {
      setShowCustomType(false);
      setFormData({ ...formData, component_type: value });
      setCustomType(''); // Clear custom type input
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-2">
            <Label htmlFor="component_id">Component Serial Number *</Label>
            <Input id="component_id" value={formData.component_id} onChange={(e) => setFormData({...formData, component_id: e.target.value})} required disabled={!!component} />
        </div>
        <div className="space-y-2">
            <Label htmlFor="component_type">Component Type *</Label>
            {!showCustomType ? (
              <Select value={formData.component_type} onValueChange={handleTypeSelect} required>
                <SelectTrigger><SelectValue placeholder="Select a type..."/></SelectTrigger>
                <SelectContent>
                  {allTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  <SelectItem value="__custom__">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Add new type...
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter new type name"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  required
                />
                <Button variant="ghost" size="icon" onClick={() => setShowCustomType(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
        </div>
        <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Operational">Operational</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Damaged">Damaged</SelectItem>
              </SelectContent>
            </Select>
        </div>
      </CardContent>
      <CardFooter className="bg-slate-50 border-t flex justify-end gap-3 p-4">
        <Button type="button" variant="outline" onClick={onCancel}><X className="w-4 h-4 mr-2" />Cancel</Button>
        <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white"><Save className="w-4 h-4 mr-2" />{component ? "Update" : "Create"}</Button>
      </CardFooter>
    </form>
  );
}
