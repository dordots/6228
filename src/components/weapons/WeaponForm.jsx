
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

export default function WeaponForm({ weapon, soldiers, onSubmit, onCancel, existingWeapons = [], currentUser }) {
  // Check if user is division manager
  const isDivisionManager = currentUser?.custom_role === 'division_manager';
  const userDivision = currentUser?.division;

  const [formData, setFormData] = useState(weapon || {
    weapon_id: "",
    weapon_type: "",
    status: "functioning",
    assigned_to: null, // Changed from "" to null for consistency with unassigned logic
    division_name: isDivisionManager && !weapon ? userDivision : (weapon?.division_name || null), // Auto-set division for division managers on new weapons
    last_checked_date: "",
    comments: "" // Initialize new comments field
  });
  const [idError, setIdError] = useState('');
  const [showCustomType, setShowCustomType] = useState(false);
  const [customType, setCustomType] = useState('');

  // Get unique weapon types from existing weapons
  const existingTypes = useMemo(() => {
    const safeWeapons = Array.isArray(existingWeapons) ? existingWeapons : [];
    const types = safeWeapons
      .filter(w => w && w.weapon_type)
      .map(w => w.weapon_type)
      .filter((type, index, arr) => arr.indexOf(type) === index) // Remove duplicates
      .sort();
    return types;
  }, [existingWeapons]);

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


  // Auto-populate division when soldier is assigned
  useEffect(() => {
    if (assignedSoldier && assignedSoldier.division_name) {
      setFormData(prev => ({ ...prev, division_name: assignedSoldier.division_name }));
    } else if (formData.assigned_to === null) {
      // If unassigned
      if (isDivisionManager) {
        // Division managers: set to their division
        setFormData(prev => ({ ...prev, division_name: userDivision }));
      } else {
        // Others: clear division
        setFormData(prev => ({ ...prev, division_name: null }));
      }
    }
  }, [assignedSoldier, formData.assigned_to, isDivisionManager, userDivision]);

  // Set initial state from props
  useEffect(() => {
    setFormData(weapon || {
      weapon_id: "",
      weapon_type: "",
      status: "functioning",
      assigned_to: null, // Ensure null for initial unassigned state
      division_name: null, // Ensure null for initial unassigned state
      last_checked_date: "",
      comments: "" // Ensure comments is initialized
    });
  }, [weapon]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Use custom type if "other" was selected
    const finalFormData = {
      ...formData,
      weapon_type: showCustomType ? customType : formData.weapon_type,
    };

    // Only perform duplicate ID check when adding a new weapon (weapon prop is null/undefined)
    if (!weapon) {
      const existingIds = Array.isArray(existingWeapons) ? existingWeapons.map(w => w?.weapon_id).filter(Boolean) : [];
      if (existingIds.includes(finalFormData.weapon_id)) {
        setIdError('This Weapon ID already exists. Please choose a different one.');
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
    // Clear the ID error if the weapon_id field is being changed
    if (field === 'weapon_id' && idError) {
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
      handleChange('weapon_type', value);
    }
  };

  return (
    <Card className="border-slate-200 shadow-md">
      <CardHeader className="bg-slate-50 border-b border-slate-200">
        <CardTitle className="text-slate-900">
          {weapon ? 'Edit Weapon Details' : 'Add New Weapon'}
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="weapon_id">Weapon ID *</Label>
              <Input
                id="weapon_id"
                value={formData.weapon_id}
                onChange={(e) => handleChange('weapon_id', e.target.value)}
                required
                disabled={!!weapon} // Disable input if editing an existing weapon
              />
              {idError && <p className="text-red-500 text-sm mt-1">{idError}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="weapon_type">Type *</Label>
              {!showCustomType ? (
                <Select 
                  value={formData.weapon_type} 
                  onValueChange={handleTypeSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select weapon type" />
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
                value={formData.division_name || 'unassigned'}
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
                <p className="text-xs text-slate-500">Division managers can only add weapons to their own division</p>
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
          {/* New Comments Field */}
          <div className="space-y-2">
            <Label htmlFor="comments">Comments</Label>
            <Textarea
              id="comments"
              placeholder="Add any relevant notes or comments..."
              value={formData.comments || ''} // Ensure value is a string, even if comments is null/undefined
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
          <Button type="submit" className="bg-red-700 hover:bg-red-800 text-white">
            <Save className="w-4 h-4 mr-2" />
            {weapon ? 'Update' : 'Create'} Weapon
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
