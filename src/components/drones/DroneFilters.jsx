import { useMemo, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

// Multi-select button component
function MultiSelectButton({ options, selected, onToggle, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const selectedCount = selected.length;

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const lowerTerm = searchTerm.toLowerCase();
    return options.filter(option => option.label.toLowerCase().includes(lowerTerm));
  }, [options, searchTerm]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
        >
          <span>
            {selectedCount === 0 ? placeholder : `${selectedCount} selected`}
          </span>
          <Filter className="w-4 h-4 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="border-b border-slate-200 p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              No results found.
            </div>
          ) : (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                onClick={() => onToggle(option.value)}
              >
                <Checkbox
                  checked={selected.includes(option.value)}
                  onCheckedChange={() => onToggle(option.value)}
                />
                <label className="text-sm cursor-pointer flex-1">{option.label}</label>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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

  const handleMultiSelectToggle = (key, value) => {
    const currentValues = filters[key] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    handleFilterChange(key, newValues);
  };

  const clearAllFilters = () => {
    onFilterChange({
      types: [],
      statuses: [],
      armory_statuses: [],
      divisions: [],
      assigned_soldiers: []
    });
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.types?.length > 0) count += filters.types.length;
    if (filters.statuses?.length > 0) count += filters.statuses.length;
    if (filters.armory_statuses?.length > 0) count += filters.armory_statuses.length;
    if (filters.divisions?.length > 0) count += filters.divisions.length;
    if (filters.assigned_soldiers?.length > 0) count += filters.assigned_soldiers.length;
    return count;
  }, [filters]);

  const setTypeOptions = setTypes.map(t => ({ value: t, label: t }));

  const statusOptions = [
    { value: 'Operational', label: 'Operational' },
    { value: 'Maintenance', label: 'Maintenance' },
    { value: 'Damaged', label: 'Damaged' },
    { value: 'Missing', label: 'Missing' }
  ];

  const armoryStatusOptions = [
    { value: 'with_soldier', label: 'With Soldier' },
    { value: 'in_deposit', label: 'In Deposit' }
  ];

  const divisionOptions = divisions.map(d => ({ value: d, label: d }));

  const soldierOptions = [
    { value: 'unassigned', label: 'Unassigned Items' },
    ...soldiers.map(s => ({
      value: s.soldier_id,
      label: `${s.first_name} ${s.last_name} (${s.soldier_id})`
    }))
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative">
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="ml-2 bg-red-600 text-white">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {/* Header - Fixed at top */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter Drones
            </h4>
            <Button
              variant="link"
              className="h-auto p-0 text-sm"
              onClick={clearAllFilters}
            >
              Clear all
            </Button>
          </div>
        </div>

        {/* Scrollable Filter Options */}
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {/* Set Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Set Type</Label>
            <MultiSelectButton
              options={setTypeOptions}
              selected={filters.types || []}
              onToggle={(value) => handleMultiSelectToggle('types', value)}
              placeholder="Select types..."
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <MultiSelectButton
              options={statusOptions}
              selected={filters.statuses || []}
              onToggle={(value) => handleMultiSelectToggle('statuses', value)}
              placeholder="Select statuses..."
            />
          </div>

          {/* Armory Status */}
          <div className="space-y-1.5">
            <Label className="text-xs">Location</Label>
            <MultiSelectButton
              options={armoryStatusOptions}
              selected={filters.armory_statuses || []}
              onToggle={(value) => handleMultiSelectToggle('armory_statuses', value)}
              placeholder="Select locations..."
            />
          </div>

          {/* Division */}
          <div className="space-y-1.5">
            <Label className="text-xs">Division</Label>
            <MultiSelectButton
              options={divisionOptions}
              selected={filters.divisions || []}
              onToggle={(value) => handleMultiSelectToggle('divisions', value)}
              placeholder="Select divisions..."
            />
          </div>

          {/* Assigned Soldier */}
          <div className="space-y-1.5">
            <Label className="text-xs">Assigned Soldier</Label>
            <MultiSelectButton
              options={soldierOptions}
              selected={filters.assigned_soldiers || []}
              onToggle={(value) => handleMultiSelectToggle('assigned_soldiers', value)}
              placeholder="Select soldiers..."
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
