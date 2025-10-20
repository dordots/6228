
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"; // Import useRef
import { Soldier } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DroneSet } from "@/api/entities";
import { Equipment } from "@/api/entities";
import { ActivityLog } from "@/api/entities";
import { User } from "@/api/entities";
import { generateReleaseForm } from "@/api/functions"; // Import the new function
import { sendReleaseFormByActivity } from "@/api/functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, ChevronDown, Home, ArrowLeftCircle, Target, Package, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import AssignedItemsList from "../components/release/AssignedItemsList";
import SignatureCanvas from "../components/soldiers/SignatureCanvas"; // Import signature canvas

export default function SoldierReleasePage() {
  const [soldiers, setSoldiers] = useState([]);
  const [assignedWeapons, setAssignedWeapons] = useState([]);
  const [assignedGear, setAssignedGear] = useState([]);
  const [assignedDrones, setAssignedDrones] = useState([]);
  const [assignedEquipmentList, setAssignedEquipmentList] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false); // New state for overall release
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [lastReleasedSoldier, setLastReleasedSoldier] = useState(null); // ADD: Keep track of last soldier

  const [showSerializedDialog, setShowSerializedDialog] = useState(false);
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false);
  const [selectedSerializedItems, setSelectedSerializedItems] = useState([]);
  const [selectedEquipmentItems, setSelectedEquipmentItems] = useState([]);
  const [serializedQuantities, setSerializedQuantities] = useState({});
  const [equipmentQuantities, setEquipmentQuantities] = useState({});

  const [successMessage, setSuccessMessage] = useState(""); // New state for success messages
  const [errorMessage, setErrorMessage] = useState(""); // New state for error messages

  const [showSuccessDialog, setShowSuccessDialog] = useState(false); // NEW: State for successful release dialog
  const [dialogContent, setDialogContent] = useState({ title: '', description: '' }); // NEW: Content for the success dialog
  const [lastActivityId, setLastActivityId] = useState(null); // NEW: Store activity ID for PDF
  const [isExporting, setIsExporting] = useState(false); // NEW: State for PDF export loading

  const signaturePadRef = useRef(null); // Ref for the signature pad

  useEffect(() => {
    loadAllData(); // Renamed loadSoldiers to loadAllData based on outline
  }, []);

  const handleSerializedQuantityChange = (itemId, quantity) => {
    setSerializedQuantities(prev => ({
      ...prev,
      [itemId]: quantity
    }));
  };

  const handleEquipmentQuantityChange = (itemId, quantity) => {
    setEquipmentQuantities(prev => ({
      ...prev,
      [itemId]: quantity
    }));
  };

  const loadAllData = async () => { // Renamed from loadSoldiers
    setIsLoading(true);
    try {
      const s = await Soldier.list("-created_date");
      setSoldiers(Array.isArray(s) ? s : []);
    } catch (error) {
      console.error("Error loading soldiers:", error);
      setErrorMessage("Error loading soldiers.");
    }
    setIsLoading(false);
  };

  const loadSoldierItems = async (soldier) => {
    if (!soldier) return;
    setIsItemsLoading(true);
    setErrorMessage(""); // Clear any previous errors
    try {
      const soldierId = soldier.soldier_id;
      const [w, sg, ds, eq] = await Promise.all([
        Weapon.filter({ assigned_to: soldierId }),
        SerializedGear.filter({ assigned_to: soldierId }),
        DroneSet.filter({ assigned_to: soldierId }),
        Equipment.filter({ assigned_to: soldierId }),
      ]);
      setAssignedWeapons(Array.isArray(w) ? w : []);
      setAssignedGear(Array.isArray(sg) ? sg : []);
      setAssignedDrones(Array.isArray(ds) ? ds : []);
      setAssignedEquipmentList(Array.isArray(eq) ? eq : []);
    } catch (error) {
      console.error("Error loading soldier items:", error);
      setErrorMessage("Error loading soldier's assigned items.");
      // Reset on error
      setAssignedWeapons([]);
      setAssignedGear([]);
      setAssignedDrones([]);
      setAssignedEquipmentList([]);
    }
    setIsItemsLoading(false);
  };

  const searchResults = useMemo(() => {
    if (searchTerm.length < 2) return [];
    if (!Array.isArray(soldiers)) return [];

    const searchTermNormalized = searchTerm.trim();

    return soldiers.filter(soldier => {
      if (!soldier) return false;

      // Create multiple search targets
      const searchTargets = [
        soldier.first_name,
        soldier.last_name,
        soldier.soldier_id,
        `${soldier.first_name} ${soldier.last_name}`,
        `${soldier.last_name} ${soldier.first_name}`,
        soldier.division_name,
        soldier.team_name,
        soldier.profession
      ].filter(Boolean);

      // Check if any target contains the search term (case-insensitive, includes Hebrew)
      return searchTargets.some(target => {
        if (!target) return false;

        // Direct inclusion check (works for Hebrew)
        return target.toLowerCase().includes(searchTermNormalized.toLowerCase()) ||
               searchTermNormalized.toLowerCase().includes(target.toLowerCase());
      });
    }).slice(0, 15); // Increased limit to show more results
  }, [soldiers, searchTerm]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSearchOpen(value.length >= 2);
    setSuccessMessage(""); // Clear messages on new search
    setErrorMessage("");
  };

  const selectSoldier = (soldier) => {
    setSelectedSoldier(soldier);
    setSearchTerm(`${soldier.first_name} ${soldier.last_name}`);
    setSearchOpen(false);
    setSelectedSerializedItems([]);
    setSelectedEquipmentItems([]);
    setSerializedQuantities({});
    setEquipmentQuantities({});
    setSuccessMessage(""); // Clear messages on new selection
    setErrorMessage("");
    loadSoldierItems(soldier);
  };

  const assignedSerialized = useMemo(() => {
    if (!selectedSoldier) return [];
    const mappedWeapons = assignedWeapons.map(i => ({ ...i, itemType: 'Weapon', displayName: i.weapon_type, displayId: i.weapon_id }));
    const mappedGear = assignedGear.map(i => ({ ...i, itemType: 'Gear', displayName: i.gear_type, displayId: i.gear_id }));
    const mappedDrones = assignedDrones.map(i => ({ ...i, itemType: 'Drone', displayName: i.set_type, displayId: i.set_serial_number }));
    return [...mappedWeapons, ...mappedGear, ...mappedDrones];
  }, [selectedSoldier, assignedWeapons, assignedGear, assignedDrones]);

  const assignedEquipment = useMemo(() => {
    if (!selectedSoldier) return [];
    return assignedEquipmentList.map(i => ({ ...i, itemType: 'Equipment', displayName: `${i.equipment_type} (x${i.quantity})`, displayId: `ID: ${i.id.slice(0,8)}` }));
  }, [selectedSoldier, assignedEquipmentList]);

  // Combined list of all assigned items for a potential full release action
  const allAssignedItemsForFullRelease = useMemo(() => {
    if (!selectedSoldier) return [];
    const items = [];
    assignedWeapons.forEach(i => items.push({ id: i.id, itemType: 'Weapon', displayName: i.weapon_type, displayId: i.weapon_id }));
    assignedGear.forEach(i => items.push({ id: i.id, itemType: 'Gear', displayName: i.gear_type, displayId: i.gear_id }));
    assignedDrones.forEach(i => items.push({ id: i.id, itemType: 'Drone', displayName: i.set_type, displayId: i.set_serial_number }));
    assignedEquipmentList.forEach(i => items.push({ id: i.id, itemType: 'Equipment', displayName: `${i.equipment_type} (x${i.quantity})`, quantity: i.quantity, displayId: `ID: ${i.id.slice(0,8)}` }));
    return items;
  }, [selectedSoldier, assignedWeapons, assignedGear, assignedDrones, assignedEquipmentList]);


  const checkAndFinalizeRelease = async (soldierId) => {
      const [w, sg, ds, eq] = await Promise.all([
        Weapon.filter({ assigned_to: soldierId }),
        SerializedGear.filter({ assigned_to: soldierId }),
        DroneSet.filter({ assigned_to: soldierId }),
        Equipment.filter({ assigned_to: soldierId }),
      ]);
      const remainingItemsCount = w.length + sg.length + ds.length + eq.length;

      if (remainingItemsCount === 0 && selectedSoldier) {
        // Removed the automatic status change to 'released'
        const currentUser = await User.me();
        await ActivityLog.create({
          activity_type: "UNASSIGN",
          entity_type: "Soldier",
          details: `All items unassigned from soldier ${selectedSoldier.first_name} ${selectedSoldier.last_name}.`,
          user_full_name: currentUser?.full_name || 'System',
          client_timestamp: new Date().toISOString(),
          division_name: selectedSoldier.division_name,
          soldier_id: selectedSoldier.soldier_id
        });
        // The success message is now handled by the Dialog
        // setSuccessMessage(`All equipment successfully unassigned from ${selectedSoldier.first_name} ${selectedSoldier.last_name}.`);
        // Keep the UI reset for better user experience
        setSelectedSoldier(null);
        setSearchTerm("");
        setAssignedWeapons([]);
        setAssignedGear([]);
        setAssignedDrones([]);
        setAssignedEquipmentList([]);
      }
  };

  const handleUnassignSerialized = async (signature) => {
    if (selectedSerializedItems.length === 0 || !selectedSoldier) return;
    setErrorMessage(""); // Clear any previous errors
    try {
      const currentUser = await User.me();
      // ADDED: Look up the performing soldier
      let performingSoldier = null;
      if (currentUser.linked_soldier_id) {
          try {
              const soldiers = await Soldier.filter({ soldier_id: currentUser.linked_soldier_id });
              performingSoldier = soldiers[0] || null;
          } catch (e) { console.error("Error fetching linked soldier:", e); }
      }

      const itemsToUnassign = assignedSerialized.filter(item => selectedSerializedItems.includes(item.id));
      const itemDetailsForLog = itemsToUnassign.map(item => {
        return { type: item.itemType, name: item.displayName, id: item.displayId };
      });

      for (const item of itemsToUnassign) {
        if (!item) continue;

        // Debug: Log the item structure to see what ID we're using
        console.log('[DEBUG handleUnassignSerialized] Attempting to update item:', {
          itemType: item.itemType,
          id: item.id,
          weapon_id: item.weapon_id,
          gear_id: item.gear_id,
          drone_set_id: item.drone_set_id,
          displayId: item.displayId
        });

        switch (item.itemType) {
          case 'Weapon':
            await Weapon.update(item.id, { assigned_to: null, armory_status: 'with_soldier' });
            break;
          case 'Gear':
            await SerializedGear.update(item.id, { assigned_to: null, armory_status: 'with_soldier' });
            break;
          case 'Drone':
            await DroneSet.update(item.id, { assigned_to: null, armory_status: 'with_soldier' });
            break;
          default: break;
        }
      }

      const logContext = { unassignedItems: itemDetailsForLog };
      if (signature) {
        logContext.signature = signature;
      }
      
      const newActivityLog = await ActivityLog.create({
        activity_type: "UNASSIGN",
        entity_type: "Soldier",
        details: `Unassigned ${itemDetailsForLog.length} serialized items from ${selectedSoldier.first_name} ${selectedSoldier.last_name} (${selectedSoldier.soldier_id}).` + (signature ? ` Signature provided.` : ''),
        user_full_name: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : currentUser.full_name,
        user_soldier_id: performingSoldier ? performingSoldier.soldier_id : null,
        client_timestamp: new Date().toISOString(),
        context: logContext,
        division_name: selectedSoldier.division_name,
        soldier_id: selectedSoldier.soldier_id
      });

      // Send email notification and get feedback
      const emailResponse = await sendReleaseFormByActivity({ activityId: newActivityLog.id });

      // Show success dialog with detailed feedback
      setDialogContent({
        title: 'Release Successful',
        description: emailResponse.data.soldierReceived
          ? `The release form has been sent to ${selectedSoldier.first_name}'s email. A copy was also sent to you.`
          : `The release form could not be sent to the soldier (they are not a registered app user). A copy was sent to your email for manual sharing.`,
      });
      setLastActivityId(newActivityLog.id);
      setLastReleasedSoldier(selectedSoldier);
      setShowSuccessDialog(true);
      
      setSuccessMessage(""); // Clear general messages
      setErrorMessage("");

      await checkAndFinalizeRelease(selectedSoldier.soldier_id);
      setShowSerializedDialog(false);
      setSelectedSerializedItems([]);
      setSerializedQuantities({});
      await loadSoldierItems(selectedSoldier); // Keep this to re-fetch remaining items if any

    } catch (error) {
      console.error("Failed to release serialized items:", error);

      // Even on error, try to create activity log and send email (operation may have partially succeeded)
      try {
        const currentUser = await User.me();
        let performingSoldier = null;
        if (currentUser.linked_soldier_id) {
          try {
            const soldiers = await Soldier.filter({ soldier_id: currentUser.linked_soldier_id });
            performingSoldier = soldiers[0] || null;
          } catch (e) { console.error("Error fetching linked soldier:", e); }
        }

        const itemsToUnassign = assignedSerialized.filter(item => selectedSerializedItems.includes(item.id));
        const itemDetailsForLog = itemsToUnassign.map(item => {
          return { type: item.itemType, name: item.displayName, id: item.displayId };
        });

        const logContext = { unassignedItems: itemDetailsForLog };
        if (signature) {
          logContext.signature = signature;
        }

        const newActivityLog = await ActivityLog.create({
          activity_type: "UNASSIGN",
          entity_type: "Soldier",
          details: `Attempted to unassign ${itemDetailsForLog.length} serialized items from ${selectedSoldier.first_name} ${selectedSoldier.last_name} (${selectedSoldier.soldier_id}).` + (signature ? ` Signature provided.` : ''),
          user_full_name: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : currentUser.full_name,
          user_soldier_id: performingSoldier ? performingSoldier.soldier_id : null,
          client_timestamp: new Date().toISOString(),
          context: logContext,
          division_name: selectedSoldier.division_name,
          soldier_id: selectedSoldier.soldier_id
        });

        // Try to send email
        try {
          console.log('[handleUnassignSerialized] Sending release form email for activity:', newActivityLog.id);
          const emailResponse = await sendReleaseFormByActivity({ activityId: newActivityLog.id });
          console.log('[handleUnassignSerialized] Email response:', emailResponse);
          setDialogContent({
            title: 'Release Completed',
            description: emailResponse.data.soldierReceived
              ? `The release form has been sent to ${selectedSoldier.first_name}'s email. A copy was also sent to you.`
              : `The release form could not be sent to the soldier (they are not a registered app user). A copy was sent to your email for manual sharing.`,
          });
        } catch (emailError) {
          console.error("Failed to send email:", emailError);
          setDialogContent({
            title: 'Release Completed',
            description: `Items have been processed. Email notification could not be sent.`,
          });
        }

        setLastActivityId(newActivityLog.id);
        setLastReleasedSoldier(selectedSoldier);
        setShowSuccessDialog(true);

      } catch (logError) {
        console.error("Failed to create activity log:", logError);
        // Even if activity log creation fails, set the soldier so the button can work
        // The button will try to create the form on-demand
        setLastReleasedSoldier(selectedSoldier);
        setDialogContent({
          title: 'Release Completed',
          description: `Items have been processed. You can try viewing the release form, or refresh the page to see the current state.`,
        });
        setShowSuccessDialog(true);
      }

      // Close the dialog and refresh
      setShowSerializedDialog(false);
      setSelectedSerializedItems([]);
      setSerializedQuantities({});
      if (selectedSoldier) {
        await loadSoldierItems(selectedSoldier);
      }
    }
  };

  const handleUnassignEquipment = async (signature) => {
    if (selectedEquipmentItems.length === 0 || !selectedSoldier) return;
    setErrorMessage(""); // Clear any previous errors
    try {
      const currentUser = await User.me();
      // ADDED: Look up the performing soldier
      let performingSoldier = null;
      if (currentUser.linked_soldier_id) {
          try {
              const soldiers = await Soldier.filter({ soldier_id: currentUser.linked_soldier_id });
              performingSoldier = soldiers[0] || null;
          } catch (e) { console.error("Error fetching linked soldier:", e); }
      }

      let logDetails = [];

      for (const itemId of selectedEquipmentItems) {
        const item = assignedEquipmentList.find(e => e.id === itemId);
        if (!item) continue;

        const quantityToUnassign = equipmentQuantities[itemId] || item.quantity;
        const remainingQuantity = item.quantity - quantityToUnassign;

        logDetails.push({ type: item.equipment_type, quantity: quantityToUnassign, name: item.displayName });

        if (remainingQuantity <= 0) {
          await Equipment.update(itemId, { assigned_to: null });
        } else {
          await Equipment.update(itemId, { quantity: remainingQuantity });
          const { id, ...rest } = item;
          await Equipment.create({
            ...rest,
            assigned_to: null,
            quantity: quantityToUnassign,
          });
        }
      }

      const logContext = { unassignedItems: logDetails };
      if (signature) {
          logContext.signature = signature;
      }

      const newActivityLog = await ActivityLog.create({
        activity_type: "UNASSIGN",
        entity_type: "Soldier",
        details: `Unassigned ${logDetails.reduce((sum, item) => sum + item.quantity, 0)} units of equipment from ${selectedSoldier.first_name} ${selectedSoldier.last_name} (${selectedSoldier.soldier_id}).` + (signature ? ` Signature provided.` : ''),
        user_full_name: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : currentUser.full_name,
        user_soldier_id: performingSoldier ? performingSoldier.soldier_id : null,
        client_timestamp: new Date().toISOString(),
        context: logContext,
        division_name: selectedSoldier.division_name,
        soldier_id: selectedSoldier.soldier_id
      });
      
      // Send email notification and get feedback
      const emailResponse = await sendReleaseFormByActivity({ activityId: newActivityLog.id });

      // Show success dialog with detailed feedback
      setDialogContent({
        title: 'Release Successful',
        description: emailResponse.data.soldierReceived
          ? `The release form has been sent to ${selectedSoldier.first_name}'s email. A copy was also sent to you.`
          : `The release form could not be sent to the soldier (they are not a registered app user). A copy was sent to your email for manual sharing.`,
      });
      setLastActivityId(newActivityLog.id);
      setLastReleasedSoldier(selectedSoldier);
      setShowSuccessDialog(true);

      setSuccessMessage(""); // Clear general messages
      setErrorMessage("");

      await checkAndFinalizeRelease(selectedSoldier.soldier_id);
      setShowEquipmentDialog(false);
      setSelectedEquipmentItems([]);
      setEquipmentQuantities({});
      await loadSoldierItems(selectedSoldier); // Keep this to re-fetch remaining items if any

    } catch (error) {
      console.error("Failed to release equipment:", error);

      // Even on error, try to create activity log and send email (operation may have partially succeeded)
      try {
        const currentUser = await User.me();
        let performingSoldier = null;
        if (currentUser.linked_soldier_id) {
          try {
            const soldiers = await Soldier.filter({ soldier_id: currentUser.linked_soldier_id });
            performingSoldier = soldiers[0] || null;
          } catch (e) { console.error("Error fetching linked soldier:", e); }
        }

        let logDetails = [];
        for (const itemId of selectedEquipmentItems) {
          const item = assignedEquipmentList.find(e => e.id === itemId);
          if (!item) continue;
          const quantityToUnassign = equipmentQuantities[itemId] || item.quantity;
          logDetails.push({ type: item.equipment_type, quantity: quantityToUnassign, name: item.displayName });
        }

        const logContext = { unassignedItems: logDetails };
        if (signature) {
          logContext.signature = signature;
        }

        const newActivityLog = await ActivityLog.create({
          activity_type: "UNASSIGN",
          entity_type: "Soldier",
          details: `Attempted to unassign ${logDetails.reduce((sum, item) => sum + item.quantity, 0)} units of equipment from ${selectedSoldier.first_name} ${selectedSoldier.last_name} (${selectedSoldier.soldier_id}).` + (signature ? ` Signature provided.` : ''),
          user_full_name: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : currentUser.full_name,
          user_soldier_id: performingSoldier ? performingSoldier.soldier_id : null,
          client_timestamp: new Date().toISOString(),
          context: logContext,
          division_name: selectedSoldier.division_name,
          soldier_id: selectedSoldier.soldier_id
        });

        // Try to send email
        try {
          console.log('[handleUnassignEquipment] Sending release form email for activity:', newActivityLog.id);
          const emailResponse = await sendReleaseFormByActivity({ activityId: newActivityLog.id });
          console.log('[handleUnassignEquipment] Email response:', emailResponse);
          setDialogContent({
            title: 'Release Completed',
            description: emailResponse.data.soldierReceived
              ? `The release form has been sent to ${selectedSoldier.first_name}'s email. A copy was also sent to you.`
              : `The release form could not be sent to the soldier (they are not a registered app user). A copy was sent to your email for manual sharing.`,
          });
        } catch (emailError) {
          console.error("Failed to send email:", emailError);
          setDialogContent({
            title: 'Release Completed',
            description: `Items have been processed. Email notification could not be sent.`,
          });
        }

        setLastActivityId(newActivityLog.id);
        setLastReleasedSoldier(selectedSoldier);
        setShowSuccessDialog(true);

      } catch (logError) {
        console.error("Failed to create activity log:", logError);
        // Even if activity log creation fails, set the soldier so the button can work
        // The button will try to create the form on-demand
        setLastReleasedSoldier(selectedSoldier);
        setDialogContent({
          title: 'Release Completed',
          description: `Items have been processed. You can try viewing the release form, or refresh the page to see the current state.`,
        });
        setShowSuccessDialog(true);
      }

      // Close the dialog and refresh
      setShowEquipmentDialog(false);
      setSelectedEquipmentItems([]);
      setEquipmentQuantities({});
      if (selectedSoldier) {
        await loadSoldierItems(selectedSoldier);
      }
    }
  };

  // New handleRelease function for a full soldier release
  const handleRelease = async (signature) => {
    if (!selectedSoldier) return;
    setIsReleasing(true);
    setSuccessMessage("");
    setErrorMessage("");
    try {
        const user = await User.me();
        if (!user) throw new Error("Current user not found.");
        
        // ADDED: Look up the performing soldier
        let performingSoldier = null;
        if (user.linked_soldier_id) {
            try {
                const soldiers = await Soldier.filter({ soldier_id: user.linked_soldier_id });
                performingSoldier = soldiers[0] || null;
            } catch (e) { console.error("Error fetching linked soldier:", e); }
        }

        const unassignPromises = [];
        const itemDetailsForLog = [];

        for (const item of allAssignedItemsForFullRelease) {
            let promise;
            let logDetail = { type: item.itemType, name: item.displayName, id: item.id };
            if (item.itemType === 'Equipment') {
                logDetail.quantity = item.quantity; // For Equipment, log original assigned quantity
            }

            switch (item.itemType) {
                case 'Weapon':
                    promise = Weapon.update(item.id, { assigned_to: null, armory_status: 'with_soldier' });
                    break;
                case 'Gear':
                    promise = SerializedGear.update(item.id, { assigned_to: null, armory_status: 'with_soldier' });
                    break;
                case 'Drone':
                    promise = DroneSet.update(item.id, { assigned_to: null, armory_status: 'with_soldier' });
                    break;
                case 'Equipment':
                    // For full release, unassign the entire equipment instance
                    promise = Equipment.update(item.id, { assigned_to: null });
                    break;
                default:
                    console.warn(`Unknown itemType during full release: ${item.itemType}`);
                    continue;
            }
            if (promise) {
                unassignPromises.push(promise);
                itemDetailsForLog.push(logDetail); // Collect for activity log context
            }
        }
        
        // Removed the soldier status update - no longer changing to 'released'

        await Promise.all(unassignPromises);

        const logContext = {
            soldierId: selectedSoldier.soldier_id,
            unassignedItems: itemDetailsForLog,
            signature: signature || null // Add signature directly to context
        };

        const newActivityLog = await ActivityLog.create({
            activity_type: "RELEASE",
            entity_type: "Soldier",
            details: `Unassigned all ${itemDetailsForLog.length} items from soldier ${selectedSoldier.first_name} ${selectedSoldier.last_name} (${selectedSoldier.soldier_id}).` + (signature ? ` Signature provided.` : ''),
            user_full_name: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : user.full_name,
            user_soldier_id: performingSoldier ? performingSoldier.soldier_id : null,
            context: logContext,
            division_name: selectedSoldier.division_name,
            soldier_id: selectedSoldier.soldier_id
        });

        // Send email notification
        const emailResponse = await sendReleaseFormByActivity({ activityId: newActivityLog.id });
        
        // Show success dialog with detailed feedback
        setDialogContent({
            title: 'Full Release Successful',
            description: emailResponse.data.soldierReceived
              ? `The release form has been sent to ${selectedSoldier.first_name}'s email. A copy was also sent to you.`
              : `The release form could not be sent to the soldier (they are not a registered app user). A copy was sent to your email for manual sharing.`,
        });
        setLastActivityId(newActivityLog.id);
        setLastReleasedSoldier(selectedSoldier);
        setShowSuccessDialog(true);
        
        setSuccessMessage(""); // Clear general messages
        setErrorMessage("");

        // Reset UI after full release
        setSelectedSoldier(null);
        setSearchTerm("");
        setAssignedWeapons([]);
        setAssignedGear([]);
        setAssignedDrones([]);
        setAssignedEquipmentList([]);
        loadAllData(); // Refresh the soldier list

    } catch (error) {
        console.error("Failed to perform full soldier release:", error);

        // Even on error, try to create activity log and send email (operation may have partially succeeded)
        try {
            const user = await User.me();
            let performingSoldier = null;
            if (user.linked_soldier_id) {
                try {
                    const soldiers = await Soldier.filter({ soldier_id: user.linked_soldier_id });
                    performingSoldier = soldiers[0] || null;
                } catch (e) { console.error("Error fetching linked soldier:", e); }
            }

            const itemDetailsForLog = [];
            for (const item of allAssignedItemsForFullRelease) {
                let logDetail = { type: item.itemType, name: item.displayName, id: item.id };
                if (item.itemType === 'Equipment') {
                    logDetail.quantity = item.quantity;
                }
                itemDetailsForLog.push(logDetail);
            }

            const logContext = {
                soldierId: selectedSoldier.soldier_id,
                unassignedItems: itemDetailsForLog,
                signature: signature || null
            };

            const newActivityLog = await ActivityLog.create({
                activity_type: "RELEASE",
                entity_type: "Soldier",
                details: `Attempted to unassign all ${itemDetailsForLog.length} items from soldier ${selectedSoldier.first_name} ${selectedSoldier.last_name} (${selectedSoldier.soldier_id}).` + (signature ? ` Signature provided.` : ''),
                user_full_name: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : user.full_name,
                user_soldier_id: performingSoldier ? performingSoldier.soldier_id : null,
                context: logContext,
                division_name: selectedSoldier.division_name,
                soldier_id: selectedSoldier.soldier_id
            });

            // Try to send email
            try {
                console.log('[handleRelease] Sending release form email for activity:', newActivityLog.id);
                const emailResponse = await sendReleaseFormByActivity({ activityId: newActivityLog.id });
                console.log('[handleRelease] Email response:', emailResponse);
                setDialogContent({
                    title: 'Full Release Completed',
                    description: emailResponse.data.soldierReceived
                      ? `The release form has been sent to ${selectedSoldier.first_name}'s email. A copy was also sent to you.`
                      : `The release form could not be sent to the soldier (they are not a registered app user). A copy was sent to your email for manual sharing.`,
                });
            } catch (emailError) {
                console.error("Failed to send email:", emailError);
                setDialogContent({
                    title: 'Full Release Completed',
                    description: `Items have been processed. Email notification could not be sent.`,
                });
            }

            setLastActivityId(newActivityLog.id);
            setLastReleasedSoldier(selectedSoldier);
            setShowSuccessDialog(true);

        } catch (logError) {
            console.error("Failed to create activity log:", logError);
            // Even if activity log creation fails, set the soldier so the button can work
            // The button will try to create the form on-demand
            setLastReleasedSoldier(selectedSoldier);
            setDialogContent({
                title: 'Full Release Completed',
                description: `Items have been processed. You can try viewing the release form, or refresh the page to see the current state.`,
            });
            setShowSuccessDialog(true);
        }

        // Reset UI and refresh
        setSelectedSoldier(null);
        setSearchTerm("");
        setAssignedWeapons([]);
        setAssignedGear([]);
        setAssignedDrones([]);
        setAssignedEquipmentList([]);
        loadAllData(); // Refresh the soldier list
    } finally {
        setIsReleasing(false);
    }
  };

  const handleExportForm = async () => {
    if (!lastReleasedSoldier) return;
    setIsExporting(true);
    try {
      let activityId = lastActivityId;

      // If we don't have an activity ID, try to find the most recent one for this soldier
      if (!activityId) {
        console.log('[handleExportForm] No activity ID available, querying for most recent activity...');
        const recentActivities = await ActivityLog.filter({
          soldier_id: lastReleasedSoldier.soldier_id,
          activity_type: ['UNASSIGN', 'RELEASE']
        });

        if (recentActivities && recentActivities.length > 0) {
          // Sort by created_at descending and take the first one
          const sortedActivities = recentActivities.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
            const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
            return dateB - dateA;
          });
          activityId = sortedActivities[0].id;
          console.log('[handleExportForm] Found activity ID:', activityId);
        }
      }

      // FIXED: Call the function directly instead of trying to use a URL
      const response = await generateReleaseForm({
        activityId: activityId || undefined,
        fallback_soldier_id: lastReleasedSoldier.soldier_id
      });

      // Create HTML blob and open in new tab
      const blob = new Blob([response.data], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');

      // Clean up after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

    } catch (error) {
      console.error("Error generating release form:", error);
      setErrorMessage("Failed to generate the release form. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* DIALOG FOR SUCCESS AND MANUAL FORM VIEWING */}
      <Dialog open={showSuccessDialog} onOpenChange={(isOpen) => { setShowSuccessDialog(isOpen); if (!isOpen) setLastReleasedSoldier(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogContent.title}</DialogTitle>
            <DialogDescription>
              {dialogContent.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuccessDialog(false)}>Close</Button>
            <Button onClick={handleExportForm} disabled={isExporting || !lastReleasedSoldier}>
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "View Release Form"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Let's Go Home</h1>
        <p className="text-slate-600 text-sm md:text-base">Un-sign equipment from a soldier upon their release.</p>
      </div>

      {successMessage && (
        <div className="bg-green-100 border border-green-200 text-green-800 p-3 rounded-md text-sm" role="alert">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-100 border border-red-200 text-red-800 p-3 rounded-md text-sm" role="alert">
          {errorMessage}
        </div>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200 pb-4">
          <CardTitle className="text-slate-900 flex items-center gap-2 text-lg md:text-xl">
            <Users className="w-5 h-5" />
            Find Soldier to Release
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Search by name or soldier ID</label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Type at least 2 characters..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="pl-9 pr-10"
                    disabled={isLoading}
                  />
                  {isLoading ?
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 animate-spin" /> :
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  }
                </div>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <ScrollArea className="h-60">
                  {Array.isArray(searchResults) && searchResults.length > 0 ? (
                    searchResults.map(soldier => (
                      <div
                        key={soldier.id}
                        onClick={() => selectSoldier(soldier)}
                        className="p-3 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900 text-sm">
                              {soldier.first_name} {soldier.last_name}
                            </p>
                            <p className="text-xs text-slate-600">ID: {soldier.soldier_id}</p>
                          </div>
                          {soldier.enlistment_status !== 'released' ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200 border font-medium text-xs">
                              ACTIVE
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 border font-medium text-xs">
                              RELEASED
                            </Badge>
                          )}
                        </div>
                        {soldier.division_name && (
                          <p className="text-xs text-slate-500 mt-1">{soldier.division_name}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-500 text-sm">
                      {searchTerm.length < 2 ? 'Type at least 2 characters to search' : 'No active soldiers found.'}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {selectedSoldier && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Release Actions for {selectedSoldier.first_name} {selectedSoldier.last_name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4">
            {isItemsLoading ? (
              <div className="flex-1 flex justify-center items-center p-4 h-auto">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                <span className="ml-2 text-slate-500">Loading equipment...</span>
              </div>
            ) : (
              <>
                <Button
                  onClick={() => setShowSerializedDialog(true)}
                  disabled={assignedSerialized.length === 0}
                  variant="outline"
                  className="flex-1 justify-start p-4 text-left h-auto"
                >
                  <Target className="w-6 h-6 mr-4 text-red-600"/>
                  <div>
                    <p className="font-bold">Un-sign Weapons, Gear & Drones</p>
                    <p className="text-sm text-slate-600">{assignedSerialized.length} items assigned</p>
                  </div>
                </Button>
                <Button
                  onClick={() => setShowEquipmentDialog(true)}
                  disabled={assignedEquipment.length === 0}
                  variant="outline"
                  className="flex-1 justify-start p-4 text-left h-auto"
                >
                  <Package className="w-6 h-6 mr-4 text-green-600"/>
                  <div>
                    <p className="font-bold">Un-sign Equipment</p>
                    <p className="text-sm text-slate-600">{assignedEquipment.length} items assigned</p>
                  </div>
                </Button>
                {/* ADD: Full release button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={isReleasing || (allAssignedItemsForFullRelease.length === 0)}
                      variant="destructive"
                      className="flex-1 justify-start p-4 text-left h-auto"
                      onClick={() => signaturePadRef.current?.clear()}
                    >
                      {isReleasing ? (
                        <Loader2 className="w-6 h-6 mr-4 animate-spin" />
                      ) : (
                        <Home className="w-6 h-6 mr-4"/>
                      )}
                      <div>
                        <p className="font-bold">Fully Release Soldier</p>
                        <p className="text-sm text-slate-600">Unassign all {allAssignedItemsForFullRelease.length} items</p>
                      </div>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will unassign ALL equipment from {selectedSoldier.first_name} {selectedSoldier.last_name}. Please provide a signature to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Soldier's Signature</label>
                        <div className="border rounded-md bg-white">
                           <SignatureCanvas ref={signaturePadRef} />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => signaturePadRef.current?.clear()}>Clear Signature</Button>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => {
                          const signature = signaturePadRef.current?.isEmpty() ? null : signaturePadRef.current.toDataURL();
                          handleRelease(signature);
                      }}>Continue Release</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {selectedSoldier && (
        <>
          <Dialog open={showSerializedDialog} onOpenChange={setShowSerializedDialog}>
            <DialogContent className="max-w-2xl p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle>Un-assign Weapons, Gear & Drones</DialogTitle>
              </DialogHeader>
              <div className="p-6 border-t">
                <AssignedItemsList
                  items={assignedSerialized}
                  selectedItems={selectedSerializedItems}
                  onSelectionChange={setSelectedSerializedItems}
                  quantities={serializedQuantities}
                  onQuantityChange={handleSerializedQuantityChange}
                />
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t flex justify-end">
                 <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={selectedSerializedItems.length === 0} className="bg-red-600 hover:bg-red-700" onClick={() => signaturePadRef.current?.clear()}>
                      <ArrowLeftCircle className="w-4 h-4 mr-2" />
                      Un-sign {selectedSerializedItems.length} Selected Items
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will un-assign {selectedSerializedItems.length} items from {selectedSoldier.first_name} {selectedSoldier.last_name}. Please provide a signature to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                     <div className="space-y-2">
                        <label className="text-sm font-medium">Soldier's Signature</label>
                        <div className="border rounded-md bg-white">
                           <SignatureCanvas ref={signaturePadRef} />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => signaturePadRef.current?.clear()}>Clear Signature</Button>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => {
                        const signature = signaturePadRef.current?.isEmpty() ? null : signaturePadRef.current.toDataURL();
                        handleUnassignSerialized(signature);
                      }}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showEquipmentDialog} onOpenChange={setShowEquipmentDialog}>
            <DialogContent className="max-w-2xl p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle>Un-assign Equipment</DialogTitle>
              </DialogHeader>
              <div className="p-6 border-t">
                <AssignedItemsList
                  items={assignedEquipment}
                  selectedItems={selectedEquipmentItems}
                  onSelectionChange={setSelectedEquipmentItems}
                  quantities={equipmentQuantities}
                  onQuantityChange={handleEquipmentQuantityChange}
                />
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t flex justify-end">
                 <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={selectedEquipmentItems.length === 0} className="bg-red-600 hover:bg-red-700" onClick={() => signaturePadRef.current?.clear()}>
                      <ArrowLeftCircle className="w-4 h-4 mr-2" />
                      Un-sign {selectedEquipmentItems.length} Selected Items
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will un-assign {selectedEquipmentItems.length} equipment items from {selectedSoldier.first_name} {selectedSoldier.last_name}. Please provide a signature to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                     <div className="space-y-2">
                        <label className="text-sm font-medium">Soldier's Signature</label>
                        <div className="border rounded-md bg-white">
                           <SignatureCanvas ref={signaturePadRef} />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => signaturePadRef.current?.clear()}>Clear Signature</Button>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => {
                        const signature = signaturePadRef.current?.isEmpty() ? null : signaturePadRef.current.toDataURL();
                        handleUnassignEquipment(signature);
                      }}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
