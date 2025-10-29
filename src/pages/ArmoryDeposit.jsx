
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Soldier } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DroneSet } from "@/api/entities";
import { ActivityLog } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Package, PackageOpen, User as UserIcon, ArchiveRestore } from "lucide-react";

import DepositReleaseDialog from "../components/armory/DepositReleaseDialog";
import UnassignedDepositTab from "../components/armory/UnassignedDepositTab";
import UnassignedReleaseTab from "../components/armory/UnassignedReleaseTab";

export default function ArmoryDepositPage() { // Renamed from ArmoryDeposit
  const [soldiers, setSoldiers] = useState([]);
  const [weapons, setWeapons] = useState([]);
  const [gear, setGear] = useState([]);
  const [droneSets, setDroneSets] = useState([]);
  const [unassignedToDeposit, setUnassignedToDeposit] = useState({ weapons: [], gear: [], droneSets: [] });
  const [unassignedInDeposit, setUnassignedInDeposit] = useState({ weapons: [], gear: [], droneSets: [] });
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("deposit");
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null); // Added currentUser state

  useEffect(() => {
    loadData();
    loadCurrentUser(); // Load current user on mount
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUserData = await User.me(); // Fetch current user again to ensure permissions for data loading
      const isAdmin = currentUserData?.role === 'admin';
      const isManager = currentUserData?.custom_role === 'manager';
      const isDivisionManager = currentUserData?.custom_role === 'division_manager';
      const isTeamLeader = currentUserData?.custom_role === 'team_leader';
      const userDivision = currentUserData?.division;
      const userTeam = currentUserData?.team;

      // Team leaders need special two-step filtering
      if (isTeamLeader && userDivision && userTeam) {
        console.log('Team leader: Using two-step filtering approach for armory deposit');

        // Step 1: Get team soldiers
        const teamSoldiers = await Soldier.filter({
          division_name: userDivision,
          team_name: userTeam
        });

        const soldierIds = teamSoldiers.map(s => s.soldier_id);
        console.log(`Team leader: Found ${soldierIds.length} team soldiers`);

        // Step 2: Get all division items, then filter client-side
        const divisionFilter = { division_name: userDivision };
        const withSoldierFilter = { ...divisionFilter, armory_status: 'with_soldier' };
        const inDepositFilter = { ...divisionFilter, armory_status: 'in_deposit' };

        const [
          allWeapons, allGear, allDrones,
          withSoldierWeapons, withSoldierGear, withSoldierDrones,
          inDepositWeapons, inDepositGear, inDepositDrones
        ] = await Promise.all([
          Weapon.filter(divisionFilter),
          SerializedGear.filter(divisionFilter),
          DroneSet.filter(divisionFilter),
          Weapon.filter(withSoldierFilter),
          SerializedGear.filter(withSoldierFilter),
          DroneSet.filter(withSoldierFilter),
          Weapon.filter(inDepositFilter),
          SerializedGear.filter(inDepositFilter),
          DroneSet.filter(inDepositFilter),
        ]);

        // Filter for unassigned items (null or empty string) and exclude samples
        const isUnassigned = (item) => (!item.assigned_to || item.assigned_to === null || item.assigned_to === '') && item.is_sample !== true && item.is_sample !== 'true';
        const unassignedToDepositWeapons = withSoldierWeapons.filter(isUnassigned);
        const unassignedToDepositGear = withSoldierGear.filter(isUnassigned);
        const unassignedToDepositDrones = withSoldierDrones.filter(isUnassigned);
        const unassignedInDepositWeapons = inDepositWeapons.filter(isUnassigned);
        const unassignedInDepositGear = inDepositGear.filter(isUnassigned);
        const unassignedInDepositDrones = inDepositDrones.filter(isUnassigned);

        const soldierIdSet = new Set(soldierIds);
        const weaponsData = allWeapons.filter(w => w.assigned_to && soldierIdSet.has(w.assigned_to));
        const gearData = allGear.filter(g => g.assigned_to && soldierIdSet.has(g.assigned_to));
        const droneSetsData = allDrones.filter(d => d.assigned_to && soldierIdSet.has(d.assigned_to));

        console.log(`Team leader: After filtering, ${weaponsData.length} weapons, ${gearData.length} gear, ${droneSetsData.length} drones assigned to team`);

        setSoldiers(Array.isArray(teamSoldiers) ? teamSoldiers : []);
        setWeapons(Array.isArray(weaponsData) ? weaponsData : []);
        setGear(Array.isArray(gearData) ? gearData : []);
        setDroneSets(Array.isArray(droneSetsData) ? droneSetsData : []);
        setUnassignedToDeposit({
            weapons: Array.isArray(unassignedToDepositWeapons) ? unassignedToDepositWeapons : [],
            gear: Array.isArray(unassignedToDepositGear) ? unassignedToDepositGear : [],
            droneSets: Array.isArray(unassignedToDepositDrones) ? unassignedToDepositDrones : [],
        });
        setUnassignedInDeposit({
            weapons: Array.isArray(unassignedInDepositWeapons) ? unassignedInDepositWeapons : [],
            gear: Array.isArray(unassignedInDepositGear) ? unassignedInDepositGear : [],
            droneSets: Array.isArray(unassignedInDepositDrones) ? unassignedInDepositDrones : [],
        });
      } else {
        // Non-team-leader roles: standard filtering
        let filter = {};
        if (isAdmin || isManager) {
          filter = {}; // See everything
        } else if (isDivisionManager && userDivision) {
          filter = { division_name: userDivision }; // See division only
        } else if (userDivision) {
          filter = { division_name: userDivision }; // Fallback
        }
        const withSoldierFilter = { ...filter, armory_status: 'with_soldier' };
        const inDepositFilter = { ...filter, armory_status: 'in_deposit' };

        const [
          soldiersData, weaponsData, gearData, droneSetsData,
          withSoldierWeapons, withSoldierGear, withSoldierDrones,
          inDepositWeapons, inDepositGear, inDepositDrones
        ] = await Promise.all([
          Soldier.filter(filter),
          Weapon.filter(filter),
          SerializedGear.filter(filter),
          DroneSet.filter(filter),
          Weapon.filter(withSoldierFilter),
          SerializedGear.filter(withSoldierFilter),
          DroneSet.filter(withSoldierFilter),
          Weapon.filter(inDepositFilter),
          SerializedGear.filter(inDepositFilter),
          DroneSet.filter(inDepositFilter),
        ]);

        // Filter for unassigned items (null or empty string) and exclude samples
        const isUnassigned = (item) => (!item.assigned_to || item.assigned_to === null || item.assigned_to === '') && item.is_sample !== true && item.is_sample !== 'true';
        const unassignedToDepositWeapons = withSoldierWeapons.filter(isUnassigned);
        const unassignedToDepositGear = withSoldierGear.filter(isUnassigned);
        const unassignedToDepositDrones = withSoldierDrones.filter(isUnassigned);
        const unassignedInDepositWeapons = inDepositWeapons.filter(isUnassigned);
        const unassignedInDepositGear = inDepositGear.filter(isUnassigned);
        const unassignedInDepositDrones = inDepositDrones.filter(isUnassigned);

        setSoldiers(Array.isArray(soldiersData) ? soldiersData : []);
        setWeapons(Array.isArray(weaponsData) ? weaponsData : []);
        setGear(Array.isArray(gearData) ? gearData : []);
        setDroneSets(Array.isArray(droneSetsData) ? droneSetsData : []);
        setUnassignedToDeposit({
            weapons: Array.isArray(unassignedToDepositWeapons) ? unassignedToDepositWeapons : [],
            gear: Array.isArray(unassignedToDepositGear) ? unassignedToDepositGear : [],
            droneSets: Array.isArray(unassignedToDepositDrones) ? unassignedToDepositDrones : [],
        });
        setUnassignedInDeposit({
            weapons: Array.isArray(unassignedInDepositWeapons) ? unassignedInDepositWeapons : [],
            gear: Array.isArray(unassignedInDepositGear) ? unassignedInDepositGear : [],
            droneSets: Array.isArray(unassignedInDepositDrones) ? unassignedInDepositDrones : [],
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setSoldiers([]);
      setWeapons([]);
      setGear([]);
      setDroneSets([]);
      setUnassignedToDeposit({ weapons: [], gear: [], droneSets: [] });
      setUnassignedInDeposit({ weapons: [], gear: [], droneSets: [] });
    }
    setIsLoading(false);
  };

  const handleDepositClick = (soldier) => {
    // Permission checks added
    if (activeTab === 'deposit' && !currentUser?.permissions?.can_deposit_equipment && currentUser?.role !== 'admin') {
      alert("You do not have permission to deposit equipment.");
      return;
    }
    if (activeTab === 'release' && !currentUser?.permissions?.can_release_equipment && currentUser?.role !== 'admin') {
      alert("You do not have permission to release equipment.");
      return;
    }
    setSelectedSoldier(soldier);
    setShowDepositDialog(true);
  };

  // Renamed from handleDepositRelease to handleFinalize as per outline, and adapted parameters
  // Preserved original signature to match DepositReleaseDialog's call, and applied logging changes
  const handleFinalize = async ({ soldier, weaponIds, gearIds, droneSetIds, signature, action: mode, depositLocation }) => {
    try {
      const currentUser = await User.me();
      const armoryStatus = mode === 'deposit' ? 'in_deposit' : 'with_soldier';

      const updatePromises = [];

      // Update weapons
      for (const weaponId of weaponIds) {
        const updatePayload = { armory_status: armoryStatus };
        if (mode === 'deposit' && depositLocation) {
          updatePayload.deposit_location = depositLocation;
        } else if (mode === 'release') {
          updatePayload.deposit_location = null; // Clear deposit location on release
        }
        updatePromises.push(Weapon.update(weaponId, updatePayload));
      }

      // Update gear
      for (const gearId of gearIds) {
        const updatePayload = { armory_status: armoryStatus };
        if (mode === 'deposit' && depositLocation) {
          updatePayload.deposit_location = depositLocation;
        } else if (mode === 'release') {
          updatePayload.deposit_location = null; // Clear deposit location on release
        }
        updatePromises.push(SerializedGear.update(gearId, updatePayload));
      }

      // Update drone sets
      for (const droneSetId of droneSetIds) {
        const updatePayload = { armory_status: armoryStatus };
        if (mode === 'deposit' && depositLocation) {
          updatePayload.deposit_location = depositLocation;
        } else if (mode === 'release') {
          updatePayload.deposit_location = null; // Clear deposit location on release
        }
        updatePromises.push(DroneSet.update(droneSetId, updatePayload));
      }

      await Promise.all(updatePromises);
      
      const totalItemsCount = weaponIds.length + gearIds.length + droneSetIds.length;
      const actionText = mode === 'deposit' ? 'Deposited' : 'Released';
      
      let locationText = '';
      if (mode === 'deposit' && depositLocation) {
        locationText = ` to ${depositLocation === 'division_deposit' ? 'Division Deposit' : 'Central Armory Deposit'}`;
      }

      if (totalItemsCount > 0) {
        await ActivityLog.create({
          activity_type: mode === 'deposit' ? "DEPOSIT" : "RELEASE", 
          entity_type: "Armory", // Changed from "Equipment" to "Armory" as per outline
          details: `${actionText} ${totalItemsCount} item(s) for soldier ${soldier.first_name} ${soldier.last_name} (${soldier.soldier_id})${locationText}.`, // Include location in details
          user_full_name: currentUser?.full_name || 'System',
          context: { // Added context as per outline
              soldierId: soldier.soldier_id,
              itemIds: [...weaponIds, ...gearIds, ...droneSetIds],
              depositLocation: depositLocation // Include deposit location in context
          },
          division_name: soldier.division_name // Added division_name as per outline
        });
      }

      setShowDepositDialog(false);
      setSelectedSoldier(null);
      await loadData();
    } catch (error) {
      console.error("Error processing deposit/release:", error);
    }
  };

  const handleDepositUnassigned = async ({ weaponIds, gearIds, droneSetIds, signature, depositLocation }) => {
    try {
      const currentUser = await User.me();
      const updatePayload = { armory_status: 'in_deposit', assigned_to: null, deposit_location: depositLocation };

      for (const weaponId of weaponIds) {
        await Weapon.update(weaponId, updatePayload);
      }
      for (const gearId of gearIds) {
        await SerializedGear.update(gearId, updatePayload);
      }
      for (const droneSetId of droneSetIds) {
        await DroneSet.update(droneSetId, updatePayload);
      }

      const actionItems = [];
      if (weaponIds.length > 0) actionItems.push(`${weaponIds.length} weapon(s)`);
      if (gearIds.length > 0) actionItems.push(`${gearIds.length} gear item(s)`);
      if (droneSetIds.length > 0) actionItems.push(`${droneSetIds.length} drone set(s)`);

      const locationText = depositLocation === 'division_deposit' ? 'Division Deposit' : 'Central Armory Deposit';

      if (actionItems.length > 0) {
          await ActivityLog.create({
              activity_type: "DEPOSIT",
              entity_type: "Armory",
              details: `Deposited unassigned items to ${locationText}: ${actionItems.join(', ')}. Signature: ${signature}`,
              user_full_name: currentUser?.full_name || 'System'
          });
      }

      await loadData();
    } catch (error) {
        console.error("Error depositing unassigned items:", error);
    }
  };

  const handleReleaseUnassigned = async ({ weaponIds, gearIds, droneSetIds, signature }) => {
    try {
      const currentUser = await User.me();
      const updatePayload = { armory_status: 'with_soldier', assigned_to: null, deposit_location: null };

      for (const weaponId of weaponIds) {
        await Weapon.update(weaponId, updatePayload);
      }
      for (const gearId of gearIds) {
        await SerializedGear.update(gearId, updatePayload);
      }
      for (const droneSetId of droneSetIds) {
        await DroneSet.update(droneSetId, updatePayload);
      }

      const actionItems = [];
      if (weaponIds.length > 0) actionItems.push(`${weaponIds.length} weapon(s)`);
      if (gearIds.length > 0) actionItems.push(`${gearIds.length} gear item(s)`);
      if (droneSetIds.length > 0) actionItems.push(`${droneSetIds.length} drone set(s)`);

      if (actionItems.length > 0) {
          await ActivityLog.create({
              activity_type: "RELEASE",
              entity_type: "Armory",
              details: `Released unassigned items from deposit: ${actionItems.join(', ')}. Signature: ${signature}`,
              user_full_name: currentUser?.full_name || 'System'
          });
      }

      await loadData();
    } catch (error) {
        console.error("Error releasing unassigned items:", error);
    }
  };

  const filterSoldiersByStatus = useCallback((status) => {
    const soldierIdsWithMatchingItems = new Set();
    const allItems = [...weapons, ...gear, ...droneSets];

    allItems.forEach(item => {
      // Check if item is assigned and its armory_status matches the desired status
      // Default to 'with_soldier' if armory_status is not explicitly set
      if (item.assigned_to && (item.armory_status || 'with_soldier') === status) {
        soldierIdsWithMatchingItems.add(item.assigned_to);
      }
    });

    const searchLower = searchTerm.toLowerCase();
    
    return soldiers.filter(s => {
      const matchesId = soldierIdsWithMatchingItems.has(s.soldier_id);
      if (!matchesId) return false;

      const soldierHasMatchingItemSerial = 
        weapons.some(w => w.assigned_to === s.soldier_id && w.weapon_id?.toLowerCase().includes(searchLower)) ||
        gear.some(g => g.assigned_to === s.soldier_id && g.gear_id?.toLowerCase().includes(searchLower)) ||
        droneSets.some(ds => ds.assigned_to === s.soldier_id && ds.set_serial_number?.toLowerCase().includes(searchLower));

      const matchesSearch = !searchTerm || 
        s.first_name?.toLowerCase().includes(searchLower) ||
        s.last_name?.toLowerCase().includes(searchLower) ||
        s.soldier_id?.toLowerCase().includes(searchLower) ||
        soldierHasMatchingItemSerial;

      return matchesId && matchesSearch;
    });
  }, [soldiers, weapons, gear, droneSets, searchTerm]);

  const soldiersForDeposit = useMemo(() => filterSoldiersByStatus('with_soldier'), [filterSoldiersByStatus]);
  // Changed 'in_armory' to 'in_deposit'
  const soldiersForRelease = useMemo(() => filterSoldiersByStatus('in_deposit'), [filterSoldiersByStatus]);


  return (
    <div className="p-6 space-y-6">
      <DepositReleaseDialog
        open={showDepositDialog}
        onOpenChange={setShowDepositDialog}
        soldier={selectedSoldier}
        weapons={weapons}       // Pass all weapons
        gear={gear}             // Pass all gear
        droneSets={droneSets}   // Pass all droneSets
        onSubmit={handleFinalize} // Keep onSubmit call as handleFinalize, as signature was preserved
        mode={activeTab}        // Pass activeTab as 'mode'
      />
      
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Armory Deposit & Release</h1>
        <p className="text-slate-600">Manage the flow of equipment in and out of the armory</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          placeholder="Search soldier or item serial..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="deposit" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">
            <Package className="w-4 h-4 mr-2"/>
            Deposit into Armory
          </TabsTrigger>
          <TabsTrigger value="release" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
            <PackageOpen className="w-4 h-4 mr-2"/>
            Release from Armory
          </TabsTrigger>
          <TabsTrigger value="unassigned" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700">
            <ArchiveRestore className="w-4 h-4 mr-2"/>
            Deposit Unassigned
          </TabsTrigger>
          <TabsTrigger value="release-unassigned" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
            <PackageOpen className="w-4 h-4 mr-2"/>
            Release Unassigned
          </TabsTrigger>
        </TabsList>
        <TabsContent value="deposit">
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-blue-900">
                <Package className="w-6 h-6"/>
                <div>
                  Deposit Equipment
                  <p className="text-sm font-normal text-slate-600 mt-1">Select a soldier to deposit their assigned equipment into the armory.</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center py-8 text-slate-500">Loading soldiers...</p>
              ) : soldiersForDeposit.length === 0 ? (
                <p className="text-center py-8 text-slate-500">No soldiers found with equipment to deposit.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {soldiersForDeposit.map(soldier => (
                    <Card key={soldier.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-medium">{soldier.first_name} {soldier.last_name}</CardTitle>
                        <UserIcon className="w-4 h-4 text-slate-500" />
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-slate-600">ID: {soldier.soldier_id}</p>
                        <Badge variant="outline">{soldier.division_name || 'N/A'}</Badge>
                        <Button 
                          onClick={() => handleDepositClick(soldier)} 
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          // Disable button based on permissions
                          disabled={!currentUser?.permissions?.can_deposit_equipment && currentUser?.role !== 'admin'}
                        >
                          Select for Deposit
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="release">
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-green-900">
                <PackageOpen className="w-6 h-6"/>
                 <div>
                  Release Equipment
                  <p className="text-sm font-normal text-slate-600 mt-1">Select a soldier to release their deposited equipment back to them.</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center py-8 text-slate-500">Loading soldiers...</p>
              ) : soldiersForRelease.length === 0 ? (
                <p className="text-center py-8 text-slate-500">No soldiers found with equipment in armory to release.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {soldiersForRelease.map(soldier => (
                    <Card key={soldier.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-medium">{soldier.first_name} {soldier.last_name}</CardTitle>
                        <UserIcon className="w-4 h-4 text-slate-500" />
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-slate-600">ID: {soldier.soldier_id}</p>
                        <Badge variant="outline">{soldier.division_name || 'N/A'}</Badge>
                        <Button 
                          onClick={() => handleDepositClick(soldier)} 
                          className="w-full bg-green-600 hover:bg-green-700"
                          // Disable button based on permissions
                          disabled={!currentUser?.permissions?.can_release_equipment && currentUser?.role !== 'admin'}
                        >
                          Select for Release
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="unassigned">
          <UnassignedDepositTab
            items={unassignedToDeposit}
            isLoading={isLoading}
            onSubmit={handleDepositUnassigned}
            onRefresh={loadData}
          />
        </TabsContent>
        <TabsContent value="release-unassigned">
          <UnassignedReleaseTab
            items={unassignedInDeposit}
            isLoading={isLoading}
            onSubmit={handleReleaseUnassigned}
            onRefresh={loadData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
