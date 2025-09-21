
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

export default function ReassignWeaponDialog({
  open,
  onOpenChange,
  weapon,
  soldiers,
  onReassign,
}) {
  const [newAssignment, setNewAssignment] = useState('');
  const [newDivision, setNewDivision] = useState(''); // This will now be derived automatically
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);

  // existingDivisions useMemo has been removed as per outline

  const handleSubmit = () => {
    // The parent now only needs the weapon and the new soldier ID.
    onReassign(weapon, newAssignment || null);
    onOpenChange(false);
  };

  const handleSelectSoldier = (soldierId, soldierName) => {
    setNewAssignment(soldierId);
    setSearchTerm(soldierName || 'Unassigned');
    setShowDropdown(false);
    
    // Automatically derive the division for display purposes
    const selectedSoldier = Array.isArray(soldiers) ? soldiers.find(s => s.soldier_id === soldierId) : null;
    setNewDivision(selectedSoldier?.division_name || '');
  };

  const currentSoldier = useMemo(() => {
    if (!weapon?.assigned_to || !Array.isArray(soldiers)) return null;
    return soldiers.find(s => s.soldier_id === weapon.assigned_to);
  }, [weapon, soldiers]);

  // Filter soldiers based on search term.
  // Changed: show all soldiers when no search term, filter with 1+ characters
  const filteredSoldiers = useMemo(() => {
    const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
    if (!searchTerm) return safeSoldiers; // Show all soldiers if no search term
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
      setNewDivision(weapon?.division_name || '');
      setSearchTerm('');
      setShowDropdown(false);
    }
  }, [open, weapon]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Reassign Weapon</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Weapon Details</Label>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-medium">{weapon?.weapon_type}</p>
              <p className="text-sm text-slate-600">ID: {weapon?.weapon_id}</p>
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
                        onClick={() => handleSelectSoldier('', 'Unassigned')} 
                        className="p-3 hover:bg-slate-100 cursor-pointer text-sm flex items-center gap-2 border-b"
                      >
                        <UserX className="w-4 h-4 text-slate-500" />
                        Unassigned
                      </div>
                      {filteredSoldiers.length > 0 ? (
                        filteredSoldiers.map(s => (
                          <div 
                            key={s.soldier_id} 
                            onClick={() => handleSelectSoldier(s.soldier_id, `${s.first_name} ${s.last_name}`)} 
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

            {/* Division Assignment - This section is now purely for display */}
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Label>Current Division</Label>
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 h-10">
                  <Shield className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">{weapon?.division_name || <span className="text-slate-500">N/A</span>}</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 mt-6" />
              <div className="flex-1 space-y-2">
                <Label>New Division (Automatic)</Label>
                 <Select value={newDivision || 'unassigned'} disabled>
                  <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {/* Simplified list of divisions */}
                    {[...new Set((Array.isArray(soldiers) ? soldiers : []).map(s => s.division_name).filter(Boolean))].map(division => (
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
          <Button onClick={handleSubmit} className="bg-red-600 hover:bg-red-700">Reassign Weapon</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
