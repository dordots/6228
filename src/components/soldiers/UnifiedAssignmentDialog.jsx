
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Search, Plus, X, Users, Target, Binoculars, Joystick, Package, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import SignatureCanvas from './SignatureCanvas';
import { Checkbox } from "@/components/ui/checkbox";

import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DroneSet } from "@/api/entities";
import { DroneComponent } from "@/api/entities";
import { Equipment } from "@/api/entities";
import { ActivityLog } from '@/api/entities';
import { User } from '@/api/entities';
import { Soldier } from "@/api/entities";
import { sendSigningFormByActivity } from "@/api/functions";

// Import the full forms for creating new items
import WeaponForm from "../weapons/WeaponForm";
import GearForm from "../gear/GearForm";
import DroneSetForm from "../drones/DroneSetForm";

export default function UnifiedAssignmentDialog({
  open,
  onOpenChange,
  soldier,
  unassignedWeapons = [],
  unassignedGear = [],
  unassignedDroneSets = [],
  equipment = [], // This prop contains ALL equipment items (assigned and unassigned)
  weapons = [],
  gear = [],
  drones = [],
  onSuccess,
}) {
  // User state for permissions
  const [currentUser, setCurrentUser] = useState(null);
  
  // Serialized items state
  const [selectedWeaponIds, setSelectedWeaponIds] = useState([]);
  const [selectedGearIds, setSelectedGearIds] = useState([]);
  const [selectedDroneSetIds, setSelectedDroneSetIds] = useState([]);
  const [weaponSearch, setWeaponSearch] = useState('');
  const [gearSearch, setGearSearch] = useState('');
  const [droneSetSearch, setDroneSetSearch] = useState('');

  // Equipment state
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState([]);
  const [equipmentQuantities, setEquipmentQuantities] = useState({});
  const [equipmentSearch, setEquipmentSearch] = useState('');

  const [signature, setSignature] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [toast, setToast] = useState(null);

  // Local state for optimistic updates
  const [localUnassignedWeapons, setLocalUnassignedWeapons] = useState([]);
  const [localUnassignedGear, setLocalUnassignedGear] = useState([]);
  const [localUnassignedDroneSets, setLocalUnassignedDroneSets] = useState([]);

  // Form dialog states
  const [showWeaponForm, setShowWeaponForm] = useState(false);
  const [showGearForm, setShowGearForm] = useState(false);
  const [showDroneSetForm, setShowDroneSetForm] = useState(false);
  const [initialWeaponData, setInitialWeaponData] = useState(null);
  const [initialGearData, setInitialGearData] = useState(null);
  const [initialDroneSetData, setInitialDroneSetData] = useState(null);

  // קנס"פ dialog state
  const [showKansapDialog, setShowKansapDialog] = useState(false);
  const [selectedMachineGun, setSelectedMachineGun] = useState(null);
  const [availableKansapPairs, setAvailableKansapPairs] = useState([]);

  useEffect(() => {
    // Fetch current user for permissions
    const fetchUser = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
      } catch (error) {
        // Error fetching user
      }
    };
    if (open) {
      fetchUser();
    }
  }, [open]);

  useEffect(() => {
    // Sync local unassigned items with props
    setLocalUnassignedWeapons(unassignedWeapons || []);
    setLocalUnassignedGear(unassignedGear || []);
    setLocalUnassignedDroneSets(unassignedDroneSets || []);

    // Reset selections when soldier or unassigned lists change
    // This prevents selections from persisting if the dialog context (e.g., soldier) changes.
    setSelectedWeaponIds([]);
    setSelectedGearIds([]);
    setSelectedDroneSetIds([]);
    setSelectedEquipmentIds([]);
    setEquipmentQuantities({}); // Also reset quantities for equipment
    setWeaponSearch('');
    setGearSearch('');
    setDroneSetSearch('');
    setEquipmentSearch('');
    setSignature('');
    setIsLoading(false);
    setToast(null);

  }, [soldier, unassignedWeapons, unassignedGear, unassignedDroneSets, equipment]); // Added equipment to dependencies as it impacts availableEquipment

  // Filter equipment by soldier's division and availability
  const availableEquipment = useMemo(() => {
    if (!Array.isArray(equipment) || !soldier) {
        return [];
    }

    const filtered = equipment.filter(item => {
      // Fixed: Item must be unassigned (null, '', or undefined) and have stock
      // Changed from: if (item.assigned_to || ...)
      // To: if (item.assigned_to && item.assigned_to !== '' || ...)
      // This properly handles null, undefined, and empty string
      if ((item.assigned_to && item.assigned_to !== '') || (item.quantity || 0) <= 0) {
        return false;
      }

      // Item is available if it has no division OR its division matches the soldier's
      return !item.division_name || item.division_name === soldier.division_name;
    });

    return filtered;
  }, [equipment, soldier]);

  // Machine gun types that can have קנס"פ attachments
  const MACHINE_GUN_TYPES = [
    'מקלע קל נגב 7.62',
    'מקלע קל נגב דגם ב',
    'מקלע אחיד מאג 7.62',
    'מקלע נגב קומנדו'
  ];

  // Helper function to check if a weapon is a machine gun
  const isMachineGun = useCallback((weapon) => {
    if (!weapon || !weapon.weapon_type) return false;
    return MACHINE_GUN_TYPES.some(type => weapon.weapon_type.includes(type));
  }, []);

  // Helper function to find matching קנס"פ pairs for a machine gun
  const findKansapPairs = useCallback((machineGun) => {
    if (!machineGun || !machineGun.weapon_id || !machineGun.weapon_type) return [];
    
    // Find all קנס"פ weapons that match the type (not just ID pattern)
    // Show all available קנס"פ pairs that match the machine gun type
    const matchingKansap = localUnassignedWeapons.filter(weapon => {
      if (!weapon.weapon_type || !weapon.weapon_id) return false;
      if (!weapon.weapon_type.includes('קנס"פ')) return false;
      
      // Must have -1 or -2 suffix to be a valid קנס"פ pair
      const kansapId = weapon.weapon_id;
      const hasValidSuffix = kansapId.includes('-1') || kansapId.includes('-2');
      if (!hasValidSuffix) return false;
      
      // Check if קנס"פ type matches the machine gun type
      // Extract key words from machine gun type to match with קנס"פ
      let typeMatches = false;
      const machineGunType = machineGun.weapon_type;
      const kansapType = weapon.weapon_type;
      
      // Match patterns:
      // "מקלע קל נגב 7.62" -> קנס"פ - נגב 7.62 (specific match required)
      // "מקלע קל נגב דגם ב" -> קנס"פ - נגב (only, not קנס"פ - נגב דגם ב)
      // "מקלע אחיד מאג 7.62" -> קנס"פ - מאג or קנס"פ - מאג 7.62 (all matching types)
      // "מקלע נגב קומנדו" -> קנס"פ - נגב קומנדו (specific match required)
      
      if (machineGunType.includes('נגב קומנדו')) {
        // For "מקלע נגב קומנדו", only match "קנס"פ - נגב קומנדו"
        typeMatches = kansapType.includes('נגב קומנדו');
      } else if (machineGunType.includes('דגם ב')) {
        // For "מקלע קל נגב דגם ב", only match "קנס"פ - נגב" (not "קנס"פ - נגב דגם ב")
        typeMatches = kansapType.includes('נגב') && !kansapType.includes('דגם ב') && !kansapType.includes('קומנדו') && !kansapType.includes('7.62');
      } else if (machineGunType.includes('7.62') && machineGunType.includes('נגב')) {
        // For "מקלע קל נגב 7.62", only match "קנס"פ - נגב 7.62"
        typeMatches = kansapType.includes('נגב 7.62') || (kansapType.includes('נגב') && kansapType.includes('7.62'));
      } else if (machineGunType.includes('נגב')) {
        // For other נגב machine guns, match any קנס"פ with נגב (but not קומנדו, דגם ב, or 7.62 specific ones)
        typeMatches = kansapType.includes('נגב') && !kansapType.includes('קומנדו') && !kansapType.includes('דגם ב') && !kansapType.includes('7.62');
      } else if (machineGunType.includes('מאג')) {
        // For מאג machine guns, match any קנס"פ with מאג
        typeMatches = kansapType.includes('מאג');
      }
      
      return typeMatches;
    });
    
    // Group into pairs
    const pairs = [];
    const processed = new Set();
    
    matchingKansap.forEach(weapon => {
      if (processed.has(weapon.id)) return;
      
      const weaponId = weapon.weapon_id;
      const baseId = weaponId.replace(/-[12]$/, '');
      const suffix = weaponId.endsWith('-1') ? '1' : weaponId.endsWith('-2') ? '2' : null;
      
      if (!suffix) return;
      
      const otherSuffix = suffix === '1' ? '2' : '1';
      const otherWeaponId = `${baseId}-${otherSuffix}`;
      const otherWeapon = matchingKansap.find(w => w.weapon_id === otherWeaponId);
      
      if (otherWeapon) {
        // Extract display name (e.g., "קנס"פ - נגב")
        const nameMatch = weapon.weapon_type.match(/קנס"פ\s*-?\s*(.+)/);
        const displayName = nameMatch ? `קנס"פ - ${nameMatch[1].trim()}` : weapon.weapon_type;
        
        pairs.push({
          id: `${weapon.id}-${otherWeapon.id}`,
          weapon1: weapon,
          weapon2: otherWeapon,
          displayName: displayName
        });
        processed.add(weapon.id);
        processed.add(otherWeapon.id);
      } else {
        // Only one weapon found, still add it
        const nameMatch = weapon.weapon_type.match(/קנס"פ\s*-?\s*(.+)/);
        const displayName = nameMatch ? `קנס"פ - ${nameMatch[1].trim()}` : weapon.weapon_type;
        
        pairs.push({
          id: weapon.id,
          weapon1: weapon,
          weapon2: null,
          displayName: displayName
        });
        processed.add(weapon.id);
      }
    });
    
    return pairs;
  }, [localUnassignedWeapons]);

  // Helper function to find paired weapon for קנס"פ weapons
  // Defined before weaponOptions to avoid hoisting issues
  const findPairedWeapon = useCallback((weapon, includeSelected = false) => {
    if (!weapon || !weapon.weapon_type || !weapon.weapon_id) return null;
    
    // Check if weapon type contains "קנס"פ"
    if (!weapon.weapon_type.includes('קנס"פ')) return null;
    
    // Extract base ID (remove -1 or -2 suffix)
    const weaponId = weapon.weapon_id;
    const baseId = weaponId.replace(/-[12]$/, '');
    
    // Determine the suffix of current weapon
    const currentSuffix = weaponId.endsWith('-1') ? '1' : weaponId.endsWith('-2') ? '2' : null;
    if (!currentSuffix) return null;
    
    // Find the paired weapon with the other suffix
    const pairedSuffix = currentSuffix === '1' ? '2' : '1';
    const pairedWeaponId = `${baseId}-${pairedSuffix}`;
    
    // Find the paired weapon in available weapons
    const pairedWeapon = localUnassignedWeapons.find(w => 
      w.weapon_id === pairedWeaponId && 
      w.weapon_type === weapon.weapon_type &&
      (includeSelected || !selectedWeaponIds.includes(w.id))
    );
    
    return pairedWeapon || null;
  }, [localUnassignedWeapons, selectedWeaponIds]);

  // Filter weapons: prevent selecting types soldier already owns or already selected
  const weaponOptions = useMemo(() => {
    if (!Array.isArray(localUnassignedWeapons) || !soldier) return [];

    // Get types of weapons soldier already owns (from weapons prop)
    const alreadyOwnedTypes = new Set(
      (weapons || [])
        .filter(w => w.assigned_to === soldier.soldier_id)
        .map(w => w.weapon_type)
        .filter(Boolean)
    );

    // Get types of already selected weapons in current session
    const selectedTypes = new Set(
      selectedWeaponIds
        .map(id => localUnassignedWeapons.find(w => w.id === id)?.weapon_type)
        .filter(Boolean)
    );

    const filtered = localUnassignedWeapons.filter(weapon => {
      if (!weapon) return false;

      // FIRST: Filter out קנס"פ weapons from options - they will be attached automatically via machine gun dialog
      // Simply check if the weapon_type contains the word קנס"פ
      if (weapon.weapon_type && typeof weapon.weapon_type === 'string' && weapon.weapon_type.includes('קנס"פ')) {
        return false;
      }

      const matchesDivision = !weapon.division_name || weapon.division_name === soldier.division_name;
      const notSelected = !selectedWeaponIds.includes(weapon.id);
      const typeNotOwned = !alreadyOwnedTypes.has(weapon.weapon_type); // Block types soldier already owns
      const typeNotSelected = !selectedTypes.has(weapon.weapon_type); // Prevent duplicate types in current selection
      const matchesSearch = weaponSearch.length === 0 ||
         (weapon.weapon_type && weapon.weapon_type.toLowerCase().includes(weaponSearch.toLowerCase())) ||
         (weapon.weapon_id && weapon.weapon_id.toLowerCase().includes(weaponSearch.toLowerCase()));

      return matchesDivision && notSelected && typeNotOwned && typeNotSelected && matchesSearch;
    });

    // Double-check: ensure no קנס"פ weapons slipped through
    return filtered.filter(weapon => {
      if (!weapon || !weapon.weapon_type) return true;
      return !weapon.weapon_type.includes('קנס"פ');
    });
  }, [localUnassignedWeapons, weaponSearch, selectedWeaponIds, soldier, weapons]);

  const gearOptions = useMemo(() => {
    if (!Array.isArray(localUnassignedGear) || !soldier) return [];

    // Get types of gear soldier already owns (from gear prop)
    const alreadyOwnedTypes = new Set(
      (gear || [])
        .filter(g => g.assigned_to === soldier.soldier_id)
        .map(g => g.gear_type)
        .filter(Boolean)
    );

    // Get types of already selected gear in current session
    const selectedTypes = new Set(
      selectedGearIds
        .map(id => localUnassignedGear.find(g => g.id === id)?.gear_type)
        .filter(Boolean)
    );

    return localUnassignedGear.filter(gearItem => {
      const matchesDivision = !gearItem.division_name || gearItem.division_name === soldier.division_name;
      const notSelected = !selectedGearIds.includes(gearItem.id);
      const typeNotOwned = !alreadyOwnedTypes.has(gearItem.gear_type); // Block types soldier already owns
      const typeNotSelected = !selectedTypes.has(gearItem.gear_type); // Prevent duplicate types in current selection
      const matchesSearch = gearSearch.length === 0 ||
        (gearItem.gear_type && gearItem.gear_type.toLowerCase().includes(gearSearch.toLowerCase())) ||
        (gearItem.gear_id && gearItem.gear_id.toLowerCase().includes(gearSearch.toLowerCase()));

        return gearItem && matchesDivision && notSelected && typeNotOwned && typeNotSelected && matchesSearch;
    });
  }, [localUnassignedGear, gearSearch, selectedGearIds, soldier, gear]);

  const droneSetOptions = useMemo(() => {
    if (!Array.isArray(localUnassignedDroneSets) || !soldier) return [];

    // NOTE: Unlike weapons and gear, soldiers CAN have multiple drones of the same type
    // So we don't filter by type here

    return localUnassignedDroneSets.filter(droneSet => {
      const matchesDivision = !droneSet.division_name || droneSet.division_name === soldier.division_name;
      const notSelected = !selectedDroneSetIds.includes(droneSet.id);
      const matchesSearch = droneSetSearch.length === 0 ||
         (droneSet.set_serial_number && droneSet.set_serial_number.toLowerCase().includes(droneSetSearch.toLowerCase())) ||
         (droneSet.set_type && droneSet.set_type.toLowerCase().includes(droneSetSearch.toLowerCase()));

      return droneSet && matchesDivision && notSelected && matchesSearch;
    });
  }, [localUnassignedDroneSets, droneSetSearch, selectedDroneSetIds, soldier, drones]);

  const equipmentOptions = useMemo(() => {
    // If availableEquipment is empty, means no stock or no division, so no options
    if (availableEquipment.length === 0) return [];
    return availableEquipment.filter(item =>
      !selectedEquipmentIds.includes(item.id) &&
      (equipmentSearch.length === 0 ||
       (item.equipment_type && item.equipment_type.toLowerCase().includes(equipmentSearch.toLowerCase())) ||
       (item.serial_number && item.serial_number.toLowerCase().includes(equipmentSearch.toLowerCase())))
    );
  }, [availableEquipment, equipmentSearch, selectedEquipmentIds]);

  // Selection handlers
  const selectItem = (type, item) => {
    if (type === 'weapon') {
      // Check if this is a machine gun that needs קנס"פ attachment
      if (isMachineGun(item)) {
        const kansapPairs = findKansapPairs(item);
        // Always show dialog for machine guns, even if no pairs available
        setSelectedMachineGun(item);
        setAvailableKansapPairs(kansapPairs);
        setShowKansapDialog(true);
        return; // Don't add the weapon yet, wait for user to select קנס"פ pair or cancel
      }
      
      // Regular weapon selection
      const newIds = [item.id];
      setSelectedWeaponIds(prev => {
        const combined = [...prev, ...newIds];
        // Remove duplicates
        return [...new Set(combined)];
      });
    } else if (type === 'gear') {
      setSelectedGearIds(prev => [...prev, item.id]);
    } else if (type === 'droneSet') {
      setSelectedDroneSetIds(prev => [...prev, item.id]);
    } else if (type === 'equipment') {
      setSelectedEquipmentIds(prev => [...prev, item.id]);
      setEquipmentQuantities(prev => ({ ...prev, [item.id]: 1 }));
    }
  };

  // Handle קנס"פ pair selection
  const handleKansapPairSelect = (pair) => {
    if (!selectedMachineGun) return;
    
    // Add the machine gun
    const newIds = [selectedMachineGun.id];
    
    // Add the קנס"פ pair weapons
    if (pair.weapon1) {
      newIds.push(pair.weapon1.id);
    }
    if (pair.weapon2) {
      newIds.push(pair.weapon2.id);
    }
    
    setSelectedWeaponIds(prev => {
      const combined = [...prev, ...newIds];
      return [...new Set(combined)];
    });
    
    // Close dialog and reset state
    setShowKansapDialog(false);
    setSelectedMachineGun(null);
    setAvailableKansapPairs([]);
  };

  const handleRemoveItem = (type, id) => {
    if (type === 'weapon') {
      // Find the weapon to check if it's a machine gun or קנס"פ
      const weapon = localUnassignedWeapons.find(w => w.id === id);
      
      if (!weapon) {
        setSelectedWeaponIds(prev => prev.filter(weaponId => weaponId !== id));
        return;
      }

      // Check if this is a machine gun - if so, find and remove its קנס"פ pairs
      if (isMachineGun(weapon)) {
        const kansapIds = [];
        selectedWeaponIds.forEach(otherId => {
          if (otherId === id) return;
          const otherWeapon = localUnassignedWeapons.find(w => w.id === otherId);
          if (otherWeapon && otherWeapon.weapon_type && otherWeapon.weapon_type.includes('קנס"פ')) {
            // Check if this קנס"פ matches the machine gun (type matching only, no ID matching)
            const machineGunType = weapon.weapon_type;
            const kansapType = otherWeapon.weapon_type;
            
            // Match type based on key words (same logic as findKansapPairs)
            let typeMatches = false;
            if (machineGunType.includes('נגב קומנדו')) {
              typeMatches = kansapType.includes('נגב קומנדו');
            } else if (machineGunType.includes('דגם ב')) {
              typeMatches = kansapType.includes('נגב') && !kansapType.includes('דגם ב') && !kansapType.includes('קומנדו') && !kansapType.includes('7.62');
            } else if (machineGunType.includes('7.62') && machineGunType.includes('נגב')) {
              typeMatches = kansapType.includes('נגב 7.62') || (kansapType.includes('נגב') && kansapType.includes('7.62'));
            } else if (machineGunType.includes('נגב')) {
              typeMatches = kansapType.includes('נגב') && !kansapType.includes('קומנדו') && !kansapType.includes('דגם ב') && !kansapType.includes('7.62');
            } else if (machineGunType.includes('מאג')) {
              typeMatches = kansapType.includes('מאג');
            }
            
            if (typeMatches) {
              kansapIds.push(otherId);
            }
          }
        });
        
        // Remove machine gun and all its קנס"פ pairs
        setSelectedWeaponIds(prev => prev.filter(weaponId => weaponId !== id && !kansapIds.includes(weaponId)));
      } else if (weapon.weapon_type && weapon.weapon_type.includes('קנס"פ')) {
        // This is a קנס"פ weapon - find its machine gun and remove both
        const machineGunId = selectedWeaponIds.find(otherId => {
          if (otherId === id) return false;
          const otherWeapon = localUnassignedWeapons.find(w => w.id === otherId);
          if (!otherWeapon || !isMachineGun(otherWeapon)) return false;
          
          // Check if this קנס"פ matches the machine gun (type matching only, not ID)
          const machineGunType = otherWeapon.weapon_type;
          const kansapType = weapon.weapon_type;
          
          // Match type based on key words (same logic as findKansapPairs)
          let typeMatches = false;
          if (machineGunType.includes('נגב קומנדו')) {
            typeMatches = kansapType.includes('נגב קומנדו');
          } else if (machineGunType.includes('דגם ב')) {
            typeMatches = kansapType.includes('נגב') && !kansapType.includes('דגם ב') && !kansapType.includes('קומנדו') && !kansapType.includes('7.62');
          } else if (machineGunType.includes('7.62') && machineGunType.includes('נגב')) {
            typeMatches = kansapType.includes('נגב 7.62') || (kansapType.includes('נגב') && kansapType.includes('7.62'));
          } else if (machineGunType.includes('נגב')) {
            typeMatches = kansapType.includes('נגב') && !kansapType.includes('קומנדו') && !kansapType.includes('דגם ב') && !kansapType.includes('7.62');
          } else if (machineGunType.includes('מאג')) {
            typeMatches = kansapType.includes('מאג');
          }
          
          return typeMatches;
        });
        
        if (machineGunId) {
          // Find all קנס"פ pairs for this machine gun
          const machineGun = localUnassignedWeapons.find(w => w.id === machineGunId);
          if (machineGun) {
            const kansapIds = [];
            selectedWeaponIds.forEach(otherId => {
              if (otherId === machineGunId) return;
              const otherWeapon = localUnassignedWeapons.find(w => w.id === otherId);
              if (otherWeapon && otherWeapon.weapon_type && otherWeapon.weapon_type.includes('קנס"פ')) {
                const machineGunType = machineGun.weapon_type;
                const kansapType = otherWeapon.weapon_type;
                
                // Match type based on key words (same logic as findKansapPairs, no ID matching)
                let typeMatches = false;
                if (machineGunType.includes('נגב קומנדו')) {
                  typeMatches = kansapType.includes('נגב קומנדו');
                } else if (machineGunType.includes('דגם ב')) {
                  typeMatches = kansapType.includes('נגב') && !kansapType.includes('דגם ב') && !kansapType.includes('קומנדו') && !kansapType.includes('7.62');
                } else if (machineGunType.includes('7.62') && machineGunType.includes('נגב')) {
                  typeMatches = kansapType.includes('נגב 7.62') || (kansapType.includes('נגב') && kansapType.includes('7.62'));
                } else if (machineGunType.includes('נגב')) {
                  typeMatches = kansapType.includes('נגב') && !kansapType.includes('קומנדו') && !kansapType.includes('דגם ב') && !kansapType.includes('7.62');
                } else if (machineGunType.includes('מאג')) {
                  typeMatches = kansapType.includes('מאג');
                }
                
                if (typeMatches) {
                  kansapIds.push(otherId);
                }
              }
            });
            
            // Remove machine gun and all its קנס"פ pairs
            setSelectedWeaponIds(prev => prev.filter(weaponId => weaponId !== machineGunId && weaponId !== id && !kansapIds.includes(weaponId)));
            return;
          }
        }
        
        // Fallback: if it's a קנס"פ weapon, find its pair
        const pairedWeapon = findPairedWeapon(weapon, true);
        if (pairedWeapon && selectedWeaponIds.includes(pairedWeapon.id)) {
          setSelectedWeaponIds(prev => prev.filter(weaponId => weaponId !== id && weaponId !== pairedWeapon.id));
        } else {
          setSelectedWeaponIds(prev => prev.filter(weaponId => weaponId !== id));
        }
      } else {
        // Regular weapon - just remove this one
        setSelectedWeaponIds(prev => prev.filter(weaponId => weaponId !== id));
      }
    } else if (type === 'gear') {
      setSelectedGearIds(prev => prev.filter(gearId => gearId !== id));
    } else if (type === 'droneSet') {
      setSelectedDroneSetIds(prev => prev.filter(setId => setId !== id));
    } else if (type === 'equipment') {
      setSelectedEquipmentIds(prev => prev.filter(equipmentId => equipmentId !== id));
      setEquipmentQuantities(prev => { const { [id]: _, ...rest } = prev; return rest; });
    }
  };

  const handleQuantityChange = (id, value) => {
    const item = availableEquipment.find(eq => eq.id === id);
    if (!item) return;

    let qty = parseInt(value, 10);
    if (isNaN(qty) || qty < 1) {
      qty = 1;
    } else if (qty > item.quantity) {
      qty = item.quantity;
    }
    setEquipmentQuantities(prev => ({ ...prev, [id]: qty }));
  };

  const showToast = (message, variant) => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAssign = async () => {
    const selectedWeapons = selectedWeaponIds.map(id => localUnassignedWeapons.find(w => w.id === id)).filter(Boolean);
    const selectedGear = selectedGearIds.map(id => localUnassignedGear.find(g => g.id === id)).filter(Boolean);
    const selectedDroneSets = selectedDroneSetIds.map(id => localUnassignedDroneSets.find(d => d.id === id)).filter(Boolean);

    const equipmentAssignments = selectedEquipmentIds.map(id => {
        const item = availableEquipment.find(e => e.id === id);
        return item ? {
            equipment_type: item.equipment_type,
            quantity: equipmentQuantities[id] || 1,
            condition: item.condition,
            serial_number: item.serial_number, // This serial number refers to the stock item, not necessarily the soldier's assigned item (which is non-serialized)
            division_name: item.division_name,
            original_stock_id: item.id
        } : null;
    }).filter(Boolean);

    const validEquipmentAssignments = equipmentAssignments.filter(e => e.quantity > 0);


    const hasSelectedItems = selectedWeapons.length > 0 || selectedGear.length > 0 ||
                             selectedDroneSets.length > 0 || validEquipmentAssignments.length > 0;

    if (!hasSelectedItems) {
      showToast("No items selected for assignment.", "destructive");
      return;
    }

    // NEW: Check for duplicate types (excluding קנס"פ pairs)
    const weaponTypes = selectedWeapons.map(w => w.weapon_type);
    const gearTypes = selectedGear.map(g => g.gear_type);
    const droneTypes = selectedDroneSets.map(d => d.set_type);

    // Helper to check if two weapons are a valid קנס"פ pair
    const isValidKansapPair = (weapon1, weapon2) => {
      if (!weapon1 || !weapon2) return false;
      if (!weapon1.weapon_type || !weapon2.weapon_type) return false;
      if (!weapon1.weapon_type.includes('קנס"פ') || !weapon2.weapon_type.includes('קנס"פ')) return false;
      if (weapon1.weapon_type !== weapon2.weapon_type) return false;
      
      // Check if they have the same base ID (without -1/-2 suffix)
      const baseId1 = weapon1.weapon_id.replace(/-[12]$/, '');
      const baseId2 = weapon2.weapon_id.replace(/-[12]$/, '');
      return baseId1 === baseId2;
    };

    // Filter out valid קנס"פ pairs from duplicate check
    const weaponTypesForDuplicateCheck = [];
    const processedWeaponIndices = new Set();
    
    for (let i = 0; i < selectedWeapons.length; i++) {
      if (processedWeaponIndices.has(i)) continue;
      
      const weapon1 = selectedWeapons[i];
      let isPartOfPair = false;
      
      // Check if this weapon is part of a קנס"פ pair
      for (let j = i + 1; j < selectedWeapons.length; j++) {
        if (processedWeaponIndices.has(j)) continue;
        
        const weapon2 = selectedWeapons[j];
        if (isValidKansapPair(weapon1, weapon2)) {
          // This is a valid pair, skip both from duplicate check
          processedWeaponIndices.add(i);
          processedWeaponIndices.add(j);
          isPartOfPair = true;
          break;
        }
      }
      
      if (!isPartOfPair) {
        weaponTypesForDuplicateCheck.push(weapon1.weapon_type);
      }
    }

    const hasDuplicateWeapons = weaponTypesForDuplicateCheck.length !== new Set(weaponTypesForDuplicateCheck).size;
    const hasDuplicateGear = gearTypes.length !== new Set(gearTypes).size;
    const hasDuplicateDrones = droneTypes.length !== new Set(droneTypes).size;

    if (hasDuplicateWeapons || hasDuplicateGear || hasDuplicateDrones) {
      let errorMessage = "Cannot assign multiple items of the same type:\n";
      if (hasDuplicateWeapons) {
        const duplicates = weaponTypesForDuplicateCheck.filter((type, index) => weaponTypesForDuplicateCheck.indexOf(type) !== index);
        errorMessage += `\n• Weapons: ${[...new Set(duplicates)].join(', ')}`;
      }
      if (hasDuplicateGear) {
        const duplicates = gearTypes.filter((type, index) => gearTypes.indexOf(type) !== index);
        errorMessage += `\n• Gear: ${[...new Set(duplicates)].join(', ')}`;
      }
      if (hasDuplicateDrones) {
        const duplicates = droneTypes.filter((type, index) => droneTypes.indexOf(type) !== index);
        errorMessage += `\n• Drones: ${[...new Set(duplicates)].join(', ')}`;
      }
      showToast(errorMessage, "destructive");
      return;
    }

    if (hasSelectedItems && !signature) {
      showToast("Soldier's signature is required to finalize equipment assignment.", "destructive");
      return;
    }

    setIsLoading(true);
    setToast(null);
    setProgress(0);
    setProgressMessage('Preparing assignment...');

    // Fetch drone components for selected drone sets
    const droneSetIds = selectedDroneSets.map(d => d.drone_set_id).filter(Boolean);
    let droneComponents = [];
    if (droneSetIds.length > 0) {
        try {
            const allComponents = await DroneComponent.filter({});
            droneComponents = allComponents.filter(comp => droneSetIds.includes(comp.drone_set_id));
        } catch (error) {
            console.error("Error fetching drone components:", error);
        }
    }

    // Group components by drone set ID
    const componentsByDroneSet = {};
    droneComponents.forEach(comp => {
        if (!componentsByDroneSet[comp.drone_set_id]) {
            componentsByDroneSet[comp.drone_set_id] = [];
        }
        componentsByDroneSet[comp.drone_set_id].push({
            type: comp.component_type,
            id: comp.component_id
        });
    });

    const assignedItemDetails = [
        ...selectedWeapons.map(w => ({ type: 'Weapon', id: w.id, fieldId: w.weapon_id, name: w.weapon_type })),
        ...selectedGear.map(g => ({ type: 'Gear', id: g.id, fieldId: g.gear_id, name: g.gear_type })),
        ...selectedDroneSets.map(d => ({
            type: 'Drone Set',
            id: d.id,
            fieldId: d.set_serial_number,
            name: d.set_type,
            components: componentsByDroneSet[d.drone_set_id] || [] // Add components
        })),
        ...validEquipmentAssignments.map(e => ({ type: 'Equipment', name: e.equipment_type, quantity: e.quantity, original_stock_id: e.original_stock_id }))
    ];

    const totalSteps = 5; // Prepare, Assign Items, Update Soldier, Create Activity Log, Send Email
    let currentStep = 0;

    const updateProgress = (step, message) => {
        currentStep = step;
        setProgress((currentStep / totalSteps) * 100);
        setProgressMessage(message);
    };

    // Create detailed description of assigned items
    const itemsDescription = assignedItemDetails.map(item => {
        if (item.type === 'Equipment') {
            return `${item.name} (x${item.quantity})`;
        }
        return `${item.name} (${item.fieldId})`;
    }).join(', ');

    try {
        updateProgress(1, 'Authenticating user...');
        const currentUser = await User.me();
        if (!currentUser) {
            throw new Error("User not authenticated. Please log in.");
        }

        let performingSoldier = null;
        if (currentUser.linked_soldier_id) {
            try {
                const soldiers = await Soldier.filter({ soldier_id: currentUser.linked_soldier_id });
                performingSoldier = soldiers[0] || null;
            } catch (error) {
                // Error loading linked soldier
            }
        }

        const promises = [];

        // Serialized items (Weapons, Gear, Drones) - Simple assignment update
        for (const item of selectedWeapons) {
            promises.push(Weapon.update(item.weapon_id, { assigned_to: soldier.soldier_id, division_name: soldier.division_name, last_signed_by: `${soldier.first_name} ${soldier.last_name}` }));
        }

        for (const item of selectedGear) {
            promises.push(SerializedGear.update(item.gear_id, { assigned_to: soldier.soldier_id, division_name: soldier.division_name, last_signed_by: `${soldier.first_name} ${soldier.last_name}` }));
        }

        for (const item of selectedDroneSets) {
            promises.push(DroneSet.update(item.drone_set_id, { assigned_to: soldier.soldier_id, division_name: soldier.division_name, last_signed_by: `${soldier.first_name} ${soldier.last_name}` }));
        }

        // FIXED LOGIC for non-serialized equipment
        for (const equip of validEquipmentAssignments) {
            const originalStockItem = availableEquipment.find(item => item.id === equip.original_stock_id);

            if (!originalStockItem) {
                throw new Error(`Insufficient stock: Original stock item for ${equip.equipment_type} (ID: ${equip.original_stock_id}) not found.`);
            }
            if (originalStockItem.quantity < equip.quantity) {
                throw new Error(`Insufficient stock: Only ${originalStockItem.quantity} of ${equip.equipment_type} available, tried to assign ${equip.quantity}.`);
            }

            // 1. Update (or delete) the source stock record
            const newStockQuantity = originalStockItem.quantity - equip.quantity;
            if (newStockQuantity > 0) {
                promises.push(Equipment.update(originalStockItem.equipment_id, { quantity: newStockQuantity }));
            } else {
                promises.push(Equipment.delete(originalStockItem.equipment_id));
            }

            // 2. Find if soldier already has this equipment type (from the complete 'equipment' prop)
            const soldierExistingItem = (equipment || []).find(item =>
                item.assigned_to === soldier.soldier_id &&
                item.equipment_type === equip.equipment_type
            );

            if (soldierExistingItem) {
                // 3a. If yes, update the quantity of soldier's existing record
                const newSoldierQuantity = (soldierExistingItem.quantity || 0) + equip.quantity;
                promises.push(Equipment.update(soldierExistingItem.equipment_id, { quantity: newSoldierQuantity }));
            } else {
                // 3b. If no, create a new record for the soldier
                promises.push(Equipment.create({
                    equipment_type: equip.equipment_type,
                    quantity: equip.quantity,
                    condition: equip.condition, // Use the condition from the assigned equip (which came from original stock)
                    assigned_to: soldier.soldier_id,
                    division_name: soldier.division_name,
                    last_signed_by: `${soldier.first_name} ${soldier.last_name}`
                    // serial_number is deliberately excluded here as these are non-serialized items
                    // and the serial number from the stock item does not apply to the aggregated soldier entry.
                }));
            }
        }

        // Use allSettled instead of all to handle cases where items don't exist in Firestore
        updateProgress(2, `Assigning ${assignedItemDetails.length} item(s)...`);
        const results = await Promise.allSettled(promises);

        // CRITICAL: Update soldier status to "arrived" if currently "expected"
        // Wrap in try-catch so failure here doesn't prevent dialog from closing
        try {
            updateProgress(3, 'Updating soldier status...');
            if (soldier.enlistment_status === 'expected') {
                await Soldier.update(soldier.soldier_id, {
                    enlistment_status: 'arrived',
                    arrival_date: soldier.arrival_date || new Date().toISOString().split('T')[0]
                });
            }
        } catch (soldierUpdateError) {
            // Failed to update soldier status, but assignment was successful
        }

        // Create activity log - wrap in try-catch
        try {
            updateProgress(4, 'Creating activity log...');
            const activityData = {
                activity_type: "ASSIGN",
                entity_type: "Soldier",
                details: `Assigned to ${soldier.first_name} ${soldier.last_name} (${soldier.soldier_id}): ${itemsDescription}`,
                user_full_name: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : currentUser.full_name,
                user_soldier_id: performingSoldier ? performingSoldier.soldier_id : null,
                soldier_id: soldier.soldier_id,
                context: {
                    soldierId: soldier.soldier_id,
                    assignedItems: assignedItemDetails,
                    signature,
                },
                division_name: soldier.division_name,
            };

            const newActivityLog = await ActivityLog.create(activityData);

            if (soldier.email && hasSelectedItems) {
                try {
                    updateProgress(5, 'Sending confirmation email...');
                    await sendSigningFormByActivity({
                        activityId: newActivityLog.id
                    });
                } catch (emailError) {
                    // Failed to send signing email, but assignment was successful
                }
            }

            updateProgress(5, 'Assignment complete!');
        } catch (activityLogError) {
            // Failed to create activity log, but assignment was successful
        }

        // Always close dialog and refresh after successful assignment
        setIsLoading(false);
        showToast("Equipment assigned successfully!", "success");

        setTimeout(() => {
            handleClose(false);
            if (onSuccess) onSuccess();
        }, 1500);

    } catch (error) {
        setIsLoading(false);
        showToast(`An error occurred during assignment: ${error.message}. Please check details and try again.`, "destructive");
    }
  };

  const handleClose = (isOpen) => {
    if (!isOpen) {
      setSelectedWeaponIds([]);
      setSelectedGearIds([]);
      setSelectedDroneSetIds([]);
      setSelectedEquipmentIds([]);
      setEquipmentQuantities({});
      setWeaponSearch('');
      setGearSearch('');
      setDroneSetSearch('');
      setEquipmentSearch('');
      setSignature('');
      setIsLoading(false);
      setToast(null);
    }
    onOpenChange(isOpen);
  };

  const getSelectedItemDetails = (type, id) => {
    const list = type === 'weapon' ? localUnassignedWeapons :
                 type === 'gear' ? localUnassignedGear :
                 type === 'droneSet' ? localUnassignedDroneSets :
                 availableEquipment; // This now refers to the filtered availableEquipment
    if (Array.isArray(list)) return list.find(item => item && item.id === id);
    return null;
  };

  // Form handlers for creating new items
  const handleOpenWeaponForm = (searchTerm) => {
    setInitialWeaponData({ weapon_id: searchTerm, weapon_type: '', status: 'functioning' });
    setShowWeaponForm(true);
  };

  const handleOpenGearForm = (searchTerm) => {
    setInitialGearData({ gear_id: searchTerm, gear_type: '', status: 'functioning' });
    setShowGearForm(true);
  };

  const handleOpenDroneSetForm = (searchTerm) => {
    setInitialDroneSetData({ set_serial_number: searchTerm, set_type: 'Avetta', status: 'Operational' });
    setShowDroneSetForm(true);
  };

  const handleWeaponFormSubmit = async (weaponData) => {
    try {
      const newWeapon = await Weapon.create(weaponData);
      setLocalUnassignedWeapons(prev => [...prev, newWeapon]);
      setSelectedWeaponIds(prev => [...prev, newWeapon.id]);
      setWeaponSearch('');
      setShowWeaponForm(false);
      setInitialWeaponData(null);
      showToast("New weapon created and selected!", "success");
    } catch (error) {
      showToast('Failed to create weapon. Please check if the ID is unique.', "destructive");
    }
  };

  const handleGearFormSubmit = async (gearData) => {
    try {
      const newGear = await SerializedGear.create(gearData);
      setLocalUnassignedGear(prev => [...prev, newGear]);
      setSelectedGearIds(prev => [...prev, newGear.id]);
      setGearSearch('');
      setShowGearForm(false);
      setInitialGearData(null);
      showToast("New gear created and selected!", "success");
    } catch (error) {
      showToast('Failed to create gear. Please check if the ID is unique.', "destructive");
    }
  };

  const handleDroneSetFormSubmit = async (droneSetData) => {
    try {
      const newDroneSet = await DroneSet.create(droneSetData);
      setLocalUnassignedDroneSets(prev => [...prev, newDroneSet]);
      setSelectedDroneSetIds(prev => [...prev, newDroneSet.id]);
      setDroneSetSearch('');
      setShowDroneSetForm(false);
      setInitialDroneSetData(null);
      showToast("New drone set created and selected!", "success");
    } catch (error) {
      showToast('Failed to create drone set. Please check if the ID is unique.', "destructive");
    }
  };

  if (!soldier) return null;

  const totalSelectedItems = selectedWeaponIds.length + selectedGearIds.length +
                            selectedDroneSetIds.length + selectedEquipmentIds.length;
  const isFinalizeDisabled = isLoading || totalSelectedItems === 0 ||
                           (totalSelectedItems > 0 && !signature);

  return (
    <>
      {/* Weapon Form Dialog */}
      <Dialog open={showWeaponForm} onOpenChange={setShowWeaponForm}>
        <DialogContent className="w-full max-w-[95vw] md:max-w-[625px] h-[95vh] md:max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 md:px-6 py-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowWeaponForm(false)}
                className="md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-lg md:text-xl">Add New Weapon</DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 md:px-6">
            <WeaponForm
              weapon={initialWeaponData}
              soldiers={[]}
              existingWeapons={localUnassignedWeapons}
              onSubmit={handleWeaponFormSubmit}
              onCancel={() => setShowWeaponForm(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Gear Form Dialog */}
      <Dialog open={showGearForm} onOpenChange={setShowGearForm}>
        <DialogContent className="w-full max-w-[95vw] md:max-w-[625px] h-[95vh] md:max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 md:px-6 py-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowGearForm(false)}
                className="md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-lg md:text-xl">Add New Serialized Gear</DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 md:px-6">
            <GearForm
              gear={initialGearData}
              soldiers={[]}
              existingGear={localUnassignedGear}
              onSubmit={handleGearFormSubmit}
              onCancel={() => setShowGearForm(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Drone Set Form Dialog */}
      <Dialog open={showDroneSetForm} onOpenChange={setShowDroneSetForm}>
        <DialogContent className="w-full max-w-[95vw] md:max-w-[725px] h-[95vh] md:max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 md:px-6 py-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDroneSetForm(false)}
                className="md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-lg md:text-xl">Add New Drone Set</DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 md:px-6">
            <DroneSetForm
              droneSet={initialDroneSetData}
              allComponents={[]}
              allSoldiers={[]}
              onSubmit={handleDroneSetFormSubmit}
              onCancel={() => setShowDroneSetForm(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Assign Equipment to {soldier.first_name} {soldier.last_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {toast && (
              <div className={`p-3 rounded-md shadow-md text-white ${toast.variant === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                {toast.message}
              </div>
            )}

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-3"><CardTitle className="text-lg text-blue-900">Soldier Information</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><p className="font-medium text-blue-700">Name</p><p className="text-blue-900">{soldier.first_name} {soldier.last_name}</p></div>
                  <div><p className="font-medium text-blue-700">ID</p><p className="text-blue-900">{soldier.soldier_id}</p></div>
                  <div><p className="font-medium text-blue-700">Division</p><p className="text-blue-900">{soldier.division_name || 'N/A'}</p></div>
                  <div><p className="font-medium text-blue-700">Date</p><p className="text-blue-900">{format(new Date(), 'MMM d, yyyy')}</p></div>
                  {soldier.email && (
                    <div className="col-span-2 md:col-span-4">
                      <p className="font-medium text-blue-700">Email</p>
                      <p className="text-blue-900">{soldier.email}</p>
                      <p className="text-xs text-blue-600 mt-1">📧 Signing form will be sent automatically if user is registered</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="serialized" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="serialized">Serialized Items (Weapons, Gear, Drones)</TabsTrigger>
                <TabsTrigger value="equipment">Standard Equipment</TabsTrigger>
              </TabsList>

              <TabsContent value="serialized" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Weapons Section */}
                  <Card className="border-red-200">
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-red-700"><Target className="w-4 h-4" />Weapons</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {selectedWeaponIds.length > 0 && (() => {
                        // Group weapons: machine guns with קנס"פ pairs, and קנס"פ pairs together
                        const groupedWeapons = [];
                        const processedIds = new Set();
                        
                        selectedWeaponIds.forEach(id => {
                          if (processedIds.has(id)) return;
                          
                          const weapon = getSelectedItemDetails('weapon', id);
                          if (!weapon) return;
                          
                          // Check if this is a machine gun - if so, find its קנס"פ pairs
                          if (isMachineGun(weapon)) {
                            const kansapIds = [];
                            selectedWeaponIds.forEach(otherId => {
                              if (otherId === id || processedIds.has(otherId)) return;
                              const otherWeapon = getSelectedItemDetails('weapon', otherId);
                              if (otherWeapon && otherWeapon.weapon_type && otherWeapon.weapon_type.includes('קנס"פ')) {
                                // Check if this קנס"פ matches the machine gun
                                const machineGunId = weapon.weapon_id;
                                const last4Digits = machineGunId.slice(-4);
                                const machineGunType = weapon.weapon_type;
                                
                                const kansapId = otherWeapon.weapon_id;
                                const idMatches = kansapId.includes(last4Digits) && (kansapId.includes('-1') || kansapId.includes('-2'));
                                
                                // Match type based on key words
                                let typeMatches = false;
                                const kansapType = otherWeapon.weapon_type;
                                if (machineGunType.includes('נגב קומנדו')) {
                                  // For "מקלע נגב קומנדו", only match "קנס"פ - נגב קומנדו"
                                  typeMatches = kansapType.includes('נגב קומנדו');
                                } else if (machineGunType.includes('דגם ב')) {
                                  // For "מקלע קל נגב דגם ב", only match "קנס"פ - נגב" (not "קנס"פ - נגב דגם ב")
                                  typeMatches = kansapType.includes('נגב') && !kansapType.includes('דגם ב') && !kansapType.includes('קומנדו') && !kansapType.includes('7.62');
                                } else if (machineGunType.includes('7.62') && machineGunType.includes('נגב')) {
                                  // For "מקלע קל נגב 7.62", only match "קנס"פ - נגב 7.62"
                                  typeMatches = kansapType.includes('נגב 7.62') || (kansapType.includes('נגב') && kansapType.includes('7.62'));
                                } else if (machineGunType.includes('נגב')) {
                                  // For other נגב machine guns, match any קנס"פ with נגב (but not קומנדו, דגם ב, or 7.62)
                                  typeMatches = kansapType.includes('נגב') && !kansapType.includes('קומנדו') && !kansapType.includes('דגם ב') && !kansapType.includes('7.62');
                                } else if (machineGunType.includes('מאג')) {
                                  // For מאג machine guns, match any קנס"פ with מאג
                                  typeMatches = kansapType.includes('מאג');
                                }
                                
                                if (idMatches && typeMatches) {
                                  kansapIds.push(otherId);
                                }
                              }
                            });
                            
                            if (kansapIds.length > 0) {
                              // Group machine gun with its קנס"פ pairs
                              const kansapWeapons = kansapIds.map(kid => getSelectedItemDetails('weapon', kid)).filter(Boolean);
                              const kansapDisplay = kansapWeapons.map(k => {
                                const nameMatch = k.weapon_type.match(/קנס"פ\s*-?\s*(.+)/);
                                return nameMatch ? nameMatch[1].trim() : k.weapon_type.replace('קנס"פ', '').trim();
                              }).join(', ');
                              
                              processedIds.add(id);
                              kansapIds.forEach(kid => processedIds.add(kid));
                              
                              groupedWeapons.push({
                                id: id,
                                kansapIds: kansapIds,
                                displayName: `${weapon.weapon_type} + קנס"פ (${kansapDisplay})`,
                                weapon1: weapon,
                                kansapWeapons: kansapWeapons,
                                isMachineGunWithKansap: true
                              });
                            } else {
                              // Machine gun without קנס"פ
                              processedIds.add(id);
                              groupedWeapons.push({
                                id: id,
                                displayName: weapon.weapon_type,
                                weapon1: weapon,
                                isPaired: false
                              });
                            }
                          } else if (weapon.weapon_type && weapon.weapon_type.includes('קנס"פ')) {
                            // Check if this קנס"פ is already grouped with a machine gun
                            let isGrouped = false;
                            groupedWeapons.forEach(group => {
                              if (group.isMachineGunWithKansap && group.kansapIds && group.kansapIds.includes(id)) {
                                isGrouped = true;
                              }
                            });
                            
                            if (!isGrouped) {
                              // Standalone קנס"פ weapon - check for pair
                              const pairedWeapon = findPairedWeapon(weapon, true);
                              const pairedId = pairedWeapon && selectedWeaponIds.includes(pairedWeapon.id) ? pairedWeapon.id : null;
                              
                              if (pairedId) {
                                const pairedWeaponObj = getSelectedItemDetails('weapon', pairedId);
                                processedIds.add(id);
                                processedIds.add(pairedId);
                                
                                const nameMatch = weapon.weapon_type.match(/קנס"פ\s*-?\s*(.+)/);
                                const displayName = nameMatch ? `קנס"פ - ${nameMatch[1].trim()}` : weapon.weapon_type;
                                
                                groupedWeapons.push({
                                  id: id,
                                  pairedId: pairedId,
                                  displayName: displayName,
                                  weapon1: weapon,
                                  weapon2: pairedWeaponObj,
                                  isPaired: true
                                });
                              } else {
                                processedIds.add(id);
                                groupedWeapons.push({
                                  id: id,
                                  displayName: weapon.weapon_type,
                                  weapon1: weapon,
                                  isPaired: false
                                });
                              }
                            }
                          } else {
                            // Regular weapon
                            processedIds.add(id);
                            groupedWeapons.push({
                              id: id,
                              displayName: weapon.weapon_type,
                              weapon1: weapon,
                              isPaired: false
                            });
                          }
                        });
                        
                        return (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Selected Weapons:</Label>
                            {groupedWeapons.map(group => (
                              <div key={group.id} className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{group.displayName}</p>
                                  {group.isMachineGunWithKansap ? (
                                    <div className="text-xs text-red-600 space-y-1">
                                      <p>{group.weapon1.weapon_id}</p>
                                      {group.kansapWeapons && group.kansapWeapons.map((k, idx) => (
                                        <p key={idx} className="text-red-500">קנס"פ {idx + 1}: {k.weapon_id}</p>
                                      ))}
                                    </div>
                                  ) : group.isPaired ? (
                                    <p className="text-xs text-red-600">
                                      {group.weapon1.weapon_id}, {group.weapon2?.weapon_id}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-red-600">{group.weapon1.weapon_id}</p>
                                  )}
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => {
                                    // Always use handleRemoveItem which handles machine gun + קנס"פ removal
                                    handleRemoveItem('weapon', group.id);
                                  }} 
                                  className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <div className="space-y-2">
                        <Label>Search Weapons</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input placeholder="Type to search..." value={weaponSearch} onChange={(e) => setWeaponSearch(e.target.value)} className="pl-9" />
                        </div>
                      </div>
                      <ScrollArea className="h-32 border rounded-md">
                        <div className="p-2 space-y-1">
                          {weaponOptions.length > 0 ? (
                            weaponOptions.map(weapon => (
                              <div 
                                key={weapon.id} 
                                onClick={() => selectItem('weapon', weapon)} 
                                className="p-2 hover:bg-red-50 cursor-pointer rounded border border-red-100"
                              >
                                <p className="font-medium text-sm">{weapon.weapon_type}</p>
                                <p className="text-xs text-red-600">{weapon.weapon_id}</p>
                              </div>
                            ))
                          ) : weaponSearch.length > 0 ? (
                            <div className="p-4 text-center text-slate-500 text-sm">
                              <p className="mb-2">No weapons found matching "{weaponSearch}"</p>
                              {(currentUser?.permissions?.['equipment.create'] || currentUser?.role === 'admin') && (
                                <Button variant="link" className="text-sm h-auto p-0 text-blue-600" onClick={() => handleOpenWeaponForm(weaponSearch)}>
                                  <Plus className="w-4 h-4 mr-1" />Add as a new weapon
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="p-4 text-center text-slate-500 text-sm">
                              <p>No weapons available</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* Gear Section */}
                  <Card className="border-purple-200">
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-purple-700"><Binoculars className="w-4 h-4" />Serialized Gear</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {selectedGearIds.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Selected Gear:</Label>
                          {selectedGearIds.map(id => {
                            const gear = getSelectedItemDetails('gear', id);
                            return gear ? (
                              <div key={id} className="flex items-center justify-between p-2 bg-purple-50 border border-purple-200 rounded">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{gear.gear_type}</p>
                                  <p className="text-xs text-purple-600">{gear.gear_id}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveItem('gear', id)} className="h-6 w-6 p-0 text-purple-600 hover:bg-purple-100"><X className="w-3 h-3" /></Button>
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Search Gear</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input placeholder="Type to search..." value={gearSearch} onChange={(e) => setGearSearch(e.target.value)} className="pl-9" />
                        </div>
                      </div>
                      <ScrollArea className="h-32 border rounded-md">
                        <div className="p-2 space-y-1">
                          {gearOptions.length > 0 ? (
                            gearOptions.map(gear => (
                              <div key={gear.id} onClick={() => selectItem('gear', gear)} className="p-2 hover:bg-purple-50 cursor-pointer rounded border border-purple-100">
                                <p className="font-medium text-sm">{gear.gear_type}</p>
                                <p className="text-xs text-purple-600">{gear.gear_id}</p>
                              </div>
                            ))
                          ) : gearSearch.length > 0 ? (
                            <div className="p-4 text-center text-slate-500 text-sm">
                              <p className="mb-2">No gear found matching "{gearSearch}"</p>
                              {(currentUser?.permissions?.['equipment.create'] || currentUser?.role === 'admin') && (
                                <Button variant="link" className="text-sm h-auto p-0 text-blue-600" onClick={() => handleOpenGearForm(gearSearch)}>
                                  <Plus className="w-4 h-4 mr-1" />Add as new gear
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="p-4 text-center text-slate-500 text-sm">
                              <p>No gear available</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* Drone Sets Section */}
                  <Card className="border-blue-200">
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-blue-700"><Joystick className="w-4 h-4" />Drone Sets</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {selectedDroneSetIds.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Selected Drone Sets:</Label>
                          {selectedDroneSetIds.map(id => {
                            const droneSet = getSelectedItemDetails('droneSet', id);
                            return droneSet ? (
                              <div key={id} className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{droneSet.set_type}</p>
                                  <p className="text-xs text-blue-600">{droneSet.set_serial_number}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveItem('droneSet', id)} className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-100"><X className="w-3 h-3" /></Button>
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Search Drone Sets</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input placeholder="Type to search..." value={droneSetSearch} onChange={(e) => setDroneSetSearch(e.target.value)} className="pl-9" />
                        </div>
                      </div>
                      <ScrollArea className="h-32 border rounded-md">
                        <div className="p-2 space-y-1">
                          {droneSetOptions.length > 0 ? (
                            droneSetOptions.map(droneSet => (
                              <div key={droneSet.id} onClick={() => selectItem('droneSet', droneSet)} className="p-2 hover:bg-blue-50 cursor-pointer rounded border border-blue-100">
                                <p className="font-medium text-sm">{droneSet.set_type}</p>
                                <p className="text-xs text-blue-600">{droneSet.set_serial_number}</p>
                              </div>
                            ))
                          ) : droneSetSearch.length > 0 ? (
                            <div className="p-4 text-center text-slate-500 text-sm">
                              <p className="mb-2">No drone sets found matching "{droneSetSearch}"</p>
                              {(currentUser?.permissions?.['equipment.create'] || currentUser?.role === 'admin') && (
                                <Button variant="link" className="text-sm h-auto p-0 text-blue-600" onClick={() => handleOpenDroneSetForm(droneSetSearch)}>
                                  <Plus className="w-4 h-4 mr-1" />Add as new drone set
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="p-4 text-center text-slate-500 text-sm">
                              <p>No drone sets available</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="equipment" className="space-y-4">
                <Card className="border-green-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-green-700">
                      <Package className="w-4 h-4" />
                      Standard Equipment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-slate-600 mb-4">
                      Soldier's Division: {soldier.division_name || 'None'}
                      <br />
                      Total Available Equipment: {availableEquipment.length}
                    </div>

                    {availableEquipment.length === 0 ? (
                      <div className="p-6 text-center text-slate-600 bg-slate-50 rounded-md">
                        <p className="font-semibold">No Assignable Stock Found</p>
                        <p className="text-sm">
                          There is no unassigned equipment stock available that matches the soldier's division (or is universally assignable) and has a quantity greater than 0.
                          <br />
                          <span className="text-xs mt-2">Equipment must be in storage (not assigned), have quantity &gt; 0, and either have no division or match the soldier's division.</span>
                        </p>
                      </div>
                    ) : (
                      <>
                        {selectedEquipmentIds.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Selected Equipment:</Label>
                            {selectedEquipmentIds.map(id => {
                              const item = getSelectedItemDetails('equipment', id);
                              return item ? (
                                <div key={id} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{item.equipment_type}</p>
                                    <div className="flex items-center gap-2 text-xs text-green-600">
                                      <span>Available in stock: {item.quantity}</span>
                                      {item.serial_number && <span>S/N: {item.serial_number}</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="1"
                                      max={item.quantity}
                                      value={equipmentQuantities[id] || 1}
                                      onChange={(e) => handleQuantityChange(id, e.target.value)}
                                      className="w-16 h-8 text-sm"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveItem('equipment', id)}
                                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-100"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ) : null;
                            })}
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="equipmentSearch">Search Available Equipment</Label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                              id="equipmentSearch"
                              placeholder="Type to search..."
                              value={equipmentSearch}
                              onChange={(e) => setEquipmentSearch(e.target.value)}
                              className="pl-9"
                            />
                          </div>
                        </div>

                        <ScrollArea className="h-40 border rounded-md">
                          <div className="p-2 space-y-1">
                            {equipmentOptions.length > 0 ? (
                              equipmentOptions.map(item => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between p-2 hover:bg-green-50 cursor-pointer rounded border border-transparent hover:border-green-200 transition-colors duration-150"
                                >
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      checked={selectedEquipmentIds.includes(item.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          selectItem('equipment', item);
                                        } else {
                                          handleRemoveItem('equipment', item.id);
                                        }
                                      }}
                                    />
                                    <div>
                                      <p className="font-medium text-sm">{item.equipment_type}</p>
                                      <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span>Available: {item.quantity}</span>
                                        {item.serial_number && <span>S/N: {item.serial_number}</span>}
                                        <Badge variant="outline" className={item.condition === 'functioning' ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}>
                                          {item.condition}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-center text-slate-500 text-sm">
                                <p>No equipment found matching "{equipmentSearch}"</p>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {totalSelectedItems > 0 && (
              <Card>
                <CardHeader><CardTitle>Assignment Summary</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-slate-700 mb-1">Weapons ({selectedWeaponIds.length})</p>
                      {(() => {
                        // Group weapons: machine guns with קנס"פ pairs, and קנס"פ pairs together
                        const groupedWeapons = [];
                        const processedIds = new Set();
                        
                        selectedWeaponIds.forEach(id => {
                          if (processedIds.has(id)) return;
                          
                          const weapon = getSelectedItemDetails('weapon', id);
                          if (!weapon) return;
                          
                          // Check if this is a machine gun - if so, find its קנס"פ pairs
                          if (isMachineGun(weapon)) {
                            const kansapIds = [];
                            selectedWeaponIds.forEach(otherId => {
                              if (otherId === id || processedIds.has(otherId)) return;
                              const otherWeapon = getSelectedItemDetails('weapon', otherId);
                              if (otherWeapon && otherWeapon.weapon_type && otherWeapon.weapon_type.includes('קנס"פ')) {
                                const machineGunId = weapon.weapon_id;
                                const last4Digits = machineGunId.slice(-4);
                                const machineGunType = weapon.weapon_type;
                                const kansapType = otherWeapon.weapon_type;
                                
                                const kansapId = otherWeapon.weapon_id;
                                const idMatches = kansapId.includes(last4Digits) && (kansapId.includes('-1') || kansapId.includes('-2'));
                                
                                // Match type based on key words
                                let typeMatches = false;
                                if (machineGunType.includes('נגב קומנדו')) {
                                  // For "מקלע נגב קומנדו", only match "קנס"פ - נגב קומנדו"
                                  typeMatches = kansapType.includes('נגב קומנדו');
                                } else if (machineGunType.includes('דגם ב')) {
                                  // For "מקלע קל נגב דגם ב", only match "קנס"פ - נגב" (not "קנס"פ - נגב דגם ב")
                                  typeMatches = kansapType.includes('נגב') && !kansapType.includes('דגם ב') && !kansapType.includes('קומנדו') && !kansapType.includes('7.62');
                                } else if (machineGunType.includes('7.62') && machineGunType.includes('נגב')) {
                                  // For "מקלע קל נגב 7.62", only match "קנס"פ - נגב 7.62"
                                  typeMatches = kansapType.includes('נגב 7.62') || (kansapType.includes('נגב') && kansapType.includes('7.62'));
                                } else if (machineGunType.includes('נגב')) {
                                  // For other נגב machine guns, match any קנס"פ with נגב (but not קומנדו, דגם ב, or 7.62)
                                  typeMatches = kansapType.includes('נגב') && !kansapType.includes('קומנדו') && !kansapType.includes('דגם ב') && !kansapType.includes('7.62');
                                } else if (machineGunType.includes('מאג')) {
                                  // For מאג machine guns, match any קנס"פ with מאג
                                  typeMatches = kansapType.includes('מאג');
                                }
                                
                                if (idMatches && typeMatches) {
                                  kansapIds.push(otherId);
                                }
                              }
                            });
                            
                            if (kansapIds.length > 0) {
                              const kansapWeapons = kansapIds.map(kid => getSelectedItemDetails('weapon', kid)).filter(Boolean);
                              const kansapDisplay = kansapWeapons.map(k => {
                                const nameMatch = k.weapon_type.match(/קנס"פ\s*-?\s*(.+)/);
                                return nameMatch ? nameMatch[1].trim() : k.weapon_type.replace('קנס"פ', '').trim();
                              }).join(', ');
                              
                              processedIds.add(id);
                              kansapIds.forEach(kid => processedIds.add(kid));
                              
                              groupedWeapons.push(
                                <Badge key={id} variant="outline" className="mr-1 mb-1">
                                  {weapon.weapon_type} + קנס"פ ({kansapDisplay})
                                </Badge>
                              );
                            } else {
                              processedIds.add(id);
                              groupedWeapons.push(
                                <Badge key={id} variant="outline" className="mr-1 mb-1">{weapon.weapon_type}</Badge>
                              );
                            }
                          } else if (weapon.weapon_type && weapon.weapon_type.includes('קנס"פ')) {
                            // Check if this קנס"פ is already grouped with a machine gun
                            let isGrouped = false;
                            groupedWeapons.forEach(() => {
                              // Check if already processed in machine gun grouping
                              if (processedIds.has(id)) isGrouped = true;
                            });
                            
                            if (!isGrouped) {
                              const pairedWeapon = findPairedWeapon(weapon, true);
                              const pairedId = pairedWeapon && selectedWeaponIds.includes(pairedWeapon.id) ? pairedWeapon.id : null;
                              
                              if (pairedId) {
                                processedIds.add(id);
                                processedIds.add(pairedId);
                                const nameMatch = weapon.weapon_type.match(/קנס"פ\s*-?\s*(.+)/);
                                const displayName = nameMatch ? `קנס"פ - ${nameMatch[1].trim()}` : weapon.weapon_type;
                                groupedWeapons.push(
                                  <Badge key={id} variant="outline" className="mr-1 mb-1">{displayName}</Badge>
                                );
                              } else {
                                processedIds.add(id);
                                groupedWeapons.push(
                                  <Badge key={id} variant="outline" className="mr-1 mb-1">{weapon.weapon_type}</Badge>
                                );
                              }
                            }
                          } else {
                            processedIds.add(id);
                            groupedWeapons.push(
                              <Badge key={id} variant="outline" className="mr-1 mb-1">{weapon.weapon_type}</Badge>
                            );
                          }
                        });
                        
                        return groupedWeapons;
                      })()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-700 mb-1">Gear ({selectedGearIds.length})</p>
                      {selectedGearIds.map(id => {
                        const gear = getSelectedItemDetails('gear', id);
                        return gear ? (<Badge key={id} variant="outline" className="mr-1 mb-1">{gear.gear_type}</Badge>) : null;
                      })}
                    </div>
                    <div>
                      <p className="font-medium text-slate-700 mb-1">Drone Sets ({selectedDroneSetIds.length})</p>
                      {selectedDroneSetIds.map(id => {
                        const droneSet = getSelectedItemDetails('droneSet', id);
                        return droneSet ? (<Badge key={id} variant="outline" className="mr-1 mb-1">{droneSet.set_type}</Badge>) : null;
                      })}
                    </div>
                    <div>
                      <p className="font-medium text-slate-700 mb-1">Equipment ({selectedEquipmentIds.length})</p>
                      {selectedEquipmentIds.map(id => {
                        const equipment = getSelectedItemDetails('equipment', id);
                        const qty = equipmentQuantities[id] || 1;
                        return equipment ? (<Badge key={id} variant="outline" className="mr-1 mb-1">{equipment.equipment_type} ({qty})</Badge>) : null;
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signature">Soldier Signature</Label>
                    <SignatureCanvas onSignatureChange={setSignature} />
                  </div>
                </CardContent>
              </Card>
            )}

            {isLoading && (
              <div className="space-y-2 py-4">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>{progressMessage}</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>Cancel</Button>
              <Button onClick={handleAssign} disabled={isFinalizeDisabled} className="bg-green-600 hover:bg-green-700">
                {isLoading ? "Processing..." : "Finalize Assignment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* קנס"פ Selection Dialog */}
      <Dialog open={showKansapDialog} onOpenChange={setShowKansapDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Select קנס"פ for {selectedMachineGun?.weapon_type} ({selectedMachineGun?.weapon_id})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-900">
                <strong>Selected:</strong> {selectedMachineGun?.weapon_type} - {selectedMachineGun?.weapon_id}
              </p>
              <p className="text-xs text-blue-700 mt-2">
                Please select the קנס"פ pair that fits this machine gun
              </p>
            </div>
            
            {availableKansapPairs.length > 0 ? (
              <ScrollArea className="h-64 border rounded-md">
                <div className="p-2 space-y-2">
                  {availableKansapPairs.map((pair) => (
                    <div
                      key={pair.id}
                      onClick={() => handleKansapPairSelect(pair)}
                      className="p-3 hover:bg-blue-50 cursor-pointer rounded border border-blue-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{pair.displayName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              קנס"פ 1: {pair.weapon1.weapon_id}
                            </Badge>
                            {pair.weapon2 && (
                              <Badge variant="outline" className="text-xs">
                                קנס"פ 2: {pair.weapon2.weapon_id}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button size="sm" className="ml-2">
                          Select
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="p-4 text-center text-slate-500">
                <p>No קנס"פ pairs available</p>
                <p className="text-xs mt-2">The machine gun will be selected without קנס"פ</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowKansapDialog(false);
                setSelectedMachineGun(null);
                setAvailableKansapPairs([]);
              }}
            >
              Cancel
            </Button>
            {availableKansapPairs.length === 0 && (
              <Button
                onClick={() => {
                  // Add machine gun without קנס"פ when no pairs are available
                  if (selectedMachineGun) {
                    setSelectedWeaponIds(prev => [...prev, selectedMachineGun.id]);
                  }
                  setShowKansapDialog(false);
                  setSelectedMachineGun(null);
                  setAvailableKansapPairs([]);
                }}
              >
                Continue Without קנס"פ
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
