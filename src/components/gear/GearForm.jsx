
import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Save, X, Calendar as CalendarIcon, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import ComboBox from "@/components/common/ComboBox"; // New import

const CONDITIONS = ["functioning", "not_functioning"];

export default function GearForm({ gear, soldiers, onSubmit, onCancel, existingGear = [], currentUser }) {
  // Check if user is division manager
  const isDivisionManager = currentUser?.custom_role === 'division_manager';
  const userDivision = currentUser?.division;

  const [formData, setFormData] = useState(gear || {
    gear_id: "",
    gear_type: "",
    status: "functioning",
    assigned_to: "",
    division_name: isDivisionManager && !gear ? userDivision : (gear?.division_name || ""),
    last_checked_date: "",
    comments: ""
  });
  const [idError, setIdError] = useState('');
  const [showCustomType, setShowCustomType] = useState(false);
  const [customType, setCustomType] = useState('');

  // Get unique gear types from existing gear
  const existingTypes = useMemo(() => {
    const safeGear = Array.isArray(existingGear) ? existingGear : [];
    const types = safeGear
      .filter(g => g && g.gear_type)
      .map(g => g.gear_type)
      .filter((type, index, arr) => arr.indexOf(type) === index) // Remove duplicates
      .sort();
    return types;
  }, [existingGear]);

  // Get unique divisions from soldiers
  const existingDivisions = useMemo(() => {
    const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
    const divisions = safeSoldiers
      .filter(s => s && s.division_name)
      .map(s => s.division_name)
      .filter((division, index, arr) => arr.indexOf(division) === index) // Remove duplicates
      .sort();
    return divisions;
  }, [soldiers]);

  const assignedSoldier = useMemo(() => {
    if (!formData.assigned_to || !Array.isArray(soldiers)) return null;
    return soldiers.find(s => s.soldier_id === formData.assigned_to);
  }, [formData.assigned_to, soldiers]);

  // Auto-populate division when soldier is assigned
  useEffect(() => {
    if (assignedSoldier && assignedSoldier.division_name) {
      setFormData(prev => ({ ...prev, division_name: assignedSoldier.division_name }));
    } else if (formData.assigned_to === "" || formData.assigned_to === "unassigned") {
      // If unassigned
      if (isDivisionManager) {
        // Division managers: set to their division
        setFormData(prev => ({ ...prev, division_name: userDivision }));
      } else {
        // Others: clear division
        setFormData(prev => ({ ...prev, division_name: "" }));
      }
    }
  }, [assignedSoldier, formData.assigned_to, isDivisionManager, userDivision]);

  // Set initial state from props
  useEffect(() => {
    setFormData(gear || {
      gear_id: "",
      gear_type: "",
      status: "functioning",
      assigned_to: "",
      division_name: "",
      last_checked_date: "",
      comments: ""
    });
  }, [gear]);

  // New: Create soldier options for ComboBox
  const soldierOptions = useMemo(() => {
    return [
      { value: 'unassigned', label: 'Unassigned' },
      ...(Array.isArray(soldiers) ? soldiers.map(soldier => ({
        value: soldier.soldier_id,
        label: `${soldier.first_name} ${soldier.last_name} (${soldier.soldier_id})`
      })) : [])
    ];
  }, [soldiers]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Use custom type if "other" was selected
    const finalFormData = {
      ...formData,
      gear_type: showCustomType ? customType : formData.gear_type,
    };

    // Force division assignment for division managers
    if (isDivisionManager && !finalFormData.division_name) {
      finalFormData.division_name = userDivision;
    }

    // Validate that division managers have a division
    if (isDivisionManager && !finalFormData.division_name) {
      alert('Error: Division managers must have a division assigned. Please contact an administrator.');
      return;
    }

    // Only perform duplicate ID check when adding a new item (gear prop is null/undefined)
    if (!gear) {
      const existingIds = Array.isArray(existingGear) ? existingGear.map(g => g?.gear_id).filter(Boolean) : [];
      if (existingIds.includes(finalFormData.gear_id)) {
        setIdError('This Gear ID already exists. Please choose a different one.');
        return; // Prevent form submission
      }
    }

    // If no duplicate or if in edit mode, proceed with submission
    onSubmit(finalFormData);
  };

  const handleChange = (field, value) => {
    // If the special "unassigned" value is selected, store null in the state.
    const finalValue = value === 'unassigned' ? null : value;
    setFormData(prev => ({ ...prev, [field]: finalValue }));
    if (field === 'gear_id' && idError) {
      setIdError('');
    }
  };

  const handleTypeSelect = (value) => {
    if (value === '__custom__') {
      setShowCustomType(true);
      setCustomType('');
    } else {
      setShowCustomType(false);
      setCustomType('');
      handleChange('gear_type', value);
    }
  };

  return (
    <Card className="border-slate-200 shadow-md">
      <CardHeader className="bg-slate-50 border-b border-slate-200">
        <CardTitle className="text-slate-900">
          {gear ? 'Edit Gear Details' : 'Add New Serialized Gear'}
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="gear_id">Gear ID *</Label>
              <Input
                id="gear_id"
                value={formData.gear_id}
                onChange={(e) => handleChange('gear_id', e.target.value)}
                required
                disabled={!!gear} // Disable input if editing an existing gear
              />
              {idError && <p className="text-red-500 text-sm mt-1">{idError}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gear_type">Type *</Label>
              {!showCustomType ? (
                <Select 
                  value={formData.gear_type} 
                  onValueChange={handleTypeSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gear type" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">
                      <div className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add new type...
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Enter new type"
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
              <Label htmlFor="status">Status *</Label>
              <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map(condition => (
                    <SelectItem key={condition} value={condition}>
                      {condition.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assigned To</Label>
              <ComboBox
                options={soldierOptions}
                value={formData.assigned_to || 'unassigned'}
                onSelect={(value) => handleChange('assigned_to', value)}
                placeholder="Select a soldier"
                searchPlaceholder="Search soldiers..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="division_name">Division</Label>
              <Select
                value={formData.division_name || (isDivisionManager ? userDivision : "unassigned")}
                onValueChange={(value) => handleChange('division_name', value)}
                disabled={isDivisionManager}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select division" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {existingDivisions.map(division => (
                    <SelectItem key={division} value={division}>{division}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isDivisionManager && (
                <p className="text-xs text-slate-500">Division managers can only add gear to their own division</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_checked_date">Last Checked Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.last_checked_date ? format(new Date(formData.last_checked_date), 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.last_checked_date ? new Date(formData.last_checked_date) : undefined}
                    onSelect={(date) => handleChange('last_checked_date', date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* New Comments field */}
          <div className="space-y-2">
            <Label htmlFor="comments">Comments</Label>
            <Textarea
              id="comments"
              placeholder="Add any relevant notes or comments..."
              value={formData.comments || ''}
              onChange={(e) => handleChange('comments', e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-end gap-3 bg-slate-50 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" className="bg-purple-700 hover:bg-purple-800 text-white">
            <Save className="w-4 h-4 mr-2" />
            {gear ? 'Update' : 'Create'} Gear
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
