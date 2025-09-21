
import React, { useState, useMemo, useEffect } from 'react';
import { Equipment } from '@/api/entities';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Search, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const SERIALIZED_ITEMS = [
  "טלקון נייד", "מצלמת ציידים", "צג מפקד אמיר", "משקפת פוגי 15.80", "משקפת מפקד",
  "ציין לייזר לנגב", "לאופולד", "קסטרל", "מטל מפקד", "ציין לייזר למטול",
  "כוונת M-5", "משקפת 8.30", "משקפת נרקיס", "סמן לייזר מפקד", "אטלסון",
  "מיני כוכב", "אקדח מסמרים", "משקפת 10.50", "מטל", "ממיר מתח למטל", "משקפת 7.50"
];

export default function EquipmentForm({ equipment, soldiers, allEquipment, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(equipment || {
    equipment_type: "",
    serial_number: "",
    condition: "functioning",
    division_name: "",
    assigned_to: "",
    quantity: 1
  });

  const [typeSearch, setTypeSearch] = useState(equipment?.equipment_type || "");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [customType, setCustomType] = useState("");
  const [showCustomType, setShowCustomType] = useState(false);
  const [existingEquipmentTypes, setExistingEquipmentTypes] = useState([]);

  // Load existing equipment types from database
  useEffect(() => {
    const loadExistingTypes = async () => {
      try {
        const allEquipment = await Equipment.list();
        const types = [...new Set(allEquipment.map(e => e.equipment_type).filter(Boolean))].sort();
        setExistingEquipmentTypes(types);
      } catch (error) {
        console.error('Error loading equipment types:', error);
        setExistingEquipmentTypes([]);
      }
    };
    loadExistingTypes();
  }, []);

  // Filter equipment types based on search - now uses dynamic data
  const filteredTypes = useMemo(() => {
    if (!typeSearch.trim()) return existingEquipmentTypes;
    const searchLower = typeSearch.toLowerCase();
    return existingEquipmentTypes.filter(type =>
      type.toLowerCase().includes(searchLower)
    );
  }, [typeSearch, existingEquipmentTypes]);

  // Get unique divisions from both soldiers and all existing equipment
  const divisions = useMemo(() => {
    const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
    const safeEquipment = Array.isArray(allEquipment) ? allEquipment : [];
    
    const soldierDivisions = safeSoldiers.map(s => s.division_name).filter(Boolean);
    const equipmentDivisions = safeEquipment.map(e => e.division_name).filter(Boolean);
    
    const divisionsSet = new Set([...soldierDivisions, ...equipmentDivisions]);
    return Array.from(divisionsSet).sort();
  }, [soldiers, allEquipment]);

  // Filter soldiers by selected division
  const soldiersInDivision = useMemo(() => {
    if (!formData.division_name) return [];
    const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
    return safeSoldiers.filter(s => s.division_name === formData.division_name);
  }, [soldiers, formData.division_name]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalType = showCustomType ? customType : formData.equipment_type;
    
    if (!finalType) {
      alert('Please select an equipment type.');
      return;
    }
    
    if (!formData.division_name) {
      alert('Please select a division.');
      return;
    }

    const finalData = {
      ...formData,
      equipment_type: finalType
    };

    // Validate serial number requirement for serialized items
    if (SERIALIZED_ITEMS.includes(finalType) && !finalData.serial_number?.trim()) {
      alert(`${finalType} requires a serial number.`);
      return;
    }

    onSubmit(finalData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Clear assigned soldier if division changes
      if (field === 'division_name' && value !== prev.division_name) {
        updated.assigned_to = "";
      }
      return updated;
    });
  };

  const handleTypeSelect = (type) => {
    setTypeSearch(type);
    handleChange('equipment_type', type);
    setShowTypeDropdown(false);
  };

  const requiresSerial = SERIALIZED_ITEMS.includes(formData.equipment_type) || SERIALIZED_ITEMS.includes(customType);

  return (
    <Card className="border-slate-200 shadow-md">
      <CardHeader className="bg-slate-50 border-b border-slate-200">
        <CardTitle className="text-slate-900">
          {equipment ? 'Edit Equipment' : 'Add New Equipment'}
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="equipment_type">Equipment Type *</Label>
              {!showCustomType ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Search equipment types..."
                      value={typeSearch}
                      onChange={(e) => {
                        setTypeSearch(e.target.value);
                        setShowTypeDropdown(true);
                      }}
                      onFocus={() => setShowTypeDropdown(true)}
                      className="pl-9 pr-10"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  </div>
                  
                  {showTypeDropdown && (
                    <div className="relative z-10">
                      <div className="absolute w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredTypes.length > 0 ? (
                          filteredTypes.map(type => (
                            <div
                              key={type}
                              onClick={() => handleTypeSelect(type)}
                              className="p-3 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0"
                            >
                              <div className="font-medium text-slate-900">{type}</div>
                              {SERIALIZED_ITEMS.includes(type) && (
                                <div className="text-xs text-amber-600 mt-1">דורש מס' סידורי</div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-slate-500 text-sm">
                            <p className="mb-2">No equipment types found matching "{typeSearch}"</p>
                            <Button
                              type="button"
                              variant="link"
                              className="text-sm h-auto p-0"
                              onClick={() => {
                                setCustomType(typeSearch);
                                setShowCustomType(true);
                                setShowTypeDropdown(false);
                              }}
                            >
                              Add "{typeSearch}" as custom type
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="custom-type"
                      checked={showCustomType}
                      onCheckedChange={setShowCustomType}
                    />
                    <Label htmlFor="custom-type" className="text-sm">Add custom equipment type</Label>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Enter custom equipment type"
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCustomType(false);
                      setCustomType("");
                      setTypeSearch("");
                      handleChange('equipment_type', "");
                    }}
                  >
                    Back to existing types
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="division_name">Division *</Label>
              <Select value={formData.division_name} onValueChange={(value) => handleChange('division_name', value)}>
                <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
                <SelectContent>
                  {divisions.map(division => (
                    <SelectItem key={division} value={division}>{division}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-slate-600">All equipment must belong to a division</p>
            </div>
            
            {requiresSerial && (
              <div className="space-y-2">
                <Label htmlFor="serial_number">Serial Number *</Label>
                <Input
                  id="serial_number"
                  value={formData.serial_number || ''}
                  onChange={(e) => handleChange('serial_number', e.target.value)}
                  disabled={!!equipment}
                  required={requiresSerial}
                  placeholder="Required for this item type"
                />
                <p className="text-sm text-amber-600">This equipment type requires a serial number</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="condition">Condition</Label>
              <Select value={formData.condition} onValueChange={(value) => handleChange('condition', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="functioning">Functioning</SelectItem>
                  <SelectItem value="not_functioning">Not Functioning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Select value={formData.assigned_to || ''} onValueChange={(value) => handleChange('assigned_to', value)}>
                <SelectTrigger><SelectValue placeholder="In division storage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>In Division Storage</SelectItem>
                  {soldiersInDivision.map(s => (
                    <SelectItem key={s.id} value={s.soldier_id}>
                      {s.first_name} {s.last_name} ({s.soldier_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-slate-600">
                {formData.division_name 
                  ? `Choose a soldier from ${formData.division_name} or leave in storage` 
                  : "Select division first to see available soldiers"
                }
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity || 1}
                onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 1)}
                placeholder="Number of items"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" className="bg-green-700 hover:bg-green-800 text-white">
            <Save className="w-4 h-4 mr-2" />
            {equipment ? 'Update' : 'Create'} Equipment
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
