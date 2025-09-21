
import React, { useState, useEffect, useMemo } from "react";
import { Soldier } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, ChevronDown, ClipboardCheck, Target, Binoculars } from "lucide-react";
import MaintenanceInspectionForm from "../components/maintenance/MaintenanceInspectionForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function MaintenancePage() {
  const [soldiers, setSoldiers] = useState([]);
  const [weapons, setWeapons] = useState([]);
  const [serializedGear, setSerializedGear] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [soldiersData, weaponsData, gearData] = await Promise.all([
        Soldier.list().catch(() => []),
        Weapon.list().catch(() => []),
        SerializedGear.list().catch(() => [])
      ]);
      setSoldiers(Array.isArray(soldiersData) ? soldiersData : []);
      setWeapons(Array.isArray(weaponsData) ? weaponsData : []);
      setSerializedGear(Array.isArray(gearData) ? gearData : []);
    } catch (error) {
      console.error("Error loading data:", error);
      setSoldiers([]);
      setWeapons([]);
      setSerializedGear([]);
    }
    setIsLoading(false);
  };

  const searchResults = useMemo(() => {
    if (searchTerm.length < 2) return [];
    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/).filter(Boolean);

    const soldierResults = (Array.isArray(soldiers) ? soldiers : [])
      .filter(s => {
        const searchableString = [s.first_name, s.last_name, s.soldier_id].join(' ').toLowerCase();
        return searchWords.every(word => searchableString.includes(word));
      })
      .map(s => ({
        id: `s-${s.id}`,
        type: 'soldier',
        display: `${s.first_name} ${s.last_name}`,
        subDisplay: `ID: ${s.soldier_id}`,
        soldier: s
      }));

    const weaponResults = (Array.isArray(weapons) ? weapons : [])
      .filter(w => w.weapon_id && w.weapon_id.toLowerCase().includes(searchLower) && w.assigned_to)
      .map(w => {
        const assignedSoldier = (Array.isArray(soldiers) ? soldiers : []).find(s => s.soldier_id === w.assigned_to);
        if (!assignedSoldier) return null;
        return {
          id: `w-${w.id}`,
          type: 'weapon',
          display: `Weapon ${w.weapon_type} (${w.weapon_id})`,
          subDisplay: `Assigned to ${assignedSoldier.first_name} ${assignedSoldier.last_name}`,
          soldier: assignedSoldier
        };
      })
      .filter(Boolean);

    const gearResults = (Array.isArray(serializedGear) ? serializedGear : [])
      .filter(g => g.gear_id && g.gear_id.toLowerCase().includes(searchLower) && g.assigned_to)
      .map(g => {
        const assignedSoldier = (Array.isArray(soldiers) ? soldiers : []).find(s => s.soldier_id === g.assigned_to);
        if (!assignedSoldier) return null;
        return {
          id: `g-${g.id}`,
          type: 'gear',
          display: `Gear ${g.gear_type} (${g.gear_id})`,
          subDisplay: `Assigned to ${assignedSoldier.first_name} ${assignedSoldier.last_name}`,
          soldier: assignedSoldier
        };
      })
      .filter(Boolean);

    return [...soldierResults, ...weaponResults, ...gearResults].slice(0, 15);
  }, [searchTerm, soldiers, weapons, serializedGear]);

  const selectSoldier = (soldier) => {
    setSelectedSoldier(soldier);
    setSearchTerm(soldier ? `${soldier.first_name} ${soldier.last_name}` : '');
    setSearchOpen(false);
  };
  
  const handleSubmitInspection = async (inspectionResults) => {
    const today = new Date().toISOString();
    const updatePromises = [];

    // Process weapon updates
    for (const [weaponId, newStatus] of Object.entries(inspectionResults.weapons)) {
        const weaponToUpdate = weapons.find(w => w.id === weaponId);
        if (weaponToUpdate) {
            updatePromises.push(
                Weapon.update(weaponId, { status: newStatus, last_checked_date: today })
            );
        }
    }

    // Process gear updates
    for (const [gearId, newStatus] of Object.entries(inspectionResults.gear)) {
        const gearToUpdate = serializedGear.find(g => g.id === gearId);
        if (gearToUpdate) {
            updatePromises.push(
                SerializedGear.update(gearId, { status: newStatus, last_checked_date: today })
            );
        }
    }

    try {
      await Promise.all(updatePromises);
      setShowSuccessDialog(true);
    } catch(error) {
      console.error("Failed to submit inspection:", error);
      alert("An error occurred during submission. Please try again.");
    }
  };

  const handleSuccessDialogClose = () => {
    setShowSuccessDialog(false);
    setSelectedSoldier(null);
    setSearchTerm('');
    loadAllData(); // Refresh data for next inspection
  };

  const assignedWeapons = useMemo(() => {
    if (!selectedSoldier) return [];
    return weapons.filter(w => w.assigned_to === selectedSoldier.soldier_id);
  }, [selectedSoldier, weapons]);

  const assignedGear = useMemo(() => {
    if (!selectedSoldier) return [];
    return serializedGear.filter(g => g.assigned_to === selectedSoldier.soldier_id);
  }, [selectedSoldier, serializedGear]);


  return (
    <div className="p-6 space-y-6">
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inspection Submitted Successfully</AlertDialogTitle>
            <AlertDialogDescription>
              The equipment statuses and last checked dates have been updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleSuccessDialogClose}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Maintenance Inspection</h1>
        <p className="text-slate-600">Search for a soldier, weapon, or gear to inspect assigned equipment.</p>
      </div>

      <Card className="border-slate-200 shadow-sm max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Search className="w-5 h-5" />
            Find Equipment or Soldier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search by name, ID, weapon ID, or gear ID..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setSearchOpen(e.target.value.length >= 2); }}
                  className="pl-9 pr-10"
                />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              </div>
            </PopoverTrigger>
            <PopoverContent 
              className="w-[--radix-popover-trigger-width] p-0"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <ScrollArea className="h-60">
                {searchResults.length > 0 ? (
                  searchResults.map(result => (
                    <div key={result.id} onClick={() => selectSoldier(result.soldier)} className="p-3 hover:bg-slate-100 cursor-pointer flex items-center gap-3">
                      {result.type === 'soldier' && <Users className="w-4 h-4 text-slate-500" />}
                      {result.type === 'weapon' && <Target className="w-4 h-4 text-slate-500" />}
                      {result.type === 'gear' && <Binoculars className="w-4 h-4 text-slate-500" />}
                      <div>
                        <p className="font-medium text-slate-900">{result.display}</p>
                        <p className="text-sm text-slate-600">{result.subDisplay}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-500">No results found.</div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {selectedSoldier ? (
        <MaintenanceInspectionForm
          key={selectedSoldier.id} // Re-mount component when soldier changes
          soldier={selectedSoldier}
          assignedWeapons={assignedWeapons}
          assignedGear={assignedGear}
          onSubmit={handleSubmitInspection}
          onCancel={() => {
            setSelectedSoldier(null);
            setSearchTerm('');
          }}
          isLoading={isLoading}
        />
      ) : (
        <Card className="border-slate-200 shadow-sm bg-slate-50">
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-slate-700">No Soldier Selected</h3>
            <p className="text-slate-600">Search and select an item to begin an inspection.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
