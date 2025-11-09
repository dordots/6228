
import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Save, X, ChevronDown, Package, PackageOpen } from "lucide-react";
import ComboBox from "@/components/common/ComboBox";
import { Textarea } from "@/components/ui/textarea";
import { DroneSetType } from "@/api/entities";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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
  currentUser,
  onSubmit,
  onCancel
}) {
  // Check if user is division manager
  const isDivisionManager = currentUser?.custom_role === 'division_manager';
  const userDivision = currentUser?.division;

  const [droneSetTypes, setDroneSetTypes] = useState([]);
  const [formData, setFormData] = useState(
    droneSet || {
      set_serial_number: "",
      set_type: "",
      status: "Operational",
      assigned_to: null,
      division_name: isDivisionManager && !droneSet ? userDivision : (droneSet?.division_name || ""),
      components: {},
      comments: "",
      armory_status: "in_deposit",
      is_sample: "false",
    }
  );
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [depositLocation, setDepositLocation] = useState('division_deposit');
  const [depositAction, setDepositAction] = useState('deposit'); // 'deposit' or 'release'

  // Load drone set types from database
  useEffect(() => {
    const loadTypes = async () => {
      try {
        const types = await DroneSetType.list();
        setDroneSetTypes(Array.isArray(types) ? types : []);

        // Set default type if editing or if types are available
        if (!droneSet && types.length > 0 && !formData.set_type) {
          setFormData(prev => ({ ...prev, set_type: types[0].type_name }));
        }
      } catch (error) {
        setDroneSetTypes([]);
      }
    };
    loadTypes();
  }, [droneSet]);

  const currentComponentSlots = useMemo(() => {
    const selectedType = droneSetTypes.find(t => t.type_name === formData.set_type);
    return selectedType?.component_slots || {};
  }, [formData.set_type, droneSetTypes]);

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
            armory_status: "in_deposit",
            is_sample: "false",
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
        if (newSoldier) {
          // Soldier selected: use their division
          newState.division_name = newSoldier.division_name;
        } else {
          // Unassigned: division managers keep their division, others clear
          newState.division_name = isDivisionManager ? userDivision : "";
        }
        // Set armory_status based on assignment
        newState.armory_status = value ? "with_soldier" : "in_deposit";
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

      return available;
    } catch (error) {
      return [];
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const finalData = { ...formData };

      // Force division assignment for division managers
      if (isDivisionManager && !finalData.division_name) {
        finalData.division_name = userDivision;
      }

      // Validate that division managers have a division
      if (isDivisionManager && !finalData.division_name) {
        alert('Error: Division managers must have a division assigned. Please contact an administrator.');
        return;
      }

      onSubmit(finalData);
    } catch (error) {
      // Error handling
    }
  };

  const handleTransferToDeposit = () => {
    setDepositAction('deposit');
    setShowDepositDialog(true);
  };

  const handleReleaseFromDeposit = () => {
    setDepositAction('release');
    setShowDepositDialog(true);
  };

  const handleConfirmDeposit = () => {
    if (depositAction === 'deposit') {
      const depositData = {
        ...formData,
        armory_status: 'in_deposit',
        deposit_location: depositLocation,
        assigned_to: null, // Unassign when transferring to deposit
      };
      onSubmit(depositData);
    } else {
      // Release from deposit
      const releaseData = {
        ...formData,
        armory_status: 'with_soldier',
        deposit_location: null, // Clear deposit location
        // Keep assigned_to as is (could be null or already assigned)
      };
      onSubmit(releaseData);
    }
    setShowDepositDialog(false);
  };

  const isWithSoldier = droneSet && (droneSet.armory_status || 'with_soldier') === 'with_soldier';
  const isInDeposit = droneSet && droneSet.armory_status === 'in_deposit';

  return (
    <>
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
            {droneSetTypes.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-800">
                  No drone set types available. Please create drone set types first in the "Drone Set Types" page.
                </p>
              </div>
            ) : (
              <Select value={formData.set_type} onValueChange={(value) => handleChange('set_type', value)} required>
                <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                <SelectContent>
                  {droneSetTypes.map((type) => (
                    <SelectItem key={type.id} value={type.type_name}>
                      {type.type_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Operational">Operational</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Damaged">Damaged</SelectItem>
                <SelectItem value="Missing">Missing</SelectItem>
              </SelectContent>
            </Select>
          </div>
           <div className="space-y-2">
            <Label htmlFor="division_name">Division</Label>
            <Select
              value={formData.division_name || (isDivisionManager ? userDivision : "")}
              onValueChange={(value) => handleChange('division_name', value)}
              disabled={isDivisionManager}
            >
              <SelectTrigger id="division_name"><SelectValue placeholder="Select a division..." /></SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                <SelectItem value={null}>No Division</SelectItem>
                {Array.isArray(divisions) && divisions.map(div => (
                  <SelectItem key={div} value={div}>{div}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isDivisionManager && (
              <p className="text-xs text-slate-500">Division managers can only add drones to their own division</p>
            )}
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

        {(currentUser?.permissions?.['equipment.assign_components'] || currentUser?.role === 'admin') && (
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
        )}
      </CardContent>
      <CardFooter className="bg-slate-50 border-t flex justify-between gap-3 p-4">
        <div>
          {droneSet && isWithSoldier && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleTransferToDeposit}
              className="border-amber-500 text-amber-700 hover:bg-amber-50"
            >
              <Package className="w-4 h-4 mr-2" />
              Transfer to Deposit
            </Button>
          )}
          {droneSet && isInDeposit && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleReleaseFromDeposit}
              className="border-green-500 text-green-700 hover:bg-green-50"
            >
              <PackageOpen className="w-4 h-4 mr-2" />
              Release from Deposit
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="w-4 h-4 mr-2" />
            {droneSet ? "Update Set" : "Create Set"}
          </Button>
        </div>
      </CardFooter>
    </form>

    {/* Deposit/Release Dialog */}
    <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {depositAction === 'deposit' ? 'Transfer to Deposit' : 'Release from Deposit'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {depositAction === 'deposit' && (
            <div className="space-y-2">
              <Label htmlFor="deposit-location">Deposit Location *</Label>
              <Select value={depositLocation} onValueChange={setDepositLocation}>
                <SelectTrigger id="deposit-location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="division_deposit">Division Deposit</SelectItem>
                  <SelectItem value="armory_deposit">Armory Deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-sm text-slate-600">
            {depositAction === 'deposit' 
              ? 'This will transfer the drone set to deposit and unassign it from the current soldier.'
              : 'This will release the drone set from deposit and set its status to "with soldier".'}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDepositDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDeposit} 
            className={depositAction === 'deposit' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}
          >
            {depositAction === 'deposit' ? (
              <>
                <Package className="w-4 h-4 mr-2" />
                Transfer to Deposit
              </>
            ) : (
              <>
                <PackageOpen className="w-4 h-4 mr-2" />
                Release from Deposit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
