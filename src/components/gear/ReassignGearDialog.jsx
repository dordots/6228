
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, User, UserX, Search, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ReassignGearDialog({
  open,
  onOpenChange,
  gear,
  soldiers,
  onReassign,
}) {
  const [newAssignment, setNewAssignment] = useState('');
  const [newDivision, setNewDivision] = useState(''); // Keep for display purposes in disabled select
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);

  const existingDivisions = useMemo(() => {
    const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
    const divisions = safeSoldiers
      .filter(s => s && s.division_name)
      .map(s => s.division_name)
      .filter((division, index, arr) => arr.indexOf(division) === index)
      .sort();
    return divisions;
  }, [soldiers]);

  const handleSubmit = () => {
    // Only pass the new soldier ID. The parent component will handle the logic.
    onReassign(gear, newAssignment || null);
    onOpenChange(false);
  };

  // Modified: Added divisionName parameter as per outline.
  const handleSelectSoldier = (soldierId, soldierName, divisionName) => {
    setNewAssignment(soldierId);
    setSearchTerm(soldierName || 'Unassigned');
    setShowDropdown(false);
    // Determine division from selected soldier and set it for display in the disabled field
    const selectedSoldier = Array.isArray(soldiers) ? soldiers.find(s => s.soldier_id === soldierId) : null;
    setNewDivision(selectedSoldier?.division_name || '');
  };

  const currentSoldier = useMemo(() => {
    if (!gear?.assigned_to || !Array.isArray(soldiers)) return null;
    return soldiers.find(s => s.soldier_id === gear.assigned_to);
  }, [gear, soldiers]);

  const filteredSoldiers = useMemo(() => {
    const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
    // Changed: show all soldiers when no search term, filter with 1+ characters
    if (!searchTerm) return safeSoldiers;
    const searchLower = searchTerm.toLowerCase().trim();
    return safeSoldiers.filter(s =>
      s &&
      (`${s.first_name} ${s.last_name}`.toLowerCase().includes(searchLower) ||
      s.soldier_id.toLowerCase().includes(searchLower))
    );
  }, [searchTerm, soldiers]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setNewAssignment('');
      setNewDivision(''); // Reset new division display when dialog opens
      setSearchTerm('');
      setShowDropdown(false);
    }
  }, [open, gear]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Reassign Gear</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Gear Details</Label>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-medium">{gear?.gear_type}</p>
              <p className="text-sm text-slate-600">ID: {gear?.gear_id}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Soldier Assignment */}
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Label>Current Soldier</Label>
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 h-10">
                  {currentSoldier ? (
                    <><User className="w-4 h-4 text-slate-500" /><span className="text-sm">{currentSoldier.first_name} {currentSoldier.last_name}</span></>
                  ) : (
                    <><UserX className="w-4 h-4 text-slate-500" /><span className="text-sm text-slate-500">Unassigned</span></>
                  )}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 mt-6" />
              <div className="flex-1 space-y-2">
                <Label>New Soldier</Label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      ref={inputRef}
                      placeholder="Search or click to see all..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      className="pl-9"
                    />
                  </div>
                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-60 overflow-auto">
                      <div
                        // Pass empty string for divisionName to match the updated signature
                        onClick={() => handleSelectSoldier('', 'Unassigned', '')}
                        className="p-3 hover:bg-slate-100 cursor-pointer text-sm flex items-center gap-2 border-b"
                      >
                        <UserX className="w-4 h-4 text-slate-500" />
                        Unassigned
                      </div>
                      {filteredSoldiers.length > 0 ? (
                        filteredSoldiers.map(s => (
                          <div
                            key={s.soldier_id} // Use soldier_id as key for uniqueness
                            // Modified: Pass s.division_name as the third argument
                            onClick={() => handleSelectSoldier(s.soldier_id, `${s.first_name} ${s.last_name}`, s.division_name)}
                            className="p-3 hover:bg-slate-100 cursor-pointer text-sm border-b last:border-b-0"
                          >
                            <p className="font-medium">{s.first_name} {s.last_name}</p>
                            <p className="text-xs text-slate-500">ID: {s.soldier_id} • {s.division_name || 'No Division'}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-sm text-slate-500 text-center">
                          No soldiers found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Division Assignment - This section can be removed or disabled as it's now automatic */}
            <div className="flex items-center gap-4 hidden">
              <div className="flex-1 space-y-2">
                <Label>Current Division</Label>
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 h-10">
                  <Shield className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">{gear?.division_name || <span className="text-slate-500">N/A</span>}</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 mt-6" />
              <div className="flex-1 space-y-2">
                <Label>New Division (Automatic)</Label>
                 <Select value={newDivision || 'no-division'} onValueChange={setNewDivision} disabled>
                  <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-division">Unassigned</SelectItem>
                    {existingDivisions.map(division => (
                      <SelectItem key={division} value={division}>{division}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-purple-600 hover:bg-purple-700">Reassign Gear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
