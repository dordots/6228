
import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function SigningSoldierTable({ soldiers, weapons, gear, drones, equipment, onAssign }) {
  const [expandedEquipment, setExpandedEquipment] = useState({});

  const getSoldierEquipment = (soldierId) => {
    const assignedWeapons = weapons.filter(w => w.assigned_to === soldierId);
    const assignedGear = gear.filter(g => g.assigned_to === soldierId);
    const assignedDrones = drones.filter(d => d.assigned_to === soldierId);
    // ADD: Get assigned equipment
    const assignedEquipment = Array.isArray(equipment) ? equipment.filter(e => e.assigned_to === soldierId) : [];
    return { assignedWeapons, assignedGear, assignedDrones, assignedEquipment };
  };

  const toggleEquipmentExpanded = (soldierId) => {
    setExpandedEquipment(prev => ({
      ...prev,
      [soldierId]: !prev[soldierId]
    }));
  };

  const renderEquipmentDetails = (assignedWeapons, assignedGear, assignedDrones, assignedEquipment, soldierId) => {
    const totalItems = assignedWeapons.length + assignedGear.length + assignedDrones.length + assignedEquipment.length;
    
    if (totalItems === 0) {
      return <span className="text-slate-500 text-sm">No equipment assigned</span>;
    }

    const isExpanded = expandedEquipment[soldierId];

    return (
      <div className="space-y-2 max-w-lg">
        {/* Weapons - Always visible when present */}
        {assignedWeapons.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-red-700 mb-1">🎯 Weapons ({assignedWeapons.length})</div>
            {assignedWeapons.map(weapon => (
              <div key={weapon.id} className="text-xs text-slate-700 pl-2 border-l-2 border-red-200">
                {weapon.weapon_type} - <span className="font-mono">{weapon.weapon_id}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Serialized Gear - Always visible when present */}
        {assignedGear.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-purple-700 mb-1">🔍 Serialized Gear ({assignedGear.length})</div>
            {assignedGear.map(gearItem => (
              <div key={gearItem.id} className="text-xs text-slate-700 pl-2 border-l-2 border-purple-200">
                {gearItem.gear_type} - <span className="font-mono">{gearItem.gear_id}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Drone Sets - Always visible when present */}
        {assignedDrones.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-blue-700 mb-1">🚁 Drone Sets ({assignedDrones.length})</div>
            {assignedDrones.map(drone => (
              <div key={drone.id} className="text-xs text-slate-700 pl-2 border-l-2 border-blue-200">
                {drone.set_type} - <span className="font-mono">{drone.set_serial_number}</span>
              </div>
            ))}
          </div>
        )}

        {/* Standard Equipment - Compressed with expand/collapse */}
        {assignedEquipment.length > 0 && (
          <div>
            <div 
              className="text-xs font-semibold text-green-700 mb-1 flex items-center cursor-pointer hover:bg-green-50 p-1 rounded"
              onClick={() => toggleEquipmentExpanded(soldierId)}
            >
              {isExpanded ? <ChevronDown className="w-3 h-3 mr-1" /> : <ChevronRight className="w-3 h-3 mr-1" />}
              📦 Standard Equipment ({assignedEquipment.length})
            </div>
            
            {!isExpanded ? (
              <div className="pl-2 border-l-2 border-green-200 text-xs text-slate-600">
                <div className="flex flex-wrap gap-1">
                  {assignedEquipment.map(equip => (
                    <Badge key={equip.id} variant="secondary" className="text-xs">
                      {equip.equipment_type} ({equip.quantity})
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pl-2 border-l-2 border-green-200">
                {assignedEquipment.map(equip => (
                  <div key={equip.id} className="text-xs text-slate-700 mb-1">
                    <div className="font-medium">{equip.equipment_type}</div>
                    <div className="text-slate-500 ml-2">
                      Qty: {equip.quantity}
                      {equip.serial_number && <span> • S/N: {equip.serial_number}</span>}
                      {equip.condition && <span> • Status: {equip.condition}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="font-semibold w-48">Soldier</TableHead>
            <TableHead className="font-semibold">Current Equipment Assigned</TableHead>
            <TableHead className="text-right font-semibold w-32">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {soldiers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-slate-500 py-8">No soldiers found.</TableCell>
            </TableRow>
          ) : (
            soldiers.map(soldier => {
              const { assignedWeapons, assignedGear, assignedDrones, assignedEquipment } = getSoldierEquipment(soldier.soldier_id);
              return (
                <TableRow key={soldier.id} className="hover:bg-slate-50">
                  <TableCell className="align-top">
                    <div className="font-medium text-slate-900">{soldier.first_name} {soldier.last_name}</div>
                    <div className="text-xs text-slate-600 font-mono">ID: {soldier.soldier_id}</div>
                    {soldier.division_name && (
                      <div className="text-xs text-slate-500 mt-1">📍 {soldier.division_name}</div>
                    )}
                  </TableCell>
                  <TableCell className="align-top py-4">
                    {renderEquipmentDetails(assignedWeapons, assignedGear, assignedDrones, assignedEquipment, soldier.soldier_id)}
                  </TableCell>
                  <TableCell className="text-right align-top">
                    <Button size="sm" onClick={() => onAssign(soldier)} className="bg-green-600 hover:bg-green-700">
                      Assign Equipment
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
