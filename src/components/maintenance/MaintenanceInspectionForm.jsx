import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Binoculars, Plane, Search, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";

export default function MaintenanceInspectionForm({ soldier, assignedWeapons, assignedGear, assignedDrones = [], onSubmit, onCancel, isLoading }) {
  const [weaponSearch, setWeaponSearch] = useState("");
  const [gearSearch, setGearSearch] = useState("");
  const [droneSearch, setDroneSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [itemStatuses, setItemStatuses] = useState({});
  const [itemComments, setItemComments] = useState({});

  // Filter out SAMPLE items first, then apply search
  const nonSampleWeapons = useMemo(() =>
    assignedWeapons.filter(w => !w.weapon_id?.toUpperCase().includes('SAMPLE')),
    [assignedWeapons]
  );

  const nonSampleGear = useMemo(() =>
    assignedGear.filter(g => !g.gear_id?.toUpperCase().includes('SAMPLE')),
    [assignedGear]
  );

  const nonSampleDrones = useMemo(() =>
    assignedDrones.filter(d => !d.set_serial_number?.toUpperCase().includes('SAMPLE')),
    [assignedDrones]
  );

  // Filter weapons by search
  const filteredWeapons = useMemo(() => {
    if (!weaponSearch) return nonSampleWeapons;
    const searchLower = weaponSearch.toLowerCase();
    return nonSampleWeapons.filter(w =>
      (w.weapon_type?.toLowerCase().includes(searchLower)) ||
      (w.weapon_id?.toLowerCase().includes(searchLower))
    );
  }, [nonSampleWeapons, weaponSearch]);

  // Filter gear by search
  const filteredGear = useMemo(() => {
    if (!gearSearch) return nonSampleGear;
    const searchLower = gearSearch.toLowerCase();
    return nonSampleGear.filter(g =>
      (g.gear_type?.toLowerCase().includes(searchLower)) ||
      (g.gear_id?.toLowerCase().includes(searchLower))
    );
  }, [nonSampleGear, gearSearch]);

  // Filter drones by search
  const filteredDrones = useMemo(() => {
    if (!droneSearch) return nonSampleDrones;
    const searchLower = droneSearch.toLowerCase();
    return nonSampleDrones.filter(d =>
      (d.set_type?.toLowerCase().includes(searchLower)) ||
      (d.set_serial_number?.toLowerCase().includes(searchLower))
    );
  }, [nonSampleDrones, droneSearch]);

  const toggleItemSelection = (type, id) => {
    const key = `${type}-${id}`;
    const newSelected = new Set(selectedItems);
    if (newSelected.has(key)) {
      newSelected.delete(key);
      // Remove status and comments for deselected item
      const newStatuses = { ...itemStatuses };
      const newComments = { ...itemComments };
      delete newStatuses[key];
      delete newComments[key];
      setItemStatuses(newStatuses);
      setItemComments(newComments);
    } else {
      newSelected.add(key);
      // Initialize with default status based on item type
      const defaultStatus = type === 'drone' ? 'operational' : 'functioning';
      setItemStatuses(prev => ({ ...prev, [key]: defaultStatus }));
      setItemComments(prev => ({ ...prev, [key]: '' }));
    }
    setSelectedItems(newSelected);
  };

  const updateItemStatus = (key, status) => {
    setItemStatuses(prev => ({ ...prev, [key]: status }));
  };

  const updateItemComments = (key, comments) => {
    setItemComments(prev => ({ ...prev, [key]: comments }));
  };

  // Helper function to get status badge styling
  const getStatusBadge = (status) => {
    if (!status) return null;

    const statusConfig = {
      // Weapon and gear statuses
      'functioning': { label: 'Functioning', className: 'bg-green-100 text-green-800 border-green-300' },
      'not_functioning': { label: 'Not Functioning', className: 'bg-red-100 text-red-800 border-red-300' },
      'missing': { label: 'Missing', className: 'bg-amber-100 text-amber-800 border-amber-300' },
      // Drone statuses
      'operational': { label: 'Operational', className: 'bg-green-100 text-green-800 border-green-300' },
      'maintenance': { label: 'Maintenance', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      'damaged': { label: 'Damaged', className: 'bg-red-100 text-red-800 border-red-300' }
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-300' };

    return (
      <Badge className={`${config.className} border`}>
        {config.label}
      </Badge>
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedItems.size === 0) {
      alert("Please select at least one item to inspect.");
      return;
    }

    const inspectionResults = { weapons: {}, gear: {}, drones: {} };

    selectedItems.forEach(key => {
      // Split only on the first hyphen to preserve IDs that contain hyphens
      const firstHyphenIndex = key.indexOf('-');
      const type = key.substring(0, firstHyphenIndex);
      const id = key.substring(firstHyphenIndex + 1);
      const status = itemStatuses[key] || 'functioning';
      const comments = itemComments[key] || '';

      if (type === 'weapon') {
        inspectionResults.weapons[id] = { status, comments };
      } else if (type === 'gear') {
        inspectionResults.gear[id] = { status, comments };
      } else if (type === 'drone') {
        inspectionResults.drones[id] = { status, comments };
      }
    });

    await onSubmit(inspectionResults);

    // Reset form
    setSelectedItems(new Set());
    setItemStatuses({});
    setItemComments({});
  };

  const renderWeaponItem = (weapon) => {
    const key = `weapon-${weapon.id}`;
    const isSelected = selectedItems.has(key);

    return (
      <div key={weapon.id} className={`p-4 border rounded-lg flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-slate-50'}`} onClick={() => toggleItemSelection('weapon', weapon.id)}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleItemSelection('weapon', weapon.id)}
        />
        <Target className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">{weapon.weapon_type}</p>
          <p className="text-sm text-gray-500 font-mono">{weapon.weapon_id}</p>
          {weapon.last_checked_date && (
            <p className="text-xs text-slate-500 mt-1">Last Checked: {format(new Date(weapon.last_checked_date), 'PPP')}</p>
          )}
        </div>
        {weapon.status && getStatusBadge(weapon.status)}
      </div>
    );
  };

  const renderGearItem = (gear) => {
    const key = `gear-${gear.id}`;
    const isSelected = selectedItems.has(key);

    return (
      <div key={gear.id} className={`p-4 border rounded-lg flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-slate-50'}`} onClick={() => toggleItemSelection('gear', gear.id)}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleItemSelection('gear', gear.id)}
        />
        <Binoculars className="w-5 h-5 text-blue-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">{gear.gear_type}</p>
          <p className="text-sm text-gray-500 font-mono">{gear.gear_id}</p>
          {gear.last_checked_date && (
            <p className="text-xs text-slate-500 mt-1">Last Checked: {format(new Date(gear.last_checked_date), 'PPP')}</p>
          )}
        </div>
        {gear.status && getStatusBadge(gear.status)}
      </div>
    );
  };

  const renderDroneItem = (drone) => {
    const key = `drone-${drone.id}`;
    const isSelected = selectedItems.has(key);

    return (
      <div key={drone.id} className={`p-4 border rounded-lg flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-slate-50'}`} onClick={() => toggleItemSelection('drone', drone.id)}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleItemSelection('drone', drone.id)}
        />
        <Plane className="w-5 h-5 text-purple-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">{drone.set_type}</p>
          <p className="text-sm text-gray-500 font-mono">{drone.set_serial_number}</p>
          {drone.last_checked_date && (
            <p className="text-xs text-slate-500 mt-1">Last Checked: {format(new Date(drone.last_checked_date), 'PPP')}</p>
          )}
        </div>
        {drone.status && getStatusBadge(drone.status)}
      </div>
    );
  };

  // Get details of selected items for display in inspection form
  const getSelectedItemsDetails = useMemo(() => {
    const details = [];
    selectedItems.forEach(key => {
      // Split only on the first hyphen to preserve IDs that contain hyphens
      const firstHyphenIndex = key.indexOf('-');
      const type = key.substring(0, firstHyphenIndex);
      const id = key.substring(firstHyphenIndex + 1);

      if (type === 'weapon') {
        const weapon = nonSampleWeapons.find(w => w.id === id);
        if (weapon) {
          details.push({
            key,
            type: 'weapon',
            icon: Target,
            iconColor: 'text-red-500',
            name: weapon.weapon_type,
            id: weapon.weapon_id
          });
        }
      } else if (type === 'gear') {
        const gear = nonSampleGear.find(g => g.id === id);
        if (gear) {
          details.push({
            key,
            type: 'gear',
            icon: Binoculars,
            iconColor: 'text-blue-500',
            name: gear.gear_type,
            id: gear.gear_id
          });
        }
      } else if (type === 'drone') {
        const drone = nonSampleDrones.find(d => d.id === id);
        if (drone) {
          details.push({
            key,
            type: 'drone',
            icon: Plane,
            iconColor: 'text-purple-500',
            name: drone.set_type,
            id: drone.set_serial_number
          });
        }
      }
    });
    return details;
  }, [selectedItems, nonSampleWeapons, nonSampleGear, nonSampleDrones]);

  const totalItems = nonSampleWeapons.length + nonSampleGear.length + nonSampleDrones.length;

  if (totalItems === 0 && !isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{soldier ? `${soldier.first_name} ${soldier.last_name}` : 'Unassigned Equipment'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-slate-600 py-8">
            {soldier ? 'This soldier has no equipment assigned to them.' : 'No unassigned equipment found.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {soldier ? `${soldier.first_name} ${soldier.last_name}'s Equipment` : 'Unassigned Equipment'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {nonSampleWeapons.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Target className="w-5 h-5" /> {soldier ? 'Assigned Weapons' : 'Unassigned Weapons'}
                  <span className="text-sm text-slate-500 font-normal">({filteredWeapons.length} of {nonSampleWeapons.length})</span>
                </h3>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search weapons..."
                    value={weaponSearch}
                    onChange={(e) => setWeaponSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {filteredWeapons.map(w => renderWeaponItem(w))}
              </div>
              {filteredWeapons.length === 0 && weaponSearch && (
                <p className="text-center text-slate-500 py-4">No weapons match your search.</p>
              )}
            </div>
          )}

          {nonSampleGear.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Binoculars className="w-5 h-5" /> {soldier ? 'Assigned Serialized Gear' : 'Unassigned Serialized Gear'}
                  <span className="text-sm text-slate-500 font-normal">({filteredGear.length} of {nonSampleGear.length})</span>
                </h3>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search gear..."
                    value={gearSearch}
                    onChange={(e) => setGearSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {filteredGear.map(g => renderGearItem(g))}
              </div>
              {filteredGear.length === 0 && gearSearch && (
                <p className="text-center text-slate-500 py-4">No gear matches your search.</p>
              )}
            </div>
          )}

          {nonSampleDrones.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Plane className="w-5 h-5" /> {soldier ? 'Assigned Drones' : 'Unassigned Drones'}
                  <span className="text-sm text-slate-500 font-normal">({filteredDrones.length} of {nonSampleDrones.length})</span>
                </h3>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search drones..."
                    value={droneSearch}
                    onChange={(e) => setDroneSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {filteredDrones.map(d => renderDroneItem(d))}
              </div>
              {filteredDrones.length === 0 && droneSearch && (
                <p className="text-center text-slate-500 py-4">No drones match your search.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky Bottom Inspection Form - Each item gets its own row */}
      {selectedItems.size > 0 && (
        <Card className="sticky bottom-6 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ClipboardCheck className="w-6 h-6" /> Inspection Form
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Update status for each of the {selectedItems.size} selected item(s).
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Show each selected item with its own status and comments */}
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {getSelectedItemsDetails.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-4 border rounded-lg">
                      <div className="md:col-span-1 flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${item.iconColor}`} />
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-sm text-gray-500 font-mono">{item.id}</p>
                        </div>
                      </div>

                      <div className="md:col-span-1">
                        <Label htmlFor={`status-${item.key}`}>Status</Label>
                        <Select
                          value={itemStatuses[item.key] || (item.type === 'drone' ? 'operational' : 'functioning')}
                          onValueChange={(value) => updateItemStatus(item.key, value)}
                        >
                          <SelectTrigger id={`status-${item.key}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {item.type === 'drone' ? (
                              <>
                                <SelectItem value="operational">operational</SelectItem>
                                <SelectItem value="maintenance">maintenance</SelectItem>
                                <SelectItem value="damaged">damaged</SelectItem>
                                <SelectItem value="missing">missing</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="functioning">functioning</SelectItem>
                                <SelectItem value="not_functioning">not functioning</SelectItem>
                                <SelectItem value="missing">missing</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor={`comments-${item.key}`}>Comments</Label>
                        <Input
                          id={`comments-${item.key}`}
                          placeholder="Add optional comments..."
                          value={itemComments[item.key] || ''}
                          onChange={(e) => updateItemComments(item.key, e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <Button type="submit">Submit Inspection</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
