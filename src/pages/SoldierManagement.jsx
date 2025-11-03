
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Soldier } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DroneSet } from "@/api/entities";
import { Equipment } from "@/api/entities";
import { ActivityLog } from "@/api/entities";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, Loader2 } from "lucide-react";
import UnifiedAssignmentDialog from "../components/soldiers/UnifiedAssignmentDialog";
import SigningSoldierTable from "../components/signing/SigningSoldierTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { generateSigningForm } from "@/api/functions";

export default function SoldierManagement() {
  const [soldiers, setSoldiers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isAssigning, setIsAssigning] = useState(false);
  const [assigningSoldier, setAssigningSoldier] = useState(null);

  const [unassignedWeapons, setUnassignedWeapons] = useState([]);
  const [unassignedGear, setUnassignedGear] = useState([]);
  const [unassignedDroneSets, setUnassignedDroneSets] = useState([]);
  const [availableEquipment, setAvailableEquipment] = useState([]);
  
  // States to hold ALL equipment for current stock display
  const [allWeapons, setAllWeapons] = useState([]);
  const [allGear, setAllGear] = useState([]);
  const [allDrones, setAllDrones] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);

  // States for success dialog and form generation
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [dialogContent, setDialogContent] = useState({ title: '', description: '', activityId: null, soldier: null });
  const [isGeneratingForm, setIsGeneratingForm] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);

  const performingSoldier = null;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get current user first
      const user = await User.me();
      setCurrentUser(user);

      const userDivision = user?.division;
      const userTeam = user?.team;
      const isAdmin = user?.role === 'admin';
      const isManager = user?.custom_role === 'manager';

      // Build filters based on user role
      let soldierFilter = {};
      let equipmentFilter = {};

      if (isAdmin || isManager) {
        // Admins and managers see everything
        soldierFilter = {};
        equipmentFilter = {};
      } else if (user?.custom_role === 'division_manager' && userDivision) {
        // Division managers see all soldiers in their division
        soldierFilter = { division_name: userDivision };
        equipmentFilter = { division_name: userDivision };
      } else if (user?.custom_role === 'team_leader' && userDivision && userTeam) {
        // Team leaders see only their team's soldiers
        soldierFilter = { division_name: userDivision, team_name: userTeam };
        equipmentFilter = { division_name: userDivision };
      } else if (userDivision) {
        // Fallback: users with division see their division
        soldierFilter = { division_name: userDivision };
        equipmentFilter = { division_name: userDivision };
      }

      const [
        soldiersData,
        allW,
        allG,
        allDS,
        allE
      ] = await Promise.all([
        soldierFilter && Object.keys(soldierFilter).length > 0 ? Soldier.filter(soldierFilter) : Soldier.list("-created_date"),
        equipmentFilter && Object.keys(equipmentFilter).length > 0 ? Weapon.filter(equipmentFilter) : Weapon.list(),
        equipmentFilter && Object.keys(equipmentFilter).length > 0 ? SerializedGear.filter(equipmentFilter) : SerializedGear.list(),
        equipmentFilter && Object.keys(equipmentFilter).length > 0 ? DroneSet.filter(equipmentFilter) : DroneSet.list(),
        equipmentFilter && Object.keys(equipmentFilter).length > 0 ? Equipment.filter(equipmentFilter) : Equipment.list()
      ]);

      // Filter for unassigned items only
      const unassignedW = (allW || []).filter(item => !item.assigned_to);
      const unassignedG = (allG || []).filter(item => !item.assigned_to);
      const unassignedDS = (allDS || []).filter(item => !item.assigned_to);
      const availableE = (allE || []).filter(item => !item.assigned_to);

      setSoldiers(Array.isArray(soldiersData) ? soldiersData : []);
      setUnassignedWeapons(unassignedW);
      setUnassignedGear(unassignedG);
      setUnassignedDroneSets(unassignedDS);
      setAvailableEquipment(availableE);
      setAllWeapons(Array.isArray(allW) ? allW : []);
      setAllGear(Array.isArray(allG) ? allG : []);
      setAllDrones(Array.isArray(allDS) ? allDS : []);
      setAllEquipment(Array.isArray(allE) ? allE : []);

    } catch (error) {
      setSoldiers([]);
      setUnassignedWeapons([]);
      setUnassignedGear([]);
      setUnassignedDroneSets([]);
      setAvailableEquipment([]);
      setAllWeapons([]);
      setAllGear([]);
      setAllDrones([]);
      setAllEquipment([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAssignDialog = useCallback((soldier) => {
    setAssigningSoldier(soldier);
    setIsAssigning(true);
  }, [availableEquipment, allEquipment]);

  const handleSigningSuccess = useCallback(() => {
    loadData();
    setAssigningSoldier(null);
    setIsAssigning(false);
    
    // This logic now resides in the component that initiates it
    // The dialog now only needs to signal success.
    // We can add more complex feedback later if needed.
    setDialogContent({
      title: 'Assignment Processed',
      description: 'The assignment has been successfully recorded. Any relevant notifications have been sent.',
      activityId: null, // This is simplified, as the dialog handles logging.
      soldier: null
    });
    setShowSuccessDialog(true);
    
  }, [loadData]);

  // Added: Function to generate and view the form
  const handleViewForm = async () => {
    if (!dialogContent.activityId || !dialogContent.soldier) return;
    setIsGeneratingForm(true);
    try {
      const response = await generateSigningForm({ 
        activityId: dialogContent.activityId,
        fallback_soldier_id: dialogContent.soldier.soldier_id
      });
      const blob = new Blob([response.data], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
      alert("Failed to generate form. " + (error.message || ""));
    } finally {
      setIsGeneratingForm(false);
    }
  };

  const filteredSoldiers = useMemo(() => {
    const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
    
    if (!searchTerm) {
      return safeSoldiers;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/).filter(Boolean);

    return safeSoldiers.filter(soldier => {
      if (!soldier) return false;

      const searchableString = [
        soldier.first_name,
        soldier.last_name,
        soldier.soldier_id,
        soldier.email,
        soldier.division_name,
        soldier.team_name,
        soldier.profession,
      ].filter(Boolean).join(' ').toLowerCase();

      return searchWords.every(word => searchableString.includes(word));
    });
  }, [soldiers, searchTerm]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          <div className="h-16 bg-slate-200 rounded"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Soldier Signing</h1>
          <p className="text-slate-600">Assign equipment to soldiers.</p>
        </div>
      </div>

      {/* Unified Assignment Dialog */}
      {assigningSoldier && (
          <UnifiedAssignmentDialog
              open={isAssigning}
              onOpenChange={setIsAssigning}
              soldier={assigningSoldier}
              unassignedWeapons={unassignedWeapons}
              unassignedGear={unassignedGear}
              unassignedDroneSets={unassignedDroneSets}
              equipment={allEquipment} // Pass all equipment for division filtering inside
              weapons={allWeapons} 
              gear={allGear} 
              drones={allDrones}
              onSuccess={handleSigningSuccess}
          />
      )}

      {/* Added: Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{dialogContent.title}</DialogTitle>
            <DialogDescription>
              {dialogContent.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuccessDialog(false)}>Close</Button>
            {dialogContent.activityId && (
              <Button onClick={handleViewForm} disabled={isGeneratingForm}>
                {isGeneratingForm ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "View Form"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-200 pb-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <CardTitle className="text-slate-900 flex items-center gap-2 text-lg md:text-xl">
                    <Users className="w-5 h-5" />
                    Find Soldier to Assign Equipment
                </CardTitle>
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-none md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Search soldiers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="text-sm text-slate-600 font-medium whitespace-nowrap">
                    {filteredSoldiers.length} soldiers
                  </div>
                </div>
              </div>
          </CardHeader>
          <CardContent className="p-0">
              <div className="overflow-auto">
                  <SigningSoldierTable
                      soldiers={filteredSoldiers}
                      weapons={allWeapons}
                      gear={allGear}
                      drones={allDrones}
                      equipment={allEquipment}
                      onAssign={handleOpenAssignDialog}
                  />
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
