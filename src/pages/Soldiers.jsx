
import React, { useState, useEffect } from "react";
import { Soldier } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DroneSet } from "@/api/entities";
import { Equipment } from "@/api/entities";
import { ActivityLog } from "@/api/entities";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Trash2, ArrowLeft, History, Mail, Loader2, ClipboardCopy, Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription, // Ensure DialogDescription is imported
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import SoldierForm from "../components/soldiers/SoldierForm";
import SoldierTable from "../components/soldiers/SoldierTable";
import UnifiedAssignmentDialog from "../components/soldiers/UnifiedAssignmentDialog";
import SoldierFilters from "../components/soldiers/SoldierFilters";
import SigningHistoryDialog from "../components/soldiers/SigningHistoryDialog";
import DeleteConfirmDialog from "../components/common/DeleteConfirmDialog";
import { sendBulkEquipmentForms } from "@/api/functions";
import JSZip from 'jszip';
import { generateEquipmentFormHTML } from "@/utils/equipmentFormGenerator";

export default function Soldiers() {
  const [soldiers, setSoldiers] = useState([]);
  const [weapons, setWeapons] = useState([]);
  const [serializedGear, setSerializedGear] = useState([]);
  const [droneSets, setDroneSets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSoldier, setEditingSoldier] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({ statuses: [], divisions: [], teams: [], crews: [], sexes: [], marital_statuses: [], license_types: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [selectedSoldierForWelcome, setSelectedSoldierForWelcome] = useState(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedSoldierForHistory, setSelectedSoldierForHistory] = useState(null);
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [isCopyingEmails, setIsCopyingEmails] = useState(false); // Existing state
  const [showEmailsDialog, setShowEmailsDialog] = useState(false); // New state
  const [emailsForInvite, setEmailsForInvite] = useState([]); // New state
  const [isGeneratingZip, setIsGeneratingZip] = useState(false); // For ZIP download
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [soldierToDelete, setSoldierToDelete] = useState(null);

  // RENAMED: from availableEquipment to allEquipment for clarity
  const [allEquipment, setAllEquipment] = useState([]);

  useEffect(() => {
    loadAllData();
    const fetchUser = async () => {
        try {
            setCurrentUser(await User.me());
        } catch (e) {
        }
    };
    fetchUser();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      const isAdmin = currentUser?.role === 'admin';
      const isManager = currentUser?.custom_role === 'manager';
      const isDivisionManager = currentUser?.custom_role === 'division_manager';
      const isTeamLeader = currentUser?.custom_role === 'team_leader';
      const userDivision = currentUser?.division;
      const userTeam = currentUser?.team;

      // Build filter based on role hierarchy
      let filter = {};
      let equipmentFilter = {}; // Separate filter for equipment

      if (isAdmin || isManager) {
        filter = {}; // See everything
        equipmentFilter = {};
      } else if (isDivisionManager && userDivision) {
        filter = { division_name: userDivision }; // See division only
        equipmentFilter = { division_name: userDivision };
      } else if (isTeamLeader && userDivision && userTeam) {
        filter = { division_name: userDivision, team_name: userTeam }; // See team only
        // For equipment, only filter by division since most items don't have team_name yet
        equipmentFilter = { division_name: userDivision };
      } else if (userDivision) {
        filter = { division_name: userDivision }; // Fallback
        equipmentFilter = { division_name: userDivision };
      }

      console.groupCollapsed('[Soldiers] Personnel table fetch');
      console.log('[Soldiers] Applied filter', filter);

      const results = await Promise.allSettled([
        Soldier.filter(filter), // Remove sort - orderBy excludes docs without the field
        Weapon.filter(equipmentFilter),
        SerializedGear.filter(equipmentFilter),
        DroneSet.filter(equipmentFilter),
        Equipment.filter(equipmentFilter) // This loads all equipment
      ]);

      // Get raw soldier data from Firestore
      let soldierData = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value : [];
      console.log('[Soldiers] Raw soldiers returned', soldierData.length, soldierData);

      // Deduplicate by document ID only
      const uniqueById = new Map();
      const duplicateEntries = [];
      soldierData.forEach(soldier => {
        if (!uniqueById.has(soldier.id)) {
          uniqueById.set(soldier.id, soldier);
        } else {
          duplicateEntries.push({ kept: uniqueById.get(soldier.id), ignored: soldier });
        }
      });
      const finalSoldiers = Array.from(uniqueById.values());

      if (duplicateEntries.length > 0) {
        console.warn('[Soldiers] Duplicate soldier records detected', duplicateEntries);
      }
      console.log('[Soldiers] Final soldiers after dedupe', finalSoldiers.length, finalSoldiers.map(s => ({
        id: s.id,
        soldier_id: s.soldier_id,
        division_name: s.division_name,
        team_name: s.team_name,
        status: s.status
      })));

      setSoldiers(finalSoldiers);
      setWeapons(results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : []);
      setSerializedGear(results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : []);
      setDroneSets(results[3].status === 'fulfilled' && Array.isArray(results[3].value) ? results[3].value : []);
      // UPDATED: Set all equipment data
      setAllEquipment(results[4].status === 'fulfilled' && Array.isArray(results[4].value) ? results[4].value : []);
      console.groupEnd();
    } catch (error) {
      console.error('[Soldiers] Failed to load personnel data', error);
      console.groupEnd();
      setSoldiers([]);
      setWeapons([]);
      setSerializedGear([]);
      setDroneSets([]);
      setAllEquipment([]); // Reset equipment on error
    }
    setIsLoading(false);
  };

  const loadSoldiers = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      const isAdmin = currentUser?.role === 'admin';
      const isManager = currentUser?.custom_role === 'manager';
      const isDivisionManager = currentUser?.custom_role === 'division_manager';
      const isTeamLeader = currentUser?.custom_role === 'team_leader';
      const userDivision = currentUser?.division;
      const userTeam = currentUser?.team;

      // Build filter based on role hierarchy
      let filter = {};
      if (isAdmin || isManager) {
        filter = {}; // See everything
      } else if (isDivisionManager && userDivision) {
        filter = { division_name: userDivision }; // See division only
      } else if (isTeamLeader && userDivision && userTeam) {
        filter = { division_name: userDivision, team_name: userTeam }; // See team only
      } else if (userDivision) {
        filter = { division_name: userDivision }; // Fallback
      }

      const data = await Soldier.filter(filter, "-created_date"); 
      setSoldiers(Array.isArray(data) ? data : []);
    } catch (error) {
      setSoldiers([]);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (soldierData) => {
    try {
      const currentUser = await User.me();

      let performingSoldier = null;
      try {
          const soldiers = await Soldier.filter({ email: currentUser.email });
          performingSoldier = soldiers[0] || null;
      } catch (error) {
      }
      
      const getAdjustedTimestamp = () => {
        const now = new Date();
        now.setUTCHours(now.getUTCHours() + 3);
        return now.toISOString();
      };

      if (editingSoldier) {
        const changes = {};
        Object.keys(soldierData).forEach(key => {
            if (soldierData[key] !== editingSoldier[key]) {
                changes[key] = {
                    old: editingSoldier[key] || null,
                    new: soldierData[key] || null,
                };
            }
        });

        // Verify the soldier document exists before updating
        const existingSoldier = await Soldier.findById(editingSoldier.id);
        if (!existingSoldier) {
          // Try to find by soldier_id if direct lookup failed
          const soldierBySoldierId = await Soldier.findById(editingSoldier.soldier_id);
          if (soldierBySoldierId) {
            await Soldier.update(editingSoldier.soldier_id, soldierData);
          } else {
            alert(`Error: Soldier document not found. The soldier may have been deleted or the ID is invalid. Please refresh and try again.`);
            setShowForm(false);
            setEditingSoldier(null);
            await loadAllData();
            return;
          }
        } else {
          await Soldier.update(editingSoldier.id, soldierData);
        }
        
        const activityData = {
          activity_type: "UPDATE",
          entity_type: "Soldier",
          details: `Updated soldier ${soldierData.first_name} ${soldierData.last_name} (${soldierData.soldier_id})`,
          user_full_name: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : currentUser.full_name,
          user_soldier_id: performingSoldier ? performingSoldier.soldier_id : null,
          client_timestamp: getAdjustedTimestamp(),
          context: { changes },
          division_name: soldierData.division_name
        };
        
        await ActivityLog.create(activityData);
        
      } else {
        // Check if a soldier with this ID already exists
        // Since soldier_id is used as the document ID, we need to check by ID directly
        try {
          const existingSoldier = await Soldier.findById(soldierData.soldier_id);

          if (existingSoldier) {
            alert(`Error: Soldier ID "${soldierData.soldier_id}" already exists.`);
            return;
          }
        } catch (error) {
          // If findById throws an error, the document doesn't exist, which is what we want
        }
        
        await Soldier.create(soldierData);
        
        // Auto-create user account if phone number is provided
        if (soldierData.phone_number) {
          try {
            // Format phone number with country code if not present
            let phoneNumber = soldierData.phone_number.trim();
            if (!phoneNumber.startsWith('+')) {
              // Assuming Israel country code +972 (you can adjust this)
              phoneNumber = '+972' + phoneNumber.replace(/^0/, '');
            }
            
            await User.create({
              phoneNumber: phoneNumber,
              role: 'soldier',
              custom_role: 'soldier',
              linked_soldier_id: soldierData.soldier_id,
              displayName: `${soldierData.first_name} ${soldierData.last_name}`,
              email: soldierData.email || null
            });
          } catch (error) {
            // Don't fail the soldier creation if user account creation fails
            // Admin can manually create the account later
          }
        }
        
        const activityData = {
          activity_type: "CREATE",
          entity_type: "Soldier",
          details: `Created new soldier ${soldierData.first_name} ${soldierData.last_name} (${soldierData.soldier_id})`,
          user_full_name: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : currentUser.full_name,
          user_soldier_id: performingSoldier ? performingSoldier.soldier_id : null,
          client_timestamp: getAdjustedTimestamp(),
          division_name: soldierData.division_name
        };
        
        await ActivityLog.create(activityData);
      }
      
      setShowForm(false);
      setEditingSoldier(null);
      await loadAllData();
    } catch (error) {
      // Fallback logic
      if (editingSoldier) {
        // Attempt to update even if activity log failed (original logic)
        // This catch block seems to have duplicated logic for create/update.
        // It's safer to just log and let the form close/data refresh.
      } else {
        // Attempt to create even if activity log failed (original logic)
        // Also checks for existing ID again.
      }
      setShowForm(false);
      setEditingSoldier(null);
      await loadAllData();
    }
  };

  const handleEdit = (soldier) => {
    setEditingSoldier(soldier);
    setShowForm(true);
  };

  const handleDeleteClick = (soldier) => {
    if (!currentUser?.permissions?.can_delete_soldiers && currentUser?.role !== 'admin') {
      alert("You do not have permission to delete soldiers.");
      return;
    }
    setSoldierToDelete(soldier);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!soldierToDelete) return;

    try {
      const currentUser = await User.me();

      let performingSoldier = null;
      try {
          const soldiers = await Soldier.filter({ email: currentUser.email });
          performingSoldier = soldiers[0] || null;
      } catch (error) {
      }

      const getAdjustedTimestamp = () => {
        const now = new Date();
        now.setUTCHours(now.getUTCHours() + 3);
        return now.toISOString();
      };

      await Soldier.delete(soldierToDelete.id);
      
      const activityData = {
        activity_type: "DELETE",
        entity_type: "Soldier",
        details: `Deleted soldier ${soldierToDelete.first_name} ${soldierToDelete.last_name} (${soldierToDelete.soldier_id})`,
        user_full_name: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : currentUser.full_name,
        user_soldier_id: performingSoldier ? performingSoldier.soldier_id : null,
        client_timestamp: getAdjustedTimestamp(),
        context: { deletedRecord: soldierToDelete },
        division_name: soldierToDelete.division_name
      };

      await ActivityLog.create(activityData);
      await loadAllData();
    } catch (error) {
      if (error.message?.includes('Object not found') || error.response?.status === 404) {
        await loadAllData();
      } else {
        alert("An error occurred while deleting the soldier. The data has been refreshed.");
        await loadAllData();
      }
    } finally {
      setShowDeleteConfirm(false);
      setSoldierToDelete(null);
    }
  };

  const handleWelcomeSoldier = (soldier) => {
    setSelectedSoldierForWelcome(soldier);
    setShowWelcomeDialog(true);
  };

  const getSoldierAssignedTypes = React.useCallback((soldier) => {
    if (!soldier) return { weaponTypes: [], gearTypes: [], droneSetTypes: [] };
    
    const soldierWeapons = weapons.filter(w => w && w.assigned_to === soldier.soldier_id);
    const soldierGear = serializedGear.filter(g => g && g.assigned_to === soldier.soldier_id);
    const soldierDroneSets = droneSets.filter(ds => ds && ds.assigned_to === soldier.soldier_id);
    
    return {
      weaponTypes: soldierWeapons.map(w => w.weapon_type).filter(Boolean),
      gearTypes: soldierGear.map(g => g.gear_type).filter(Boolean),
      droneSetTypes: soldierDroneSets.map(ds => ds.set_type).filter(Boolean)
    };
  }, [weapons, serializedGear, droneSets]);

  const unassignedWeapons = React.useMemo(() => {
    const safeWeapons = Array.isArray(weapons) ? weapons : [];

    // Fixed filter: checks for null, empty string, AND undefined
    const unassigned = safeWeapons.filter(w => w && !w.assigned_to);

    return unassigned;
  }, [weapons]);

  const unassignedGear = React.useMemo(() => {
    const safeGear = Array.isArray(serializedGear) ? serializedGear : [];

    // Fixed filter: checks for null, empty string, AND undefined
    const unassigned = safeGear.filter(g => g && !g.assigned_to);

    return unassigned;
  }, [serializedGear]);

  const unassignedDroneSets = React.useMemo(() => {
    const safeDroneSets = Array.isArray(droneSets) ? droneSets : [];

    // Fixed filter: checks for null, empty string, AND undefined
    const unassigned = safeDroneSets.filter(ds => ds && !ds.assigned_to);

    return unassigned;
  }, [droneSets]);

  const getFilteredUnassignedItems = React.useCallback((soldier) => {
    if (!soldier) {
      return {
        weapons: unassignedWeapons,
        gear: unassignedGear,
        droneSets: unassignedDroneSets
      };
    }
    
    const assignedTypes = getSoldierAssignedTypes(soldier);
    
    return {
      weapons: unassignedWeapons.filter(w => !assignedTypes.weaponTypes.includes(w.weapon_type)),
      gear: unassignedGear.filter(g => !assignedTypes.gearTypes.includes(g.gear_type)),
      droneSets: unassignedDroneSets.filter(ds => !assignedTypes.droneSetTypes.includes(ds.set_type))
    };
  }, [unassignedWeapons, unassignedGear, unassignedDroneSets, getSoldierAssignedTypes]);

  const handleFinalizeArrival = async ({ soldier, weaponIds, gearIds, droneSetIds }) => {
    try {
      const currentUser = await User.me();
      const getAdjustedTimestamp = () => {
        const now = new Date();
        now.setUTCHours(now.getUTCHours() + 3);
        return now.toISOString();
      };
      
      await Soldier.update(soldier.id, {
        enlistment_status: 'arrived',
        arrival_date: new Date().toISOString().split('T')[0]
      });

      const soldierFullName = `${soldier.first_name} ${soldier.last_name}`;

      if (Array.isArray(weaponIds)) {
        for (const weaponId of weaponIds) {
          // Find weapon to get weapon_type
          const weapon = weapons.find(w => w.weapon_id === weaponId);
          if (weapon && weapon.weapon_type) {
            await Weapon.update({ where: { weapon_id: weaponId, weapon_type: weapon.weapon_type } }, { 
              assigned_to: soldier.soldier_id, 
              division_name: soldier.division_name,
              last_signed_by: soldierFullName 
            });
          } else {
            // Fallback: use weaponId only (may fail if multiple weapons with same ID)
            await Weapon.update(weaponId, { 
              assigned_to: soldier.soldier_id, 
              division_name: soldier.division_name,
              last_signed_by: soldierFullName 
            });
          }
        }
      }

      if (Array.isArray(gearIds)) {
        for (const gearId of gearIds) {
          // Find gear to get gear_type
          const gear = serializedGear.find(g => g.gear_id === gearId);
          if (gear && gear.gear_type) {
            await SerializedGear.update({ where: { gear_id: gearId, gear_type: gear.gear_type } }, { 
              assigned_to: soldier.soldier_id, 
              division_name: soldier.division_name,
              last_signed_by: soldierFullName 
            });
          } else {
            // Fallback: use gearId only (may fail if multiple gear with same ID)
            await SerializedGear.update(gearId, { 
              assigned_to: soldier.soldier_id, 
              division_name: soldier.division_name,
              last_signed_by: soldierFullName 
            });
          }
        }
      }

      if (Array.isArray(droneSetIds)) {
        for (const setId of droneSetIds) {
          // Find drone set to get set_type
          const droneSet = droneSets.find(d => d.drone_set_id === setId);
          if (droneSet && droneSet.set_type) {
            await DroneSet.update({ where: { drone_set_id: setId, set_type: droneSet.set_type } }, { 
              assigned_to: soldier.soldier_id, 
              division_name: soldier.division_name 
            });
          } else {
            // Fallback: use setId only (may fail if multiple drones with same ID)
            await DroneSet.update(setId, { assigned_to: soldier.soldier_id, division_name: soldier.division_name });
          }
        }
      }

      const assignedEquipmentContext = {
        weaponIds: weaponIds,
        gearIds: gearIds,
        droneSetIds: droneSetIds,
        soldierId: soldier.soldier_id,
        soldierFullName: soldierFullName
      };

      await ActivityLog.create({
        activity_type: "ASSIGN",
        entity_type: "Soldier",
        details: `Soldier ${soldier.first_name} ${soldier.last_name} (${soldier.soldier_id}) signed for equipment and marked as arrived`,
        user_full_name: currentUser?.full_name || 'System',
        client_timestamp: getAdjustedTimestamp(),
        context: assignedEquipmentContext,
        division_name: soldier.division_name
      });

      setShowWelcomeDialog(false);
      await loadAllData();
    } catch (error) {
      console.error("Error finalizing soldier arrival:", error);
      alert("Error finalizing soldier arrival: " + error.message);
    }
  };


  const handleOpenHistory = (soldier) => {
    setSelectedSoldierForHistory(soldier);
    setShowHistoryDialog(true);
  };

  const checkForDuplicates = () => {
    if (!Array.isArray(soldiers)) {
      setDuplicates([]);
      setShowDuplicates(true);
      return;
    }
    const idCounts = soldiers.reduce((acc, s) => {
      if (s && s.soldier_id) {
        acc[s.soldier_id] = (acc[s.soldier_id] || 0) + 1;
      }
      return acc;
    }, {});
    const foundDuplicates = Object.entries(idCounts)
      .filter(([id, count]) => count > 1)
      .map(([id, count]) => ({ id, count }));
    setDuplicates(foundDuplicates);
    setShowDuplicates(true);
  };

  const handleSort = (column) => {
    let direction = 'asc';
    if (sortConfig.key === column && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: column, direction });
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (Array.isArray(sortedSoldiers) && sortedSoldiers.length > 0 && selectedItems.length === sortedSoldiers.length) {
      setSelectedItems([]);
    } else if (Array.isArray(sortedSoldiers)) {
      setSelectedItems(sortedSoldiers.map(s => s.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!currentUser?.permissions?.can_delete_soldiers && currentUser?.role !== 'admin') {
        alert("You do not have permission to delete soldiers.");
        return;
    }
    try {
      const currentUser = await User.me();
      const getAdjustedTimestamp = () => {
        const now = new Date();
        now.setUTCHours(now.getUTCHours() + 3);
        return now.toISOString();
      };
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const id of selectedItems) {
        const soldierToDelete = soldiers.find(s => s.id === id);
        if (soldierToDelete) {
          try {
            await Soldier.delete(id);
            await ActivityLog.create({
              activity_type: "DELETE",
              entity_type: "Soldier",
              details: `Deleted soldier ${soldierToDelete.first_name} ${soldierToDelete.last_name} (${soldierToDelete.soldier_id}) during bulk delete`,
              user_full_name: currentUser?.full_name || 'System',
              client_timestamp: getAdjustedTimestamp(),
              context: { deletedRecord: soldierToDelete },
              division_name: soldierToDelete.division_name
            });
            successCount++;
          } catch (deleteError) {
            if (deleteError.message?.includes('Object not found') || deleteError.response?.status === 404) {
              successCount++;
            } else {
              errorCount++;
            }
          }
        }
      }
      
      setSelectedItems([]);
      setShowBulkDeleteConfirm(false);
      
      if (errorCount > 0) {
        alert(`Bulk deletion completed. ${successCount} soldiers deleted successfully, ${errorCount} errors occurred. The data has been refreshed.`);
      } else {
        alert(`${successCount} soldiers deleted successfully. The data has been refreshed.`);
      }
      
      await loadAllData();
    } catch (error) {
      alert("An unexpected error occurred during bulk deletion. The data has been refreshed to show the current state.");
      setSelectedItems([]);
      setShowBulkDeleteConfirm(false);
      await loadAllData();
    }
  };

  const handleBulkEmailEquipment = async () => {
    setIsSendingBulk(true);
    try {
      const response = await sendBulkEquipmentForms();
      const result = response.data;

      if (result.success) {
        alert(`Bulk email completed!\n\nSent: ${result.summary.sent}\nSkipped: ${result.summary.skipped}\nErrors: ${result.summary.errors}\n\nTotal soldiers processed: ${result.summary.total}`);
      } else {
        alert('Bulk email failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to send bulk emails: ' + error.message);
    } finally {
      setIsSendingBulk(false);
    }
  };

  const generateFormsForSoldiers = (soldiersList) => {
    const zip = new JSZip();

    // Generate HTML for each soldier
    for (const soldier of soldiersList) {
      // Collect all assigned items for this soldier
      const assignedItems = [];

      // Add weapons
      weapons
        .filter(w => w.assigned_to === soldier.soldier_id)
        .forEach(weapon => {
          assignedItems.push({ type: 'Weapon', ...weapon });
        });

      // Add gear
      serializedGear
        .filter(g => g.assigned_to === soldier.soldier_id)
        .forEach(gear => {
          assignedItems.push({ type: 'Gear', ...gear });
        });

      // Add drone sets
      droneSets
        .filter(d => d.assigned_to === soldier.soldier_id)
        .forEach(droneSet => {
          assignedItems.push({ type: 'Drone Set', ...droneSet });
        });

      // Add equipment
      allEquipment
        .filter(e => e.assigned_to === soldier.soldier_id && (e.quantity || 0) > 0)
        .forEach(equipment => {
          assignedItems.push({ type: 'Equipment', ...equipment });
        });

      // Generate HTML
      const html = generateEquipmentFormHTML(soldier, assignedItems);

      // Create filename: soldier_id-first_name-last_name.html
      const filename = `${soldier.soldier_id}-${soldier.first_name}-${soldier.last_name}.html`;

      // Add to ZIP
      zip.file(filename, html);
    }

    return zip;
  };

  const handleDownloadAllForms = async () => {
    setIsGeneratingZip(true);
    try {
      // Get all soldiers with their assigned equipment
      const soldiersWithEquipment = soldiers.filter(soldier => {
        const hasWeapons = weapons.some(w => w.assigned_to === soldier.soldier_id);
        const hasGear = serializedGear.some(g => g.assigned_to === soldier.soldier_id);
        const hasDrones = droneSets.some(d => d.assigned_to === soldier.soldier_id);
        const hasEquipment = allEquipment.some(e => e.assigned_to === soldier.soldier_id && (e.quantity || 0) > 0);

        return hasWeapons || hasGear || hasDrones || hasEquipment;
      });

      if (soldiersWithEquipment.length === 0) {
        alert('No soldiers with assigned equipment found.');
        setIsGeneratingZip(false);
        return;
      }

      const zip = generateFormsForSoldiers(soldiersWithEquipment);

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;

      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `equipment-forms-${dateStr}.zip`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);

      alert(`Successfully generated ${soldiersWithEquipment.length} equipment forms!`);
    } catch (error) {
      alert('Failed to generate ZIP file: ' + error.message);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  const handleDownloadSelectedForms = async () => {
    if (selectedItems.length === 0) {
      alert('Please select soldiers to download forms.');
      return;
    }

    setIsGeneratingZip(true);
    try {
      // Get selected soldiers
      const selectedSoldiers = soldiers.filter(soldier => selectedItems.includes(soldier.id));

      if (selectedSoldiers.length === 0) {
        alert('No selected soldiers found.');
        setIsGeneratingZip(false);
        return;
      }

      const zip = generateFormsForSoldiers(selectedSoldiers);

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;

      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `equipment-forms-selected-${dateStr}.zip`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);

      alert(`Successfully generated ${selectedSoldiers.length} equipment forms!`);
    } catch (error) {
      alert('Failed to generate ZIP file: ' + error.message);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  const handleCopyEmailsForInvite = async () => {
    setIsCopyingEmails(true);
    try {
      const allSoldiers = await Soldier.list();
      const allUsers = await User.list();
      
      const existingUserEmails = new Set(allUsers.map(u => u.email?.toLowerCase()).filter(Boolean));
      
      const emailsToInvite = [
        ...new Set(
          allSoldiers
            .filter(s => s && s.email && !existingUserEmails.has(s.email.toLowerCase()))
            .map(s => s.email)
        )
      ];

      if (emailsToInvite.length === 0) {
        alert("All soldiers with email addresses are already registered as users.");
        return;
      }

      setEmailsForInvite(emailsToInvite);
      setShowEmailsDialog(true);

    } catch (error) {
      alert("Failed to get emails. Please try again.");
    } finally {
      setIsCopyingEmails(false);
    }
  };

  const copyIndividualEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      alert(`Copied: ${email}`);
    } catch (error) {
      alert("Failed to copy email.");
    }
  };

  const copyAllEmailsSeparately = async () => {
    try {
      // Try different formatting approaches
      const formats = {
        "Newline separated": emailsForInvite.join('\n'),
        "Comma separated": emailsForInvite.join(', '),
        "Space separated": emailsForInvite.join(' ')
      };
      
      let message = `Found ${emailsForInvite.length} emails to invite:\n\n`;
      message += emailsForInvite.map(email => `• ${email}`).join('\n');
      message += '\n\nTry copying one of these formats:\n\n';
      
      Object.entries(formats).forEach(([name, format]) => {
        message += `${name}: ${format}\n\n`;
      });
      
      // Copy the newline version by default
      await navigator.clipboard.writeText(formats["Newline separated"]);
      alert(message + "The newline-separated version has been copied to clipboard.");
      
    } catch (error) {
      alert("Failed to copy emails. Please copy them individually.");
    }
  };

  const filteredSoldiers = React.useMemo(() => {
    const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];

    const filtered = safeSoldiers.filter(soldier => {
      if (!soldier) return false;

      const searchLower = searchTerm.toLowerCase().trim();
      const searchWords = searchLower.split(/\s+/).filter(Boolean);

      const matchesSearch = !searchTerm || (() => {
        const searchableString = [
          soldier.first_name,
          soldier.last_name,
          soldier.soldier_id,
          soldier.id_number,
          soldier.email,
          soldier.division_name,
          soldier.team_name,
          soldier.profession,
        ].filter(Boolean).join(' ').toLowerCase();

        return searchWords.every(word => searchableString.includes(word));
      })();

      const matchesStatus = !filters.statuses || filters.statuses.length === 0 || filters.statuses.includes(soldier.enlistment_status || 'expected');
      const matchesDivision = !filters.divisions || filters.divisions.length === 0 || filters.divisions.includes(soldier.division_name);
      const matchesTeam = !filters.teams || filters.teams.length === 0 || filters.teams.includes(soldier.team_name);
      const matchesCrew = !filters.crews || filters.crews.length === 0 || filters.crews.includes(soldier.crew);
      const matchesSex = !filters.sexes || filters.sexes.length === 0 || filters.sexes.includes(soldier.sex);
      const matchesMarital = !filters.marital_statuses || filters.marital_statuses.length === 0 || filters.marital_statuses.includes(soldier.marital_status);
      const matchesLicenseType = !filters.license_types || filters.license_types.length === 0 || filters.license_types.includes(soldier.driving_license_type);

      return matchesSearch && matchesStatus && matchesDivision && matchesTeam && matchesCrew && matchesSex && matchesMarital && matchesLicenseType;
    });

    return filtered;
  }, [soldiers, searchTerm, filters]);

  const sortedSoldiers = React.useMemo(() => {
    if (!Array.isArray(filteredSoldiers)) return [];

    let sortableItems = [...filteredSoldiers];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue = a ? a[sortConfig.key] : undefined;
        let bValue = b ? b[sortConfig.key] : undefined;

        if (sortConfig.key === 'name') {
          aValue = (a && a.first_name && a.last_name) ? `${a.first_name} ${a.last_name}` : undefined;
          bValue = (b && b.first_name && b.last_name) ? `${b.first_name} ${b.last_name}` : undefined;
        }

        if (sortConfig.key === 'equipment') {
          const safeWeapons = Array.isArray(weapons) ? weapons : [];
          const safeGear = Array.isArray(serializedGear) ? serializedGear : [];
          const safeDroneSets = Array.isArray(droneSets) ? droneSets : [];

          const aWeapons = safeWeapons.filter(w => w && a && w.assigned_to === a.soldier_id).length;
          const aGear = safeGear.filter(g => g && a && g.assigned_to === a.soldier_id).length;
          const aDroneSets = safeDroneSets.filter(ds => ds && a && ds.assigned_to === a.soldier_id).length;
          aValue = aWeapons + aGear + aDroneSets;

          const bWeapons = safeWeapons.filter(w => w && b && w.assigned_to === b.soldier_id).length;
          const bGear = safeGear.filter(g => g && b && g.assigned_to === b.soldier_id).length;
          const bDroneSets = safeDroneSets.filter(ds => ds && b && ds.assigned_to === b.soldier_id).length;
          bValue = bWeapons + bGear + bDroneSets;
        }

        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        if (sortConfig.key !== 'equipment') {
            aValue = String(aValue).toLowerCase();
            bValue = String(bValue).toLowerCase();
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : 1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredSoldiers, sortConfig, weapons, serializedGear, droneSets]);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <UnifiedAssignmentDialog
        open={showWelcomeDialog}
        onOpenChange={setShowWelcomeDialog}
        soldier={selectedSoldierForWelcome}
        unassignedWeapons={selectedSoldierForWelcome ? getFilteredUnassignedItems(selectedSoldierForWelcome).weapons : []}
        unassignedGear={selectedSoldierForWelcome ? getFilteredUnassignedItems(selectedSoldierForWelcome).gear : []}
        unassignedDroneSets={selectedSoldierForWelcome ? getFilteredUnassignedItems(selectedSoldierForWelcome).droneSets : []}
        equipment={allEquipment}
        onSuccess={loadAllData}
      />
      
      <SigningHistoryDialog
        soldier={selectedSoldierForHistory}
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
      />

      {/* Bulk Delete Confirmation */}
      <DeleteConfirmDialog
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        onConfirm={handleBulkDelete}
        itemType="soldiers"
        itemName={`${selectedItems.length} selected items`}
        isLoading={false}
      />
      
      <AlertDialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Soldier IDs</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicates.length > 0 ? (
                <>
                  <p>The following Soldier IDs have been used more than once. Please correct them to ensure data integrity.</p>
                  <ul className="mt-4 space-y-2">
                    {duplicates.map(d => (
                      <li key={d.id} className="flex justify-between items-center">
                        <span>Soldier ID: <strong>{d.id}</strong></span>
                        <Badge variant="destructive">Used {d.count} times</Badge>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                "No duplicate Soldier IDs found."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDuplicates(false)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Email List Dialog */}
      <Dialog open={showEmailsDialog} onOpenChange={setShowEmailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Soldier Emails for Invitation</DialogTitle>
            <DialogDescription>
              {emailsForInvite.length} soldiers need to be invited to the app. Copy emails individually or try the bulk copy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div className="flex gap-2 mb-4">
              <Button onClick={copyAllEmailsSeparately} className="bg-blue-600 hover:bg-blue-700">
                Copy All (Try Different Formats)
              </Button>
              <Button variant="outline" onClick={() => setShowEmailsDialog(false)}>
                Close
              </Button>
            </div>
            <div className="space-y-2">
              {emailsForInvite.map((email, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <span className="font-mono text-sm">{email}</span>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => copyIndividualEmail(email)}
                  >
                    Copy
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Personnel Management</h1>
          <p className="text-slate-600">Manage company soldiers and their information</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedItems.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={handleDownloadSelectedForms}
                disabled={isGeneratingZip}
                className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
              >
                {isGeneratingZip ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Selected Forms ({selectedItems.length})
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={!currentUser?.permissions?.can_delete_soldiers && currentUser?.role !== 'admin'}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected ({selectedItems.length})
              </Button>
            </>
          )}
          <Button 
            variant="outline"
            onClick={handleCopyEmailsForInvite}
            disabled={isCopyingEmails}
            className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200"
          >
            {isCopyingEmails ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Getting Emails...</>
            ) : (
              <><ClipboardCopy className="w-4 h-4 mr-2" />Copy Emails for Invite</>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleBulkEmailEquipment}
            disabled={isSendingBulk}
            className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
          >
            {isSendingBulk ? (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Email All Equipment Lists
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadAllForms}
            disabled={isGeneratingZip}
            className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
          >
            {isGeneratingZip ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download all forms (ZIP)
              </>
            )}
          </Button>
          <Button variant="outline" onClick={checkForDuplicates}>Check Duplicates</Button>
          <Button
            onClick={() => { setEditingSoldier(null); setShowForm(true); }}
            className="bg-green-700 hover:bg-green-800 text-white"
            disabled={!currentUser?.permissions?.can_create_soldiers && currentUser?.role !== 'admin'}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Soldier
          </Button>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-full max-w-[95vw] md:max-w-2xl h-[95vh] md:max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-4 md:px-6 py-4 border-b shrink-0 bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowForm(false)}
                className="md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-lg md:text-xl">
                {editingSoldier ? 'Edit Soldier' : 'Add New Soldier'}
              </DialogTitle>
          </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-safe">
            <div className="px-4 md:px-6 py-4 pb-8">
              <SoldierForm
                soldier={editingSoldier}
                existingSoldiers={soldiers}
                onSubmit={handleSubmit}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200">
          <div className="flex flex-col gap-4 items-start justify-between">
            <CardTitle className="text-slate-900">Personnel Roster</CardTitle>
            <div className="flex flex-col md:flex-row gap-4 w-full items-start md:items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search soldiers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="text-sm text-slate-600 font-medium whitespace-nowrap">
                  {sortedSoldiers.length} soldiers
                </div>
              </div>
              <SoldierFilters
                filters={filters}
                onFilterChange={setFilters}
                soldiers={Array.isArray(soldiers) ? soldiers.filter(s => s != null) : []}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[70vh]">
            <SoldierTable
              soldiers={sortedSoldiers}
              weapons={weapons}
              serializedGear={serializedGear}
              droneSets={droneSets}
              equipment={allEquipment}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onMarkArrived={handleWelcomeSoldier}
              onShowHistory={handleOpenHistory}
              isLoading={isLoading}
              sortConfig={sortConfig}
              currentUser={currentUser}
              onSort={handleSort}
              selectedItems={selectedItems}
              onSelectItem={handleSelectItem}
              onSelectAll={handleSelectAll}
            />
          </div>
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDelete}
        itemType="Soldier"
        itemName={soldierToDelete ? `${soldierToDelete.first_name} ${soldierToDelete.last_name} (${soldierToDelete.soldier_id})` : ""}
      />
    </div>
  );
}
