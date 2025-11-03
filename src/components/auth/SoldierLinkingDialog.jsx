import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User } from "@/api/entities";
import { Soldier } from "@/api/entities";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SoldierLinkingDialog({ open, onOpenChange, onLinked }) {
  const [soldiers, setSoldiers] = useState([]);
  const [selectedSoldierId, setSelectedSoldierId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSoldiers, setIsLoadingSoldiers] = useState(true);

  useEffect(() => {
    if (open) {
      setIsLoadingSoldiers(true);
      loadSoldiers();
      setSelectedSoldierId(""); // Reset selection when dialog opens
    }
  }, [open]);

  const loadSoldiers = async () => {
    try {
      const soldiersData = await Soldier.list("-created_date");
      setSoldiers(Array.isArray(soldiersData) ? soldiersData : []);
    } catch (error) {
      setSoldiers([]);
    } finally {
      setIsLoadingSoldiers(false);
    }
  };

  const handleLink = async () => {
    if (!selectedSoldierId) return;

    setIsLoading(true);
    try {
      await User.updateMyUserData({ linked_soldier_id: selectedSoldierId });
      
      const selectedSoldier = soldiers.find(s => s.soldier_id === selectedSoldierId);
      if (onLinked && selectedSoldier) {
        onLinked(selectedSoldier);
      }
      
      onOpenChange(false);
    } catch (error) {
      alert("Failed to link soldier account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link Your Soldier Account</DialogTitle>
          <DialogDescription>
            Search for and select your soldier record to link it with your user account. This ensures your name and ID appear correctly.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Command className="rounded-lg border shadow-sm">
            <CommandInput placeholder="Type to search soldier by name or ID..." />
            <CommandList className="max-h-[300px]">
              {isLoadingSoldiers ? (
                <div className="p-4 text-center text-sm text-slate-500 flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading soldiers...
                </div>
              ) : (
                <>
                  <CommandEmpty>No soldier found.</CommandEmpty>
                  <CommandGroup>
                    {soldiers.map((soldier) => (
                      <CommandItem
                        key={soldier.id}
                        value={`${soldier.first_name} ${soldier.last_name} ${soldier.soldier_id}`}
                        onSelect={() => {
                          setSelectedSoldierId(soldier.soldier_id);
                        }}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedSoldierId === soldier.soldier_id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span>
                          {soldier.first_name} {soldier.last_name} 
                          <span className="text-slate-500 ml-2">({soldier.soldier_id})</span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleLink} 
            disabled={!selectedSoldierId || isLoading}
          >
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Linking...</> : "Link Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}