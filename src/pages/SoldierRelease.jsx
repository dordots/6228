
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"; // Import useRef
import { Soldier } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DroneSet } from "@/api/entities";
import { Equipment } from "@/api/entities";
import { ActivityLog } from "@/api/entities";
import { User } from "@/api/entities";
import { generateReleaseForm } from "@/api/functions"; // Import the new function
import { sendReleaseFormByActivity, sendEmailViaSendGrid } from "@/api/functions";

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
  const [lastReleaseData, setLastReleaseData] = useState(null); // NEW: Store release data (items, signature, date, performer) for fallback

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
    assignedWeapons.forEach(i => items.push({ id: i.weapon_id, itemType: 'Weapon', displayName: i.weapon_type, displayId: i.weapon_id }));
    assignedGear.forEach(i => items.push({ id: i.gear_id, itemType: 'Gear', displayName: i.gear_type, displayId: i.gear_id }));
    assignedDrones.forEach(i => items.push({ id: i.drone_set_id, itemType: 'Drone', displayName: i.set_type, displayId: i.set_serial_number }));
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
          } catch (e) { }
      }

      const itemsToUnassign = assignedSerialized.filter(item => selectedSerializedItems.includes(item.id));
      const itemDetailsForLog = itemsToUnassign.map(item => {
        return { type: item.itemType, name: item.displayName, id: item.displayId };
      });

      for (const item of itemsToUnassign) {
        if (!item) continue;


        switch (item.itemType) {
          case 'Weapon':
            await Weapon.update(item.weapon_id, { assigned_to: null, armory_status: 'with_soldier' });
            break;
          case 'Gear':
            await SerializedGear.update(item.gear_id, { assigned_to: null, armory_status: 'with_soldier' });
            break;
          case 'Drone':
            await DroneSet.update(item.id, { assigned_to: null, armory_status: 'with_soldier' });
            break;
          default: break;
        }
      }


      // Try to create ActivityLog and send email, but don't fail if this doesn't work
      try {
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

        // Try to send email notification
        try {
          const emailResponse = await sendReleaseFormByActivity({ activityId: newActivityLog.id });

          const soldierReceived = emailResponse?.data?.soldierReceived || emailResponse?.soldierReceived || false;

          setDialogContent({
            title: 'Release Successful',
            description: soldierReceived
              ? `The release form has been sent to ${selectedSoldier.first_name}'s email. A copy was also sent to you.`
              : `The release form could not be sent to the soldier (they are not a registered app user). A copy was sent to your email for manual sharing.`,
          });
        } catch (emailError) {
          setDialogContent({
            title: 'Release Successful',
            description: `Items have been unassigned successfully. You can view and download the release form using the button below.`,
          });
        }

        setLastActivityId(newActivityLog.id);
        setLastReleasedSoldier(selectedSoldier);
        setShowSuccessDialog(true);

      } catch (logError) {
        // Store the release data for later use
        const releaseData = {
          releasedItems: itemDetailsForLog,
          signature: signature,
          activityDate: new Date(),
          performedBy: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : currentUser.full_name
        };
        setLastReleaseData(releaseData);

        // Try to send email directly with HTML
        try {
          if (selectedSoldier.email) {
            const htmlContent = await generateReleaseFormHTML(
              selectedSoldier,
              releaseData.releasedItems,
              releaseData.signature,
              releaseData.activityDate,
              releaseData.performedBy
            );

            if (!htmlContent || htmlContent.trim().length === 0) {
              throw new Error('Generated HTML content is empty');
            }

            const emailResult = await sendEmailViaSendGrid({
              to: selectedSoldier.email,
              subject: `טופס שחרור ציוד - ${selectedSoldier.first_name} ${selectedSoldier.last_name}`,
              html: htmlContent,
              text: `טופס שחרור ציוד עבור ${selectedSoldier.first_name} ${selectedSoldier.last_name}`
            });

            if (emailResult.success) {
            } else {
              throw new Error(emailResult.error || 'Email sending failed');
            }
            setDialogContent({
              title: 'Release Successful',
              description: `Items have been unassigned successfully. The release form has been sent to ${selectedSoldier.first_name}'s email.`,
            });
          } else {
            setDialogContent({
              title: 'Release Successful',
              description: `Items have been unassigned successfully. You can view and download the release form using the button below.`,
            });
          }
        } catch (emailError) {
          setDialogContent({
            title: 'Release Successful',
            description: `Items have been unassigned successfully. You can view and download the release form using the button below.`,
          });
        }

        setLastReleasedSoldier(selectedSoldier);
        setLastActivityId(null);
        setShowSuccessDialog(true);
      }

      setSuccessMessage(""); // Clear general messages
      setErrorMessage("");

      await checkAndFinalizeRelease(selectedSoldier.soldier_id);
      setShowSerializedDialog(false);
      setSelectedSerializedItems([]);
      setSerializedQuantities({});
      await loadSoldierItems(selectedSoldier); // Keep this to re-fetch remaining items if any

    } catch (error) {

      // Even on error, try to create activity log and send email (operation may have partially succeeded)
      try {
        const currentUser = await User.me();
        let performingSoldier = null;
        if (currentUser.linked_soldier_id) {
          try {
            const soldiers = await Soldier.filter({ soldier_id: currentUser.linked_soldier_id });
            performingSoldier = soldiers[0] || null;
          } catch (e) { }
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
          const emailResponse = await sendReleaseFormByActivity({ activityId: newActivityLog.id });
          setDialogContent({
            title: 'Release Completed',
            description: emailResponse.data.soldierReceived
              ? `The release form has been sent to ${selectedSoldier.first_name}'s email. A copy was also sent to you.`
              : `The release form could not be sent to the soldier (they are not a registered app user). A copy was sent to your email for manual sharing.`,
          });
        } catch (emailError) {
          setDialogContent({
            title: 'Release Completed',
            description: `Items have been processed. Email notification could not be sent.`,
          });
        }

        setLastActivityId(newActivityLog.id);
        setLastReleasedSoldier(selectedSoldier);
        setShowSuccessDialog(true);

      } catch (logError) {

        // Store the release data for later use
        setLastReleaseData({
          releasedItems: itemDetailsForLog,
          signature: signature,
          activityDate: new Date(),
          performedBy: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : user.full_name
        });

        // Even if activity log creation fails, set the soldier so the button can work
        setLastReleasedSoldier(selectedSoldier);
        setLastActivityId(null); // No activity ID available
        setDialogContent({
          title: 'Release Completed',
          description: `Items have been unassigned successfully. The automatic email could not be sent due to a system issue, but you can view and download the release form using the button below.`,
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
          } catch (e) { }
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


      // Try to create ActivityLog and send email, but don't fail if this doesn't work
      try {
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

        // Try to send email notification
        try {
          const emailResponse = await sendReleaseFormByActivity({ activityId: newActivityLog.id });

          const soldierReceived = emailResponse?.data?.soldierReceived || emailResponse?.soldierReceived || false;

          setDialogContent({
            title: 'Release Successful',
            description: soldierReceived
              ? `The release form has been sent to ${selectedSoldier.first_name}'s email. A copy was also sent to you.`
              : `The release form could not be sent to the soldier (they are not a registered app user). A copy was sent to your email for manual sharing.`,
          });
        } catch (emailError) {
          setDialogContent({
            title: 'Release Successful',
            description: `Equipment has been unassigned successfully. You can view and download the release form using the button below.`,
          });
        }

        setLastActivityId(newActivityLog.id);
        setLastReleasedSoldier(selectedSoldier);
        setShowSuccessDialog(true);

      } catch (logError) {
        // Store the release data for later use
        const releaseData = {
          releasedItems: logDetails,
          signature: signature,
          activityDate: new Date(),
          performedBy: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : currentUser.full_name
        };
        setLastReleaseData(releaseData);

        // Try to send email directly with HTML
        try {
          if (selectedSoldier.email) {
            const htmlContent = await generateReleaseFormHTML(
              selectedSoldier,
              releaseData.releasedItems,
              releaseData.signature,
              releaseData.activityDate,
              releaseData.performedBy
            );

            if (!htmlContent || htmlContent.trim().length === 0) {
              throw new Error('Generated HTML content is empty');
            }

            const emailResult = await sendEmailViaSendGrid({
              to: selectedSoldier.email,
              subject: `טופס שחרור ציוד - ${selectedSoldier.first_name} ${selectedSoldier.last_name}`,
              html: htmlContent,
              text: `טופס שחרור ציוד עבור ${selectedSoldier.first_name} ${selectedSoldier.last_name}`
            });

            if (emailResult.success) {
            } else {
              throw new Error(emailResult.error || 'Email sending failed');
            }
            setDialogContent({
              title: 'Release Successful',
              description: `Equipment has been unassigned successfully. The release form has been sent to ${selectedSoldier.first_name}'s email.`,
            });
          } else {
            setDialogContent({
              title: 'Release Successful',
              description: `Equipment has been unassigned successfully. You can view and download the release form using the button below.`,
            });
          }
        } catch (emailError) {
          setDialogContent({
            title: 'Release Successful',
            description: `Equipment has been unassigned successfully. You can view and download the release form using the button below.`,
          });
        }

        setLastReleasedSoldier(selectedSoldier);
        setLastActivityId(null);
        setShowSuccessDialog(true);
      }

      setSuccessMessage(""); // Clear general messages
      setErrorMessage("");

      await checkAndFinalizeRelease(selectedSoldier.soldier_id);
      setShowEquipmentDialog(false);
      setSelectedEquipmentItems([]);
      setEquipmentQuantities({});
      await loadSoldierItems(selectedSoldier); // Keep this to re-fetch remaining items if any

    } catch (error) {

      // Even on error, try to create activity log and send email (operation may have partially succeeded)
      try {
        const currentUser = await User.me();
        let performingSoldier = null;
        if (currentUser.linked_soldier_id) {
          try {
            const soldiers = await Soldier.filter({ soldier_id: currentUser.linked_soldier_id });
            performingSoldier = soldiers[0] || null;
          } catch (e) { }
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
          const emailResponse = await sendReleaseFormByActivity({ activityId: newActivityLog.id });
          setDialogContent({
            title: 'Release Completed',
            description: emailResponse.data.soldierReceived
              ? `The release form has been sent to ${selectedSoldier.first_name}'s email. A copy was also sent to you.`
              : `The release form could not be sent to the soldier (they are not a registered app user). A copy was sent to your email for manual sharing.`,
          });
        } catch (emailError) {
          setDialogContent({
            title: 'Release Completed',
            description: `Items have been processed. Email notification could not be sent.`,
          });
        }

        setLastActivityId(newActivityLog.id);
        setLastReleasedSoldier(selectedSoldier);
        setShowSuccessDialog(true);

      } catch (logError) {

        // Store the release data for later use
        setLastReleaseData({
          releasedItems: logDetails,
          signature: signature,
          activityDate: new Date(),
          performedBy: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : user.full_name
        });

        // Even if activity log creation fails, set the soldier so the button can work
        setLastReleasedSoldier(selectedSoldier);
        setLastActivityId(null); // No activity ID available
        setDialogContent({
          title: 'Release Completed',
          description: `Items have been unassigned successfully. The automatic email could not be sent due to a system issue, but you can view and download the release form using the button below.`,
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
            } catch (e) { }
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
                    continue;
            }
            if (promise) {
                unassignPromises.push(promise);
                itemDetailsForLog.push(logDetail); // Collect for activity log context
            }
        }
        
        // Removed the soldier status update - no longer changing to 'released'

        await Promise.all(unassignPromises);

        // Try to create ActivityLog and send email, but don't fail if this doesn't work
        try {
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

            // Try to send email notification
            try {
                const emailResponse = await sendReleaseFormByActivity({ activityId: newActivityLog.id });

                // Show success dialog with detailed feedback
                const soldierReceived = emailResponse?.data?.soldierReceived || emailResponse?.soldierReceived || false;

                setDialogContent({
                    title: 'Full Release Successful',
                    description: soldierReceived
                      ? `The release form has been sent to ${selectedSoldier.first_name}'s email. A copy was also sent to you.`
                      : `The release form could not be sent to the soldier (they are not a registered app user). A copy was sent to your email for manual sharing.`,
                });
            } catch (emailError) {
                setDialogContent({
                    title: 'Full Release Successful',
                    description: `All equipment has been released successfully. You can view and download the release form using the button below.`,
                });
            }

            setLastActivityId(newActivityLog.id);
            setLastReleasedSoldier(selectedSoldier);
            setShowSuccessDialog(true);

        } catch (logError) {
            // Store the release data for later use
            const releaseData = {
                releasedItems: itemDetailsForLog,
                signature: signature,
                activityDate: new Date(),
                performedBy: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : user.full_name
            };
            setLastReleaseData(releaseData);

            // Try to send email directly with HTML
            try {
                if (selectedSoldier.email) {
                    const htmlContent = await generateReleaseFormHTML(
                        selectedSoldier,
                        releaseData.releasedItems,
                        releaseData.signature,
                        releaseData.activityDate,
                        releaseData.performedBy
                    );

                    if (!htmlContent || htmlContent.trim().length === 0) {
                        throw new Error('Generated HTML content is empty');
                    }

                    const emailParams = {
                        to: selectedSoldier.email,
                        subject: `טופס שחרור ציוד - ${selectedSoldier.first_name} ${selectedSoldier.last_name}`,
                        html: htmlContent,
                        text: `טופס שחרור ציוד עבור ${selectedSoldier.first_name} ${selectedSoldier.last_name}`
                    };

                    const emailResult = await sendEmailViaSendGrid(emailParams);

                    if (emailResult.success) {
                    } else {
                        throw new Error(emailResult.error || 'Email sending failed');
                    }
                    setDialogContent({
                        title: 'Full Release Successful',
                        description: `All equipment has been released successfully. The release form has been sent to ${selectedSoldier.first_name}'s email.`,
                    });
                } else {
                    setDialogContent({
                        title: 'Full Release Successful',
                        description: `All equipment has been released successfully. You can view and download the release form using the button below.`,
                    });
                }
            } catch (emailError) {
                setDialogContent({
                    title: 'Full Release Successful',
                    description: `All equipment has been released successfully. You can view and download the release form using the button below.`,
                });
            }

            setLastReleasedSoldier(selectedSoldier);
            setLastActivityId(null);
            setShowSuccessDialog(true);
        }

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

        // Even on error, try to create activity log and send email (operation may have partially succeeded)
        try {
            const user = await User.me();
            let performingSoldier = null;
            if (user.linked_soldier_id) {
                try {
                    const soldiers = await Soldier.filter({ soldier_id: user.linked_soldier_id });
                    performingSoldier = soldiers[0] || null;
                } catch (e) { }
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
                const emailResponse = await sendReleaseFormByActivity({ activityId: newActivityLog.id });
                setDialogContent({
                    title: 'Full Release Completed',
                    description: emailResponse.data.soldierReceived
                      ? `The release form has been sent to ${selectedSoldier.first_name}'s email. A copy was also sent to you.`
                      : `The release form could not be sent to the soldier (they are not a registered app user). A copy was sent to your email for manual sharing.`,
                });
            } catch (emailError) {
                setDialogContent({
                    title: 'Full Release Completed',
                    description: `Items have been processed. Email notification could not be sent.`,
                });
            }

            setLastActivityId(newActivityLog.id);
            setLastReleasedSoldier(selectedSoldier);
            setShowSuccessDialog(true);

        } catch (logError) {
            // Store the release data for later use
            setLastReleaseData({
                releasedItems: itemDetailsForLog,
                signature: signature,
                activityDate: new Date(),
                performedBy: performingSoldier ? `${performingSoldier.first_name} ${performingSoldier.last_name}` : user.full_name
            });

            // Even if activity log creation fails, set the soldier so the button can work
            // The button will try to create the form on-demand
            setLastReleasedSoldier(selectedSoldier);
            setLastActivityId(null); // No activity ID available
            setDialogContent({
                title: 'Release Completed',
                description: `Equipment has been released successfully. The automatic email could not be sent due to a system issue, but you can view and download the release form using the button below.`,
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

  // Helper function to generate HTML release form directly
  const generateReleaseFormHTML = async (soldier, releasedItems, signature, activityDate, performedBy) => {
    // Fetch remaining items currently with soldier (AFTER the release)
    const [remainingWeapons, remainingGear, remainingDrones, remainingEquipment] = await Promise.all([
      Weapon.filter({ assigned_to: soldier.soldier_id }),
      SerializedGear.filter({ assigned_to: soldier.soldier_id }),
      DroneSet.filter({ assigned_to: soldier.soldier_id }),
      Equipment.filter({ assigned_to: soldier.soldier_id }),
    ]);

    const remainingItems = [];
    remainingWeapons.forEach(w => remainingItems.push({ type: 'Weapon', name: w.weapon_type, serialId: w.weapon_id, status: w.status }));
    remainingGear.forEach(g => remainingItems.push({ type: 'Serialized Gear', name: g.gear_type, serialId: g.gear_id, status: g.status }));
    remainingDrones.forEach(d => remainingItems.push({ type: 'Drone Set', name: d.set_type, serialId: d.set_serial_number, status: d.status }));
    remainingEquipment.forEach(e => remainingItems.push({ type: 'Equipment', name: e.equipment_type, serialId: `Qty: ${e.quantity}`, status: e.condition }));

    const dateStr = activityDate.toLocaleDateString('en-US');
    const timeStr = activityDate.toLocaleTimeString('en-US');

    // Format released items with proper serial IDs
    const formattedReleasedItems = releasedItems.map(item => {
      let serialId = item.id || item.serialId || 'N/A';

      // For equipment, show quantity
      if (item.type === 'Equipment' && item.quantity) {
        serialId = `Qty: ${item.quantity}`;
      }

      return {
        type: item.type,
        name: item.name,
        serialId: serialId,
        status: 'Released'
      };
    });

    const releasedItemsHTML = formattedReleasedItems.length > 0
      ? `<table class="items-table"><thead><tr><th>#</th><th>סוג</th><th>שם הפריט</th><th>מספר סידורי</th><th>סטטוס</th></tr></thead><tbody>
          ${formattedReleasedItems.map((item, index) => `<tr><td>${index + 1}</td><td>${item.type}</td><td>${item.name}</td><td>${item.serialId}</td><td>${item.status}</td></tr>`).join('')}
        </tbody></table>`
      : `<p><strong>לא שוחרר ציוד באירוע זה.</strong></p>`;

    const remainingItemsHTML = remainingItems.length > 0
      ? `<table class="items-table"><thead><tr><th>#</th><th>סוג</th><th>שם הפריט</th><th>מספר סידורי</th><th>סטטוס</th></tr></thead><tbody>
          ${remainingItems.map((item, index) => `<tr><td>${index + 1}</td><td>${item.type}</td><td>${item.name}</td><td>${item.serialId}</td><td>${item.status}</td></tr>`).join('')}
        </tbody></table>`
      : `<p><strong>לא נותר ציוד ברשות החייל.</strong></p>`;

    const signatureHTML = signature
      ? `<img src="${signature}" alt="Soldier Signature" style="max-width:100%;max-height:100px;" />`
      : `<p><em>לא סופקה חתימה עבור שחרור זה</em></p>`;

    return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Equipment Release Form</title>
    <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        @page { size: A4; margin: 0.5in; }
        * { box-sizing: border-box; }
        body { font-family: 'Heebo', Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000; direction: rtl; text-align: right; margin: 0; padding: 20px; background: white; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
        .header h1 { font-size: 24px; font-weight: bold; margin: 0 0 5px 0; direction: ltr; }
        .header h2 { font-size: 20px; font-weight: bold; margin: 0; direction: rtl; }
        .section { margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; page-break-inside: avoid; }
        .section h3 { font-size: 16px; font-weight: bold; margin: 0 0 10px 0; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        .info-row { margin-bottom: 8px; }
        .info-row strong { font-weight: 600; }
        .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .items-table th, .items-table td { border: 1px solid #666; padding: 8px; text-align: right; font-size: 11px; }
        .items-table th { background-color: #f5f5f5; font-weight: bold; }
        .released-items { background-color: #fffbe6; }
        .remaining-items { background-color: #f0f9ff; }
        .signature-box { border: 1px solid #666; min-height: 120px; padding: 10px; margin-top: 10px; display: flex; align-items: center; justify-content: center; background: #fafafa; }
        .signature-box img { max-width: 100%; max-height: 100px; object-fit: contain; }
        .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Equipment Release Form</h1>
        <h2>טופס שחרור ציוד</h2>
    </div>
    <div class="section">
        <h3>פרטי הפעילות - Activity Details</h3>
        <div class="info-row"><strong>תאריך:</strong> ${dateStr} בשעה ${timeStr}</div>
        <div class="info-row"><strong>מאושר על ידי:</strong> ${performedBy || 'System'}</div>
    </div>
    <div class="section">
        <h3>פרטי החייל - Soldier Information</h3>
        <div class="info-row"><strong>שם:</strong> ${soldier.first_name} ${soldier.last_name}</div>
        <div class="info-row"><strong>מספר אישי:</strong> ${soldier.soldier_id}</div>
        <div class="info-row"><strong>יחידה:</strong> ${soldier.division_name || 'לא שויך'}</div>
    </div>
    <div class="section released-items">
        <h3>ציוד ששוחרר באירוע זה - Equipment Released in This Event (${releasedItems.length} items)</h3>
        ${releasedItemsHTML}
    </div>
    <div class="section remaining-items">
        <h3>סה"כ ציוד שנותר אצל החייל - Total Equipment Remaining with Soldier (${remainingItems.length} items)</h3>
        ${remainingItemsHTML}
    </div>
    <div class="section">
        <h3>חתימת החייל - Soldier Signature</h3>
        <div class="signature-box">${signatureHTML}</div>
    </div>
    <div class="footer">
        <p>נוצר ב-${new Date().toLocaleString('he-IL')}</p>
    </div>
</body>
</html>`;
  };

  const handleExportForm = async () => {
    if (!lastReleasedSoldier) return;
    setIsExporting(true);
    try {
      let activityId = lastActivityId;
      let activityData = null;
      let releasedItems = [];
      let signature = null;
      let activityDate = new Date();
      let performedBy = 'System';

      // If we don't have an activity ID, try to find the most recent one for this soldier
      if (!activityId) {
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
          activityData = sortedActivities[0];
          activityId = activityData.id;
        }
      } else {
        // Fetch the activity data if we have an ID but not the data
        try {
          activityData = await ActivityLog.get(activityId);
        } catch (e) {
        }
      }

      // Extract data from activity if available
      if (activityData) {
        releasedItems = activityData.context?.unassignedItems || [];
        signature = activityData.context?.signature || null;
        activityDate = activityData.created_at ? new Date(activityData.created_at) : new Date();
        performedBy = activityData.user_full_name || 'System';

      } else if (lastReleaseData) {
        // Use stored release data as fallback when ActivityLog failed
        releasedItems = lastReleaseData.releasedItems || [];
        signature = lastReleaseData.signature || null;
        activityDate = lastReleaseData.activityDate || new Date();
        performedBy = lastReleaseData.performedBy || 'System';

      } else {
      }

      // If no activity data or no released items, fetch current equipment as fallback
      if (releasedItems.length === 0) {
        try {
          const [weapons, gear, drones, equipment] = await Promise.all([
            Weapon.filter({ assigned_to: lastReleasedSoldier.soldier_id }),
            SerializedGear.filter({ assigned_to: lastReleasedSoldier.soldier_id }),
            DroneSet.filter({ assigned_to: lastReleasedSoldier.soldier_id }),
            Equipment.filter({ assigned_to: lastReleasedSoldier.soldier_id }),
          ]);

          // Format items for the release form
          weapons.forEach(w => releasedItems.push({ type: 'Weapon', name: w.weapon_type, id: w.weapon_id }));
          gear.forEach(g => releasedItems.push({ type: 'Gear', name: g.gear_type, id: g.gear_id }));
          drones.forEach(d => releasedItems.push({ type: 'Drone', name: d.set_type, id: d.set_serial_number }));
          equipment.forEach(e => releasedItems.push({ type: 'Equipment', name: e.equipment_type, id: `Qty: ${e.quantity}`, quantity: e.quantity }));

        } catch (fetchError) {
        }
      }

      // Generate HTML directly
      const htmlContent = await generateReleaseFormHTML(
        lastReleasedSoldier,
        releasedItems,
        signature,
        activityDate,
        performedBy
      );


      // Create HTML blob and open in new tab
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');

      // Clean up after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

    } catch (error) {
      setErrorMessage(`Failed to generate the release form: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* DIALOG FOR SUCCESS AND MANUAL FORM VIEWING */}
      <Dialog open={showSuccessDialog} onOpenChange={(isOpen) => { setShowSuccessDialog(isOpen); if (!isOpen) { setLastReleasedSoldier(null); setErrorMessage(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogContent.title}</DialogTitle>
            <DialogDescription>
              {dialogContent.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6">
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-md text-sm">
                {errorMessage}
              </div>
            )}
            <p className="text-xs text-slate-500">
              Tip: Click "View Release Form" below to open the form in a new browser tab.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSuccessDialog(false); setErrorMessage(""); }}>Close</Button>
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
