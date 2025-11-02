
import React, { useState, useMemo, useEffect } from 'react';
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
import { Search, Plus, X, Users, Target, Binoculars, Joystick, Package, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import SignatureCanvas from './SignatureCanvas';
import { Checkbox } from "@/components/ui/checkbox";

import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DroneSet } from "@/api/entities";
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

  useEffect(() => {
    // Sync local unassigned items with props
    setLocalUnassignedWeapons(unassignedWeapons || []);
    setLocalUnassignedGear(unassignedGear || []);
    setLocalUnassignedDroneSets(unassignedDroneSets || []);

    // Debug logging to see what we're getting
    console.log("=== DEBUG: Items received ===");
    console.log("Unassigned Weapons:", unassignedWeapons?.length || 0);
    console.log("Unassigned Gear:", unassignedGear?.length || 0);
    console.log("Unassigned Drone Sets:", unassignedDroneSets?.length || 0);
    console.log("Equipment:", equipment?.length || 0);

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

    console.log('[DEBUG availableEquipment] Total equipment loaded:', equipment.length);

    // Debug: Check assignment status
    const assignmentStats = {
      total: equipment.length,
      null: equipment.filter(e => e.assigned_to === null).length,
      empty: equipment.filter(e => e.assigned_to === '').length,
      undefined: equipment.filter(e => e.assigned_to === undefined).length,
      assigned: equipment.filter(e => e.assigned_to && e.assigned_to !== '').length
    };
    console.log('[DEBUG availableEquipment] Assignment stats:', assignmentStats);

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

    console.log('[DEBUG availableEquipment] Available (unassigned) count:', filtered.length);

    return filtered;
  }, [equipment, soldier]);

  // Filter weapons: prevent selecting multiple of the same type
  const weaponOptions = useMemo(() => {
    if (!Array.isArray(localUnassignedWeapons) || !soldier) return [];

    // Get types of already selected weapons
    const selectedTypes = new Set(
      selectedWeaponIds
        .map(id => localUnassignedWeapons.find(w => w.id === id)?.weapon_type)
        .filter(Boolean)
    );

    return localUnassignedWeapons.filter(weapon => {
      const matchesDivision = !weapon.division_name || weapon.division_name === soldier.division_name;
      const notSelected = !selectedWeaponIds.includes(weapon.id);
      const typeNotSelected = !selectedTypes.has(weapon.weapon_type); // NEW: prevent duplicate types
      const matchesSearch = weaponSearch.length === 0 ||
         (weapon.weapon_type && weapon.weapon_type.toLowerCase().includes(weaponSearch.toLowerCase())) ||
         (weapon.weapon_id && weapon.weapon_id.toLowerCase().includes(weaponSearch.toLowerCase()));

      return weapon && matchesDivision && notSelected && typeNotSelected && matchesSearch;
    });
  }, [localUnassignedWeapons, weaponSearch, selectedWeaponIds, soldier]);

  const gearOptions = useMemo(() => {
    if (!Array.isArray(localUnassignedGear) || !soldier) return [];

    // Get types of already selected gear
    const selectedTypes = new Set(
      selectedGearIds
        .map(id => localUnassignedGear.find(g => g.id === id)?.gear_type)
        .filter(Boolean)
    );

    return localUnassignedGear.filter(gearItem => {
      const matchesDivision = !gearItem.division_name || gearItem.division_name === soldier.division_name;
      const notSelected = !selectedGearIds.includes(gearItem.id);
      const typeNotSelected = !selectedTypes.has(gearItem.gear_type); // NEW: prevent duplicate types
      const matchesSearch = gearSearch.length === 0 ||
        (gearItem.gear_type && gearItem.gear_type.toLowerCase().includes(gearSearch.toLowerCase())) ||
        (gearItem.gear_id && gearItem.gear_id.toLowerCase().includes(gearSearch.toLowerCase()));

        return gearItem && matchesDivision && notSelected && typeNotSelected && matchesSearch;
    });
  }, [localUnassignedGear, gearSearch, selectedGearIds, soldier]);

  const droneSetOptions = useMemo(() => {
    if (!Array.isArray(localUnassignedDroneSets) || !soldier) return [];

    // Get types of already selected drone sets
    const selectedTypes = new Set(
      selectedDroneSetIds
        .map(id => localUnassignedDroneSets.find(d => d.id === id)?.set_type)
        .filter(Boolean)
    );

    return localUnassignedDroneSets.filter(droneSet => {
      const matchesDivision = !droneSet.division_name || droneSet.division_name === soldier.division_name;
      const notSelected = !selectedDroneSetIds.includes(droneSet.id);
      const typeNotSelected = !selectedTypes.has(droneSet.set_type); // NEW: prevent duplicate types
      const matchesSearch = droneSetSearch.length === 0 ||
         (droneSet.set_serial_number && droneSet.set_serial_number.toLowerCase().includes(droneSetSearch.toLowerCase())) ||
         (droneSet.set_type && droneSet.set_type.toLowerCase().includes(droneSetSearch.toLowerCase()));

      return droneSet && matchesDivision && notSelected && typeNotSelected && matchesSearch;
    });
  }, [localUnassignedDroneSets, droneSetSearch, selectedDroneSetIds, soldier]);

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
      setSelectedWeaponIds(prev => [...prev, item.id]);
    } else if (type === 'gear') {
      setSelectedGearIds(prev => [...prev, item.id]);
    } else if (type === 'droneSet') {
      setSelectedDroneSetIds(prev => [...prev, item.id]);
    } else if (type === 'equipment') {
      setSelectedEquipmentIds(prev => [...prev, item.id]);
      setEquipmentQuantities(prev => ({ ...prev, [item.id]: 1 }));
    }
  };

  const handleRemoveItem = (type, id) => {
    if (type === 'weapon') {
      setSelectedWeaponIds(prev => prev.filter(weaponId => weaponId !== id));
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

    // NEW: Check for duplicate types
    const weaponTypes = selectedWeapons.map(w => w.weapon_type);
    const gearTypes = selectedGear.map(g => g.gear_type);
    const droneTypes = selectedDroneSets.map(d => d.set_type);

    const hasDuplicateWeapons = weaponTypes.length !== new Set(weaponTypes).size;
    const hasDuplicateGear = gearTypes.length !== new Set(gearTypes).size;
    const hasDuplicateDrones = droneTypes.length !== new Set(droneTypes).size;

    if (hasDuplicateWeapons || hasDuplicateGear || hasDuplicateDrones) {
      let errorMessage = "Cannot assign multiple items of the same type:\n";
      if (hasDuplicateWeapons) {
        const duplicates = weaponTypes.filter((type, index) => weaponTypes.indexOf(type) !== index);
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

    const assignedItemDetails = [
        ...selectedWeapons.map(w => ({ type: 'Weapon', id: w.id, name: w.weapon_type })),
        ...selectedGear.map(g => ({ type: 'Gear', id: g.id, name: g.gear_type })),
        ...selectedDroneSets.map(d => ({ type: 'Drone Set', id: d.id, name: d.set_type })),
        ...validEquipmentAssignments.map(e => ({ type: 'Equipment', name: e.equipment_type, quantity: e.quantity, original_stock_id: e.original_stock_id }))
    ];

    try {
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
                console.error("Error loading linked soldier:", error);
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
        const results = await Promise.allSettled(promises);

        // Log any failed updates but don't fail the whole operation
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.warn(`Some items failed to update (may not exist in Firestore):`, failures.map(f => f.reason?.message));
        }

        // CRITICAL: Update soldier status to "arrived" if currently "expected"
        // Wrap in try-catch so failure here doesn't prevent dialog from closing
        try {
            console.log(`Checking soldier status: ${soldier.enlistment_status}`);
            if (soldier.enlistment_status === 'expected') {
                console.log(`Updating soldier ${soldier.soldier_id} from 'expected' to 'arrived'`);
                await Soldier.update(soldier.soldier_id, {
                    enlistment_status: 'arrived',
                    arrival_date: soldier.arrival_date || new Date().toISOString().split('T')[0]
                });
                console.log(`Successfully updated soldier ${soldier.soldier_id} status to 'arrived'`);
            } else {
                console.log(`Soldier ${soldier.soldier_id} status is already '${soldier.enlistment_status}', no update needed`);
            }
        } catch (soldierUpdateError) {
            console.warn("Failed to update soldier status, but assignment was successful:", soldierUpdateError);
        }

        // Create activity log - wrap in try-catch
        try {
            const activityData = {
                activity_type: "ASSIGN",
                entity_type: "Soldier",
                details: `Assigned ${assignedItemDetails.length} item(s) to ${soldier.first_name} ${soldier.last_name} (${soldier.soldier_id}).`,
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
                    await sendSigningFormByActivity({
                        activityId: newActivityLog.id
                    });
                } catch (emailError) {
                    console.warn("Failed to send signing email, but assignment was successful:", emailError);
                }
            }
        } catch (activityLogError) {
            console.warn("Failed to create activity log, but assignment was successful:", activityLogError);
        }

        // Always close dialog and refresh after successful assignment
        setIsLoading(false);
        showToast("Equipment assigned successfully!", "success");

        setTimeout(() => {
            handleClose(false);
            if (onSuccess) onSuccess();
        }, 1500);

    } catch (error) {
        console.error("Error assigning equipment:", error);
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
      console.error('Error creating weapon:', error);
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
      console.error('Error creating gear:', error);
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
      console.error('Error creating drone set:', error);
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
                      {selectedWeaponIds.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Selected Weapons:</Label>
                          {selectedWeaponIds.map(id => {
                            const weapon = getSelectedItemDetails('weapon', id);
                            return weapon ? (
                              <div key={id} className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{weapon.weapon_type}</p>
                                  <p className="text-xs text-red-600">{weapon.weapon_id}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveItem('weapon', id)} className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"><X className="w-3 h-3" /></Button>
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
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
                              <div key={weapon.id} onClick={() => selectItem('weapon', weapon)} className="p-2 hover:bg-red-50 cursor-pointer rounded border border-red-100">
                                <p className="font-medium text-sm">{weapon.weapon_type}</p>
                                <p className="text-xs text-red-600">{weapon.weapon_id}</p>
                              </div>
                            ))
                          ) : weaponSearch.length > 0 ? (
                            <div className="p-4 text-center text-slate-500 text-sm">
                              <p className="mb-2">No weapons found matching "{weaponSearch}"</p>
                              <Button variant="link" className="text-sm h-auto p-0 text-blue-600" onClick={() => handleOpenWeaponForm(weaponSearch)}>
                                <Plus className="w-4 h-4 mr-1" />Add as a new weapon
                              </Button>
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
                              <Button variant="link" className="text-sm h-auto p-0 text-blue-600" onClick={() => handleOpenGearForm(gearSearch)}>
                                <Plus className="w-4 h-4 mr-1" />Add as new gear
                              </Button>
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
                              <Button variant="link" className="text-sm h-auto p-0 text-blue-600" onClick={() => handleOpenDroneSetForm(droneSetSearch)}>
                                <Plus className="w-4 h-4 mr-1" />Add as new drone set
                              </Button>
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
                      {selectedWeaponIds.map(id => {
                        const weapon = getSelectedItemDetails('weapon', id);
                        return weapon ? (<Badge key={id} variant="outline" className="mr-1 mb-1">{weapon.weapon_type}</Badge>) : null;
                      })}
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

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>Cancel</Button>
              <Button onClick={handleAssign} disabled={isFinalizeDisabled} className="bg-green-600 hover:bg-green-700">
                {isLoading ? "Processing..." : "Finalize Assignment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
