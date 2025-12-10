
import React, { useState, useEffect, useMemo } from "react";
import { Soldier } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DroneSet } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, ChevronDown, ClipboardCheck, Target, Binoculars, Joystick } from "lucide-react";
import MaintenanceInspectionForm from "../components/maintenance/MaintenanceInspectionForm";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const [droneSets, setDroneSets] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("inspect-by-soldier");

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      const isAdmin = user?.role === 'admin';
      const isManager = user?.custom_role === 'manager';
      const isDivisionManager = user?.custom_role === 'division_manager';
      const userDivision = user?.division;

      // Build filter based on role hierarchy
      let filter = {};
      if (isAdmin || isManager) {
        filter = {}; // See everything
      } else if (isDivisionManager && userDivision) {
        filter = { division_name: userDivision }; // See division only
      } else if (userDivision) {
        filter = { division_name: userDivision }; // Fallback
      }

      const [soldiersData, weaponsData, gearData, dronesData] = await Promise.all([
        Soldier.filter(filter).catch(() => []),
        Weapon.filter(filter).catch(() => []),
        SerializedGear.filter(filter).catch(() => []),
        DroneSet.filter(filter).catch(() => [])
      ]);
      setSoldiers(Array.isArray(soldiersData) ? soldiersData : []);
      setWeapons(Array.isArray(weaponsData) ? weaponsData : []);
      setSerializedGear(Array.isArray(gearData) ? gearData : []);
      setDroneSets(Array.isArray(dronesData) ? dronesData : []);
    } catch (error) {
      setSoldiers([]);
      setWeapons([]);
      setSerializedGear([]);
      setDroneSets([]);
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
    for (const [weaponId, data] of Object.entries(inspectionResults.weapons)) {
        const weaponToUpdate = weapons.find(w => w.weapon_id === weaponId);
        if (weaponToUpdate) {
            const updateData = {
              status: data.status,
              last_checked_date: today
            };
            if (data.comments) {
              updateData.maintenance_comments = data.comments;
            }
            if (weaponToUpdate && weaponToUpdate.weapon_type) {
              updatePromises.push(Weapon.update({ where: { weapon_id: weaponId, weapon_type: weaponToUpdate.weapon_type } }, updateData));
            } else {
              updatePromises.push(Weapon.update(weaponId, updateData));
            }
        }
    }

    // Process gear updates
    for (const [gearId, data] of Object.entries(inspectionResults.gear)) {
        const gearToUpdate = serializedGear.find(g => g.gear_id === gearId);
        if (gearToUpdate) {
            const updateData = {
              status: data.status,
              last_checked_date: today
            };
            if (data.comments) {
              updateData.maintenance_comments = data.comments;
            }
            if (gearToUpdate && gearToUpdate.gear_type) {
              updatePromises.push(SerializedGear.update({ where: { gear_id: gearId, gear_type: gearToUpdate.gear_type } }, updateData));
            } else {
              updatePromises.push(SerializedGear.update(gearId, updateData));
            }
        }
    }

    // Process drone updates
    for (const [droneId, data] of Object.entries(inspectionResults.drones)) {
        const droneToUpdate = droneSets.find(d => d.id === droneId);
        if (droneToUpdate) {
            const updateData = {
              status: data.status,
              last_checked_date: today
            };
            if (data.comments) {
              updateData.maintenance_comments = data.comments;
            }
            if (droneToUpdate && droneToUpdate.drone_set_id && droneToUpdate.set_type) {
              updatePromises.push(DroneSet.update({ where: { drone_set_id: droneToUpdate.drone_set_id, set_type: droneToUpdate.set_type } }, updateData));
            } else {
              updatePromises.push(DroneSet.update(droneId, updateData));
            }
        }
    }

    try {
      await Promise.all(updatePromises);
      setShowSuccessDialog(true);
    } catch(error) {
      alert("An error occurred during submission. Please try again.");
    }
  };

  const handleSuccessDialogClose = () => {
    setShowSuccessDialog(false);
    if (activeTab === 'inspect-by-soldier') {
      // Keep soldier selected in bySoldier mode for quick re-inspection
      loadAllData(); // Refresh data but keep soldier selected
    } else {
      // Clear soldier in unassigned mode
      setSelectedSoldier(null);
      setSearchTerm('');
      loadAllData();
    }
  };

  const assignedWeapons = useMemo(() => {
    if (!selectedSoldier) return [];
    return weapons.filter(w => w.assigned_to === selectedSoldier.soldier_id);
  }, [selectedSoldier, weapons]);

  const assignedGear = useMemo(() => {
    if (!selectedSoldier) return [];
    return serializedGear.filter(g => g.assigned_to === selectedSoldier.soldier_id);
  }, [selectedSoldier, serializedGear]);

  const assignedDrones = useMemo(() => {
    if (!selectedSoldier) return [];
    return droneSets.filter(d => d.assigned_to === selectedSoldier.soldier_id);
  }, [selectedSoldier, droneSets]);

  const unassignedWeapons = useMemo(() => {
    return weapons.filter(w => !w.assigned_to || w.assigned_to === '');
  }, [weapons]);

  const unassignedGear = useMemo(() => {
    return serializedGear.filter(g => !g.assigned_to || g.assigned_to === '');
  }, [serializedGear]);

  const unassignedDrones = useMemo(() => {
    return droneSets.filter(d => !d.assigned_to || d.assigned_to === '');
  }, [droneSets]);


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
        <p className="text-slate-600">Manage and inspect equipment maintenance.</p>
      </div>

      <Tabs defaultValue="inspect-by-soldier" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="inspect-by-soldier">Inspect by Soldier</TabsTrigger>
          <TabsTrigger value="inspect-unassigned">Inspect Unassigned</TabsTrigger>
        </TabsList>

        <TabsContent value="inspect-by-soldier" className="space-y-6">
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
              assignedDrones={assignedDrones}
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
        </TabsContent>

        <TabsContent value="inspect-unassigned" className="space-y-6">
          {(unassignedWeapons.length > 0 || unassignedGear.length > 0 || unassignedDrones.length > 0) ? (
            <MaintenanceInspectionForm
              soldier={null}
              assignedWeapons={unassignedWeapons}
              assignedGear={unassignedGear}
              assignedDrones={unassignedDrones}
              onSubmit={handleSubmitInspection}
              onCancel={() => {}}
              isLoading={isLoading}
            />
          ) : (
            <Card className="border-slate-200 shadow-sm bg-slate-50">
              <CardContent className="p-8 text-center">
                <ClipboardCheck className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-slate-700">No Unassigned Equipment</h3>
                <p className="text-slate-600">All equipment is currently assigned to soldiers.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
