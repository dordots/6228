import { useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

// Multi-select button component
function MultiSelectButton({ options, selected, onToggle, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCount = selected.length;

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
        <div className="max-h-64 overflow-y-auto">
          {options.map((option) => (
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
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function DroneComponentFilters({ filters, onFilterChange, components = [] }) {
  const componentTypes = useMemo(() => {
    const safeComponents = Array.isArray(components) ? components : [];
    const typesSet = new Set(safeComponents.map(c => c.component_type).filter(Boolean));
    return [...typesSet].sort();
  }, [components]);

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
      statuses: []
    });
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.types?.length > 0) count += filters.types.length;
    if (filters.statuses?.length > 0) count += filters.statuses.length;
    return count;
  }, [filters]);

  const componentTypeOptions = componentTypes.map(t => ({ value: t, label: t }));

  const statusOptions = [
    { value: 'Operational', label: 'Operational' },
    { value: 'Maintenance', label: 'Maintenance' },
    { value: 'Damaged', label: 'Damaged' }
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
              Filter Components
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
          {/* Component Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Component Type</Label>
            <MultiSelectButton
              options={componentTypeOptions}
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
