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
import { ArrowRight, User, UserX, Search, ChevronDown } from "lucide-react";

export default function ReassignDroneSetDialog({
  open,
  onOpenChange,
  droneSet,
  soldiers,
  onReassign,
}) {
  const [newAssignment, setNewAssignment] = useState('');
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);

  const handleSubmit = () => {
    onReassign(droneSet, newAssignment || null);
    onOpenChange(false);
    setNewAssignment('');
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleSelectSoldier = (soldierId, soldierName) => {
    setNewAssignment(soldierId);
    setSearchTerm(soldierName || 'Unassigned');
    setShowDropdown(false);
  };

  const currentSoldier = useMemo(() => {
    if (!droneSet?.assigned_to) return null;
    return soldiers.find(s => s.soldier_id === droneSet.assigned_to);
  }, [droneSet, soldiers]);

  const filteredSoldiers = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return soldiers;
    return soldiers.filter(s => 
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchLower) ||
      s.soldier_id.toLowerCase().includes(searchLower)
    );
  }, [searchTerm, soldiers]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setNewAssignment('');
      setSearchTerm('');
      setShowDropdown(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reassign Drone Set</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Drone Set Details</Label>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-medium">{droneSet?.set_type}</p>
              <p className="text-sm text-slate-600">Serial: {droneSet?.set_serial_number}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Label>Current Assignment</Label>
              <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50">
                {currentSoldier ? (
                  <>
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">{currentSoldier.first_name} {currentSoldier.last_name}</span>
                  </>
                ) : (
                  <>
                    <UserX className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-500">Unassigned</span>
                  </>
                )}
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400 mt-6" />

            <div className="flex-1 space-y-2">
              <Label>New Assignment</Label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    ref={inputRef}
                    placeholder="Search soldier or type 'unassigned'..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="pl-9 pr-9"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
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
                    {filteredSoldiers.map(s => (
                      <div
                        key={s.id}
                        onClick={() => handleSelectSoldier(s.soldier_id, `${s.first_name} ${s.last_name}`)}
                        className="p-3 hover:bg-slate-100 cursor-pointer text-sm border-b last:border-b-0"
                      >
                        <p className="font-medium">{s.first_name} {s.last_name}</p>
                        <p className="text-xs text-slate-500">ID: {s.soldier_id}</p>
                      </div>
                    ))}
                    {filteredSoldiers.length === 0 && searchTerm && (
                      <div className="p-4 text-center text-sm text-slate-500">
                        No soldiers found matching "{searchTerm}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
            Reassign Drone Set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}