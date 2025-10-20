
import React, { useState, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Save, X, Plus } from "lucide-react";

export default function SoldierForm({ soldier, onSubmit, onCancel, existingSoldiers = [] }) {
  const [formData, setFormData] = useState(soldier || {
    soldier_id: "",
    first_name: "",
    last_name: "",
    email: "",
    street_address: "",
    city: "",
    division_name: "",
    team_name: "",
    profession: "",
    phone_number: "",
    enlistment_status: "expected",
    arrival_date: ""
  });
  const [showCustomDivision, setShowCustomDivision] = useState(false);
  const [customDivision, setCustomDivision] = useState('');

  // Get unique divisions from existing soldiers
  const existingDivisions = useMemo(() => {
    const safeSoldiers = Array.isArray(existingSoldiers) ? existingSoldiers : [];
    const divisions = safeSoldiers
      .filter(s => s && s.division_name)
      .map(s => s.division_name)
      .filter((division, index, arr) => arr.indexOf(division) === index) // Remove duplicates
      .sort();
    return divisions;
  }, [existingSoldiers]);

  useEffect(() => {
    setFormData(soldier || {
      soldier_id: "",
      first_name: "",
      last_name: "",
      email: "",
      street_address: "",
      city: "",
      division_name: "",
      team_name: "",
      profession: "",
      phone_number: "",
      enlistment_status: "expected",
      arrival_date: ""
    });
  }, [soldier]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate soldier_id is not empty or whitespace only
    if (!formData.soldier_id || formData.soldier_id.trim() === '') {
      alert('Error: Soldier ID is required and cannot be empty.');
      return;
    }

    // Use custom division if "other" was selected
    const finalFormData = {
      ...formData,
      soldier_id: formData.soldier_id.trim(), // Trim whitespace
      division_name: showCustomDivision ? customDivision : formData.division_name,
    };
    onSubmit(finalFormData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDivisionSelect = (value) => {
    if (value === '__custom__') {
      setShowCustomDivision(true);
      setCustomDivision('');
    } else {
      setShowCustomDivision(false);
      setCustomDivision('');
      handleChange('division_name', value);
    }
  };

  const clearArrivalDate = () => {
    setFormData(prev => ({ ...prev, arrival_date: "" }));
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="soldier_id">Soldier ID *</Label>
            <Input
              id="soldier_id"
              value={formData.soldier_id}
              onChange={(e) => handleChange('soldier_id', e.target.value)}
              placeholder="Unique ID"
              required
              disabled={!!soldier}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="enlistment_status">Status</Label>
            <Select value={formData.enlistment_status} onValueChange={(value) => handleChange('enlistment_status', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expected">Expected</SelectItem>
                <SelectItem value="arrived">Arrived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="first_name">First Name *</Label>
            <Input
              id="first_name"
              value={formData.first_name}
              onChange={(e) => handleChange('first_name', e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="last_name">Last Name *</Label>
            <Input
              id="last_name"
              value={formData.last_name}
              onChange={(e) => handleChange('last_name', e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="arrival_date">Arrival Date</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.arrival_date ? format(new Date(formData.arrival_date), 'PPP') : 'Select arrival date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.arrival_date ? new Date(formData.arrival_date) : undefined}
                    onSelect={(date) => handleChange('arrival_date', date)}
                  />
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearArrivalDate}
                className="px-3"
                title="Clear arrival date"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="division_name">Division</Label>
            {!showCustomDivision ? (
              <Select 
                value={formData.division_name || ""} 
                onValueChange={handleDivisionSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select division" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>No Division</SelectItem>
                  {existingDivisions.map(division => (
                    <SelectItem key={division} value={division}>{division}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add new division...
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter new division"
                  value={customDivision}
                  onChange={(e) => setCustomDivision(e.target.value)}
                />
                <Button variant="ghost" size="icon" onClick={() => setShowCustomDivision(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="soldier@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input
              id="phone_number"
              value={formData.phone_number || ''}
              onChange={(e) => handleChange('phone_number', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="team_name">Team</Label>
            <Input
              id="team_name"
              value={formData.team_name || ''}
              onChange={(e) => handleChange('team_name', e.target.value)}
              placeholder="e.g. Alpha Team"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="profession">Profession</Label>
            <Input
              id="profession"
              value={formData.profession || ''}
              onChange={(e) => handleChange('profession', e.target.value)}
              placeholder="e.g. Infantry, Medic"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="street_address">Street Address</Label>
            <Input
              id="street_address"
              value={formData.street_address || ''}
              onChange={(e) => handleChange('street_address', e.target.value)}
              placeholder="123 Main St"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="Anytown"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 pt-6 pb-4 md:pb-0">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" className="bg-green-700 hover:bg-green-800 text-white">
            <Save className="w-4 h-4 mr-2" />
            {soldier ? 'Update' : 'Create'} Soldier
          </Button>
        </div>
      </form>
    </div>
  );
}
