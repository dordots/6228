
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Binoculars, Joystick, Package, PackageOpen } from "lucide-react";
import { Label } from "@/components/ui/label";

import SignatureCanvas from "../soldiers/SignatureCanvas";

export default function DepositReleaseDialog({
  open,
  onOpenChange,
  soldier,
  weapons = [],
  gear = [],
  droneSets = [],
  mode, // 'deposit' or 'release'
  onSubmit,
}) {
  const [selectedWeaponIds, setSelectedWeaponIds] = useState([]);
  const [selectedGearIds, setSelectedGearIds] = useState([]);
  const [selectedDroneSetIds, setSelectedDroneSetIds] = useState([]);
  const [signature, setSignature] = useState("");
  const [activeTab, setActiveTab] = useState("weapons");
  const [depositLocation, setDepositLocation] = useState("division_deposit"); // New state for deposit location

  useEffect(() => {
    if (open) {
      setSelectedWeaponIds([]);
      setSelectedGearIds([]);
      setSelectedDroneSetIds([]);
      setSignature("");
      setActiveTab("weapons");
      setDepositLocation("division_deposit"); // Reset to default
    }
  }, [open]);

  const formatDepositName = (value) => {
    switch (value) {
      case 'division_deposit':
        return 'Division Deposit';
      case 'armory_deposit':
        return 'Central Armory Deposit';
      case 'naora_deposit':
        return 'Naura Deposit';
      default:
        return 'Deposit';
    }
  };

  // Filter equipment based on mode and soldier assignment
  const availableWeapons = React.useMemo(() => {
    if (!Array.isArray(weapons) || !soldier) return [];
    
    return weapons.filter(w => {
      if (!w || w.assigned_to !== soldier.soldier_id) return false;
      
      if (mode === 'deposit') {
        // For deposit: show items that are with soldier
        return (w.armory_status || 'with_soldier') === 'with_soldier';
      } else {
        // For release: show items that are in deposit
        return w.armory_status === 'in_deposit';
      }
    });
  }, [weapons, soldier, mode]);

  const availableGear = React.useMemo(() => {
    if (!Array.isArray(gear) || !soldier) return [];
    
    return gear.filter(g => {
      if (!g || g.assigned_to !== soldier.soldier_id) return false;
      
      if (mode === 'deposit') {
        // For deposit: show items that are with soldier
        return (g.armory_status || 'with_soldier') === 'with_soldier';
      } else {
        // For release: show items that are in deposit
        return g.armory_status === 'in_deposit';
      }
    });
  }, [gear, soldier, mode]);

  const availableDroneSets = React.useMemo(() => {
    if (!Array.isArray(droneSets) || !soldier) return [];
    
    return droneSets.filter(ds => {
      if (!ds || ds.assigned_to !== soldier.soldier_id) return false;
      
      if (mode === 'deposit') {
        // For deposit: show items that are with soldier
        return (ds.armory_status || 'with_soldier') === 'with_soldier';
      } else {
        // For release: show items that are in deposit
        return ds.armory_status === 'in_deposit';
      }
    });
  }, [droneSets, soldier, mode]);

  const handleWeaponSelect = (weaponId) => {
    setSelectedWeaponIds(prev =>
      prev.includes(weaponId)
        ? prev.filter(id => id !== weaponId)
        : [...prev, weaponId]
    );
  };

  const handleGearSelect = (gearId) => {
    setSelectedGearIds(prev =>
      prev.includes(gearId)
        ? prev.filter(id => id !== gearId)
        : [...prev, gearId]
    );
  };

  const handleDroneSetSelect = (droneSetId) => {
    setSelectedDroneSetIds(prev =>
      prev.includes(droneSetId)
        ? prev.filter(id => id !== droneSetId)
        : [...prev, droneSetId]
    );
  };

  const handleSubmit = () => {
    if (!signature.trim()) {
      alert("Please provide a signature before submitting.");
      return;
    }

    const totalSelected = selectedWeaponIds.length + selectedGearIds.length + selectedDroneSetIds.length;
    if (totalSelected === 0) {
      alert(`Please select at least one item to ${mode}.`);
      return;
    }

    // For deposit mode, we need to include the deposit location
    if (mode === 'deposit' && !depositLocation) {
      alert("Please select a deposit location.");
      return;
    }

    onSubmit({
      soldier,
      weaponIds: selectedWeaponIds,
      gearIds: selectedGearIds,
      droneSetIds: selectedDroneSetIds,
      signature,
      action: mode,
      depositLocation: mode === 'deposit' ? depositLocation : undefined // Only include for deposit
    });
  };

  const getStatusBadge = (item) => {
    if (mode === 'deposit') {
      return item.armory_status === 'in_deposit' ? 
        <Badge variant="secondary">In Deposit</Badge> : 
        <Badge variant="default">With Soldier</Badge>;
    } else {
      return item.armory_status === 'in_deposit' ? 
        <Badge variant="default">In Deposit</Badge> : 
        <Badge variant="secondary">With Soldier</Badge>;
    }
  };

  if (!soldier) return null;

  const actionText = mode === 'deposit' ? 'Deposit' : 'Release';
  const actionIcon = mode === 'deposit' ? <Package className="w-5 h-5" /> : <PackageOpen className="w-5 h-5" />;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {actionIcon}
            {actionText} Equipment - {soldier.first_name} {soldier.last_name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="font-medium">Soldier: {soldier.first_name} {soldier.last_name}</p>
            <p className="text-sm text-slate-600">ID: {soldier.soldier_id} • Division: {soldier.division_name || 'N/A'}</p>
          </div>

          {/* Deposit Location Selection - Only show for deposit mode */}
          {mode === 'deposit' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Label className="text-sm font-medium text-blue-900 mb-2 block">
                Select Deposit Location
              </Label>
              <Select value={depositLocation} onValueChange={setDepositLocation}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose deposit location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="division_deposit">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      <div>
                        <div className="font-medium">Division Deposit</div>
                        <div className="text-xs text-slate-500">Store in {soldier.division_name || 'Division'} storage area</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="armory_deposit">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      <div>
                        <div className="font-medium">Central Armory Deposit</div>
                        <div className="text-xs text-slate-500">Store in central armory facility</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="naura_deposit">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      <div>
                        <div className="font-medium">Naura Deposit</div>
                        <div className="text-xs text-slate-500">Send to Naura base deposit</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="weapons" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Weapons ({availableWeapons.length})
              </TabsTrigger>
              <TabsTrigger value="gear" className="flex items-center gap-2">
                <Binoculars className="w-4 h-4" />
                Gear ({availableGear.length})
              </TabsTrigger>
              <TabsTrigger value="drones" className="flex items-center gap-2">
                <Joystick className="w-4 h-4" />
                Drones ({availableDroneSets.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="weapons" className="space-y-3">
              {!availableWeapons.length ? (
                <p className="text-center py-8 text-slate-500">
                  No weapons available to {mode}
                </p>
              ) : (
                availableWeapons.map(weapon => (
                  <div
                    key={weapon.id}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedWeaponIds.includes(weapon.weapon_id)}
                        onCheckedChange={() => handleWeaponSelect(weapon.weapon_id)}
                      />
                      <div>
                        <p className="font-medium">{weapon.weapon_type}</p>
                        <p className="text-sm text-slate-600">ID: {weapon.weapon_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(weapon)}
                      <Badge variant={weapon.status === 'functioning' ? 'success' : 'destructive'}>
                        {weapon.status === 'functioning' ? 'Functioning' : 'Not Functioning'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="gear" className="space-y-3">
              {!availableGear.length ? (
                <p className="text-center py-8 text-slate-500">
                  No gear available to {mode}
                </p>
              ) : (
                availableGear.map(gearItem => (
                  <div
                    key={gearItem.id}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedGearIds.includes(gearItem.gear_id)}
                        onCheckedChange={() => handleGearSelect(gearItem.gear_id)}
                      />
                      <div>
                        <p className="font-medium">{gearItem.gear_type}</p>
                        <p className="text-sm text-slate-600">ID: {gearItem.gear_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(gearItem)}
                      <Badge variant={gearItem.status === 'functioning' ? 'success' : 'destructive'}>
                        {gearItem.status === 'functioning' ? 'Functioning' : 'Not Functioning'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="drones" className="space-y-3">
              {!availableDroneSets.length ? (
                <p className="text-center py-8 text-slate-500">
                  No drone sets available to {mode}
                </p>
              ) : (
                availableDroneSets.map(droneSet => (
                  <div
                    key={droneSet.id}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedDroneSetIds.includes(droneSet.id)}
                        onCheckedChange={() => handleDroneSetSelect(droneSet.id)}
                      />
                      <div>
                        <p className="font-medium">{droneSet.set_type} Drone Set</p>
                        <p className="text-sm text-slate-600">Serial: {droneSet.set_serial_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(droneSet)}
                      <Badge variant={droneSet.status === 'Operational' ? 'success' : 'destructive'}>
                        {droneSet.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Signature Required</h3>
            <p className="text-sm text-slate-600">
              Please sign to confirm the {mode} of selected equipment
              {mode === 'deposit' && depositLocation && (
                <span className="font-medium">
                  {' '}to {formatDepositName(depositLocation)}
                </span>
              )}
              .
            </p>
            <SignatureCanvas onSignatureChange={setSignature} />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {actionText} Selected Items
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
