import React, { useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Search } from "lucide-react";
import ComboBox from "@/components/common/ComboBox";

export default function SoldierFilters({ filters, onFilterChange, soldiers = [] }) {

  const { divisions, teams } = useMemo(() => {
    const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
    const divisionsSet = new Set(safeSoldiers.map(s => s.division_name).filter(Boolean));
    const teamsSet = new Set(safeSoldiers.map(s => s.team_name).filter(Boolean));
    return {
      divisions: [...divisionsSet].sort(),
      teams: [...teamsSet].sort(),
    };
  }, [soldiers]);

  const handleFilterChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };
  
  const divisionOptions = [
      { value: 'all', label: 'All Divisions' },
      ...divisions.map(d => ({ value: d, label: d }))
  ];

  const teamOptions = [
      { value: 'all', label: 'All Teams' },
      ...teams.map(t => ({ value: t, label: t }))
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 border-y border-slate-200">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Filter by:</span>
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
        <ComboBox
            options={teamOptions}
            value={filters.team}
            onSelect={(val) => handleFilterChange('team', val || 'all')}
            placeholder="Team"
            searchPlaceholder="Search teams..."
        />
      </div>

      <div className="w-48">
        <Select value={filters.status} onValueChange={(val) => handleFilterChange('status', val)}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="expected">Expected</SelectItem>
            <SelectItem value="arrived">Arrived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="relative flex-grow min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by name or ID..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          className="pl-10"
        />
      </div>
    </div>
  );
}