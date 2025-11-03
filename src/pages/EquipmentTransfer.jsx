
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '@/api/entities';
import { Equipment } from '@/api/entities';
import { Soldier } from '@/api/entities';
import { ActivityLog } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRightLeft, ShieldAlert, Loader2, Search, ChevronDown } from 'lucide-react';

const REQUIRED_DIVISION = "פלס\"ם"; // This constant is kept as per instructions, even if no longer directly used in main access logic

export default function EquipmentTransfer() {
  const [currentUser, setCurrentUser] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [sourceDivision, setSourceDivision] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [equipmentSearchTerm, setEquipmentSearchTerm] = useState('');
  const [equipmentSearchOpen, setEquipmentSearchOpen] = useState(false);
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [destinationDivision, setDestinationDivision] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const user = await User.me();
        setCurrentUser(user);
        // Updated permission check: admin role OR specific permission
        if (user?.role === 'admin' || user?.permissions?.can_transfer_equipment) {
          const [allEquipment, allSoldiers] = await Promise.all([
            Equipment.list(),
            Soldier.list()
          ]);
          setEquipment(Array.isArray(allEquipment) ? allEquipment : []);
          setSoldiers(Array.isArray(allSoldiers) ? allSoldiers : []);
        } else {
          // If not authorized, clear equipment and soldiers to prevent display of data
          setEquipment([]);
          setSoldiers([]);
        }
      } catch (e) {
        setError("Failed to load user data.");
      }
      setIsLoading(false);
    };
    loadInitialData();
  }, []);
  
  const reloadData = async () => { 
      const [allEquipment, allSoldiers] = await Promise.all([
        Equipment.list(),
        Soldier.list()
      ]);
      setEquipment(Array.isArray(allEquipment) ? allEquipment : []);
      setSoldiers(Array.isArray(allSoldiers) ? allSoldiers : []);
  };

  const unassignedEquipment = useMemo(() => {
    return equipment.filter(item => !item.assigned_to);
  }, [equipment]);

  const aggregatedInventory = useMemo(() => {
    const result = unassignedEquipment.reduce((acc, item) => {
      if (!item.division_name || !item.equipment_type) {
        return acc;
      }
      
      if (!acc[item.division_name]) {
        acc[item.division_name] = {};
      }
      if (!acc[item.division_name][item.equipment_type]) {
        acc[item.division_name][item.equipment_type] = { quantity: 0, records: [] };
      }
      acc[item.division_name][item.equipment_type].quantity += item.quantity || 1;
      acc[item.division_name][item.equipment_type].records.push(item);
      return acc;
    }, {});
    return result;
  }, [unassignedEquipment]);

  const availableDivisions = useMemo(() => {
    const divisions = Object.keys(aggregatedInventory).sort();
    return divisions;
  }, [aggregatedInventory]);
  
  const allDivisions = useMemo(() => {
    const equipmentDivisions = equipment.map(item => item.division_name).filter(Boolean);
    const soldierDivisions = soldiers.map(soldier => soldier.division_name).filter(Boolean);
    const combined = [...new Set([...equipmentDivisions, ...soldierDivisions])].sort();
    return combined;
  }, [equipment, soldiers]);

  const availableEquipmentTypes = useMemo(() => {
    return sourceDivision ? Object.keys(aggregatedInventory[sourceDivision] || {}).sort() : [];
  }, [sourceDivision, aggregatedInventory]);

  // Equipment search results - now shows all available types when no search term
  const equipmentSearchResults = useMemo(() => {
    if (!sourceDivision) return [];
    
    if (equipmentSearchTerm.length === 0) {
      // Show all available equipment types when no search term
      return availableEquipmentTypes.slice(0, 10);
    }
    
    const searchLower = equipmentSearchTerm.toLowerCase().trim();
    
    return availableEquipmentTypes.filter(type => {
      return type.toLowerCase().includes(searchLower);
    }).slice(0, 10);
  }, [availableEquipmentTypes, equipmentSearchTerm, sourceDivision]);

  const selectedItemDetails = useMemo(() => {
    return sourceDivision && equipmentType ? aggregatedInventory[sourceDivision][equipmentType] : null;
  }, [sourceDivision, equipmentType, aggregatedInventory]);

  const handleSourceDivisionChange = (value) => {
    setSourceDivision(value);
    setEquipmentType('');
    setEquipmentSearchTerm('');
    setDestinationDivision('');
    setTransferQuantity(1);
    setEquipmentSearchOpen(false); // Close popover on division change
  };

  const handleEquipmentSearchChange = (e) => {
    const value = e.target.value;
    setEquipmentSearchTerm(value);
    // Always keep dropdown open when there's a source division
    setEquipmentSearchOpen(!!sourceDivision);
  };

  const selectEquipmentType = (type) => {
    setEquipmentType(type);
    setEquipmentSearchTerm(type);
    setEquipmentSearchOpen(false);
    setTransferQuantity(1);
  };

  const handleTransfer = async () => {
    if (!sourceDivision || !equipmentType || !destinationDivision || transferQuantity <= 0) {
      alert("Please fill all fields correctly.");
      return;
    }
    if (sourceDivision === destinationDivision) {
      alert("Source and destination divisions cannot be the same.");
      return;
    }
    
    // Enhanced validation - check available quantity again right before transfer based on current UI state
    const currentAvailable = selectedItemDetails?.quantity || 0;
    if (transferQuantity > currentAvailable) {
      alert(`Cannot transfer ${transferQuantity} items. Only ${currentAvailable} available.`);
      return;
    }

    setIsTransferring(true);
    setError('');

    try {
      // Reload fresh data to ensure we have the latest quantities
      const freshEquipment = await Equipment.list();
      const freshSourceRecords = freshEquipment.filter(item =>
        item.equipment_type === equipmentType &&
        item.division_name === sourceDivision &&
        !item.assigned_to
      );

      const totalAvailableNow = freshSourceRecords.reduce((sum, record) => sum + (record.quantity || 0), 0);

      if (transferQuantity > totalAvailableNow) {
        alert(`Cannot complete transfer. Only ${totalAvailableNow} items currently available (data may have changed).`);
        setIsTransferring(false);
        await reloadData(); // Refresh the display
        return;
      }

      // FIXED LOGIC: Find an existing unassigned stock in the destination division.
      const existingDestItems = freshEquipment.filter(item =>
          item.equipment_type === equipmentType &&
          item.division_name === destinationDivision &&
          !item.assigned_to &&
          item.condition === 'functioning' // Match the condition
      );

      if (existingDestItems.length > 0) {
          // If a stock record exists, update its quantity.
          const mainDestItem = existingDestItems[0];
          await Equipment.update(mainDestItem.id, { quantity: (mainDestItem.quantity || 0) + transferQuantity });
      } else {
          // Only create a new record if one doesn't exist.
          await Equipment.create({
              equipment_type: equipmentType,
              division_name: destinationDivision,
              quantity: transferQuantity,
              condition: 'functioning',
              assigned_to: null,
          });
      }

      let quantityToSubtract = transferQuantity;
      // Sort freshSourceRecords to prioritize records with smaller quantities for deletion first
      const sortedFreshSourceRecords = freshSourceRecords.sort((a, b) => (a.quantity || 0) - (b.quantity || 0));

      for (const record of sortedFreshSourceRecords) {
        if (quantityToSubtract <= 0) break;

        const amountToTake = Math.min(record.quantity || 0, quantityToSubtract);
        const newQuantity = (record.quantity || 0) - amountToTake;

        if (newQuantity <= 0) { // Changed to <= 0 to handle potential negative results if quantity was 0 and tried to subtract
          await Equipment.delete(record.id);
        } else {
          await Equipment.update(record.id, { quantity: newQuantity });
        }
        quantityToSubtract -= amountToTake;
      }

      await ActivityLog.create({
          activity_type: "UPDATE",
          entity_type: "Equipment",
          details: `Transferred ${transferQuantity}x ${equipmentType} from ${sourceDivision} to ${destinationDivision}.`,
          user_full_name: currentUser?.full_name || 'System'
        }).catch(() => {
          // Ignore ActivityLog errors
        });

    } catch (e) {
      // Continue to reset form and reload data even if there's an error
    } finally {
      // Always reset form and reload data
      setSourceDivision('');
      setEquipmentType('');
      setEquipmentSearchTerm('');
      setTransferQuantity(1);
      setDestinationDivision('');
      await reloadData();
      setIsTransferring(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }
  
  // Updated access denied check and message
  if (currentUser?.role !== 'admin' && !currentUser?.permissions?.can_transfer_equipment) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to transfer equipment. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    // Wrap the main content in ScrollArea for mobile scrolling
    <ScrollArea className="h-screen w-full">
      <div className="p-6 space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">Equipment Transfer</h1>
          <p className="text-slate-600">Move unassigned equipment between divisions.</p>
        </header>

        <div className="text-xs text-gray-500">
          Debug: Total equipment: {equipment.length}, Unassigned: {unassignedEquipment.length}, Available source divisions: {availableDivisions.length}, All divisions for destination: {allDivisions.length}
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Create Transfer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source Division</Label>
                <Select value={sourceDivision} onValueChange={handleSourceDivisionChange}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {availableDivisions.map(div => <SelectItem key={div} value={div}>{div}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Equipment Type</Label>
                <Popover open={equipmentSearchOpen} onOpenChange={setEquipmentSearchOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        placeholder={sourceDivision ? "Search equipment types..." : "Select source division first"}
                        value={equipmentSearchTerm}
                        onChange={handleEquipmentSearchChange}
                        onFocus={() => sourceDivision && setEquipmentSearchOpen(true)}
                        disabled={!sourceDivision}
                        className="pl-9 pr-10"
                      />
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[--radix-popover-trigger-width] p-0" 
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <ScrollArea className="h-60">
                      {sourceDivision && equipmentSearchResults.length > 0 ? (
                        equipmentSearchResults.map(type => {
                          const details = aggregatedInventory[sourceDivision][type];
                          return (
                            <div 
                              key={type} 
                              onClick={() => selectEquipmentType(type)} 
                              className="p-3 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-slate-900 text-sm">{type}</p>
                                  <p className="text-xs text-slate-600">Available: {details.quantity} units</p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-slate-500 text-sm">
                          {!sourceDivision ? 'Select a source division first' : 
                           'No equipment types available'}
                        </div>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            {selectedItemDetails && (
              <div className="p-3 bg-slate-100 rounded-lg text-sm">
                  Available quantity: <span className="font-bold">{selectedItemDetails.quantity}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label>Quantity to Transfer</Label>
                  <Input 
                      type="number" 
                      value={transferQuantity} 
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(parseInt(e.target.value) || 1, selectedItemDetails?.quantity || 1));
                        setTransferQuantity(val);
                      }}
                      min="1"
                      max={selectedItemDetails?.quantity || 1}
                      disabled={!selectedItemDetails}
                  />
                  {selectedItemDetails && transferQuantity > selectedItemDetails.quantity && (
                    <p className="text-sm text-red-600">
                      Cannot exceed available quantity ({selectedItemDetails.quantity})
                    </p>
                  )}
              </div>
              <div className="space-y-2">
                <Label>Destination Division</Label>
                <Select value={destinationDivision} onValueChange={setDestinationDivision} disabled={!sourceDivision}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    {allDivisions.filter(d => d !== sourceDivision).map(div => <SelectItem key={div} value={div}>{div}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleTransfer} disabled={!selectedItemDetails || !destinationDivision || isTransferring} className="w-full">
              {isTransferring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
              Transfer Equipment
            </Button>
          </CardFooter>
        </Card>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </div>
    </ScrollArea>
  );
}
