import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";
import ComboBox from "@/components/common/ComboBox";

export default function DroneFilters({ filters, onFilterChange, droneSets = [], soldiers = [] }) {
  const { divisions, setTypes } = useMemo(() => {
    const safeDrones = Array.isArray(droneSets) ? droneSets : [];
    const divisionsSet = new Set(safeDrones.map(d => d.division_name).filter(Boolean));
    const typesSet = new Set(safeDrones.map(d => d.set_type).filter(Boolean));
    return {
      divisions: [...divisionsSet].sort(),
      setTypes: [...typesSet].sort()
    };
  }, [droneSets]);

  const handleFilterChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };
  
  const divisionOptions = [
    { value: 'all', label: 'All Divisions' },
    ...divisions.map(d => ({ value: d, label: d }))
  ];

  const setTypeOptions = [
    { value: 'all', label: 'All Types' },
    ...setTypes.map(t => ({ value: t, label: t }))
  ];

  const soldierOptions = [
    { value: 'all', label: 'All Soldiers' },
    { value: 'unassigned', label: 'Unassigned Items' },
    ...soldiers.map(s => ({
      value: s.soldier_id,
      label: `${s.first_name} ${s.last_name} (${s.soldier_id})`
    }))
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 border-y border-slate-200">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Filter by:</span>
      </div>

      <div className="w-48">
        <ComboBox
          options={setTypeOptions}
          value={filters.type}
          onSelect={(val) => handleFilterChange('type', val || 'all')}
          placeholder="Set Type"
          searchPlaceholder="Search types..."
        />
      </div>

      <div className="w-48">
        <Select value={filters.status} onValueChange={(val) => handleFilterChange('status', val)}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Operational">Operational</SelectItem>
            <SelectItem value="Maintenance">Maintenance</SelectItem>
            <SelectItem value="Damaged">Damaged</SelectItem>
            <SelectItem value="Missing">Missing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-48">
        <Select value={filters.armory_status} onValueChange={(val) => handleFilterChange('armory_status', val)}>
          <SelectTrigger>
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="with_soldier">With Soldier</SelectItem>
            <SelectItem value="in_deposit">In Deposit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-48">
        <ComboBox
          options={divisionOptions}
          value={filters.division}
          onSelect={(val) => handleFilterChange('division', val || 'all')}
          placeholder="Division"
          searchPlaceholder="Search divisions..."
        />
      </div>

      <div className="w-56">
        <ComboBox
          options={soldierOptions}
          value={filters.assigned_to}
          onSelect={(val) => handleFilterChange('assigned_to', val || 'all')}
          placeholder="Assigned Soldier"
          searchPlaceholder="Search soldiers..."
        />
      </div>
    </div>
  );
}