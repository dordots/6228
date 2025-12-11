
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
    id_number: "",
    first_name: "",
    last_name: "",
    sex: "",
    marital_status: "",
    email: "",
    street_address: "",
    city: "",
    division_name: "",
    team_name: "",
    crew: "",
    profession: "",
    secondary_profession: "",
    phone_number: "",
    date_of_birth: "",
    trainings: "",
    driving_license: "",
    driving_license_type: "",
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
      id_number: "",
      first_name: "",
      last_name: "",
      sex: "",
      marital_status: "",
      email: "",
      street_address: "",
      city: "",
      division_name: "",
      team_name: "",
      crew: "",
      profession: "",
      secondary_profession: "",
      phone_number: "",
      date_of_birth: "",
      trainings: "",
      driving_license: "",
      driving_license_type: "",
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
            <Label htmlFor="id_number">ID Number</Label>
            <Input
              id="id_number"
              value={formData.id_number}
              onChange={(e) => handleChange('id_number', e.target.value)}
              placeholder="National ID"
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
            <Label htmlFor="sex">Sex</Label>
            <Input
              id="sex"
              value={formData.sex}
              onChange={(e) => handleChange('sex', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="marital_status">Marital Status</Label>
            <Input
              id="marital_status"
              value={formData.marital_status}
              onChange={(e) => handleChange('marital_status', e.target.value)}
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
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date_of_birth ? format(new Date(formData.date_of_birth), 'dd/MM/yyyy') : 'Select date of birth'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.date_of_birth ? new Date(formData.date_of_birth) : undefined}
                    onSelect={(date) => handleChange('date_of_birth', date)}
                  />
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleChange('date_of_birth', "")}
                className="px-3"
                title="Clear date of birth"
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
            <Label htmlFor="crew">Crew</Label>
            <Input
              id="crew"
              value={formData.crew || ''}
              onChange={(e) => handleChange('crew', e.target.value)}
              placeholder="Crew"
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
            <Label htmlFor="secondary_profession">Secondary Profession</Label>
            <Input
              id="secondary_profession"
              value={formData.secondary_profession || ''}
              onChange={(e) => handleChange('secondary_profession', e.target.value)}
              placeholder="e.g. Secondary role"
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
          <div className="space-y-1">
            <Label htmlFor="trainings">Trainings / Qualifications</Label>
            <Input
              id="trainings"
              value={formData.trainings || ''}
              onChange={(e) => handleChange('trainings', e.target.value)}
              placeholder="Comma-separated or free text"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="driving_license">Driving License</Label>
            <Input
              id="driving_license"
              value={formData.driving_license || ''}
              onChange={(e) => handleChange('driving_license', e.target.value)}
              placeholder="Yes/No"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="driving_license_type">License Type</Label>
            <Input
              id="driving_license_type"
              value={formData.driving_license_type || ''}
              onChange={(e) => handleChange('driving_license_type', e.target.value)}
              placeholder="e.g. B, C1"
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
