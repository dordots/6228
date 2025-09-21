
import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Save, X, ChevronDown } from "lucide-react";
import ComboBox from "@/components/common/ComboBox";
import { Textarea } from "@/components/ui/textarea";

const DRONE_COMPONENTS = {
  Avetta: {
    drone_1: "Avetta Drone",
    drone_2: "Avetta Drone", 
    goggles: "Avetta Goggles",
    remote_control: "Avetta Remote",
  },
  Evo: {
    evo_drone: "Evo Drone",
    evo_remote_control: "Evo Remote Control",
    bomb_dropper: "Evo Bomb Dropper",
  },
};

function SimpleSearchableSelect({ 
  label, 
  value, 
  onValueChange, 
  items = [], 
  placeholder = "Select...",
  displayField,
  valueField,
  searchFields = []
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const selectedItem = items.find(item => item && item[valueField] === value);
  
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const searchLower = searchTerm.toLowerCase();
    return items.filter(item => 
      item && searchFields.some(field => 
        item[field] && String(item[field]).toLowerCase().includes(searchLower)
      )
    );
  }, [items, searchTerm, searchFields]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <div 
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer hover:bg-accent"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="flex-1">
            {selectedItem ? displayField(selectedItem) : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </div>
        
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-hidden">
            <div className="p-2 border-b">
              <Input
                placeholder="Type to search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-32 overflow-y-auto">
              <div 
                className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm"
                onClick={() => {
                  onValueChange("");
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                Unassigned
              </div>
              {filteredItems.map((item) => (
                <div
                  key={item[valueField]}
                  className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm"
                  onClick={() => {
                    onValueChange(item[valueField]);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  {displayField(item)}
                </div>
              ))}
              {filteredItems.length === 0 && searchTerm && (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No items found
                </div>
              )}
              {items.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No components available
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {isOpen && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

export default function DroneSetForm({ 
  droneSet, 
  unassignedComponents = [], 
  allComponents = [], 
  allSoldiers = [], 
  divisions = [],
  onSubmit, 
  onCancel 
}) {
  const [formData, setFormData] = useState(
    droneSet || {
      set_serial_number: "",
      set_type: "Avetta", 
      status: "Operational",
      assigned_to: null,
      division_name: "", 
      components: {},
      comments: "",
    }
  );

  const currentComponentSlots = useMemo(() => {
    return DRONE_COMPONENTS[formData.set_type] || {};
  }, [formData.set_type]);

  useEffect(() => {
    if (droneSet) {
        setFormData(droneSet);
    } else {
        setFormData({
            set_serial_number: "",
            set_type: "Avetta", 
            status: "Operational",
            assigned_to: null,
            division_name: "",
            components: {},
            comments: "",
        });
    }
  }, [droneSet]);
  
  useEffect(() => {
    if (!droneSet && formData.set_type) {
      setFormData(prev => ({ ...prev, components: {} }));
    }
  }, [formData.set_type, droneSet]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      let newState = { ...prev, [field]: value };
      if (field === 'assigned_to') {
        const newSoldier = Array.isArray(allSoldiers) ? allSoldiers.find(s => s.soldier_id === value) : null;
        newState.division_name = newSoldier ? newSoldier.division_name : "";
      }
      return newState;
    });
  };

  const handleComponentChange = (slotKey, componentId) => {
    setFormData(prev => ({
      ...prev,
      components: {
        ...prev.components,
        [slotKey]: componentId || null,
      },
    }));
  };

  const soldierOptions = useMemo(() => {
    const options = [
      { value: '', label: 'Unassigned' },
    ];
    if (Array.isArray(allSoldiers)) {
      options.push(...allSoldiers.map(soldier => ({
        value: soldier.soldier_id,
        label: `${soldier.first_name} ${soldier.last_name} (${soldier.soldier_id})`
      })));
    }
    return options;
  }, [allSoldiers]);

  const getAvailableComponentsForSlot = (currentSlotKey) => {
    try {
      const requiredType = currentComponentSlots[currentSlotKey];
      if (!requiredType) return [];

      const currentComponentId = formData.components?.[currentSlotKey];
      const otherSelectedIds = Object.entries(formData.components || {})
        .filter(([key, value]) => key !== currentSlotKey && value)
        .map(([, value]) => value);

      const safeUnassigned = Array.isArray(unassignedComponents) ? unassignedComponents : [];
      
      let available = safeUnassigned.filter(c => {
        if (!c || !c.component_type) return false;
        
        const dbComponentType = c.component_type.toLowerCase();
        const setType = formData.set_type.toLowerCase();
        const requiredTypeLower = requiredType.toLowerCase();

        let matchesRole = false;
        
        if (requiredTypeLower.includes("goggles")) {
          matchesRole = dbComponentType.includes("goggles");
        } else if (requiredTypeLower.includes("remote")) {
          matchesRole = dbComponentType.includes("remote");
        } else if (requiredTypeLower.includes("drone")) {
          matchesRole = dbComponentType.includes("drone");
        } else if (requiredTypeLower.includes("bomb dropper")) {
          matchesRole = dbComponentType.includes("bomb dropper");
        }

        if (!matchesRole) return false;

        if (requiredTypeLower.includes("goggles")) {
          const hasCurrentSetType = dbComponentType.includes(setType);
          const hasOtherSetType = (setType === "avetta" && dbComponentType.includes("evo")) || 
                                  (setType === "evo" && dbComponentType.includes("avetta"));
          
          return hasCurrentSetType || !hasOtherSetType;
        }
        
        if (requiredTypeLower.includes("bomb dropper")) {
          return dbComponentType.includes("evo") && dbComponentType.includes("bomb dropper");
        }
        
        return dbComponentType.includes(setType);

      }).filter(c => !otherSelectedIds.includes(c.id));
      
      if (currentComponentId && Array.isArray(allComponents)) {
        const currentComponent = allComponents.find(c => c && c.id === currentComponentId);
        if (currentComponent && !available.some(c => c && c.id === currentComponentId)) {
          available.unshift(currentComponent);
        }
      }

      console.log(`Available ${formData.set_type} components for slot ${currentSlotKey}:`, available);

      return available;
    } catch (error) {
      console.error("Error getting available components:", error);
      return [];
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      onSubmit(formData);
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="set_serial_number">Set Serial Number *</Label>
            <Input 
              id="set_serial_number" 
              value={formData.set_serial_number} 
              onChange={(e) => handleChange('set_serial_number', e.target.value)} 
              required 
              disabled={!!droneSet} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="set_type">Set Type *</Label>
            <Select value={formData.set_type} onValueChange={(value) => handleChange('set_type', value)} required>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Avetta">Avetta</SelectItem>
                <SelectItem value="Evo">Evo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Operational">Operational</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Damaged">Damaged</SelectItem>
              </SelectContent>
            </Select>
          </div>
           <div className="space-y-2">
            <Label htmlFor="division_name">Division</Label>
            <Select value={formData.division_name || ""} onValueChange={(value) => handleChange('division_name', value)}>
              <SelectTrigger id="division_name"><SelectValue placeholder="Select a division..." /></SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                <SelectItem value={null}>No Division</SelectItem> 
                {Array.isArray(divisions) && divisions.map(div => (
                  <SelectItem key={div} value={div}>{div}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assigned To</Label>
            <ComboBox
              options={soldierOptions}
              value={formData.assigned_to || ''}
              onSelect={(value) => handleChange('assigned_to', value)}
              placeholder="Select a soldier"
              searchPlaceholder="Search soldiers..."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="comments">Comments</Label>
          <Textarea
            id="comments"
            value={formData.comments || ""}
            onChange={(e) => handleChange('comments', e.target.value)}
            placeholder="Add any additional notes here..."
            className="h-24"
          />
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h4 className="font-medium">Assign Components</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {Object.entries(currentComponentSlots).map(([key, name]) => {
              const availableComponents = getAvailableComponentsForSlot(key);
              const componentLabel = name.replace(formData.set_type, '').trim();
              
              return (
                <SimpleSearchableSelect
                  key={key}
                  label={componentLabel}
                  value={formData.components?.[key]}
                  onValueChange={(componentId) => handleComponentChange(key, componentId)}
                  items={availableComponents}
                  displayField={(component) => `${component.component_type} (${component.component_id})`}
                  valueField="id"
                  searchFields={["component_type", "component_id"]}
                  placeholder={`Select ${componentLabel}...`}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-slate-50 border-t flex justify-end gap-3 p-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
          <Save className="w-4 h-4 mr-2" />
          {droneSet ? "Update Set" : "Create Set"}
        </Button>
      </CardFooter>
    </form>
  );
}
