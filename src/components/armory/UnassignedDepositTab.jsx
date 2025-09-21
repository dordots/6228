import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Binoculars, Joystick, ArchiveRestore } from "lucide-react";
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
    const [activeTab, setActiveTab] = useState("weapons");

    useEffect(() => {
        // Reset selections when items change
        setSelectedWeaponIds([]);
        setSelectedGearIds([]);
        setSelectedDroneSetIds([]);
        setSignature("");
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
            alert("Please select at least one item to release.");
            return;
        }

        onSubmit({
            weaponIds: selectedWeaponIds,
            gearIds: selectedGearIds,
            droneSetIds: selectedDroneSetIds,
            signature,
        });
        
        // Clear state after submission
        setSelectedWeaponIds([]);
        setSelectedGearIds([]);
        setSelectedDroneSetIds([]);
        setSignature("");
    };

    if (isLoading) {
        return <p className="text-center py-8 text-slate-500">Loading items...</p>;
    }
    
    const { weapons = [], gear = [], droneSets = [] } = items || {};
    
    const allItemsEmpty = weapons.length === 0 && gear.length === 0 && droneSets.length === 0;

    return (
        <Card className="border-amber-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-amber-900">
                    <ArchiveRestore className="w-6 h-6"/>
                    <div>
                        Release Unassigned Equipment
                        <p className="text-sm font-normal text-slate-600 mt-1">Select items to release from deposit back to general inventory.</p>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {allItemsEmpty ? (
                     <p className="text-center py-8 text-slate-500">No unassigned items found in deposit.</p>
                ) : (
                    <>
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="weapons" className="flex items-center gap-2">
                                    <Target className="w-4 h-4"/> Weapons ({weapons.length})
                                </TabsTrigger>
                                <TabsTrigger value="gear" className="flex items-center gap-2">
                                    <Binoculars className="w-4 h-4"/> Gear ({gear.length})
                                </TabsTrigger>
                                <TabsTrigger value="drones" className="flex items-center gap-2">
                                    <Joystick className="w-4 h-4"/> Drones ({droneSets.length})
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="weapons" className="space-y-3 pt-4">
                                {weapons.length === 0 ? <p className="text-center py-8 text-slate-500">No unassigned weapons in deposit.</p> :
                                weapons.map(w => <ItemRow key={w.id} item={w} isSelected={selectedWeaponIds.includes(w.id)} onSelect={() => handleSelect(w.id, 'weapon')} type="weapon" />)
                                }
                            </TabsContent>
                             <TabsContent value="gear" className="space-y-3 pt-4">
                                {gear.length === 0 ? <p className="text-center py-8 text-slate-500">No unassigned gear in deposit.</p> :
                                gear.map(g => <ItemRow key={g.id} item={g} isSelected={selectedGearIds.includes(g.id)} onSelect={() => handleSelect(g.id, 'gear')} type="gear" />)
                                }
                            </TabsContent>
                             <TabsContent value="drones" className="space-y-3 pt-4">
                                {droneSets.length === 0 ? <p className="text-center py-8 text-slate-500">No unassigned drone sets in deposit.</p> :
                                droneSets.map(ds => <ItemRow key={ds.id} item={ds} isSelected={selectedDroneSetIds.includes(ds.id)} onSelect={() => handleSelect(ds.id, 'droneSet')} type="droneSet" />)
                                }
                            </TabsContent>
                        </Tabs>

                        <div className="space-y-4 pt-4 border-t">
                            <h3 className="text-lg font-semibold">Signature Required</h3>
                            <p className="text-sm text-slate-600">
                                Please sign to confirm the release of the selected equipment.
                            </p>
                            <SignatureCanvas onSignatureChange={setSignature} />
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button
                                onClick={handleSubmit}
                                className="bg-amber-600 hover:bg-amber-700"
                            >
                                Release Selected Items
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}