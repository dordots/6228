
import React, { useState, useEffect, useMemo } from "react";
import { Weapon } from "@/api/entities";
import { Soldier } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Trash2, ArrowLeft, AlertTriangle, Edit } from "lucide-react"; // Added Edit
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { User } from "@/api/entities";
import { ActivityLog } from "@/api/entities";
import WeaponForm from "../components/weapons/WeaponForm";
import WeaponTable from "../components/weapons/WeaponTable";
import WeaponFilters from "../components/weapons/WeaponFilters";
import ReassignWeaponDialog from "../components/weapons/ReassignWeaponDialog";
import RenameTypeDialog from "../components/common/RenameTypeDialog"; // New Import

export default function Weapons() {
  const [weapons, setWeapons] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingWeapon, setEditingWeapon] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    types: [],
    conditions: [],
    divisions: [],
    armory_statuses: [],
    assigned_soldiers: [],
    maintenance_check: 'all',
    date_from: null,
    date_to: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassigningWeapon, setReassigningWeapon] = useState(null);
  const [viewingComment, setViewingComment] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false); // New State

  useEffect(() => {
    loadData();
    const fetchUser = async () => {
        try {
            setCurrentUser(await User.me());
        } catch(e) {
            console.error("Failed to fetch user", e);
        }
    };
    fetchUser();
    
    const urlParams = new URLSearchParams(window.location.search);
    const typeFilter = urlParams.get('type');
    if (typeFilter) {
      setFilters(prev => ({ ...prev, types: [typeFilter] }));
    }
  }, []);

  const isAdminOrManager = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.custom_role === 'manager' || currentUser.custom_role === 'division_manager';
  }, [currentUser]);

  const weaponTypes = useMemo(() => {
    const safeWeapons = Array.isArray(weapons) ? weapons : [];
    return [...new Set(safeWeapons.map(w => w.weapon_type).filter(Boolean))].sort();
  }, [weapons]);

  const loadData = async () => {
    setIsLoading(true);
    try {
       const user = await User.me();
       setCurrentUser(user);
       const isAdmin = user?.role === 'admin';
       const isManager = user?.custom_role === 'manager';
       const isDivisionManager = user?.custom_role === 'division_manager';
       const isTeamLeader = user?.custom_role === 'team_leader';
       const userDivision = user?.division;
       const userTeam = user?.team;

       // DEBUG: Log user details
       console.log('=== WEAPON LOAD DEBUG ===');
       console.log('Current User:', {
         role: user?.role,
         custom_role: user?.custom_role,
         division: user?.division,
         team: user?.team,
         full_name: user?.full_name
       });

       // Team leaders need special two-step filtering
       if (isTeamLeader && userDivision && userTeam) {
         console.log('Team leader: Using two-step filtering approach');

         // Step 1: Get team soldiers
         const teamSoldiers = await Soldier.filter({
           division_name: userDivision,
           team_name: userTeam
         }).catch(() => []);

         const soldierIds = teamSoldiers.map(s => s.soldier_id);
         console.log(`Team leader: Found ${soldierIds.length} team soldiers`);

         // Step 2: Get all division weapons, then filter client-side
         const allWeapons = await Weapon.filter({ division_name: userDivision }, "-created_date").catch(() => []);
         console.log(`Team leader: Fetched ${allWeapons.length} division weapons, filtering client-side...`);

         const soldierIdSet = new Set(soldierIds);
         const weaponsData = allWeapons.filter(w => w.assigned_to && soldierIdSet.has(w.assigned_to));

         console.log(`Team leader: After filtering, ${weaponsData.length} weapons assigned to team members`);

         setWeapons(Array.isArray(weaponsData) ? weaponsData : []);
         setSoldiers(Array.isArray(teamSoldiers) ? teamSoldiers : []);
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

         // DEBUG: Log the filter being applied
         console.log('Database Filter Applied:', filter);
         console.log('Filter explanation:', Object.keys(filter).length === 0
           ? 'No filter - fetching ALL weapons (admin/manager)'
           : `Filtering by division_name: "${filter.division_name}"`);

        const [weaponsData, soldiersData] = await Promise.all([
          Weapon.filter(filter, "-created_date").catch(() => []),
          Soldier.filter(filter).catch(() => [])
        ]);

        // DEBUG: Log fetched data
        console.log('Total weapons fetched from DB:', weaponsData?.length || 0);
        console.log('Total soldiers fetched from DB:', soldiersData?.length || 0);

        if (weaponsData && weaponsData.length > 0) {
          // Sample first 5 weapons
          console.log('Sample of first 5 weapons:', weaponsData.slice(0, 5).map(w => ({
            id: w.id,
            weapon_id: w.weapon_id,
            weapon_type: w.weapon_type,
            division_name: w.division_name,
            assigned_to: w.assigned_to
          })));

          // Check for weapons with missing division_name
          const weaponsWithoutDivision = weaponsData.filter(w => !w.division_name);
          if (weaponsWithoutDivision.length > 0) {
            console.warn('⚠️ Weapons with missing division_name:', weaponsWithoutDivision.length);
            console.warn('Sample:', weaponsWithoutDivision.slice(0, 3).map(w => ({
              id: w.id,
              weapon_id: w.weapon_id,
              weapon_type: w.weapon_type,
              division_name: w.division_name
            })));
          }

          // Show unique division names in fetched data
          const uniqueDivisions = [...new Set(weaponsData.map(w => w.division_name).filter(Boolean))];
          console.log('Unique divisions in fetched weapons:', uniqueDivisions);
        }

        console.log('=== END WEAPON LOAD DEBUG ===\n');

        setWeapons(Array.isArray(weaponsData) ? weaponsData : []);
        setSoldiers(Array.isArray(soldiersData) ? soldiersData : []);
       }
    } catch (error) {
      console.error("Error loading data:", error);
      setWeapons([]);
      setSoldiers([]);
    }
    setIsLoading(false);
  };

  const handleRenameType = async (originalType, newType) => {
    if (!isAdminOrManager) {
      alert("You do not have permission to perform this action.");
      return;
    }

    const weaponsToUpdate = weapons.filter(w => w.weapon_type === originalType);
    if (weaponsToUpdate.length === 0) {
      alert("No weapons found with the original type.");
      return;
    }

    try {
      const updatePromises = weaponsToUpdate.map(w => Weapon.update(w.id, { weapon_type: newType }));
      await Promise.all(updatePromises);

      // Try to create activity log, but don't fail rename if it errors
      try {
        await ActivityLog.create({
          activity_type: 'UPDATE',
          entity_type: 'Weapon',
          details: `Bulk renamed Weapon type from '${originalType}' to '${newType}'. Affected ${weaponsToUpdate.length} items.`,
          user_full_name: currentUser.full_name,
          division_name: 'N/A' // This is a cross-division action
        });
      } catch (logError) {
        console.error("Failed to create activity log (weapon rename succeeded):", logError);
      }

      alert("Weapon types renamed successfully!");
      setShowRenameDialog(false);
      await loadData();
    } catch (error) {
      console.error("Error renaming weapon types:", error);
      alert("An error occurred during the renaming process.");
    }
  };

  const handleSubmit = async (weaponData) => {
    try {
      const user = currentUser;
      if (!user) {
        alert("User not logged in. Please refresh.");
        return;
      }

      const timestampWithOffset = new Date(new Date().getTime() + 3 * 60 * 60 * 1000).toISOString();
      
      if (editingWeapon) {
        if (!user?.permissions?.['equipment.update'] && user?.role !== 'admin') {
          alert("You do not have permission to edit weapons.");
          return;
        }

        const oldWeapon = editingWeapon;
        const newWeapon = weaponData;
        let changes = [];

        const getSoldierName = (soldierId) => {
            const soldier = soldiers.find(s => s && s.soldier_id === soldierId);
            return soldier ? `${soldier.first_name} ${soldier.last_name}` : 'Unassigned';
        };

        const oldAssignedName = getSoldierName(oldWeapon.assigned_to);
        const newAssignedName = getSoldierName(newWeapon.assigned_to);

        if (oldWeapon.assigned_to !== newWeapon.assigned_to) {
            changes.push(`Assigned To: '${oldAssignedName}' -> '${newAssignedName}'`);
        }

        const fieldsToCompare = [
            'weapon_type', 'weapon_id', 'status', 'division_name',
            'manufacturer', 'model', 'caliber', 'armory_status', 'comments'
        ];

        fieldsToCompare.forEach(field => {
            const oldValue = String(oldWeapon[field] || '');
            const newValue = String(newWeapon[field] || '');
            if (oldValue !== newValue) {
                const formattedField = field.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                changes.push(`${formattedField}: '${oldValue}' -> '${newValue}'`);
            }
        });

        let updateDetails = `Weapon ${oldWeapon.weapon_type} (${oldWeapon.weapon_id}) was updated.`;
        if (changes.length > 0) {
            updateDetails += ` Changes: ${changes.join('; ')}.`;
        } else {
            updateDetails += ` No significant field changes detected.`;
        }

        await Weapon.update(editingWeapon.id, weaponData);

        // Try to create activity log, but don't fail weapon update if it errors
        try {
          await ActivityLog.create({
            activity_type: 'UPDATE',
            entity_type: 'Weapon',
            details: updateDetails,
            user_full_name: user.full_name,
            client_timestamp: timestampWithOffset,
            division_name: weaponData.division_name || 'N/A'
          });
        } catch (logError) {
          console.error("Failed to create activity log (weapon update succeeded):", logError);
        }
      } else {
        if (!user?.permissions?.['equipment.create'] && user?.role !== 'admin') {
          alert("You do not have permission to create weapons.");
          return;
        }
        const serial = weaponData.weapon_id;
        if (!serial?.trim()) {
            alert("Weapon ID is required.");
            return;
        }
        
        const existingWeapons = await Weapon.filter({ weapon_id: serial }).catch(() => []);

        if (existingWeapons.length > 0) {
            alert(`Error: Weapon ID "${serial}" is already in use.`);
            return;
        }

        // Find assigned soldier for enrichment
        const assignedSoldier = weaponData.assigned_to
          ? soldiers.find(s => s && s.soldier_id === weaponData.assigned_to)
          : null;

        // Enrich weapon data with all required fields to match schema of imported/existing weapons
        const enrichedWeaponData = {
          ...weaponData,
          // Timestamp fields (ISO string format for consistency with imports)
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
          // User tracking fields
          created_by: user.email || user.full_name,
          created_by_id: user.id || user.uid,
          // Default fields
          armory_status: weaponData.armory_status || "with_soldier",
          is_sample: "false",
          last_signed_by: assignedSoldier
            ? `${assignedSoldier.first_name} ${assignedSoldier.last_name}`
            : ""
        };

        await Weapon.create(enrichedWeaponData);
        let createDetails = `Weapon ${weaponData.weapon_type} (${weaponData.weapon_id}) was created.`;
        if (weaponData.assigned_to) {
            if (assignedSoldier) {
                createDetails += ` It was assigned to ${assignedSoldier.first_name} ${assignedSoldier.last_name}.`;
            }
        }

        // Try to create activity log, but don't fail weapon creation if it errors
        try {
          await ActivityLog.create({
            activity_type: 'CREATE',
            entity_type: 'Weapon',
            details: createDetails,
            user_full_name: user.full_name,
            client_timestamp: timestampWithOffset,
            division_name: enrichedWeaponData.division_name || 'N/A'
          });
        } catch (logError) {
          console.error("Failed to create activity log (weapon creation succeeded):", logError);
        }
      }

      // Always close form and refresh after successful weapon creation/update
      setShowForm(false);
      setEditingWeapon(null);
      loadData();
    } catch(e) {
      console.error(e);
      alert("An error occurred. Please try again.");
    }
  };

  const handleEdit = (weapon) => {
    setEditingWeapon(weapon);
    setShowForm(true);
  };

  const handleDelete = async (weapon) => {
    if (!currentUser?.permissions?.['equipment.delete'] && currentUser?.role !== 'admin') {
      alert("You do not have permission to delete weapons.");
      return;
    }
    try {
      const user = currentUser;
      if (!user) {
        alert("User not logged in. Please refresh.");
        return;
      }
      
      const timestampWithOffset = new Date(new Date().getTime() + 3 * 60 * 60 * 1000).toISOString();
      
      await ActivityLog.create({
        activity_type: 'DELETE',
        entity_type: 'Weapon',
        details: `Weapon ${weapon.weapon_type} (${weapon.weapon_id}) was deleted.`,
        user_full_name: user.full_name,
        client_timestamp: timestampWithOffset,
        division_name: weapon.division_name
      });
      await Weapon.delete(weapon.id);
      loadData();
    } catch (error) {
      console.error("Error deleting weapon:", error);
      if (error.message?.includes('Object not found') || error.response?.status === 404) {
        loadData();
      } else {
        alert("An error occurred while deleting the weapon. The data has been refreshed.");
        loadData();
      }
    }
  };

  const checkForDuplicates = () => {
    const idCounts = (Array.isArray(weapons) ? weapons : []).reduce((acc, w) => {
      acc[w.weapon_id] = (acc[w.weapon_id] || 0) + 1;
      return acc;
    }, {});
    const foundDuplicates = Object.entries(idCounts)
      .filter(([, count]) => count > 1)
      .map(([id, count]) => ({ id, count }));
    setDuplicates(foundDuplicates);
    setShowDuplicates(true);
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredWeapons.length && filteredWeapons.length > 0) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredWeapons.map(w => w.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!currentUser?.permissions?.can_delete_weapons && currentUser?.role !== 'admin') {
      alert("You do not have permission to delete weapons.");
      return;
    }
    try {
      const user = currentUser;
      if (!user) {
        alert("User not logged in. Please refresh.");
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      
      const timestampWithOffset = new Date(new Date().getTime() + 3 * 60 * 60 * 1000).toISOString();

      for (const id of selectedItems) {
        const weaponToDelete = weapons.find(w => w.id === id);
        if (weaponToDelete) {
          try {
            await ActivityLog.create({
              activity_type: 'DELETE',
              entity_type: 'Weapon',
              details: `Weapon ${weaponToDelete.weapon_type} (${weaponToDelete.weapon_id}) was deleted.`,
              user_full_name: user.full_name,
              client_timestamp: timestampWithOffset,
              division_name: weaponToDelete.division_name
            });
            await Weapon.delete(id);
            successCount++;
          } catch (deleteError) {
            console.error(`Error deleting weapon ${id}:`, deleteError);
            if (deleteError.message?.includes('Object not found') || deleteError.response?.status === 404) {
              successCount++;
            } else {
              errorCount++;
            }
          }
        } else {
          successCount++;
        }
      }
      
      setSelectedItems([]);
      setShowBulkDeleteConfirm(false);
      
      if (errorCount > 0) {
        alert(`Bulk deletion completed. ${successCount} weapons deleted successfully, ${errorCount} errors occurred. The data has been refreshed.`);
      }
      
      loadData();
    } catch (error) {
      console.error("Error during bulk deletion process:", error);
      alert("An unexpected error occurred during bulk deletion. The data has been refreshed to show the current state.");
      setSelectedItems([]);
      setShowBulkDeleteConfirm(false);
      loadData();
    }
  };

  const handleReassign = (weapon) => {
    setReassigningWeapon(weapon);
    setShowReassignDialog(true);
  };

  const handleReassignSubmit = async (weapon, newSoldierId) => {
    // Permission check should be more aligned with editing/transferring
    if (!isAdminOrManager && !currentUser?.permissions?.['equipment.update'] && !currentUser?.permissions?.['operations.transfer']) {
        alert("You do not have permission to reassign equipment.");
        return;
    }
    
    try {
      const user = currentUser;
      if (!user) {
        alert("User not logged in. Please refresh.");
        return;
      }

      // Find the new soldier from the comprehensive soldiers list
      const newSoldier = soldiers.find(s => s && s.soldier_id === newSoldierId);
      
      const newDivisionName = newSoldier ? newSoldier.division_name : (weapon.division_name || 'Unassigned');

      const details = newSoldier
        ? `Weapon ${weapon.weapon_type} (${weapon.weapon_id}) was assigned to ${newSoldier.first_name} ${newSoldier.last_name}.`
        : `Weapon ${weapon.weapon_type} (${weapon.weapon_id}) was unassigned.`
        ;

      const timestampWithOffset = new Date(new Date().getTime() + 3 * 60 * 60 * 1000).toISOString();

      // Prepare the payload to update the weapon
      const updatePayload = {
        assigned_to: newSoldierId,
        division_name: newSoldier ? newSoldier.division_name : null,
        team_name: newSoldier ? newSoldier.team_name : null,
        last_signed_by: newSoldier ? `${newSoldier.first_name} ${newSoldier.last_name}` : null,
      };

      // Perform the update first
      await Weapon.update(weapon.id, updatePayload);

      // Try to log the reassignment activity, but don't fail reassignment if it errors
      try {
        await ActivityLog.create({
          activity_type: 'UPDATE', // Using 'UPDATE' is more accurate than 'ASSIGN' for a reassignment
          entity_type: 'Weapon',
          details: details,
          user_full_name: user.full_name,
          client_timestamp: timestampWithOffset,
          division_name: newDivisionName // Use the derived new division name
        });
      } catch (logError) {
        console.error("Failed to create activity log (weapon reassignment succeeded):", logError);
      }

      // Close dialog and refresh data
      setShowReassignDialog(false);
      setReassigningWeapon(null);
      loadData();

    } catch (error) {
      console.error("Error reassigning weapon:", error);
      alert("An error occurred while reassigning the weapon.");
    }
  };

  const handleViewComment = (weapon) => {
    setViewingComment(weapon);
  };

  const filteredWeapons = useMemo(() => {
    if (!Array.isArray(weapons)) return [];

    // DEBUG: Log filtering process
    console.log('=== CLIENT-SIDE FILTERING DEBUG ===');
    console.log('Total weapons to filter:', weapons.length);
    console.log('Active filters:', {
      searchTerm: searchTerm || '(none)',
      types: filters.types?.length || 0,
      conditions: filters.conditions?.length || 0,
      divisions: filters.divisions?.length || 0,
      armory_statuses: filters.armory_statuses?.length || 0,
      assigned_soldiers: filters.assigned_soldiers?.length || 0,
      maintenance_check: filters.maintenance_check
    });

    const filtered = weapons.filter(weapon => {
      if (!weapon) return false;
      const assignedSoldier = Array.isArray(soldiers) ? soldiers.find(s => s && s.soldier_id === weapon.assigned_to) : null;
      const assignedSoldierName = assignedSoldier ? `${assignedSoldier.first_name} ${assignedSoldier.last_name}` : '';
      const searchLower = searchTerm.toLowerCase();
      const lastSignedByName = weapon.last_signed_by ? String(weapon.last_signed_by).toLowerCase() : '';
      const comments = weapon.comments ? String(weapon.comments).toLowerCase() : '';

      // Search match
      const matchesSearch = !searchTerm ||
        (weapon.weapon_type && String(weapon.weapon_type).toLowerCase().includes(searchLower)) ||
        (weapon.weapon_id && String(weapon.weapon_id).toLowerCase().includes(searchLower)) ||
        (assignedSoldierName && assignedSoldierName.toLowerCase().includes(searchLower)) ||
        (weapon.division_name && String(weapon.division_name).toLowerCase().includes(searchLower)) ||
        (weapon.assigned_to && String(weapon.assigned_to).toLowerCase().includes(searchLower)) ||
        (lastSignedByName && lastSignedByName.includes(searchLower)) ||
        comments.includes(searchLower);

      // Multi-select filters (if array is empty, show all)
      const matchesType = !filters.types || filters.types.length === 0 || filters.types.includes(weapon.weapon_type);
      const matchesCondition = !filters.conditions || filters.conditions.length === 0 || filters.conditions.includes(weapon.status);
      const matchesDivision = !filters.divisions || filters.divisions.length === 0 || filters.divisions.includes(weapon.division_name);
      const matchesArmory = !filters.armory_statuses || filters.armory_statuses.length === 0 ||
        filters.armory_statuses.includes(weapon.armory_status || 'with_soldier');

      // Assigned soldier filter
      const matchesAssignedSoldier = !filters.assigned_soldiers || filters.assigned_soldiers.length === 0 ||
        (filters.assigned_soldiers.includes('unassigned') && !weapon.assigned_to) ||
        (weapon.assigned_to && filters.assigned_soldiers.includes(weapon.assigned_to));

      // Maintenance check filter
      const matchesMaintenance = !filters.maintenance_check || filters.maintenance_check === 'all' ||
        (filters.maintenance_check === 'checked' && weapon.last_checked_date) ||
        (filters.maintenance_check === 'not_checked' && !weapon.last_checked_date);

      // Date range filter
      let matchesDateRange = true;
      if (weapon.last_checked_date) {
        const weaponDate = new Date(weapon.last_checked_date);

        if (filters.date_from && filters.date_to) {
          // Both dates selected - check if weapon date is between them
          const fromDate = new Date(filters.date_from);
          const toDate = new Date(filters.date_to);
          fromDate.setHours(0, 0, 0, 0);
          toDate.setHours(23, 59, 59, 999);
          matchesDateRange = weaponDate >= fromDate && weaponDate <= toDate;
        } else if (filters.date_from) {
          // Only from date - check if weapon date is on or after
          const fromDate = new Date(filters.date_from);
          fromDate.setHours(0, 0, 0, 0);
          matchesDateRange = weaponDate >= fromDate;
        } else if (filters.date_to) {
          // Only to date - check if weapon date is on or before
          const toDate = new Date(filters.date_to);
          toDate.setHours(23, 59, 59, 999);
          matchesDateRange = weaponDate <= toDate;
        }
      } else if (filters.date_from || filters.date_to) {
        // If date filters are set but weapon has no last_checked_date, exclude it
        matchesDateRange = false;
      }

      return matchesSearch && matchesType && matchesCondition && matchesDivision &&
             matchesArmory && matchesAssignedSoldier && matchesMaintenance && matchesDateRange;
    });

    // DEBUG: Show filtering results
    console.log('Weapons after client-side filtering:', filtered.length);
    console.log('Filtered out:', weapons.length - filtered.length, 'weapons');
    console.log('=== END CLIENT-SIDE FILTERING DEBUG ===\n');

    return filtered;
  }, [weapons, soldiers, searchTerm, filters]);


  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Reassign Dialog */}
      <ReassignWeaponDialog
        open={showReassignDialog}
        onOpenChange={setShowReassignDialog}
        weapon={reassigningWeapon}
        soldiers={soldiers}
        onReassign={handleReassignSubmit}
        onCancel={() => setReassigningWeapon(null)}
      />

      {/* Comment Viewer Dialog */}
      <Dialog open={!!viewingComment} onOpenChange={() => setViewingComment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comment for Weapon: {viewingComment?.weapon_id}</DialogTitle>
            <DialogDescription>
              {viewingComment?.weapon_type}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{viewingComment?.comments || "No comment provided."}</p>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Duplicate Checker Dialog */}
      <AlertDialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Weapon IDs</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicates.length > 0 ? (
                <>
                  <p>The following Weapon IDs have been used more than once. Please correct them to ensure data integrity.</p>
                  <ul className="mt-4 space-y-2">
                    {duplicates.map(d => (
                      <li key={d.id} className="flex justify-between items-center">
                        <span>Weapon ID: <strong>{d.id}</strong></span>
                        <Badge variant="destructive">Used {d.count} times</Badge>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                "No duplicate Weapon IDs found."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDuplicates(false)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirm Dialog */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedItems.length} selected weapon(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Type Dialog */}
      <RenameTypeDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        itemTypes={weaponTypes}
        entityName="Weapon"
        onRename={handleRenameType}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Weapon Management</h1>
          <p className="text-slate-600">Track and manage all company weapons systems</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedItems.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!currentUser?.permissions?.can_delete_weapons && currentUser?.role !== 'admin'}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedItems.length})
            </Button>
          )}
          {currentUser?.role === 'admin' && (
            <Button variant="outline" onClick={() => setShowRenameDialog(true)}>
              <Edit className="w-4 h-4 mr-2" /> Rename Type
            </Button>
          )}
          <Button variant="outline" onClick={checkForDuplicates}>Check Duplicates</Button>
          <Button
            onClick={() => { setEditingWeapon(null); setShowForm(true); }}
            className="bg-red-700 hover:bg-red-800 text-white"
            disabled={!isAdminOrManager}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Weapon
          </Button>
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-full max-w-[95vw] md:max-w-[625px] h-[95vh] md:max-h-[90vh] flex flex-col p-0 overflow-hidden">
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
                {editingWeapon ? 'Edit Weapon' : 'Add New Weapon'}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-safe">
            <div className="px-4 md:px-6 py-4 pb-8">
              <WeaponForm
                weapon={editingWeapon}
                soldiers={soldiers}
                existingWeapons={weapons}
                currentUser={currentUser}
                onSubmit={handleSubmit}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-slate-200 shadow-sm mt-6">
        <CardHeader className="border-b border-slate-200">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <CardTitle className="text-slate-900">Weapons Inventory</CardTitle>
            <div className="flex gap-3 w-full md:w-auto">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search weapons..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="text-sm text-slate-600 font-medium whitespace-nowrap">
                  {filteredWeapons.length} weapons
                </div>
              </div>
              <WeaponFilters filters={filters} onFilterChange={setFilters} weapons={weapons} soldiers={soldiers} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-auto max-h-[70vh]">
            <WeaponTable
              weapons={filteredWeapons}
              soldiers={soldiers}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReassign={handleReassign}
              onViewComment={handleViewComment}
              isAdminOrManager={isAdminOrManager}
              permissions={{
                'equipment.update': currentUser?.permissions?.['equipment.update'] || false,
                'equipment.delete': currentUser?.permissions?.['equipment.delete'] || false,
                'operations.transfer': currentUser?.permissions?.['operations.transfer'] || false
              }}
              selectedItems={selectedItems}
              onSelectItem={handleSelectItem}
              onSelectAll={handleSelectAll}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
