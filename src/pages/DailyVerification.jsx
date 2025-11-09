
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Soldier } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DailyVerification } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Shield, ClipboardCheck, Users, Loader2, Search, CheckSquare, Square } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import SoldierVerificationCard from "../components/verification/SoldierVerificationCard";
import ComboBox from "../components/common/ComboBox";

export default function DailyVerificationPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isManagerOrAdmin, setIsManagerOrAdmin] = useState(false);
  const [isSoldier, setIsSoldier] = useState(false);
  const [linkedSoldier, setLinkedSoldier] = useState(null);
  
  const [allDivisions, setAllDivisions] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState("");

  const [allSoldiers, setAllSoldiers] = useState([]);
  const [allWeapons, setAllWeapons] = useState([]);
  const [allGear, setAllGear] = useState([]);
  const [allVerifications, setAllVerifications] = useState([]);
  
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSoldiers, setSelectedSoldiers] = useState(new Set());

  const [isLoading, setIsLoading] = useState(true);

  // Calculate today's date - this will be recalculated on each component mount (page load/refresh)
  const today = useMemo(() => {
    const todayDate = new Date().toISOString().split('T')[0];
    return todayDate;
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      const isAdmin = user?.role === 'admin';
      const isManager = user?.custom_role === 'manager';
      const isDivisionManager = user?.custom_role === 'division_manager';
      const isTeamLeader = user?.custom_role === 'team_leader';
      const isSoldierRole = user?.custom_role === 'soldier';
      const userDivision = user?.division;
      const userTeam = user?.team;
      const linkedSoldierId = user?.linked_soldier_id;

      const hasPower = isAdmin || isManager || isDivisionManager || isTeamLeader;
      setIsManagerOrAdmin(hasPower);
      setIsSoldier(isSoldierRole);

      // If soldier, find their linked soldier record
      let foundSoldier = null;
      if (isSoldierRole) {
        // First, try to find by linked_soldier_id
        if (linkedSoldierId) {
          try {
            // Try findById first (more direct)
            try {
              foundSoldier = await Soldier.findById(linkedSoldierId);
            } catch (findByIdError) {
              // If findById fails, try filter
              const soldiersData = await Soldier.filter({ soldier_id: linkedSoldierId });
              if (Array.isArray(soldiersData) && soldiersData.length > 0) {
                foundSoldier = soldiersData[0];
              }
            }
          } catch (error) {
            // Error finding by linked_soldier_id
          }
        }
        
        // Fallback: try to find by email
        if (!foundSoldier && user?.email) {
          try {
            const soldiersByEmail = await Soldier.filter({ email: user.email });
            if (Array.isArray(soldiersByEmail) && soldiersByEmail.length > 0) {
              foundSoldier = soldiersByEmail[0];
            }
          } catch (error) {
            // Error finding by email
          }
        }
        
        // Fallback: try to find by phone number
        if (!foundSoldier && user?.phoneNumber) {
          try {
            const soldiersByPhone = await Soldier.filter({ phone_number: user.phoneNumber });
            if (Array.isArray(soldiersByPhone) && soldiersByPhone.length > 0) {
              foundSoldier = soldiersByPhone[0];
            }
          } catch (error) {
            // Error finding by phone
          }
        }
        
        if (foundSoldier) {
          setLinkedSoldier(foundSoldier);
          setSelectedDivision(foundSoldier.division_name || userDivision || "");
        } else {
          setLinkedSoldier(null);
        }
      } else {
        setLinkedSoldier(null);
      }

      // Build filter based on role hierarchy
      let divisionFilter = {};
      if (isAdmin || isManager) {
        divisionFilter = {}; // See everything
      } else if (isDivisionManager && userDivision) {
        divisionFilter = { division_name: userDivision }; // See division only
      } else if (isTeamLeader && userDivision && userTeam) {
        divisionFilter = { division_name: userDivision, team_name: userTeam }; // See team only
      } else if (userDivision) {
        divisionFilter = { division_name: userDivision }; // Fallback
      }

      const verificationFilter = {
        created_date: today, // Check by created_date field in format YYYY-MM-DD
        ...divisionFilter
      };

      // For soldiers, only load their own data
      // Declare verificationsData at function scope so it's available after if/else blocks
      let soldiersData, weaponsData, gearData;
      let verificationsData = []; // Initialize to empty array
      
      // Get the found soldier (from the lookup above) or use linkedSoldier state
      const soldierToUse = isSoldierRole ? (foundSoldier || null) : null;
      
      if (isSoldierRole && soldierToUse) {
        // Soldier: only load their own data
        const soldierIdToUse = soldierToUse.soldier_id;
        const soldierDivision = soldierToUse.division_name || userDivision || "";
        
        // Use the found soldier directly instead of filtering again
        soldiersData = [foundSoldier];
        
        // Load weapons and gear using multiple methods for robustness
        // Method 1: Filter by assigned_to
        // Method 2: Fetch by division and filter client-side
        const divisionFilterForSoldier = soldierDivision ? { division_name: soldierDivision } : {};
        
        // Query: SELECT * FROM daily_verifications WHERE created_date = "2025-11-09" AND soldier_id = "10590"
        const verificationQuery = {
          created_date: today,
          soldier_id: soldierIdToUse
        };
        
        const [
          weaponsByAssigned,
          gearByAssigned,
          allDivisionWeapons,
          allDivisionGear,
          verificationsDataResult
        ] = await Promise.all([
          Weapon.filter({ assigned_to: soldierIdToUse }).catch(() => []),
          SerializedGear.filter({ assigned_to: soldierIdToUse }).catch(() => []),
          soldierDivision ? Weapon.filter(divisionFilterForSoldier).catch(() => []) : Promise.resolve([]),
          soldierDivision ? SerializedGear.filter(divisionFilterForSoldier).catch(() => []) : Promise.resolve([]),
          DailyVerification.filter(verificationQuery).catch(() => [])
        ]);
        
        // Assign to outer scope variable
        verificationsData = Array.isArray(verificationsDataResult) ? verificationsDataResult : [];
        
        // Combine results: prefer assigned_to filter, supplement with division filter
        const weaponsByAssignedArray = Array.isArray(weaponsByAssigned) ? weaponsByAssigned : [];
        const gearByAssignedArray = Array.isArray(gearByAssigned) ? gearByAssigned : [];
        const allDivisionWeaponsArray = Array.isArray(allDivisionWeapons) ? allDivisionWeapons : [];
        const allDivisionGearArray = Array.isArray(allDivisionGear) ? allDivisionGear : [];
        
        // Filter division weapons/gear by assigned_to client-side
        const weaponsFromDivision = allDivisionWeaponsArray.filter(w => w.assigned_to === soldierIdToUse);
        const gearFromDivision = allDivisionGearArray.filter(g => g.assigned_to === soldierIdToUse);
        
        // Combine and deduplicate by weapon_id/gear_id (which is also the document id)
        const weaponsMap = new Map();
        [...weaponsByAssignedArray, ...weaponsFromDivision].forEach(w => {
          if (w && w.weapon_id) {
            weaponsMap.set(w.weapon_id, w);
          }
        });
        weaponsData = Array.from(weaponsMap.values());
        
        const gearMap = new Map();
        [...gearByAssignedArray, ...gearFromDivision].forEach(g => {
          if (g && g.gear_id) {
            gearMap.set(g.gear_id, g);
          }
        });
        gearData = Array.from(gearMap.values());
      } else {
        // Managers/Admins: load division data
        [soldiersData, weaponsData, gearData, verificationsData] = await Promise.all([
          Soldier.filter({ ...divisionFilter, enlistment_status: 'arrived' }),
          Weapon.filter(divisionFilter),
          SerializedGear.filter(divisionFilter),
          DailyVerification.filter(verificationFilter)
        ]);
      }

      const safeSoldiers = Array.isArray(soldiersData) ? soldiersData : [];
      const safeVerifications = Array.isArray(verificationsData) ? verificationsData : [];
      
      setAllSoldiers(safeSoldiers);
      setAllWeapons(Array.isArray(weaponsData) ? weaponsData : []);
      setAllGear(Array.isArray(gearData) ? gearData : []);
      setAllVerifications(safeVerifications);
      
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
    // For soldiers, show only their own data
    if (isSoldier && linkedSoldier) {
      // Try to find soldier in allSoldiers first, otherwise use linkedSoldier directly
      let soldierToDisplay = allSoldiers.find(s => s.soldier_id === linkedSoldier.soldier_id);
      if (!soldierToDisplay) {
        // If not found in allSoldiers, use linkedSoldier directly
        soldierToDisplay = linkedSoldier;
      }
      
      const displayedSoldiersList = soldierToDisplay ? [soldierToDisplay] : [];
      return {
        displayedSoldiers: displayedSoldiersList,
        displayedWeapons: allWeapons,
        displayedGear: allGear,
        displayedVerifications: allVerifications,
        teams: [],
      };
    }
    
    // For managers/admins, filter by division
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
  }, [selectedDivision, allSoldiers, allWeapons, allGear, allVerifications, isSoldier, linkedSoldier]);

  const finalDisplayedSoldiers = useMemo(() => {
    // For soldiers, skip team/search filtering
    if (isSoldier) {
      return displayedSoldiers;
    }
    
    const filtered = displayedSoldiers
      .filter(soldier => {
        const teamMatch = selectedTeam === 'all' || soldier.team_name === selectedTeam;
        const searchMatch = !searchTerm || 
          `${soldier.first_name} ${soldier.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          soldier.soldier_id.toLowerCase().includes(searchTerm.toLowerCase());
        return teamMatch && searchMatch;
      });
    
    return filtered;
  }, [displayedSoldiers, selectedTeam, searchTerm, isSoldier]);


  const handleVerify = async (soldier) => {
    if (!currentUser || !soldier) return;

    try {
      const now = new Date().toISOString();
      const verificationData = {
        soldier_id: soldier.soldier_id,
        soldier_name: `${soldier.first_name} ${soldier.last_name}`,
        verification_date: today,
        created_date: today,
        verification_timestamp: now,
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
      };
      
      await DailyVerification.create(verificationData);
    } catch (error) {
      // Error creating verification record
    } finally {
      // Refresh all data to ensure UI is up-to-date
      await loadData();
    }
  };

  const handleUndoVerify = async (verificationId) => {
    if (!currentUser || !verificationId) return;

    try {
      await DailyVerification.delete(verificationId);
    } catch (error) {
      // Error deleting verification
    } finally {
      // Refresh all data to ensure UI is up-to-date
      await loadData();
    }
  };

  const toggleSoldierSelection = (soldierId) => {
    setSelectedSoldiers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(soldierId)) {
        newSet.delete(soldierId);
      } else {
        newSet.add(soldierId);
      }
      return newSet;
    });
  };

  const selectAllUnverified = () => {
    const unverifiedIds = finalDisplayedSoldiers
      .filter(soldier => !verifiedSoldierIds.has(soldier.soldier_id))
      .map(soldier => soldier.soldier_id);
    setSelectedSoldiers(new Set(unverifiedIds));
  };

  const selectAllVerified = () => {
    const verifiedIds = finalDisplayedSoldiers
      .filter(soldier => verifiedSoldierIds.has(soldier.soldier_id))
      .map(soldier => soldier.soldier_id);
    setSelectedSoldiers(new Set(verifiedIds));
  };

  const clearSelection = () => {
    setSelectedSoldiers(new Set());
  };

  const handleBulkVerify = async () => {
    if (selectedSoldiers.size === 0 || !currentUser) return;

    try {
      const soldiersToVerify = finalDisplayedSoldiers.filter(s =>
        selectedSoldiers.has(s.soldier_id) && !verifiedSoldierIds.has(s.soldier_id)
      );

      await Promise.all(soldiersToVerify.map(soldier => {
        const now = new Date().toISOString();
        return DailyVerification.create({
          soldier_id: soldier.soldier_id,
          soldier_name: `${soldier.first_name} ${soldier.last_name}`,
          verification_date: today,
          created_date: today,
          verification_timestamp: now,
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
      }));
    } catch (error) {
      // Silently ignore error and just refresh
    } finally {
      setSelectedSoldiers(new Set()); // Clear selection after refresh
      await loadData();
    }
  };

  const handleBulkUnverify = async () => {
    if (selectedSoldiers.size === 0 || !currentUser) return;

    try {
      const verificationsToDelete = finalDisplayedSoldiers
        .filter(s => selectedSoldiers.has(s.soldier_id) && verifiedSoldierIds.has(s.soldier_id))
        .map(s => displayedVerifications.find(v => v.soldier_id === s.soldier_id))
        .filter(v => v?.id);

      await Promise.all(verificationsToDelete.map(v => DailyVerification.delete(v.id)));
    } catch (error) {
      // Silently ignore error and just refresh
    } finally {
      setSelectedSoldiers(new Set()); // Clear selection after refresh
      await loadData();
    }
  };

  const selectAll = () => {
    const allIds = finalDisplayedSoldiers.map(soldier => soldier.soldier_id);
    setSelectedSoldiers(new Set(allIds));
  };

  const verifiedSoldierIds = useMemo(() => {
    // Check daily_verifications table: if created_date === today AND soldier_id matches, soldier is verified
    const verifiedIds = new Set();
    
    displayedVerifications.forEach(v => {
      const isVerifiedToday = v.created_date === today && v.soldier_id != null;
      if (isVerifiedToday) {
        verifiedIds.add(v.soldier_id);
      }
    });
    
    return verifiedIds;
  }, [displayedVerifications, today]);

  // Computed counts for action buttons
  const selectedUnverifiedCount = useMemo(() => {
    return Array.from(selectedSoldiers).filter(id => !verifiedSoldierIds.has(id)).length;
  }, [selectedSoldiers, verifiedSoldierIds]);

  const selectedVerifiedCount = useMemo(() => {
    return Array.from(selectedSoldiers).filter(id => verifiedSoldierIds.has(id)).length;
  }, [selectedSoldiers, verifiedSoldierIds]);
  
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

  // Check permissions: allow soldiers to verify themselves, or managers/admins with verify permission
  const canVerify = currentUser?.role === 'admin' || 
                    currentUser?.permissions?.['operations.verify'] || 
                    (isSoldier && linkedSoldier);
  
  if (!canVerify) {
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
  
  // For non-soldiers, require division assignment
  if (!isSoldier && !currentUser?.division && !isManagerOrAdmin) {
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

  // For soldiers, require linked soldier
  if (isSoldier && !linkedSoldier) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Users className="h-4 w-4" />
          <AlertDescription>
            <strong>Soldier Record Not Found</strong>
            <br />
            <br />
            Your account could not be linked to a soldier record. This may happen if:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Your soldier record doesn't exist in the system</li>
              <li>Your account's linked soldier ID doesn't match any soldier record</li>
              <li>Your email or phone number doesn't match any soldier record</li>
            </ul>
            <br />
            Please contact an administrator to:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Verify your soldier record exists</li>
              <li>Link your account to the correct soldier record</li>
              <li>Update your account's linked_soldier_id field</li>
            </ul>
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
          {isSoldier ? (
            <>Verify that you have your assigned equipment for today, {new Date(today).toLocaleDateString()}.</>
          ) : (
            <>Verify that each soldier in the <strong>{selectedDivision || "selected"}</strong> division has their assigned equipment for today, {new Date(today).toLocaleDateString()}.</>
          )}
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

      {!isSoldier && (
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
      )}

      {!isSoldier && (
        <>
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

          {finalDisplayedSoldiers.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    onClick={selectAll}
                    variant="outline"
                    size="sm"
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Select All ({finalDisplayedSoldiers.length})
                  </Button>
                  <Button
                    onClick={selectAllUnverified}
                    variant="outline"
                    size="sm"
                    disabled={finalDisplayedSoldiers.filter(s => !verifiedSoldierIds.has(s.soldier_id)).length === 0}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Select All Unverified ({finalDisplayedSoldiers.filter(s => !verifiedSoldierIds.has(s.soldier_id)).length})
                  </Button>
                  <Button
                    onClick={selectAllVerified}
                    variant="outline"
                    size="sm"
                    disabled={finalDisplayedSoldiers.filter(s => verifiedSoldierIds.has(s.soldier_id)).length === 0}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Select All Verified ({finalDisplayedSoldiers.filter(s => verifiedSoldierIds.has(s.soldier_id)).length})
                  </Button>
                  {selectedSoldiers.size > 0 && (
                    <>
                      <Button onClick={clearSelection} variant="outline" size="sm">
                        Clear Selection
                      </Button>
                      {selectedUnverifiedCount > 0 && (
                        <Button onClick={handleBulkVerify} size="sm" className="bg-green-600 hover:bg-green-700">
                          Verify Selected ({selectedUnverifiedCount})
                        </Button>
                      )}
                      {selectedVerifiedCount > 0 && (
                        <Button onClick={handleBulkUnverify} size="sm" className="bg-orange-600 hover:bg-orange-700">
                          Unverify Selected ({selectedVerifiedCount})
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {finalDisplayedSoldiers.length === 0 ? (
        <Card>
            <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-slate-700">
                  {isSoldier ? "No Soldier Record Found" : "No Soldiers to Verify"}
                </h3>
                <p className="text-slate-500">
                  {isSoldier 
                    ? "Your soldier record could not be found. Please contact an administrator."
                    : `There are no soldiers marked as 'Arrived' in ${selectedDivision || "this division"}${selectedTeam !== 'all' ? ` for team ${selectedTeam}` : ''} matching your criteria.`
                  }
                </p>
            </CardContent>
        </Card>
      ) : (
        <div className={`grid gap-6 ${isSoldier ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {finalDisplayedSoldiers.map(soldier => {
            const assignedWeapons = displayedWeapons.filter(w => w.assigned_to === soldier.soldier_id);
            const assignedGear = displayedGear.filter(g => g.assigned_to === soldier.soldier_id);
            
            // Check daily_verifications table: if created_date === today AND soldier_id === current soldier_id, soldier is verified
            const verificationRecord = displayedVerifications.find(v => 
              v.soldier_id === soldier.soldier_id && 
              v.created_date === today
            );
            
            const isVerified = verificationRecord != null;

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
                isSelected={!isSoldier && selectedSoldiers.has(soldier.soldier_id)}
                onToggleSelect={!isSoldier ? () => toggleSoldierSelection(soldier.soldier_id) : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

