import React, { useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Search } from "lucide-react";
import ComboBox from "@/components/common/ComboBox";

export default function DroneComponentFilters({ filters, onFilterChange, components = [] }) {
  const componentTypes = useMemo(() => {
    const safeComponents = Array.isArray(components) ? components : [];
    const typesSet = new Set(safeComponents.map(c => c.component_type).filter(Boolean));
    return [...typesSet].sort();
  }, [components]);

  const handleFilterChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };
  
  const componentTypeOptions = [
    { value: 'all', label: 'All Types' },
    ...componentTypes.map(t => ({ value: t, label: t }))
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 border-y border-slate-200">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Filter by:</span>
      </div>

      <div className="w-48">
        <ComboBox
          options={componentTypeOptions}
          value={filters.type}
          onSelect={(val) => handleFilterChange('type', val || 'all')}
          placeholder="Component Type"
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
          </SelectContent>
        </Select>
      </div>

      <div className="relative flex-grow min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by ID..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          className="pl-10"
        />
      </div>
    </div>
  );
}