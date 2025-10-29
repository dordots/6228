import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Target, Binoculars, Joystick, ArchiveRestore, Search } from "lucide-react";
import SignatureCanvas from "../soldiers/SignatureCanvas";

const ItemRow = ({ item, isSelected, onSelect, type }) => {
    let name, id;
    switch (type) {
        case 'weapon':
            name = item.weapon_type;
            id = item.weapon_id;
            break;
        case 'gear':
            name = item.gear_type;
            id = item.gear_id;
            break;
        case 'droneSet':
            name = `${item.set_type} Set`;
            id = item.set_serial_number;
            break;
        default:
            return null;
    }

    return (
        <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
            <div className="flex items-center gap-3">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelect(item.id)}
                />
                <div>
                    <p className="font-medium">{name}</p>
                    <p className="text-sm text-slate-600">ID: {id}</p>
                </div>
            </div>
        </div>
    );
};

export default function UnassignedDepositTab({ items, isLoading, onSubmit }) {
    const [selectedWeaponIds, setSelectedWeaponIds] = useState([]);
    const [selectedGearIds, setSelectedGearIds] = useState([]);
    const [selectedDroneSetIds, setSelectedDroneSetIds] = useState([]);
    const [signature, setSignature] = useState("");
    const [depositLocation, setDepositLocation] = useState("division_deposit");
    const [activeTab, setActiveTab] = useState("weapons");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        // Reset selections when items change
        setSelectedWeaponIds([]);
        setSelectedGearIds([]);
        setSelectedDroneSetIds([]);
        setSignature("");
        setDepositLocation("division_deposit");
    }, [items]);
    
    const handleSelect = (id, type) => {
        const selectorMap = {
            weapon: [selectedWeaponIds, setSelectedWeaponIds],
            gear: [selectedGearIds, setSelectedGearIds],
            droneSet: [selectedDroneSetIds, setSelectedDroneSetIds],
        };

        const [selectedIds, setSelectedIds] = selectorMap[type];
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSubmit = () => {
        if (!signature.trim()) {
            alert("Please provide a signature before submitting.");
            return;
        }

        const totalSelected = selectedWeaponIds.length + selectedGearIds.length + selectedDroneSetIds.length;
        if (totalSelected === 0) {
            alert("Please select at least one item to deposit.");
            return;
        }

        if (!depositLocation) {
            alert("Please select a deposit location.");
            return;
        }

        onSubmit({
            weaponIds: selectedWeaponIds,
            gearIds: selectedGearIds,
            droneSetIds: selectedDroneSetIds,
            signature,
            depositLocation,
        });

        // Clear state after submission
        setSelectedWeaponIds([]);
        setSelectedGearIds([]);
        setSelectedDroneSetIds([]);
        setSignature("");
        setDepositLocation("division_deposit");
    };

    const { weapons = [], gear = [], droneSets = [] } = items || {};

    // Filter items by search term (search both ID and type)
    const filteredWeapons = useMemo(() => {
        if (!searchTerm.trim()) return weapons;
        const search = searchTerm.toLowerCase();
        return weapons.filter(w =>
            w.weapon_id?.toLowerCase().includes(search) ||
            w.weapon_type?.toLowerCase().includes(search)
        );
    }, [weapons, searchTerm]);

    const filteredGear = useMemo(() => {
        if (!searchTerm.trim()) return gear;
        const search = searchTerm.toLowerCase();
        return gear.filter(g =>
            g.gear_id?.toLowerCase().includes(search) ||
            g.gear_type?.toLowerCase().includes(search)
        );
    }, [gear, searchTerm]);

    const filteredDroneSets = useMemo(() => {
        if (!searchTerm.trim()) return droneSets;
        const search = searchTerm.toLowerCase();
        return droneSets.filter(d =>
            d.set_serial_number?.toLowerCase().includes(search) ||
            d.set_type?.toLowerCase().includes(search)
        );
    }, [droneSets, searchTerm]);

    const allItemsEmpty = weapons.length === 0 && gear.length === 0 && droneSets.length === 0;

    if (isLoading) {
        return <p className="text-center py-8 text-slate-500">Loading items...</p>;
    }

    return (
        <Card className="border-amber-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-amber-900">
                    <ArchiveRestore className="w-6 h-6"/>
                    <div>
                        Deposit Unassigned Equipment
                        <p className="text-sm font-normal text-slate-600 mt-1">Select unassigned items to deposit into division or central armory.</p>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {allItemsEmpty ? (
                     <p className="text-center py-8 text-slate-500">No unassigned items found to deposit.</p>
                ) : (
                    <>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                placeholder="Search by ID or type..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="weapons" className="flex items-center gap-2">
                                    <Target className="w-4 h-4"/> Weapons ({filteredWeapons.length})
                                </TabsTrigger>
                                <TabsTrigger value="gear" className="flex items-center gap-2">
                                    <Binoculars className="w-4 h-4"/> Gear ({filteredGear.length})
                                </TabsTrigger>
                                <TabsTrigger value="drones" className="flex items-center gap-2">
                                    <Joystick className="w-4 h-4"/> Drones ({filteredDroneSets.length})
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="weapons" className="space-y-3 pt-4">
                                {filteredWeapons.length === 0 ? <p className="text-center py-8 text-slate-500">No weapons found matching search.</p> :
                                filteredWeapons.map(w => <ItemRow key={w.id} item={w} isSelected={selectedWeaponIds.includes(w.id)} onSelect={() => handleSelect(w.id, 'weapon')} type="weapon" />)
                                }
                            </TabsContent>
                             <TabsContent value="gear" className="space-y-3 pt-4">
                                {filteredGear.length === 0 ? <p className="text-center py-8 text-slate-500">No gear found matching search.</p> :
                                filteredGear.map(g => <ItemRow key={g.id} item={g} isSelected={selectedGearIds.includes(g.id)} onSelect={() => handleSelect(g.id, 'gear')} type="gear" />)
                                }
                            </TabsContent>
                             <TabsContent value="drones" className="space-y-3 pt-4">
                                {filteredDroneSets.length === 0 ? <p className="text-center py-8 text-slate-500">No drone sets found matching search.</p> :
                                filteredDroneSets.map(ds => <ItemRow key={ds.id} item={ds} isSelected={selectedDroneSetIds.includes(ds.id)} onSelect={() => handleSelect(ds.id, 'droneSet')} type="droneSet" />)
                                }
                            </TabsContent>
                        </Tabs>

                        <div className="space-y-4 pt-4 border-t">
                            <div className="space-y-3">
                                <Label className="text-base font-semibold">Deposit Location</Label>
                                <RadioGroup value={depositLocation} onValueChange={setDepositLocation}>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="division_deposit" id="division" />
                                        <Label htmlFor="division" className="font-normal cursor-pointer">
                                            Division Deposit
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="central_armory" id="central" />
                                        <Label htmlFor="central" className="font-normal cursor-pointer">
                                            Central Armory Deposit
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <h3 className="text-lg font-semibold">Signature Required</h3>
                            <p className="text-sm text-slate-600">
                                Please sign to confirm the deposit of the selected equipment.
                            </p>
                            <SignatureCanvas onSignatureChange={setSignature} />
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button
                                onClick={handleSubmit}
                                className="bg-amber-600 hover:bg-amber-700"
                            >
                                Deposit Selected Items
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}