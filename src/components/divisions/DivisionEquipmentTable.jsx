import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Users } from "lucide-react";

export default function DivisionEquipmentTable({
  divisionName,
  divisionSoldiers,
  equipment,
  equipmentTypes,
}) {
  const getAssignedEquipmentQty = (soldierId, eqType) => {
    return (Array.isArray(equipment) ? equipment : [])
      .filter(e => e?.assigned_to === soldierId && e?.equipment_type === eqType)
      .reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  const getEquipmentTypeTotals = () => {
    const safeDivisionSoldiers = Array.isArray(divisionSoldiers) ? divisionSoldiers : [];
    const soldierIds = safeDivisionSoldiers.map(s => s.soldier_id);
    
    return equipmentTypes.reduce((acc, type) => {
      acc[type] = (Array.isArray(equipment) ? equipment : [])
        .filter(e => e?.equipment_type === type && soldierIds.includes(e.assigned_to))
        .reduce((sum, item) => sum + (item.quantity || 0), 0);
      return acc;
    }, {});
  };

  const equipmentTotals = getEquipmentTypeTotals();

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
                {equipmentTypes.map(type => (
                  <th key={`eq-${type}`} className="sticky top-0 z-20 p-2 font-medium text-center bg-slate-50 border-r" style={{minWidth: '140px'}}>
                    <div className="flex flex-col items-center gap-0.5">
                      <Wrench className="w-3 h-3 text-green-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 leading-tight break-words">{type}</span>
                      <span className="text-[10px] text-green-600 font-semibold">({equipmentTotals[type]})</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="group">
              {Array.isArray(divisionSoldiers) && divisionSoldiers.map(soldier => {
                if (!soldier) return null;
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
                    {equipmentTypes.map(type => {
                      const qty = getAssignedEquipmentQty(soldier.soldier_id, type);
                      return (
                        <td key={`eq-${soldier.id}-${type}`} className="p-1 text-center border-r">
                          {qty > 0 ? (
                            <span className="font-mono font-semibold text-slate-800">{qty}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      )
                    })}
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