
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Soldier } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DroneSet } from "@/api/entities";
import { DroneComponent } from "@/api/entities";
import { DailyVerification } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, ClipboardCheck, Users, Loader2, Search, CheckSquare } from "lucide-react";
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
  const [allDroneSets, setAllDroneSets] = useState([]);
  const [allDroneComponents, setAllDroneComponents] = useState([]);
  const [allVerifications, setAllVerifications] = useState([]);
  
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSoldiers, setSelectedSoldiers] = useState(new Set());

  const [activeTab, setActiveTab] = useState("soldiers");
  const [selectedUnassignedItems, setSelectedUnassignedItems] = useState(() => new Set());
  const [weaponSearchTerm, setWeaponSearchTerm] = useState("");
  const [gearSearchTerm, setGearSearchTerm] = useState("");
  const [droneSearchTerm, setDroneSearchTerm] = useState("");
  const [componentSearchTerm, setComponentSearchTerm] = useState("");
  const [verifyingWeaponIds, setVerifyingWeaponIds] = useState(() => new Set());
  const [verifyingGearIds, setVerifyingGearIds] = useState(() => new Set());
  const [verifyingDroneSetIds, setVerifyingDroneSetIds] = useState(() => new Set());
  const [verifyingComponentIds, setVerifyingComponentIds] = useState(() => new Set());
  const [undoingWeaponIds, setUndoingWeaponIds] = useState(() => new Set());
  const [undoingGearIds, setUndoingGearIds] = useState(() => new Set());
  const [undoingDroneSetIds, setUndoingDroneSetIds] = useState(() => new Set());
  const [undoingComponentIds, setUndoingComponentIds] = useState(() => new Set());

  const [isLoading, setIsLoading] = useState(true);

  const formatArmoryStatus = (status) => {
    if (!status) return "Unknown";
    if (status === "in_deposit") return "In Deposit";
    if (status === "with_soldier") return "With Soldier";
    return String(status).replace(/_/g, " ");
  };

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
      let soldiersData, weaponsData, gearData, droneSetsData, droneComponentsData;
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
          droneSetsByAssigned,
          allDivisionWeapons,
          allDivisionGear,
          allDivisionDroneSets,
          allComponentsList,
          verificationsDataResult
        ] = await Promise.all([
          Weapon.filter({ assigned_to: soldierIdToUse }).catch(() => []),
          SerializedGear.filter({ assigned_to: soldierIdToUse }).catch(() => []),
          DroneSet.filter({ assigned_to: soldierIdToUse }).catch(() => []),
          soldierDivision ? Weapon.filter(divisionFilterForSoldier).catch(() => []) : Promise.resolve([]),
          soldierDivision ? SerializedGear.filter(divisionFilterForSoldier).catch(() => []) : Promise.resolve([]),
          soldierDivision ? DroneSet.filter(divisionFilterForSoldier).catch(() => []) : Promise.resolve([]),
          DroneComponent.list("-created_date").catch(() => []),
          DailyVerification.filter(verificationQuery).catch(() => [])
        ]);
        
        // Assign to outer scope variable
        verificationsData = Array.isArray(verificationsDataResult) ? verificationsDataResult : [];
        
        // Combine results: prefer assigned_to filter, supplement with division filter
        const weaponsByAssignedArray = Array.isArray(weaponsByAssigned) ? weaponsByAssigned : [];
        const gearByAssignedArray = Array.isArray(gearByAssigned) ? gearByAssigned : [];
        const droneSetsByAssignedArray = Array.isArray(droneSetsByAssigned) ? droneSetsByAssigned : [];
        const allDivisionWeaponsArray = Array.isArray(allDivisionWeapons) ? allDivisionWeapons : [];
        const allDivisionGearArray = Array.isArray(allDivisionGear) ? allDivisionGear : [];
        const allDivisionDroneSetsArray = Array.isArray(allDivisionDroneSets) ? allDivisionDroneSets : [];
        
        // Filter division weapons/gear by assigned_to client-side
        const weaponsFromDivision = allDivisionWeaponsArray.filter(w => w.assigned_to === soldierIdToUse);
        const gearFromDivision = allDivisionGearArray.filter(g => g.assigned_to === soldierIdToUse);
        const droneSetsFromDivision = allDivisionDroneSetsArray.filter(d => d.assigned_to === soldierIdToUse);
        
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

        const droneSetMap = new Map();
        [...droneSetsByAssignedArray, ...droneSetsFromDivision].forEach(set => {
          const key = set?.drone_set_id || set?.id || set?.set_serial_number;
          if (set && key) {
            droneSetMap.set(String(key), set);
          }
        });
        droneSetsData = Array.from(droneSetMap.values());

        const allComponentsArray = Array.isArray(allComponentsList) ? allComponentsList : [];
        const componentBySerial = new Map();
        allComponentsArray.forEach(component => {
          if (component?.component_id) {
            componentBySerial.set(String(component.component_id), component);
          }
        });

        const componentMap = new Map();
        droneSetsData.forEach(set => {
          if (set?.components && typeof set.components === 'object') {
            Object.values(set.components).forEach(componentId => {
              if (!componentId) return;
              const component = componentBySerial.get(String(componentId));
              if (component) {
                componentMap.set(String(component.component_id), component);
              }
            });
          }
        });
        droneComponentsData = Array.from(componentMap.values());
      } else {
        // Managers/Admins: load division data
        [soldiersData, weaponsData, gearData, droneSetsData, droneComponentsData, verificationsData] = await Promise.all([
          Soldier.filter({ ...divisionFilter, enlistment_status: 'arrived' }),
          Weapon.filter(divisionFilter),
          SerializedGear.filter(divisionFilter),
          DroneSet.filter(divisionFilter),
          DroneComponent.list("-created_date"),
          DailyVerification.filter(verificationFilter)
        ]);
      }

      const safeSoldiers = Array.isArray(soldiersData) ? soldiersData : [];
      const safeVerifications = Array.isArray(verificationsData) ? verificationsData : [];
      
      setAllSoldiers(safeSoldiers);
      setAllWeapons(Array.isArray(weaponsData) ? weaponsData : []);
      setAllGear(Array.isArray(gearData) ? gearData : []);
      setAllDroneSets(Array.isArray(droneSetsData) ? droneSetsData : []);
      setAllDroneComponents(Array.isArray(droneComponentsData) ? droneComponentsData : []);
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
      setAllDroneSets([]);
      setAllDroneComponents([]);
      setAllVerifications([]);
    }
    setIsLoading(false);
  }, [today]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const {
    displayedSoldiers,
    displayedWeapons,
    displayedGear,
    displayedDroneSets,
    displayedDroneComponents,
    displayedVerifications,
    teams
  } = useMemo(() => {
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
        displayedDroneSets: allDroneSets,
        displayedDroneComponents: allDroneComponents,
        displayedVerifications: allVerifications,
        teams: [],
      };
    }
    
    // For managers/admins, filter by division
    if (!selectedDivision) {
      return {
        displayedSoldiers: [],
        displayedWeapons: [],
        displayedGear: [],
        displayedDroneSets: [],
        displayedDroneComponents: [],
        displayedVerifications: [],
        teams: []
      };
    }
    
    const soldiersInDivision = allSoldiers.filter(s => s.division_name === selectedDivision);
    const uniqueTeams = [...new Set(soldiersInDivision.map(s => s.team_name).filter(Boolean))].sort();

    const droneSetsInDivision = allDroneSets.filter(d => d.division_name === selectedDivision);
    const componentIdsInDivision = new Set();
    droneSetsInDivision.forEach(set => {
      if (set?.components && typeof set.components === 'object') {
        Object.values(set.components).forEach(componentId => {
          if (componentId) {
            componentIdsInDivision.add(String(componentId));
          }
        });
      }
    });

    const droneComponentsInDivision = allDroneComponents.filter(component => {
      if (!component) return false;
      const componentDivision = component.division_name;
      if (componentDivision) {
        return componentDivision === selectedDivision;
      }
      const componentId = String(component.component_id || component.id || '');
      return componentIdsInDivision.size === 0 || componentIdsInDivision.has(componentId);
    });

    return {
      displayedSoldiers: soldiersInDivision,
      displayedWeapons: allWeapons.filter(w => w.division_name === selectedDivision),
      displayedGear: allGear.filter(g => g.division_name === selectedDivision),
      displayedDroneSets: droneSetsInDivision,
      displayedDroneComponents: droneComponentsInDivision,
      displayedVerifications: allVerifications.filter(v => v.division_name === selectedDivision),
      teams: uniqueTeams,
    };
  }, [
    selectedDivision,
    allSoldiers,
    allWeapons,
    allGear,
    allDroneSets,
    allDroneComponents,
    allVerifications,
    isSoldier,
    linkedSoldier
  ]);

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

  const componentBySerial = useMemo(() => {
    const map = new Map();
    displayedDroneComponents.forEach(component => {
      if (!component) return;
      if (component.component_id) {
        map.set(String(component.component_id), component);
      }
      if (component.id) {
        map.set(String(component.id), component);
      }
    });
    return map;
  }, [displayedDroneComponents]);

  const componentToSetMap = useMemo(() => {
    const map = new Map();
    displayedDroneSets.forEach(set => {
      if (!set || !set.components || typeof set.components !== 'object') return;
      Object.values(set.components).forEach(componentId => {
        if (!componentId) return;
        map.set(String(componentId), set);
      });
    });
    return map;
  }, [displayedDroneSets]);

  const getAssignedDroneSetsForSoldier = useCallback(
    (soldierId) => displayedDroneSets.filter(set => set && set.assigned_to === soldierId),
    [displayedDroneSets]
  );

  const getAssignedDroneComponentsForSoldier = useCallback(
    (soldierId) => {
      const components = [];
      componentToSetMap.forEach((set, componentId) => {
        if (set && set.assigned_to === soldierId) {
          const component = componentBySerial.get(componentId);
          if (component) {
            components.push(component);
          }
        }
      });
      return components;
    },
    [componentToSetMap, componentBySerial]
  );

  const getDroneSetIdentifier = useCallback((droneSet) => {
    if (!droneSet) return null;
    const raw = droneSet.drone_set_id || droneSet.id || droneSet.set_serial_number;
    return raw ? String(raw) : null;
  }, []);

  const getComponentIdentifier = useCallback((component) => {
    if (!component) return null;
    const raw = component.component_id || component.id;
    return raw ? String(raw) : null;
  }, []);

  const unassignedWeapons = useMemo(() => {
    return displayedWeapons.filter(weapon => {
      if (!weapon) return false;
      const hasAssignee = Boolean(weapon.assigned_to);
      return !hasAssignee && weapon.armory_status !== "in_deposit";
    });
  }, [displayedWeapons]);

  const unassignedGear = useMemo(() => {
    return displayedGear.filter(gear => {
      if (!gear) return false;
      const hasAssignee = Boolean(gear.assigned_to);
      return !hasAssignee && gear.armory_status !== "in_deposit";
    });
  }, [displayedGear]);

  const unassignedDroneSets = useMemo(() => {
    return displayedDroneSets.filter(droneSet => {
      if (!droneSet) return false;
      const hasAssignee = Boolean(droneSet.assigned_to);
      return !hasAssignee && droneSet.armory_status !== "in_deposit";
    });
  }, [displayedDroneSets]);

  const unassignedDroneComponents = useMemo(() => {
    return displayedDroneComponents.filter(component => {
      if (!component) return false;
      const componentId = String(component.component_id || component.id || '');
      const parentSet = componentToSetMap.get(componentId);
      if (!parentSet) {
        return true;
      }
      const hasAssignee = Boolean(parentSet.assigned_to);
      return !hasAssignee;
    });
  }, [displayedDroneComponents, componentToSetMap]);

  const verifiedUnassignedWeaponMap = useMemo(() => {
    const map = new Map();
    displayedVerifications.forEach(verification => {
      if (!verification || verification.created_date !== today) return;
      if (verification.soldier_id) return;
      const checkedWeapons = Array.isArray(verification.weapons_checked) ? verification.weapons_checked : [];
      checkedWeapons.forEach(id => {
        if (id) {
          map.set(id, verification);
        }
      });
    });
    return map;
  }, [displayedVerifications, today]);

  const verifiedUnassignedGearMap = useMemo(() => {
    const map = new Map();
    displayedVerifications.forEach(verification => {
      if (!verification || verification.created_date !== today) return;
      if (verification.soldier_id) return;
      const checkedGear = Array.isArray(verification.gear_checked) ? verification.gear_checked : [];
      checkedGear.forEach(id => {
        if (id) {
          map.set(id, verification);
        }
      });
    });
    return map;
  }, [displayedVerifications, today]);

  const verifiedUnassignedDroneSetMap = useMemo(() => {
    const map = new Map();
    displayedVerifications.forEach(verification => {
      if (!verification || verification.created_date !== today) return;
      if (verification.soldier_id) return;
      const checkedSets = Array.isArray(verification.drone_sets_checked) ? verification.drone_sets_checked : [];
      checkedSets.forEach(id => {
        if (id) {
          map.set(String(id), verification);
        }
      });
    });
    return map;
  }, [displayedVerifications, today]);

  const verifiedUnassignedComponentMap = useMemo(() => {
    const map = new Map();
    displayedVerifications.forEach(verification => {
      if (!verification || verification.created_date !== today) return;
      if (verification.soldier_id) return;
      const checkedComponents = Array.isArray(verification.drone_components_checked)
        ? verification.drone_components_checked
        : [];
      checkedComponents.forEach(id => {
        if (id) {
          map.set(String(id), verification);
        }
      });
    });
    return map;
  }, [displayedVerifications, today]);

  const unassignedItems = useMemo(() => {
    const items = [];
    unassignedWeapons.forEach(weapon => {
      const weaponId = weapon?.weapon_id || weapon?.id;
      if (!weaponId) return;
      items.push({
        key: `weapon:${weaponId}`,
        id: weaponId,
        type: "weapon",
        name: weapon.weapon_type || "Weapon",
        status: weapon.status,
        armory_status: weapon.armory_status,
        last_signed_by: weapon.last_signed_by,
        division_name: weapon.division_name,
        record: weapon,
        verificationRecord: verifiedUnassignedWeaponMap.get(weaponId) || null,
      });
    });
    unassignedGear.forEach(gear => {
      const gearId = gear?.gear_id || gear?.id;
      if (!gearId) return;
      items.push({
        key: `gear:${gearId}`,
        id: gearId,
        type: "gear",
        name: gear.gear_type || "Gear",
        status: gear.status,
        armory_status: gear.armory_status,
        last_signed_by: gear.last_signed_by,
        division_name: gear.division_name,
        record: gear,
        verificationRecord: verifiedUnassignedGearMap.get(gearId) || null,
      });
    });
    unassignedDroneSets.forEach(droneSet => {
      const rawId = droneSet?.drone_set_id || droneSet?.id || droneSet?.set_serial_number;
      if (!rawId) return;
      const setId = String(rawId);
      items.push({
        key: `drone:${setId}`,
        id: setId,
        type: "drone",
        name: droneSet.set_type ? `${droneSet.set_type} Drone Set` : "Drone Set",
        status: droneSet.status,
        armory_status: droneSet.armory_status,
        last_signed_by: null,
        division_name: droneSet.division_name,
        record: droneSet,
        verificationRecord: verifiedUnassignedDroneSetMap.get(setId) || null,
      });
    });
    unassignedDroneComponents.forEach(component => {
      const rawId = component?.component_id || component?.id;
      if (!rawId) return;
      const componentId = String(rawId);
      const parentSet = componentToSetMap.get(componentId) || null;
      items.push({
        key: `drone_component:${componentId}`,
        id: componentId,
        type: "drone_component",
        name: component.component_type || "Drone Component",
        status: component.status,
        armory_status: parentSet?.armory_status || null,
        last_signed_by: null,
        division_name: parentSet?.division_name || component.division_name,
        record: component,
        parentSet,
        verificationRecord: verifiedUnassignedComponentMap.get(componentId) || null,
      });
    });
    return items;
  }, [
    unassignedWeapons,
    unassignedGear,
    unassignedDroneSets,
    unassignedDroneComponents,
    verifiedUnassignedWeaponMap,
    verifiedUnassignedGearMap,
    verifiedUnassignedDroneSetMap,
    verifiedUnassignedComponentMap,
    componentToSetMap
  ]);

  const unassignedItemMap = useMemo(() => {
    const map = new Map();
    unassignedItems.forEach(item => {
      map.set(item.key, item);
    });
    return map;
  }, [unassignedItems]);

  const filteredUnassignedWeapons = useMemo(() => {
    const term = weaponSearchTerm.trim().toLowerCase();
    return unassignedItems.filter(item => {
      if (item.type !== "weapon") return false;
      if (!term) return true;
      const haystack = [
        item.name,
        item.id,
        item.status,
        item.armory_status,
        item.last_signed_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [unassignedItems, weaponSearchTerm]);

  const filteredUnassignedGear = useMemo(() => {
    const term = gearSearchTerm.trim().toLowerCase();
    return unassignedItems.filter(item => {
      if (item.type !== "gear") return false;
      if (!term) return true;
      const haystack = [
        item.name,
        item.id,
        item.status,
        item.armory_status,
        item.last_signed_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [unassignedItems, gearSearchTerm]);

  const filteredUnassignedDroneSets = useMemo(() => {
    const term = droneSearchTerm.trim().toLowerCase();
    return unassignedItems.filter(item => {
      if (item.type !== "drone") return false;
      if (!term) return true;
      const haystack = [
        item.name,
        item.id,
        item.status,
        item.armory_status,
        item.division_name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [unassignedItems, droneSearchTerm]);

  const filteredUnassignedComponents = useMemo(() => {
    const term = componentSearchTerm.trim().toLowerCase();
    return unassignedItems.filter(item => {
      if (item.type !== "drone_component") return false;
      if (!term) return true;
      const parentSerial = item.parentSet?.set_serial_number;
      const haystack = [
        item.name,
        item.id,
        item.status,
        parentSerial,
        item.division_name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [unassignedItems, componentSearchTerm]);

  const displayedWeaponKeys = useMemo(
    () => filteredUnassignedWeapons.map(item => item.key),
    [filteredUnassignedWeapons]
  );

  const displayedGearKeys = useMemo(
    () => filteredUnassignedGear.map(item => item.key),
    [filteredUnassignedGear]
  );

  const displayedDroneSetKeys = useMemo(
    () => filteredUnassignedDroneSets.map(item => item.key),
    [filteredUnassignedDroneSets]
  );

  const displayedComponentKeys = useMemo(
    () => filteredUnassignedComponents.map(item => item.key),
    [filteredUnassignedComponents]
  );

  const weaponsHeaderChecked = filteredUnassignedWeapons.length === 0
    ? false
    : filteredUnassignedWeapons.every(item => selectedUnassignedItems.has(item.key))
      ? true
      : filteredUnassignedWeapons.some(item => selectedUnassignedItems.has(item.key))
        ? "indeterminate"
        : false;

  const gearHeaderChecked = filteredUnassignedGear.length === 0
    ? false
    : filteredUnassignedGear.every(item => selectedUnassignedItems.has(item.key))
      ? true
      : filteredUnassignedGear.some(item => selectedUnassignedItems.has(item.key))
        ? "indeterminate"
        : false;

  const droneHeaderChecked = filteredUnassignedDroneSets.length === 0
    ? false
    : filteredUnassignedDroneSets.every(item => selectedUnassignedItems.has(item.key))
      ? true
      : filteredUnassignedDroneSets.some(item => selectedUnassignedItems.has(item.key))
        ? "indeterminate"
        : false;

  const componentHeaderChecked = filteredUnassignedComponents.length === 0
    ? false
    : filteredUnassignedComponents.every(item => selectedUnassignedItems.has(item.key))
      ? true
      : filteredUnassignedComponents.some(item => selectedUnassignedItems.has(item.key))
        ? "indeterminate"
        : false;

  useEffect(() => {
    setSelectedUnassignedItems(prev => {
      const allowed = new Set(unassignedItems.map(item => item.key));
      let changed = false;
      const next = new Set();
      prev.forEach(key => {
        if (allowed.has(key)) {
          next.add(key);
        } else {
          changed = true;
        }
      });
      if (!changed && next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [unassignedItems]);

  const totalUnassignedItems = unassignedItems.length;
  const verifiedUnassignedCount = unassignedItems.filter(item => item.verificationRecord).length;
  const unassignedProgress = totalUnassignedItems > 0 ? (verifiedUnassignedCount / totalUnassignedItems) * 100 : 0;
  const unassignedPendingCount = totalUnassignedItems - verifiedUnassignedCount;

  const verifierDisplayName = useMemo(() => {
    return currentUser?.full_name ||
      currentUser?.displayName ||
      currentUser?.name ||
      currentUser?.email ||
      "Unknown";
  }, [currentUser]);

  const verifiedByUserId = useMemo(() => currentUser?.id || currentUser?.uid || null, [currentUser]);

  const toggleUnassignedSelection = (key) => {
    if (!key) return;
    setSelectedUnassignedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllUnassigned = () => {
    setSelectedUnassignedItems(new Set(unassignedItems.map(item => item.key)));
  };

  const selectAllPendingUnassigned = () => {
    const pendingKeys = unassignedItems.filter(item => !item.verificationRecord).map(item => item.key);
    setSelectedUnassignedItems(new Set(pendingKeys));
  };

  const selectAllVerifiedUnassigned = () => {
    const verifiedKeys = unassignedItems.filter(item => item.verificationRecord).map(item => item.key);
    setSelectedUnassignedItems(new Set(verifiedKeys));
  };

  const clearUnassignedSelection = () => {
    setSelectedUnassignedItems(new Set());
  };

  const selectedUnassignedPendingCount = useMemo(() => {
    let count = 0;
    selectedUnassignedItems.forEach(key => {
      const item = unassignedItemMap.get(key);
      if (item && !item.verificationRecord) {
        count += 1;
      }
    });
    return count;
  }, [selectedUnassignedItems, unassignedItemMap]);

  const selectedUnassignedVerifiedCount = useMemo(() => {
    let count = 0;
    selectedUnassignedItems.forEach(key => {
      const item = unassignedItemMap.get(key);
      if (item && item.verificationRecord) {
        count += 1;
      }
    });
    return count;
  }, [selectedUnassignedItems, unassignedItemMap]);

  const allUnassignedSelected = useMemo(() => {
    return totalUnassignedItems > 0 && selectedUnassignedItems.size === totalUnassignedItems;
  }, [totalUnassignedItems, selectedUnassignedItems]);

  const someUnassignedSelected = useMemo(() => {
    return selectedUnassignedItems.size > 0 && !allUnassignedSelected;
  }, [selectedUnassignedItems, allUnassignedSelected]);

  const handleVerifyUnassignedWeapon = async (weapon) => {
    if (!currentUser || !weapon) return;
    const weaponId = weapon.weapon_id || weapon.id;
    if (!weaponId) return;
    if (verifiedUnassignedWeaponMap.has(weaponId)) return;

    setVerifyingWeaponIds(prev => {
      const next = new Set(prev);
      next.add(weaponId);
      return next;
    });

    try {
      const now = new Date().toISOString();
      await DailyVerification.create({
        soldier_id: null,
        soldier_name: null,
        division_name: weapon.division_name || selectedDivision || currentUser?.division || null,
        verification_date: today,
        created_date: today,
        verification_timestamp: now,
        verified_by_user_id: verifiedByUserId,
        verified_by_user_name: verifierDisplayName,
        verified_by: verifierDisplayName,
        status: "verified",
        unassigned: true,
        item_type: "weapon",
        item_id: weaponId,
        weapons_checked: [weaponId],
        equipment_checked: [],
        gear_checked: [],
        drone_sets_checked: [],
      });
    } catch (error) {
      // Ignore errors and refresh data to sync state
    } finally {
      setVerifyingWeaponIds(prev => {
        const next = new Set(prev);
        next.delete(weaponId);
        return next;
      });
      await loadData();
    }
  };

  const handleUndoUnassignedWeapon = async (verificationRecord, weaponId) => {
    if (!currentUser || !verificationRecord?.id || !weaponId) return;

    setUndoingWeaponIds(prev => {
      const next = new Set(prev);
      next.add(weaponId);
      return next;
    });

    try {
      await DailyVerification.delete(verificationRecord.id);
    } catch (error) {
      // Ignore errors for smoother UX; data reload will correct the view
    } finally {
      setUndoingWeaponIds(prev => {
        const next = new Set(prev);
        next.delete(weaponId);
        return next;
      });
      await loadData();
    }
  };

  const handleVerifyUnassignedGear = async (gear) => {
    if (!currentUser || !gear) return;
    const gearId = gear.gear_id || gear.id;
    if (!gearId) return;
    if (verifiedUnassignedGearMap.has(gearId)) return;

    setVerifyingGearIds(prev => {
      const next = new Set(prev);
      next.add(gearId);
      return next;
    });

    try {
      const now = new Date().toISOString();
      await DailyVerification.create({
        soldier_id: null,
        soldier_name: null,
        division_name: gear.division_name || selectedDivision || currentUser?.division || null,
        verification_date: today,
        created_date: today,
        verification_timestamp: now,
        verified_by_user_id: verifiedByUserId,
        verified_by_user_name: verifierDisplayName,
        verified_by: verifierDisplayName,
        status: "verified",
        unassigned: true,
        item_type: "gear",
        item_id: gearId,
        weapons_checked: [],
        equipment_checked: [],
        gear_checked: [gearId],
        drone_sets_checked: [],
      });
    } catch (error) {
      // Ignore errors and rely on data reload to reconcile state
    } finally {
      setVerifyingGearIds(prev => {
        const next = new Set(prev);
        next.delete(gearId);
        return next;
      });
      await loadData();
    }
  };

  const handleUndoUnassignedGear = async (verificationRecord, gearId) => {
    if (!currentUser || !verificationRecord?.id || !gearId) return;

    setUndoingGearIds(prev => {
      const next = new Set(prev);
      next.add(gearId);
      return next;
    });

    try {
      await DailyVerification.delete(verificationRecord.id);
    } catch (error) {
      // Ignore errors and refresh the data to align with backend state
    } finally {
      setUndoingGearIds(prev => {
        const next = new Set(prev);
        next.delete(gearId);
        return next;
      });
      await loadData();
    }
  };

  const handleVerifyUnassignedDroneSet = async (droneSet) => {
    if (!currentUser || !droneSet) return;
    const setId = getDroneSetIdentifier(droneSet);
    if (!setId) return;
    if (verifiedUnassignedDroneSetMap.has(setId)) return;

    setVerifyingDroneSetIds(prev => {
      const next = new Set(prev);
      next.add(setId);
      return next;
    });

    try {
      const now = new Date().toISOString();
      await DailyVerification.create({
        soldier_id: null,
        soldier_name: null,
        division_name: droneSet.division_name || selectedDivision || currentUser?.division || null,
        verification_date: today,
        created_date: today,
        verification_timestamp: now,
        verified_by_user_id: verifiedByUserId,
        verified_by_user_name: verifierDisplayName,
        verified_by: verifierDisplayName,
        status: "verified",
        unassigned: true,
        item_type: "drone_set",
        item_id: setId,
        weapons_checked: [],
        equipment_checked: [],
        gear_checked: [],
        drone_sets_checked: [setId],
        drone_components_checked: [],
      });
    } catch (error) {
      // Ignore errors and rely on data reload
    } finally {
      setVerifyingDroneSetIds(prev => {
        const next = new Set(prev);
        next.delete(setId);
        return next;
      });
      await loadData();
    }
  };

  const handleUndoUnassignedDroneSet = async (verificationRecord, setId) => {
    if (!currentUser || !verificationRecord?.id || !setId) return;

    const normalizedId = String(setId);

    setUndoingDroneSetIds(prev => {
      const next = new Set(prev);
      next.add(normalizedId);
      return next;
    });

    try {
      await DailyVerification.delete(verificationRecord.id);
    } catch (error) {
      // Ignore errors and refresh the data to align with backend state
    } finally {
      setUndoingDroneSetIds(prev => {
        const next = new Set(prev);
        next.delete(normalizedId);
        return next;
      });
      await loadData();
    }
  };

  const handleVerifyUnassignedComponent = async (component) => {
    if (!currentUser || !component) return;
    const componentId = getComponentIdentifier(component);
    if (!componentId) return;
    if (verifiedUnassignedComponentMap.has(componentId)) return;

    const parentSet = componentToSetMap.get(componentId) || null;

    setVerifyingComponentIds(prev => {
      const next = new Set(prev);
      next.add(componentId);
      return next;
    });

    try {
      const now = new Date().toISOString();
      await DailyVerification.create({
        soldier_id: null,
        soldier_name: null,
        division_name: parentSet?.division_name || component.division_name || selectedDivision || currentUser?.division || null,
        verification_date: today,
        created_date: today,
        verification_timestamp: now,
        verified_by_user_id: verifiedByUserId,
        verified_by_user_name: verifierDisplayName,
        verified_by: verifierDisplayName,
        status: "verified",
        unassigned: true,
        item_type: "drone_component",
        item_id: componentId,
        weapons_checked: [],
        equipment_checked: [],
        gear_checked: [],
        drone_sets_checked: parentSet ? [getDroneSetIdentifier(parentSet)].filter(Boolean) : [],
        drone_components_checked: [componentId],
      });
    } catch (error) {
      // Ignore errors
    } finally {
      setVerifyingComponentIds(prev => {
        const next = new Set(prev);
        next.delete(componentId);
        return next;
      });
      await loadData();
    }
  };

  const handleUndoUnassignedComponent = async (verificationRecord, componentId) => {
    if (!currentUser || !verificationRecord?.id || !componentId) return;

    const normalizedId = String(componentId);

    setUndoingComponentIds(prev => {
      const next = new Set(prev);
      next.add(normalizedId);
      return next;
    });

    try {
      await DailyVerification.delete(verificationRecord.id);
    } catch (error) {
      // Ignore errors and refresh the data to align with backend state
    } finally {
      setUndoingComponentIds(prev => {
        const next = new Set(prev);
        next.delete(normalizedId);
        return next;
      });
      await loadData();
    }
  };

  const handleBulkVerifyUnassigned = async () => {
    if (!currentUser) return;
    const itemsToVerify = unassignedItems.filter(
      item => selectedUnassignedItems.has(item.key) && !item.verificationRecord && item.id
    );
    if (itemsToVerify.length === 0) return;

    const now = new Date().toISOString();

    setVerifyingWeaponIds(prev => {
      const next = new Set(prev);
      itemsToVerify
        .filter(item => item.type === "weapon")
        .forEach(item => next.add(item.id));
      return next;
    });

    setVerifyingGearIds(prev => {
      const next = new Set(prev);
      itemsToVerify
        .filter(item => item.type === "gear")
        .forEach(item => next.add(item.id));
      return next;
    });

    setVerifyingDroneSetIds(prev => {
      const next = new Set(prev);
      itemsToVerify
        .filter(item => item.type === "drone")
        .forEach(item => next.add(item.id));
      return next;
    });

    setVerifyingComponentIds(prev => {
      const next = new Set(prev);
      itemsToVerify
        .filter(item => item.type === "drone_component")
        .forEach(item => next.add(item.id));
      return next;
    });

    try {
      await Promise.all(
        itemsToVerify.map(item => {
          const divisionName =
            item.record?.division_name ||
            item.parentSet?.division_name ||
            selectedDivision ||
            currentUser?.division ||
            null;
          const parentSetId =
            item.type === "drone_component" && item.parentSet
              ? getDroneSetIdentifier(item.parentSet)
              : null;
          return DailyVerification.create({
            soldier_id: null,
            soldier_name: null,
            division_name: divisionName,
            verification_date: today,
            created_date: today,
            verification_timestamp: now,
            verified_by_user_id: verifiedByUserId,
            verified_by_user_name: verifierDisplayName,
            verified_by: verifierDisplayName,
            status: "verified",
            unassigned: true,
            item_type: item.type === "drone" ? "drone_set" : item.type === "drone_component" ? "drone_component" : item.type,
            item_id: item.id,
            weapons_checked: item.type === "weapon" ? [item.id] : [],
            equipment_checked: [],
            gear_checked: item.type === "gear" ? [item.id] : [],
            drone_sets_checked:
              item.type === "drone"
                ? [item.id]
                : parentSetId
                  ? [parentSetId]
                  : [],
            drone_components_checked: item.type === "drone_component" ? [item.id] : [],
          });
        })
      );
    } catch (error) {
      // Ignore errors; data reload will reconcile the UI
    } finally {
      setVerifyingWeaponIds(prev => {
        const next = new Set(prev);
        itemsToVerify
          .filter(item => item.type === "weapon")
          .forEach(item => next.delete(item.id));
        return next;
      });
      setVerifyingGearIds(prev => {
        const next = new Set(prev);
        itemsToVerify
          .filter(item => item.type === "gear")
          .forEach(item => next.delete(item.id));
        return next;
      });
      setVerifyingDroneSetIds(prev => {
        const next = new Set(prev);
        itemsToVerify
          .filter(item => item.type === "drone")
          .forEach(item => next.delete(item.id));
        return next;
      });
      setVerifyingComponentIds(prev => {
        const next = new Set(prev);
        itemsToVerify
          .filter(item => item.type === "drone_component")
          .forEach(item => next.delete(item.id));
        return next;
      });
      setSelectedUnassignedItems(new Set());
      await loadData();
    }
  };

  const handleBulkUndoUnassigned = async () => {
    if (!currentUser) return;
    const itemsToUndo = unassignedItems.filter(
      item => selectedUnassignedItems.has(item.key) && item.verificationRecord?.id
    );
    if (itemsToUndo.length === 0) return;

    setUndoingWeaponIds(prev => {
      const next = new Set(prev);
      itemsToUndo
        .filter(item => item.type === "weapon" && item.id)
        .forEach(item => next.add(item.id));
      return next;
    });

    setUndoingGearIds(prev => {
      const next = new Set(prev);
      itemsToUndo
        .filter(item => item.type === "gear" && item.id)
        .forEach(item => next.add(item.id));
      return next;
    });

    setUndoingDroneSetIds(prev => {
      const next = new Set(prev);
      itemsToUndo
        .filter(item => item.type === "drone" && item.id)
        .forEach(item => next.add(item.id));
      return next;
    });

    setUndoingComponentIds(prev => {
      const next = new Set(prev);
      itemsToUndo
        .filter(item => item.type === "drone_component" && item.id)
        .forEach(item => next.add(item.id));
      return next;
    });

    try {
      await Promise.all(
        itemsToUndo.map(item => DailyVerification.delete(item.verificationRecord.id))
      );
    } catch (error) {
      // Ignore errors; reload will sync UI
    } finally {
      setUndoingWeaponIds(prev => {
        const next = new Set(prev);
        itemsToUndo
          .filter(item => item.type === "weapon" && item.id)
          .forEach(item => next.delete(item.id));
        return next;
      });
      setUndoingGearIds(prev => {
        const next = new Set(prev);
        itemsToUndo
          .filter(item => item.type === "gear" && item.id)
          .forEach(item => next.delete(item.id));
        return next;
      });
      setUndoingDroneSetIds(prev => {
        const next = new Set(prev);
        itemsToUndo
          .filter(item => item.type === "drone" && item.id)
          .forEach(item => next.delete(item.id));
        return next;
      });
      setUndoingComponentIds(prev => {
        const next = new Set(prev);
        itemsToUndo
          .filter(item => item.type === "drone_component" && item.id)
          .forEach(item => next.delete(item.id));
        return next;
      });
      setSelectedUnassignedItems(new Set());
      await loadData();
    }
  };

  const handleVerify = async (
    soldier,
    assignedWeaponsParam = [],
    assignedGearParam = [],
    assignedDroneSetsParam = [],
    assignedDroneComponentsParam = []
  ) => {
    if (!currentUser || !soldier) return;

    try {
      const now = new Date().toISOString();
      const assignedWeaponsList =
        Array.isArray(assignedWeaponsParam) && assignedWeaponsParam.length > 0
          ? assignedWeaponsParam
          : displayedWeapons.filter(w => w.assigned_to === soldier.soldier_id);
      const assignedGearList =
        Array.isArray(assignedGearParam) && assignedGearParam.length > 0
          ? assignedGearParam
          : displayedGear.filter(g => g.assigned_to === soldier.soldier_id);
      const assignedDroneSetsList =
        Array.isArray(assignedDroneSetsParam) && assignedDroneSetsParam.length > 0
          ? assignedDroneSetsParam
          : getAssignedDroneSetsForSoldier(soldier.soldier_id);
      const assignedDroneComponentsList =
        Array.isArray(assignedDroneComponentsParam) && assignedDroneComponentsParam.length > 0
          ? assignedDroneComponentsParam
          : getAssignedDroneComponentsForSoldier(soldier.soldier_id);

      const weaponIds = assignedWeaponsList
        .map(w => w?.weapon_id || w?.id)
        .filter(Boolean)
        .map(String);
      const gearIds = assignedGearList
        .map(g => g?.gear_id || g?.id)
        .filter(Boolean)
        .map(String);
      const droneSetIds = assignedDroneSetsList
        .map(set => getDroneSetIdentifier(set))
        .filter(Boolean);
      const droneComponentIds = assignedDroneComponentsList
        .map(component => getComponentIdentifier(component))
        .filter(Boolean);

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
        weapons_checked: weaponIds,
        equipment_checked: [],
        gear_checked: gearIds,
        drone_sets_checked: droneSetIds,
        drone_components_checked: droneComponentIds,
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
        const assignedWeaponsList = displayedWeapons.filter(w => w.assigned_to === soldier.soldier_id);
        const assignedGearList = displayedGear.filter(g => g.assigned_to === soldier.soldier_id);
        const assignedDroneSetsList = getAssignedDroneSetsForSoldier(soldier.soldier_id);
        const assignedDroneComponentsList = getAssignedDroneComponentsForSoldier(soldier.soldier_id);

        const weaponIds = assignedWeaponsList
          .map(w => w?.weapon_id || w?.id)
          .filter(Boolean)
          .map(String);
        const gearIds = assignedGearList
          .map(g => g?.gear_id || g?.id)
          .filter(Boolean)
          .map(String);
        const droneSetIds = assignedDroneSetsList
          .map(set => getDroneSetIdentifier(set))
          .filter(Boolean);
        const droneComponentIds = assignedDroneComponentsList
          .map(component => getComponentIdentifier(component))
          .filter(Boolean);

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
          weapons_checked: weaponIds,
          equipment_checked: [],
          gear_checked: gearIds,
          drone_sets_checked: droneSetIds,
          drone_components_checked: droneComponentIds,
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

  const soldierManagerControls = !isSoldier ? (
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
              <Button onClick={selectAll} variant="outline" size="sm">
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
                    <Button onClick={handleBulkVerify} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                      Verify Selected ({selectedUnverifiedCount})
                    </Button>
                  )}
                  {selectedVerifiedCount > 0 && (
                    <Button onClick={handleBulkUnverify} size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
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
  ) : null;

  const soldierListSection = finalDisplayedSoldiers.length === 0 ? (
    <Card>
      <CardContent className="p-8 text-center">
        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-medium text-slate-700">
          {isSoldier ? "No Soldier Record Found" : "No Soldiers to Verify"}
        </h3>
        <p className="text-slate-500">
          {isSoldier
            ? "Your soldier record could not be found. Please contact an administrator."
            : `There are no soldiers marked as 'Arrived' in ${selectedDivision || "this division"}${selectedTeam !== 'all' ? ` for team ${selectedTeam}` : ''} matching your criteria.`}
        </p>
      </CardContent>
    </Card>
  ) : (
    <div className={`grid gap-6 ${isSoldier ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
      {finalDisplayedSoldiers.map(soldier => {
        const assignedWeapons = displayedWeapons.filter(w => w.assigned_to === soldier.soldier_id);
        const assignedGear = displayedGear.filter(g => g.assigned_to === soldier.soldier_id);
        const assignedDroneSets = getAssignedDroneSetsForSoldier(soldier.soldier_id);
        const assignedDroneComponents = getAssignedDroneComponentsForSoldier(soldier.soldier_id);

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
            assignedDroneSets={assignedDroneSets}
            assignedDroneComponents={assignedDroneComponents}
            isVerified={isVerified}
            verificationRecord={verificationRecord}
            onVerify={() => handleVerify(
              soldier,
              assignedWeapons,
              assignedGear,
              assignedDroneSets,
              assignedDroneComponents
            )}
            onUndoVerify={() => handleUndoVerify(verificationRecord?.id)}
            isSelected={!isSoldier && selectedSoldiers.has(soldier.soldier_id)}
            onToggleSelect={!isSoldier ? () => toggleSoldierSelection(soldier.soldier_id) : undefined}
          />
        );
      })}
    </div>
  );

  const unassignedSection = !isManagerOrAdmin ? null : (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Unassigned Equipment Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={unassignedProgress} className="w-full" />
            <span className="font-bold text-slate-700 whitespace-nowrap">
              {verifiedUnassignedCount} / {totalUnassignedItems} Verified
            </span>
          </div>
        </CardContent>
      </Card>

      {totalUnassignedItems === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-slate-500">
            No unassigned weapons, serialized gear, drone sets, or drone components currently outside the armory deposit.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={selectAllUnassigned} variant="outline" size="sm">
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Select All ({totalUnassignedItems})
                </Button>
                <Button
                  onClick={selectAllPendingUnassigned}
                  variant="outline"
                  size="sm"
                  disabled={unassignedPendingCount === 0}
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Select All Unverified ({unassignedPendingCount})
                </Button>
                <Button
                  onClick={selectAllVerifiedUnassigned}
                  variant="outline"
                  size="sm"
                  disabled={verifiedUnassignedCount === 0}
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Select All Verified ({verifiedUnassignedCount})
                </Button>
                {selectedUnassignedItems.size > 0 && (
                  <>
                    <Button onClick={clearUnassignedSelection} variant="outline" size="sm">
                      Clear Selection
                    </Button>
                    {selectedUnassignedPendingCount > 0 && (
                      <Button
                        onClick={handleBulkVerifyUnassigned}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Verify Selected ({selectedUnassignedPendingCount})
                      </Button>
                    )}
                    {selectedUnassignedVerifiedCount > 0 && (
                      <Button
                        onClick={handleBulkUndoUnassigned}
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        Unverify Selected ({selectedUnassignedVerifiedCount})
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="text-lg font-semibold text-slate-800">Unassigned Weapons</h3>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={weaponSearchTerm}
                    onChange={(e) => setWeaponSearchTerm(e.target.value)}
                    placeholder="Search weapons by type, ID or status..."
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 px-4">
                        <Checkbox
                          checked={weaponsHeaderChecked}
                          onCheckedChange={(checked) => {
                            setSelectedUnassignedItems(prev => {
                              const next = new Set(prev);
                              if (checked) {
                                displayedWeaponKeys.forEach(key => next.add(key));
                              } else {
                                displayedWeaponKeys.forEach(key => next.delete(key));
                              }
                              return next;
                            });
                          }}
                          aria-label="Select all unassigned weapons"
                        />
                      </TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Armory Status</TableHead>
                      <TableHead>Last Signed By</TableHead>
                      <TableHead className="text-right">Verification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnassignedWeapons.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-slate-500 py-6">
                          No weapons match your search criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUnassignedWeapons.map(item => {
                        const isSelected = selectedUnassignedItems.has(item.key);
                        const isVerified = Boolean(item.verificationRecord);
                        const isProcessing = verifyingWeaponIds.has(item.id) || undoingWeaponIds.has(item.id);
                        const statusVariant = item.status === 'functioning'
                          ? 'success'
                          : item.status === 'not_functioning'
                            ? 'destructive'
                            : 'secondary';
                        const statusLabel = item.status
                          ? item.status.replace(/_/g, ' ').toUpperCase()
                          : 'UNKNOWN';
                        const armoryStatus = item.armory_status;

                        const handleVerifyAction = () => handleVerifyUnassignedWeapon(item.record);
                        const handleUndoAction = () => {
                          if (item.verificationRecord?.id) {
                            handleUndoUnassignedWeapon(item.verificationRecord, item.id);
                          }
                        };

                        return (
                          <TableRow key={item.key}>
                            <TableCell className="w-12 px-4">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleUnassignedSelection(item.key)}
                                aria-label={`Select weapon ${item.id}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-sm text-slate-800">
                              {item.name}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-700">
                              {item.id}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant} className="text-xs font-semibold">
                                {statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs font-normal ${armoryStatus === 'with_soldier'
                                  ? 'text-green-800 bg-green-50 border-green-200'
                                  : 'text-slate-700 bg-slate-100 border-slate-200'
                                }`}
                              >
                                {formatArmoryStatus(armoryStatus)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {item.last_signed_by || <span className="text-slate-400">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Badge
                                  variant={isVerified ? 'secondary' : 'outline'}
                                  className={`text-xs font-medium ${isVerified
                                    ? 'bg-green-100 text-green-800 border-green-200'
                                    : 'text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {isVerified ? 'Verified Today' : 'Pending'}
                                </Badge>
                                {isVerified ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleUndoAction}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Undo
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={handleVerifyAction}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <ClipboardCheck className="w-4 h-4 mr-2" />
                                    )}
                                    Mark Verified
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="text-lg font-semibold text-slate-800">Unassigned Serialized Gear</h3>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={gearSearchTerm}
                    onChange={(e) => setGearSearchTerm(e.target.value)}
                    placeholder="Search gear by type, ID or status..."
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 px-4">
                        <Checkbox
                          checked={gearHeaderChecked}
                          onCheckedChange={(checked) => {
                            setSelectedUnassignedItems(prev => {
                              const next = new Set(prev);
                              if (checked) {
                                displayedGearKeys.forEach(key => next.add(key));
                              } else {
                                displayedGearKeys.forEach(key => next.delete(key));
                              }
                              return next;
                            });
                          }}
                          aria-label="Select all unassigned gear"
                        />
                      </TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Armory Status</TableHead>
                      <TableHead>Last Signed By</TableHead>
                      <TableHead className="text-right">Verification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnassignedGear.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-slate-500 py-6">
                          No serialized gear matches your search criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUnassignedGear.map(item => {
                        const isSelected = selectedUnassignedItems.has(item.key);
                        const isVerified = Boolean(item.verificationRecord);
                        const isProcessing = verifyingGearIds.has(item.id) || undoingGearIds.has(item.id);
                        const statusVariant = item.status === 'functioning'
                          ? 'success'
                          : item.status === 'not_functioning'
                            ? 'destructive'
                            : 'secondary';
                        const statusLabel = item.status
                          ? item.status.replace(/_/g, ' ').toUpperCase()
                          : 'UNKNOWN';
                        const armoryStatus = item.armory_status;

                        const handleVerifyAction = () => handleVerifyUnassignedGear(item.record);
                        const handleUndoAction = () => {
                          if (item.verificationRecord?.id) {
                            handleUndoUnassignedGear(item.verificationRecord, item.id);
                          }
                        };

                        return (
                          <TableRow key={item.key}>
                            <TableCell className="w-12 px-4">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleUnassignedSelection(item.key)}
                                aria-label={`Select gear ${item.id}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-sm text-slate-800">
                              {item.name}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-700">
                              {item.id}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant} className="text-xs font-semibold">
                                {statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs font-normal ${armoryStatus === 'with_soldier'
                                  ? 'text-green-800 bg-green-50 border-green-200'
                                  : 'text-slate-700 bg-slate-100 border-slate-200'
                                }`}
                              >
                                {formatArmoryStatus(armoryStatus)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {item.last_signed_by || <span className="text-slate-400">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Badge
                                  variant={isVerified ? 'secondary' : 'outline'}
                                  className={`text-xs font-medium ${isVerified
                                    ? 'bg-green-100 text-green-800 border-green-200'
                                    : 'text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {isVerified ? 'Verified Today' : 'Pending'}
                                </Badge>
                                {isVerified ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleUndoAction}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Undo
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={handleVerifyAction}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <ClipboardCheck className="w-4 h-4 mr-2" />
                                    )}
                                    Mark Verified
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="text-lg font-semibold text-slate-800">Unassigned Drone Sets</h3>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={droneSearchTerm}
                    onChange={(e) => setDroneSearchTerm(e.target.value)}
                    placeholder="Search drone sets by type, serial or status..."
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 px-4">
                        <Checkbox
                          checked={droneHeaderChecked}
                          onCheckedChange={(checked) => {
                            setSelectedUnassignedItems(prev => {
                              const next = new Set(prev);
                              if (checked) {
                                displayedDroneSetKeys.forEach(key => next.add(key));
                              } else {
                                displayedDroneSetKeys.forEach(key => next.delete(key));
                              }
                              return next;
                            });
                          }}
                          aria-label="Select all unassigned drone sets"
                        />
                      </TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Serial</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Armory Status</TableHead>
                      <TableHead>Division</TableHead>
                      <TableHead className="text-right">Verification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnassignedDroneSets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-slate-500 py-6">
                          No drone sets match your search criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUnassignedDroneSets.map(item => {
                        const isSelected = selectedUnassignedItems.has(item.key);
                        const isVerified = Boolean(item.verificationRecord);
                        const isProcessing = verifyingDroneSetIds.has(item.id) || undoingDroneSetIds.has(item.id);
                        const statusVariant =
                          item.status === 'Operational'
                            ? 'success'
                            : item.status === 'Maintenance'
                              ? 'secondary'
                              : item.status === 'Damaged'
                                ? 'destructive'
                                : 'secondary';
                        const statusLabel = item.status || 'Unknown';

                        const handleVerifyAction = () => handleVerifyUnassignedDroneSet(item.record);
                        const handleUndoAction = () => {
                          if (item.verificationRecord?.id) {
                            handleUndoUnassignedDroneSet(item.verificationRecord, item.id);
                          }
                        };

                        return (
                          <TableRow key={item.key}>
                            <TableCell className="w-12 px-4">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleUnassignedSelection(item.key)}
                                aria-label={`Select drone set ${item.id}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-sm text-slate-800">
                              {item.name}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-700">
                              {item.record?.set_serial_number || item.id}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant} className="text-xs font-semibold">
                                {statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs font-normal ${item.armory_status === 'with_soldier'
                                  ? 'text-green-800 bg-green-50 border-green-200'
                                  : 'text-slate-700 bg-slate-100 border-slate-200'
                                }`}
                              >
                                {formatArmoryStatus(item.armory_status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {item.division_name || <span className="text-slate-400">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Badge
                                  variant={isVerified ? 'secondary' : 'outline'}
                                  className={`text-xs font-medium ${isVerified
                                    ? 'bg-green-100 text-green-800 border-green-200'
                                    : 'text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {isVerified ? 'Verified Today' : 'Pending'}
                                </Badge>
                                {isVerified ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleUndoAction}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Undo
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={handleVerifyAction}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <ClipboardCheck className="w-4 h-4 mr-2" />
                                    )}
                                    Mark Verified
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="text-lg font-semibold text-slate-800">Unassigned Drone Components</h3>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={componentSearchTerm}
                    onChange={(e) => setComponentSearchTerm(e.target.value)}
                    placeholder="Search components by type, ID or status..."
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 px-4">
                        <Checkbox
                          checked={componentHeaderChecked}
                          onCheckedChange={(checked) => {
                            setSelectedUnassignedItems(prev => {
                              const next = new Set(prev);
                              if (checked) {
                                displayedComponentKeys.forEach(key => next.add(key));
                              } else {
                                displayedComponentKeys.forEach(key => next.delete(key));
                              }
                              return next;
                            });
                          }}
                          aria-label="Select all unassigned drone components"
                        />
                      </TableHead>
                      <TableHead>Component Type</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned Drone Set</TableHead>
                      <TableHead>Division</TableHead>
                      <TableHead className="text-right">Verification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnassignedComponents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-slate-500 py-6">
                          No drone components match your search criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUnassignedComponents.map(item => {
                        const isSelected = selectedUnassignedItems.has(item.key);
                        const isVerified = Boolean(item.verificationRecord);
                        const isProcessing = verifyingComponentIds.has(item.id) || undoingComponentIds.has(item.id);
                        const statusVariant =
                          item.status === 'Operational'
                            ? 'success'
                            : item.status === 'Maintenance'
                              ? 'secondary'
                              : item.status === 'Damaged'
                                ? 'destructive'
                                : 'secondary';
                        const statusLabel = item.status || 'Unknown';
                        const parentSetSerial = item.parentSet?.set_serial_number;

                        const handleVerifyAction = () => handleVerifyUnassignedComponent(item.record);
                        const handleUndoAction = () => {
                          if (item.verificationRecord?.id) {
                            handleUndoUnassignedComponent(item.verificationRecord, item.id);
                          }
                        };

                        return (
                          <TableRow key={item.key}>
                            <TableCell className="w-12 px-4">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleUnassignedSelection(item.key)}
                                aria-label={`Select drone component ${item.id}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-sm text-slate-800">
                              {item.name}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-700">
                              {item.id}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant} className="text-xs font-semibold">
                                {statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {parentSetSerial ? (
                                <span className="font-mono text-xs">{parentSetSerial}</span>
                              ) : (
                                <span className="text-slate-500">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {item.division_name || item.parentSet?.division_name || <span className="text-slate-400">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Badge
                                  variant={isVerified ? 'secondary' : 'outline'}
                                  className={`text-xs font-medium ${isVerified
                                    ? 'bg-green-100 text-green-800 border-green-200'
                                    : 'text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {isVerified ? 'Verified Today' : 'Pending'}
                                </Badge>
                                {isVerified ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleUndoAction}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Undo
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={handleVerifyAction}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <ClipboardCheck className="w-4 h-4 mr-2" />
                                    )}
                                    Mark Verified
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );

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

      {isManagerOrAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-fit">
            <TabsTrigger value="soldiers">Soldier Verification</TabsTrigger>
            <TabsTrigger value="unassigned">Unassigned Equipment</TabsTrigger>
          </TabsList>
          <TabsContent value="soldiers" className="space-y-6 focus:outline-none">
            {soldierManagerControls}
            {soldierListSection}
          </TabsContent>
          <TabsContent value="unassigned" className="space-y-6 focus:outline-none">
            {unassignedSection}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-6">
          {soldierManagerControls}
          {soldierListSection}
        </div>
      )}

    </div>
  );
}

