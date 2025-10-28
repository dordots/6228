
import React, { useState, useEffect, useCallback } from "react";
import { Soldier } from "@/api/entities";
import { Equipment } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { DroneSet } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { ActivityLog } from "@/api/entities";
import { User } from "@/api/entities";
import { DailyVerification } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wrench, Target, AlertTriangle, CheckCircle, Clock, Package, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ComboBox from "../components/common/ComboBox";


import StatsCard from "../components/dashboard/StatsCard";
import RecentActivity from "../components/dashboard/RecentActivity";
import StatusOverview from "../components/dashboard/StatusOverview";
import WeaponsSummary from "../components/dashboard/WeaponsSummary";
import GearSummary from "../components/dashboard/GearSummary";
import DronesSummary from "../components/dashboard/DronesSummary";
import VerificationSummary from "../components/dashboard/VerificationSummary";
import EquipmentSummary from "../components/dashboard/EquipmentSummary"; // Added import

export default function Dashboard() {
  const [soldiers, setSoldiers] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [weapons, setWeapons] = useState([]);
  const [gear, setGear] = useState([]);
  const [drones, setDrones] = useState([]);
  const [activities, setActivities] = useState([]);
  const [dailyVerifications, setDailyVerifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userDivision, setUserDivision] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState("all");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);
      const isAdmin = user?.role === 'admin';
      const isManager = user?.custom_role === 'manager';
      const isDivisionManager = user?.custom_role === 'division_manager';
      const isTeamLeader = user?.custom_role === 'team_leader';
      const userDivisionName = user?.division;
      const userTeamName = user?.team;

      setUserDivision(userDivisionName);

      // Team leaders need special handling - fetch division data, then filter client-side
      if (isTeamLeader && userDivisionName && userTeamName) {
        console.log('Team leader loading: First fetching team soldiers...', 'Division:', userDivisionName, 'Team:', userTeamName);

        // Step 1: Get all soldiers in the team
        const teamSoldiers = await Soldier.filter({
          division_name: userDivisionName,
          team_name: userTeamName
        });

        const soldierIds = teamSoldiers.map(s => s.soldier_id);
        console.log('Team leader loading: Found', soldierIds.length, 'team soldiers:', soldierIds);

        // Step 2: Fetch ALL division equipment/weapons/gear/drones (allowed by division scope)
        // Then filter client-side by assigned_to matching team soldier IDs
        const divisionFilter = { division_name: userDivisionName };

        const today = new Date().toISOString().split('T')[0];
        const verificationFilter = {
          verification_date: today,
          division_name: userDivisionName,
          team_name: userTeamName
        };

        console.log('Team leader loading: Fetching all division equipment/weapons/gear/drones, will filter client-side...');

        // Fetch all division equipment/weapons/gear/drones
        const [
          equipmentResult,
          weaponsResult,
          gearResult,
          dronesResult,
          activityLogResult,
          verificationsResult,
        ] = await Promise.allSettled([
          Equipment.filter(divisionFilter),
          Weapon.filter(divisionFilter),
          SerializedGear.filter(divisionFilter),
          DroneSet.filter(divisionFilter),
          ActivityLog.filter({ division_name: userDivisionName, team_name: userTeamName }, "-created_date", 50),
          DailyVerification.filter(verificationFilter),
        ]);

        // Step 3: Client-side filter - only keep items assigned to team soldiers
        const soldierIdSet = new Set(soldierIds);

        const allEquipment = equipmentResult.status === 'fulfilled' && Array.isArray(equipmentResult.value) ? equipmentResult.value : [];
        const allWeapons = weaponsResult.status === 'fulfilled' && Array.isArray(weaponsResult.value) ? weaponsResult.value : [];
        const allGear = gearResult.status === 'fulfilled' && Array.isArray(gearResult.value) ? gearResult.value : [];
        const allDrones = dronesResult.status === 'fulfilled' && Array.isArray(dronesResult.value) ? dronesResult.value : [];

        const equipmentData = allEquipment.filter(e => e.assigned_to && soldierIdSet.has(e.assigned_to));
        const weaponsData = allWeapons.filter(w => w.assigned_to && soldierIdSet.has(w.assigned_to));
        const gearData = allGear.filter(g => g.assigned_to && soldierIdSet.has(g.assigned_to));
        const dronesData = allDrones.filter(d => d.assigned_to && soldierIdSet.has(d.assigned_to));

        const activitiesData = activityLogResult.status === 'fulfilled' && Array.isArray(activityLogResult.value) ? activityLogResult.value : [];
        const verificationsData = verificationsResult.status === 'fulfilled' && Array.isArray(verificationsResult.value) ? verificationsResult.value : [];

        // Set results
        setSoldiers(teamSoldiers);
        setEquipment(equipmentData);
        setWeapons(weaponsData);
        setGear(gearData);
        setDrones(dronesData);
        setActivities(activitiesData);
        setDailyVerifications(verificationsData);

        console.log('Team leader data loaded (after client-side filtering):', {
          soldiers: teamSoldiers.length,
          equipment: `${equipmentData.length} of ${allEquipment.length}`,
          weapons: `${weaponsData.length} of ${allWeapons.length}`,
          gear: `${gearData.length} of ${allGear.length}`,
          drones: `${dronesData.length} of ${allDrones.length}`,
          activities: activitiesData.length,
          verifications: verificationsData.length,
        });
      } else {
        // Non-team-leader roles: use standard filtering
        let filter = {};
        if (isAdmin || isManager) {
          // For admins and managers, apply division filter if selected
          if (selectedDivisionFilter !== "all") {
            filter = { division_name: selectedDivisionFilter };
          }
          // Otherwise show all divisions (empty filter)
        } else if (isDivisionManager && userDivisionName) {
          // Division managers see only their division
          filter = { division_name: userDivisionName };
        } else if (userDivisionName) {
          // Fallback: filter by division
          filter = { division_name: userDivisionName };
        }

        const today = new Date().toISOString().split('T')[0];
        const verificationFilter = { verification_date: today, ...filter };

        console.log('Dashboard filter applied:', filter, 'User:', user?.full_name, 'Division:', userDivisionName, 'Team:', userTeamName, 'Role:', user?.custom_role, 'Selected Division Filter:', selectedDivisionFilter);

        const [
          soldiersResult,
          equipmentResult,
          weaponsResult,
          gearResult,
          dronesResult,
          activityLogResult,
          verificationsResult,
        ] = await Promise.allSettled([
          Soldier.filter(filter),
          Equipment.filter(filter),
          Weapon.filter(filter),
          SerializedGear.filter(filter),
          DroneSet.filter(filter),
          ActivityLog.filter(filter, "-created_date", 50),
          DailyVerification.filter(verificationFilter),
        ]);

        const soldiersData = soldiersResult.status === 'fulfilled' && Array.isArray(soldiersResult.value) ? soldiersResult.value : [];
        const equipmentData = equipmentResult.status === 'fulfilled' && Array.isArray(equipmentResult.value) ? equipmentResult.value : [];
        const weaponsData = weaponsResult.status === 'fulfilled' && Array.isArray(weaponsResult.value) ? weaponsResult.value : [];
        const gearData = gearResult.status === 'fulfilled' && Array.isArray(gearResult.value) ? gearResult.value : [];
        const dronesData = dronesResult.status === 'fulfilled' && Array.isArray(dronesResult.value) ? dronesResult.value : [];
        const activitiesData = activityLogResult.status === 'fulfilled' && Array.isArray(activityLogResult.value) ? activityLogResult.value : [];
        const verificationsData = verificationsResult.status === 'fulfilled' && Array.isArray(verificationsResult.value) ? verificationsResult.value : [];

        setSoldiers(soldiersData);
        setEquipment(equipmentData);
        setWeapons(weaponsData);
        setGear(gearData);
        setDrones(dronesData);
        setActivities(activitiesData);
        setDailyVerifications(verificationsData);

        console.log('Dashboard data loaded:', {
          soldiers: soldiersData.length,
          equipment: equipmentData.length,
          weapons: weaponsData.length,
          gear: gearData.length,
          drones: dronesData.length,
          activities: activitiesData.length,
          verifications: verificationsData.length,
        });
      }

    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setSoldiers([]);
      setEquipment([]);
      setWeapons([]);
      setGear([]);
      setDrones([]);
      setActivities([]);
      setDailyVerifications([]);
    }
    setIsLoading(false);
  }, [selectedDivisionFilter]); // selectedDivisionFilter is a dependency for loadData

  useEffect(() => {
    loadData();
  }, [loadData]); // loadData is a dependency now, ensuring it runs when selectedDivisionFilter changes via useCallback

  const getEquipmentStats = () => {
    const safeEquipment = Array.isArray(equipment) ? equipment : [];
    const assigned = safeEquipment.filter(e => e && e.assigned_to).length;
    const unassigned = safeEquipment.length - assigned;
    // Updated condition as per outline: 'not_functioning'
    const needsRepair = safeEquipment.filter(e => e && e.condition === 'not_functioning').length; 
    
    return { assigned, unassigned, needsRepair };
  };

  const getWeaponStats = () => {
    const safeWeapons = Array.isArray(weapons) ? weapons : [];
    const assigned = safeWeapons.filter(w => w && w.assigned_to).length;
    const unassigned = safeWeapons.length - assigned;
    const notFunctioning = safeWeapons.filter(w => w && w.status === 'not_functioning').length;
    const inDeposit = safeWeapons.filter(w => w && w.armory_status === 'in_deposit').length;
    
    return { assigned, unassigned, notFunctioning, inDeposit };
  };

  const getGearStats = () => {
    const safeGear = Array.isArray(gear) ? gear : [];
    const assigned = safeGear.filter(g => g && g.assigned_to).length;
    const unassigned = safeGear.length - assigned;
    const notFunctioning = safeGear.filter(g => g && g.status === 'not_functioning').length;
    const inDeposit = safeGear.filter(g => g && g.armory_status === 'in_deposit').length;
    
    return { assigned, unassigned, notFunctioning, inDeposit };
  };

  const getDroneStats = () => {
    const safeDrones = Array.isArray(drones) ? drones : [];
    const assigned = safeDrones.filter(d => d && d.assigned_to).length;
    const unassigned = safeDrones.length - assigned;
    const needMaintenance = safeDrones.filter(d => d && d.status !== 'Operational').length;
    const inDeposit = safeDrones.filter(d => d && d.armory_status === 'in_deposit').length;
    
    return { assigned, unassigned, needMaintenance, inDeposit };
  };

  const getVerificationStats = () => {
    const soldiersToVerify = Array.isArray(soldiers) ? soldiers.filter(s => s.enlistment_status === 'arrived') : [];
    const verifiedSoldierIds = new Set(dailyVerifications.map(v => v.soldier_id));
    const verifiedCount = soldiersToVerify.filter(s => verifiedSoldierIds.has(s.soldier_id)).length;
    
    return {
      verifiedCount,
      totalToVerify: soldiersToVerify.length
    };
  };

  const availableDivisions = React.useMemo(() => {
    // Only show division filter if user is admin or manager AND there are divisions to filter by
    if (!currentUser || (!currentUser.role === 'admin' && currentUser.custom_role !== 'manager')) {
      return [];
    }
    
    const divisions = new Set();
    soldiers.forEach(soldier => {
      if (soldier && soldier.division_name) {
        divisions.add(soldier.division_name);
      }
    });
    
    return Array.from(divisions).sort();
  }, [soldiers, currentUser]); // currentUser is a dependency now, as it determines filter availability

  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.custom_role === 'manager' || currentUser?.custom_role === 'division_manager';

  const divisionOptionsForFilter = [
    { value: "all", label: "All Divisions" },
    ...availableDivisions.map(div => ({ value: div, label: div }))
  ];
  
  const equipmentStats = getEquipmentStats();
  const weaponStats = getWeaponStats();
  const gearStats = getGearStats();
  const droneStats = getDroneStats();
  const verificationStats = getVerificationStats();
  const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
  const safeEquipment = Array.isArray(equipment) ? equipment : [];
  const safeWeapons = Array.isArray(weapons) ? weapons : [];

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-8">
      <div className="mb-4 md:mb-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-slate-900 mb-1 md:mb-2">
              {selectedDivisionFilter !== "all" ? `${selectedDivisionFilter} Division Dashboard` :
               currentUser?.custom_role === 'team_leader' ? 'Team Dashboard' :
               userDivision && !isManagerOrAdmin ? `${userDivision} Division Dashboard` : 'Command Dashboard'}
            </h1>
            <p className="text-sm md:text-base text-slate-600">
              {selectedDivisionFilter !== "all" ? `Overview of ${selectedDivisionFilter} division equipment and personnel status` :
               currentUser?.custom_role === 'team_leader' ? 'Overview of your team equipment and personnel status' :
               userDivision && !isManagerOrAdmin ? `Overview of ${userDivision} division equipment and personnel status` :
               'Overview of company equipment and personnel status'}
            </p>
          </div>
          
          {isManagerOrAdmin && availableDivisions.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <div className="w-48">
                <ComboBox
                  options={divisionOptionsForFilter}
                  value={selectedDivisionFilter}
                  onSelect={(val) => setSelectedDivisionFilter(val || 'all')}
                  placeholder="Filter by Division"
                  searchPlaceholder="Search divisions..."
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6">
        <StatsCard
          title="Total Personnel"
          value={safeSoldiers.length}
          icon={Users}
          color="blue"
          subtitle={`${safeSoldiers.length} total`}
          isLoading={isLoading}
        />
        <StatsCard
          title="Equipment Items"
          value={safeEquipment.length}
          icon={Wrench}
          color="green"
          subtitle={`${equipmentStats.assigned} assigned`}
          isLoading={isLoading}
        />
        <StatsCard
          title="Weapons"
          value={safeWeapons.length}
          icon={Target}
          color="red"
          subtitle={`${weaponStats.assigned} assigned`}
          isLoading={isLoading}
        />
        <StatsCard
          title="Items in Deposit"
          value={weaponStats.inDeposit + gearStats.inDeposit + droneStats.inDeposit}
          icon={Package}
          color="amber"
          subtitle="deposited"
          isLoading={isLoading}
        />
        <div className="col-span-2 md:col-span-1">
          <StatsCard
            title="Maintenance Alerts"
            value={equipmentStats.needsRepair + weaponStats.notFunctioning + gearStats.notFunctioning + droneStats.needMaintenance}
            icon={AlertTriangle}
            color="red"
            subtitle="requires attention"
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Adjusted grid for 4 columns on xl screens */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6">
        <EquipmentSummary equipment={equipment} isLoading={isLoading} />
        <WeaponsSummary weapons={weapons} isLoading={isLoading} />
        <GearSummary gear={gear} isLoading={isLoading} />
        <DronesSummary drones={drones} isLoading={isLoading} />
      </div>

      <div className={`grid grid-cols-1 ${currentUser?.custom_role === 'team_leader' ? '' : 'lg:grid-cols-3'} gap-4 md:gap-6`}>
        <div className={`${currentUser?.custom_role === 'team_leader' ? '' : 'lg:col-span-2'} space-y-4 md:space-y-6`}>
          <StatusOverview
            soldiers={safeSoldiers}
            equipment={safeEquipment}
            weapons={safeWeapons}
            isLoading={isLoading}
          />
           <RecentActivity
            activities={activities}
            isLoading={isLoading}
          />
        </div>
        {currentUser?.custom_role !== 'team_leader' && (
          <div className="space-y-4 md:space-y-6">
              <VerificationSummary
                  soldiers={soldiers}
                  dailyVerifications={dailyVerifications}
                  isLoading={isLoading}
                  userDivision={userDivision}
                  isManagerOrAdmin={isManagerOrAdmin}
              />
          </div>
        )}
      </div>
    </div>
  );
}
