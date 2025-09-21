import React, { useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Search } from "lucide-react";
import ComboBox from "@/components/common/ComboBox";

export default function EquipmentFilters({ filters, onFilterChange, equipment = [], soldiers = [] }) {
  const { divisions, equipmentTypes } = useMemo(() => {
    const safeEquipment = Array.isArray(equipment) ? equipment : [];
    const divisionsSet = new Set(safeEquipment.map(e => e.division_name).filter(Boolean));
    const typesSet = new Set(safeEquipment.map(e => e.equipment_type).filter(Boolean));
    return {
      divisions: [...divisionsSet].sort(),
      equipmentTypes: [...typesSet].sort()
    };
  }, [equipment]);

  const handleFilterChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };
  
  const divisionOptions = [
    { value: 'all', label: 'All Divisions' },
    ...divisions.map(d => ({ value: d, label: d }))
  ];
  
  const equipmentTypeOptions = [
    { value: 'all', label: 'All Types' },
    ...equipmentTypes.map(t => ({ value: t, label: t }))
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 border-y border-slate-200">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Filter by:</span>
      </div>

      <div className="w-48">
        <ComboBox
          options={equipmentTypeOptions}
          value={filters.type}
          onSelect={(val) => handleFilterChange('type', val || 'all')}
          placeholder="Equipment Type"
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

    </div>
  );
}