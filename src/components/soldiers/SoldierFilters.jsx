import { useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function SoldierFilters({ filters, onFilterChange, soldiers = [] }) {
  const { divisions, teams, crews, sexes, maritalStatuses, licenseTypes } = useMemo(() => {
    const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
    const divisionsSet = new Set(safeSoldiers.map(s => s.division_name).filter(Boolean));
    const teamsSet = new Set(safeSoldiers.map(s => s.team_name).filter(Boolean));
    const crewsSet = new Set(safeSoldiers.map(s => s.crew).filter(Boolean));
    const sexesSet = new Set(safeSoldiers.map(s => s.sex).filter(Boolean));
    const maritalSet = new Set(safeSoldiers.map(s => s.marital_status).filter(Boolean));
    const licenseTypeSet = new Set(safeSoldiers.map(s => s.driving_license_type).filter(Boolean));
    return {
      divisions: [...divisionsSet].sort(),
      teams: [...teamsSet].sort(),
      crews: [...crewsSet].sort(),
      sexes: [...sexesSet].sort(),
      maritalStatuses: [...maritalSet].sort(),
      licenseTypes: [...licenseTypeSet].sort(),
    };
  }, [soldiers]);

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
      divisions: [],
      teams: [],
      statuses: [],
      crews: [],
      sexes: [],
      marital_statuses: [],
      license_types: []
    });
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.divisions?.length > 0) count += filters.divisions.length;
    if (filters.teams?.length > 0) count += filters.teams.length;
    if (filters.statuses?.length > 0) count += filters.statuses.length;
    if (filters.crews?.length > 0) count += filters.crews.length;
    if (filters.sexes?.length > 0) count += filters.sexes.length;
    if (filters.marital_statuses?.length > 0) count += filters.marital_statuses.length;
    if (filters.license_types?.length > 0) count += filters.license_types.length;
    return count;
  }, [filters]);

  const divisionOptions = divisions.map(d => ({ value: d, label: d }));
  const teamOptions = teams.map(t => ({ value: t, label: t }));
  const crewOptions = crews.map(c => ({ value: c, label: c }));
  const sexOptions = sexes.map(c => ({ value: c, label: c }));
  const maritalOptions = maritalStatuses.map(c => ({ value: c, label: c }));
  const licenseOptions = licenseTypes.map(c => ({ value: c, label: c }));

  const statusOptions = [
    { value: 'expected', label: 'Expected' },
    { value: 'arrived', label: 'Arrived' }
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
              Filter Soldiers
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

          {/* Team */}
          <div className="space-y-1.5">
            <Label className="text-xs">Team</Label>
            <MultiSelectButton
              options={teamOptions}
              selected={filters.teams || []}
              onToggle={(value) => handleMultiSelectToggle('teams', value)}
              placeholder="Select teams..."
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

          {/* Crew */}
          <div className="space-y-1.5">
            <Label className="text-xs">Crew</Label>
            <MultiSelectButton
              options={crewOptions}
              selected={filters.crews || []}
              onToggle={(value) => handleMultiSelectToggle('crews', value)}
              placeholder="Select crews..."
            />
          </div>

          {/* Sex */}
          <div className="space-y-1.5">
            <Label className="text-xs">Sex</Label>
            <MultiSelectButton
              options={sexOptions}
              selected={filters.sexes || []}
              onToggle={(value) => handleMultiSelectToggle('sexes', value)}
              placeholder="Select sex..."
            />
          </div>

          {/* Marital Status */}
          <div className="space-y-1.5">
            <Label className="text-xs">Marital Status</Label>
            <MultiSelectButton
              options={maritalOptions}
              selected={filters.marital_statuses || []}
              onToggle={(value) => handleMultiSelectToggle('marital_statuses', value)}
              placeholder="Select marital status..."
            />
          </div>

          {/* License Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">License Type</Label>
            <MultiSelectButton
              options={licenseOptions}
              selected={filters.license_types || []}
              onToggle={(value) => handleMultiSelectToggle('license_types', value)}
              placeholder="Select license type..."
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
