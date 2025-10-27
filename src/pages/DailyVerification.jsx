
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Soldier } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DailyVerification } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, ClipboardCheck, Users, Loader2, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import SoldierVerificationCard from "../components/verification/SoldierVerificationCard";
import ComboBox from "../components/common/ComboBox";

export default function DailyVerificationPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isManagerOrAdmin, setIsManagerOrAdmin] = useState(false);
  
  const [allDivisions, setAllDivisions] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState("");

  const [allSoldiers, setAllSoldiers] = useState([]);
  const [allWeapons, setAllWeapons] = useState([]);
  const [allGear, setAllGear] = useState([]);
  const [allVerifications, setAllVerifications] = useState([]);
  
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isLoading, setIsLoading] = useState(true);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      const hasPower = user?.role === 'admin' || user?.custom_role === 'manager' || user?.custom_role === 'division_manager';
      setIsManagerOrAdmin(hasPower);

      const divisionFilter = hasPower ? {} : { division_name: user.division };
      const verificationFilter = { 
        verification_date: today, 
        ...(hasPower ? {} : { division_name: user.division })
      };

      const [soldiersData, weaponsData, gearData, verificationsData] = await Promise.all([
        Soldier.filter({ ...divisionFilter, enlistment_status: 'arrived' }),
        Weapon.filter(divisionFilter),
        SerializedGear.filter(divisionFilter),
        DailyVerification.filter(verificationFilter)
      ]);

      const safeSoldiers = Array.isArray(soldiersData) ? soldiersData : [];
      setAllSoldiers(safeSoldiers);
      setAllWeapons(Array.isArray(weaponsData) ? weaponsData : []);
      setAllGear(Array.isArray(gearData) ? gearData : []);
      setAllVerifications(Array.isArray(verificationsData) ? verificationsData : []);
      
      if (hasPower) {
        const divisions = [...new Set(safeSoldiers.map(s => s.division_name).filter(Boolean))].sort();
        setAllDivisions(divisions);
        // Set initial division to user's own, or the first in the list
        if (user.division && divisions.includes(user.division)) {
          setSelectedDivision(user.division);
        } else if (divisions.length > 0) {
          setSelectedDivision(divisions[0]);
        } else {
          setSelectedDivision(""); // No divisions found
        }
      } else {
        setSelectedDivision(user.division);
      }

    } catch (error) {
      console.error("Error loading verification data:", error);
      setAllSoldiers([]);
      setAllWeapons([]);
      setAllGear([]);
      setAllVerifications([]);
    }
    setIsLoading(false);
  }, [today]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const { displayedSoldiers, displayedWeapons, displayedGear, displayedVerifications, teams } = useMemo(() => {
    if (!selectedDivision) return { displayedSoldiers: [], displayedWeapons: [], displayedGear: [], displayedVerifications: [], teams: [] };
    
    const soldiersInDivision = allSoldiers.filter(s => s.division_name === selectedDivision);
    const uniqueTeams = [...new Set(soldiersInDivision.map(s => s.team_name).filter(Boolean))].sort();

    return {
      displayedSoldiers: soldiersInDivision,
      displayedWeapons: allWeapons.filter(w => w.division_name === selectedDivision),
      displayedGear: allGear.filter(g => g.division_name === selectedDivision),
      displayedVerifications: allVerifications.filter(v => v.division_name === selectedDivision),
      teams: uniqueTeams,
    };
  }, [selectedDivision, allSoldiers, allWeapons, allGear, allVerifications]);

  const finalDisplayedSoldiers = useMemo(() => {
    return displayedSoldiers
      .filter(soldier => {
        const teamMatch = selectedTeam === 'all' || soldier.team_name === selectedTeam;
        const searchMatch = !searchTerm || 
          `${soldier.first_name} ${soldier.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          soldier.soldier_id.toLowerCase().includes(searchTerm.toLowerCase());
        return teamMatch && searchMatch;
      });
  }, [displayedSoldiers, selectedTeam, searchTerm]);


  const handleVerify = async (soldier) => {
    if (!currentUser || !soldier) return;

    try {
      await DailyVerification.create({
        soldier_id: soldier.soldier_id,
        soldier_name: `${soldier.first_name} ${soldier.last_name}`,
        verification_date: today,
        created_date: today,
        verified_by_user_id: currentUser.id,
        verified_by_user_name: currentUser.full_name,
        verified_by: currentUser.full_name,
        division_name: soldier.division_name,
        status: 'verified',
        weapons_checked: [],
        equipment_checked: [],
        gear_checked: [],
        drone_sets_checked: [],
        signature: null,
      });
      // Refresh all data to ensure UI is up-to-date
      await loadData();
    } catch (error) {
      console.error("Error creating verification:", error);
      alert("Failed to save verification. Please try again.");
    }
  };
  
  const handleUndoVerify = async (verificationId) => {
    if (!currentUser || !verificationId) return;

    try {
      await DailyVerification.delete(verificationId);
      // Refresh all data to ensure UI is up-to-date
      await loadData();
    } catch (error) {
      console.error("Error undoing verification:", error);
      alert("Failed to undo verification. Please try again.");
    }
  };
  
  const verifiedSoldierIds = useMemo(() => 
    new Set(displayedVerifications.map(v => v.soldier_id))
  , [displayedVerifications]);
  
  const verifiedCount = finalDisplayedSoldiers.filter(s => verifiedSoldierIds.has(s.soldier_id)).length;
  const verificationProgress = finalDisplayedSoldiers.length > 0 ? (verifiedCount / finalDisplayedSoldiers.length) * 100 : 0;
  
  const divisionOptions = allDivisions.map(div => ({ value: div, label: div }));
  const teamOptions = [
      { value: 'all', label: 'All Teams' },
      ...teams.map(team => ({ value: team, label: team }))
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!currentUser?.permissions?.can_perform_daily_verification && currentUser?.role !== 'admin') {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access denied. You do not have permission to perform daily verifications.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (!currentUser?.division && !isManagerOrAdmin) {
     return (
      <div className="p-6">
        <Alert>
          <Users className="h-4 w-4" />
          <AlertDescription>
            You are not assigned to a division. This page is for division commanders to verify their soldiers' equipment.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Daily Equipment Verification</h1>
        <p className="text-slate-600">
          Verify that each soldier in the <strong>{selectedDivision || "selected"}</strong> division has their assigned equipment for today, {new Date(today).toLocaleDateString()}.
        </p>
      </div>

      {isManagerOrAdmin && (
        <Card>
          <CardContent className="p-4">
            <Label htmlFor="division-selector" className="font-semibold text-slate-700">View Division</Label>
            <div className="mt-2">
                <ComboBox
                    options={divisionOptions}
                    value={selectedDivision}
                    onSelect={(val) => setSelectedDivision(val || '')}
                    placeholder="Select a division..."
                    searchPlaceholder="Search divisions..."
                />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="team-selector" className="font-semibold text-slate-700">Filter by Team</Label>
              <div className="mt-2">
                <ComboBox
                    options={teamOptions}
                    value={selectedTeam}
                    onSelect={(val) => setSelectedTeam(val || 'all')}
                    placeholder="Select a team..."
                    searchPlaceholder="Search teams..."
                />
              </div>
            </div>
            <div>
                <Label htmlFor="search-soldier" className="font-semibold text-slate-700">Search Soldier</Label>
                <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                        id="search-soldier"
                        placeholder="Search by name or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>
          </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verification Progress for {selectedDivision}{selectedTeam !== 'all' ? ` - ${selectedTeam}` : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={verificationProgress} className="w-full" />
            <span className="font-bold text-slate-700 whitespace-nowrap">
              {verifiedCount} / {finalDisplayedSoldiers.length} Verified
            </span>
          </div>
        </CardContent>
      </Card>
      
      {finalDisplayedSoldiers.length === 0 ? (
        <Card>
            <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-slate-700">No Soldiers to Verify</h3>
                <p className="text-slate-500">There are no soldiers marked as 'Arrived' in {selectedDivision || "this division"}{selectedTeam !== 'all' ? ` for team ${selectedTeam}` : ''} matching your criteria.</p>
            </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {finalDisplayedSoldiers.map(soldier => {
            const assignedWeapons = displayedWeapons.filter(w => w.assigned_to === soldier.soldier_id);
            const assignedGear = displayedGear.filter(g => g.assigned_to === soldier.soldier_id);
            const isVerified = verifiedSoldierIds.has(soldier.soldier_id);
            const verificationRecord = isVerified ? displayedVerifications.find(v => v.soldier_id === soldier.soldier_id) : null;

            return (
              <SoldierVerificationCard
                key={soldier.id}
                soldier={soldier}
                assignedWeapons={assignedWeapons}
                assignedGear={assignedGear}
                isVerified={isVerified}
                verificationRecord={verificationRecord}
                onVerify={() => handleVerify(soldier)}
                onUndoVerify={() => handleUndoVerify(verificationRecord?.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
