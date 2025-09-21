
import React, { useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Search } from "lucide-react";
import ComboBox from "@/components/common/ComboBox";

export default function WeaponFilters({ filters, onFilterChange, weapons = [], soldiers = [] }) {
  const { divisions, weaponTypes } = useMemo(() => {
    const safeWeapons = Array.isArray(weapons) ? weapons : [];
    const divisionsSet = new Set(safeWeapons.map(w => w.division_name).filter(Boolean));
    const typesSet = new Set(safeWeapons.map(w => w.weapon_type).filter(Boolean));
    return {
      divisions: [...divisionsSet].sort(),
      weaponTypes: [...typesSet].sort()
    };
  }, [weapons]);

  const handleFilterChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };
  
  const divisionOptions = [
    { value: 'all', label: 'All Divisions' },
    ...divisions.map(d => ({ value: d, label: d }))
  ];
  
  const weaponTypeOptions = [
    { value: 'all', label: 'All Types' },
    ...weaponTypes.map(t => ({ value: t, label: t }))
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
          options={weaponTypeOptions}
          value={filters.type}
          onSelect={(val) => handleFilterChange('type', val || 'all')}
          placeholder="Weapon Type"
          searchPlaceholder="Search types..."
        />
      </div>

      <div className="w-48">
        <Select value={filters.condition} onValueChange={(val) => handleFilterChange('condition', val)}>
          <SelectTrigger>
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conditions</SelectItem>
            <SelectItem value="functioning">Functioning</SelectItem>
            <SelectItem value="not_functioning">Not Functioning</SelectItem>
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

      <div className="w-48">
        <Select value={filters.armory_status} onValueChange={(val) => handleFilterChange('armory_status', val)}>
          <SelectTrigger>
            <SelectValue placeholder="Armory Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="with_soldier">With Soldier</SelectItem>
            <SelectItem value="in_deposit">In Deposit</SelectItem>
          </SelectContent>
        </Select>
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
