
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Binoculars, Joystick, Users, CheckCircle, X } from "lucide-react";

export default function DivisionSerializedTable({
  divisionName,
  divisionSoldiers,
  weapons,
  serializedGear,
  droneSets,
  weaponTypes,
  gearTypes,
  droneSetTypes,
}) {
  const getAssignedItems = (soldierId) => {
    const assignedWeapons = (Array.isArray(weapons) ? weapons : []).filter(w => w?.assigned_to === soldierId);
    const assignedGear = (Array.isArray(serializedGear) ? serializedGear : []).filter(g => g?.assigned_to === soldierId);
    const assignedDrones = (Array.isArray(droneSets) ? droneSets : []).filter(ds => ds?.assigned_to === soldierId);

    return {
      weapons: assignedWeapons.reduce((acc, item) => { if (item?.weapon_type) acc[item.weapon_type] = item; return acc; }, {}),
      gear: assignedGear.reduce((acc, item) => { if (item?.gear_type) acc[item.gear_type] = item; return acc; }, {}),
      drones: assignedDrones.reduce((acc, item) => { if (item?.set_type) acc[item.set_type] = item; return acc; }, {}),
    };
  };

  const getTypeTotals = () => {
    const safeDivisionSoldiers = Array.isArray(divisionSoldiers) ? divisionSoldiers : [];
    const soldierIds = safeDivisionSoldiers.map(s => s.soldier_id);
    
    const weaponTotals = weaponTypes.reduce((acc, type) => {
      acc[type] = (Array.isArray(weapons) ? weapons : []).filter(w => 
        w?.weapon_type === type && soldierIds.includes(w.assigned_to)
      ).length;
      return acc;
    }, {});
    
    const gearTotals = gearTypes.reduce((acc, type) => {
      acc[type] = (Array.isArray(serializedGear) ? serializedGear : []).filter(g => 
        g?.gear_type === type && soldierIds.includes(g.assigned_to)
      ).length;
      return acc;
    }, {});
    
    const droneTotals = droneSetTypes.reduce((acc, type) => {
      acc[type] = (Array.isArray(droneSets) ? droneSets : []).filter(ds => 
        ds?.set_type === type && soldierIds.includes(ds.assigned_to)
      ).length;
      return acc;
    }, {});
    
    return { weaponTotals, gearTotals, droneTotals };
  };

  const { weaponTotals, gearTotals, droneTotals } = getTypeTotals();

  const StatusBadge = ({ item }) => {
    if (!item) return <X className="w-3 h-3 text-slate-300 mx-auto" />;
    
    const isOk = item.status === 'functioning' || item.status === 'Operational';
    
    return (
      <div className="flex flex-col items-center gap-0.5">
        <CheckCircle className="w-3 h-3 text-green-600" />
        <span className="text-xs font-mono text-slate-700 truncate max-w-[80px]">
          {item.weapon_id || item.gear_id || item.set_serial_number}
        </span>
        <Badge className={`text-[10px] px-1 py-0 leading-tight ${isOk ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}>
          {isOk ? 'OK' : 'REP'}
        </Badge>
      </div>
    );
  };

  return (
    <Card className="mb-6 border-none shadow-none">
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th 
                  className="sticky top-0 left-0 z-30 p-3 font-semibold text-left text-slate-800 bg-slate-50 border-r"
                  style={{ minWidth: '180px' }}
                >
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-sm font-bold text-slate-700">Soldier</span>
                    </div>
                    <span className="text-xs text-blue-600 font-semibold">({Array.isArray(divisionSoldiers) ? divisionSoldiers.length : 0})</span>
                  </div>
                </th>
                {weaponTypes.map(type => (
                  <th key={`w-${type}`} className="sticky top-0 z-20 p-2 font-medium text-center bg-slate-50 border-r" style={{minWidth: '120px'}}>
                    <div className="flex flex-col items-center gap-0.5">
                      <Target className="w-3 h-3 text-red-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 leading-tight break-words">{type}</span>
                      <span className="text-[10px] text-red-600 font-semibold">({weaponTotals[type]})</span>
                    </div>
                  </th>
                ))}
                {gearTypes.map(type => (
                  <th key={`g-${type}`} className="sticky top-0 z-20 p-2 font-medium text-center bg-slate-50 border-r" style={{minWidth: '120px'}}>
                    <div className="flex flex-col items-center gap-0.5">
                      <Binoculars className="w-3 h-3 text-purple-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 leading-tight break-words">{type}</span>
                      <span className="text-[10px] text-purple-600 font-semibold">({gearTotals[type]})</span>
                    </div>
                  </th>
                ))}
                {droneSetTypes.map(type => (
                  <th key={`d-${type}`} className="sticky top-0 z-20 p-2 font-medium text-center bg-slate-50 border-r" style={{minWidth: '120px'}}>
                    <div className="flex flex-col items-center gap-0.5">
                      <Joystick className="w-3 h-3 text-indigo-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 leading-tight break-words">{type}</span>
                      <span className="text-[10px] text-indigo-600 font-semibold">({droneTotals[type]})</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="group">
              {Array.isArray(divisionSoldiers) && divisionSoldiers.map(soldier => {
                if (!soldier) return null;
                const assigned = getAssignedItems(soldier.soldier_id);
                return (
                  <tr key={soldier.id} className="border-b group-hover:bg-slate-50/50">
                    <td 
                      className="sticky left-0 z-10 p-3 bg-white border-r group-hover:bg-slate-50/50"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 text-sm leading-tight">{soldier.first_name} {soldier.last_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">ID: {soldier.soldier_id}</p>
                        {soldier.team_name && (<Badge variant="outline" className="text-xs mt-1 py-0 px-2">{soldier.team_name}</Badge>)}
                      </div>
                    </td>
                    {weaponTypes.map(type => (
                      <td key={`w-${soldier.id}-${type}`} className="p-1 text-center border-r"><StatusBadge item={assigned.weapons[type]} /></td>
                    ))}
                    {gearTypes.map(type => (
                      <td key={`g-${soldier.id}-${type}`} className="p-1 text-center border-r"><StatusBadge item={assigned.gear[type]} /></td>
                    ))}
                    {droneSetTypes.map(type => (
                      <td key={`d-${soldier.id}-${type}`} className="p-1 text-center border-r"><StatusBadge item={assigned.drones[type]} /></td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
