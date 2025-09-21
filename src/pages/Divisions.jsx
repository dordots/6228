
import React, { useState, useEffect, useMemo } from "react";
import { User } from "@/api/entities";
import { Soldier } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DroneSet } from "@/api/entities";
import { Equipment } from "@/api/entities";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CheckCircle, Target, Binoculars, Joystick, Wrench, Filter, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label"; // Added Label import
import { Button } from "@/components/ui/button";
import ComboBox from "../components/common/ComboBox";

import DivisionSerializedTable from "../components/divisions/DivisionSerializedTable";
import DivisionEquipmentTable from "../components/divisions/DivisionEquipmentTable";

export default function DivisionsPage() {
  const [soldiers, setSoldiers] = useState([]);
  const [weapons, setWeapons] = useState([]);
  const [serializedGear, setSerializedGear] = useState([]);
  const [droneSets, setDroneSets] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [teamFilters, setTeamFilters] = useState({});
  
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      const isAdmin = currentUser?.role === 'admin';
      const isManager = currentUser?.custom_role === 'manager'; // Corrected check
      const userDivision = currentUser?.department;

      // If a non-admin/non-manager user has no division, they see nothing.
      if (!isAdmin && !isManager && !userDivision) {
        setIsLoading(false);
        return;
      }

      const filter = (isAdmin || isManager) ? {} : { division_name: userDivision };

      const results = await Promise.allSettled([
        Soldier.filter(filter),
        Weapon.filter(filter),
        SerializedGear.filter(filter),
        DroneSet.filter(filter),
        Equipment.filter(filter),
      ]);
      
      setSoldiers(results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value : []);
      setWeapons(results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : []);
      setSerializedGear(results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : []);
      setDroneSets(results[3].status === 'fulfilled' && Array.isArray(results[3].value) ? results[3].value : []);
      setEquipment(results[4].status === 'fulfilled' && Array.isArray(results[4].value) ? results[4].value : []);

    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const divisionGroups = useMemo(() => {
    const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
    return safeSoldiers.reduce((acc, soldier) => {
      if (!soldier) return acc;
      const division = soldier.division_name || 'Unassigned';
      if (!acc[division]) {
        acc[division] = [];
      }
      acc[division].push(soldier);
      return acc;
    }, {});
  }, [soldiers]);

  const weaponTypes = useMemo(() => [...new Set((Array.isArray(weapons) ? weapons : []).filter(w => w?.weapon_type).map(w => w.weapon_type))].sort(), [weapons]);
  const gearTypes = useMemo(() => [...new Set((Array.isArray(serializedGear) ? serializedGear : []).filter(g => g?.gear_type).map(g => g.gear_type))].sort(), [serializedGear]);
  const droneSetTypes = useMemo(() => [...new Set((Array.isArray(droneSets) ? droneSets : []).filter(ds => ds?.set_type).map(ds => ds.set_type))].sort(), [droneSets]);
  const equipmentTypes = useMemo(() => [...new Set((Array.isArray(equipment) ? equipment : []).filter(e => e?.equipment_type).map(e => e.equipment_type))].sort(), [equipment]);

  const downloadCSV = (csvContent, filename) => {
    const BOM = '\uFEFF'; // UTF-8 Byte Order Mark for proper Hebrew support
    const fullContent = BOM + csvContent;
    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up the object URL
  };

  const handleExportCSV = (divisionName, teamName, soldiersToExport) => {
    // 1. Define headers dynamically
    const headers = [
        'Soldier ID', 'Soldier Name', 'Team Name',
        ...weaponTypes.map(type => `${type} (SN)`),
        ...gearTypes.map(type => `${type} (SN)`),
        ...droneSetTypes.map(type => `${type} (SN)`),
        ...equipmentTypes.map(type => `${type} (Qty)`),
    ];

    // 2. Prepare data rows
    const dataRows = soldiersToExport.map(soldier => {
        if (!soldier) return null;

        const row = {
            'Soldier ID': soldier.soldier_id,
            'Soldier Name': `${soldier.first_name} ${soldier.last_name}`,
            'Team Name': soldier.team_name || 'N/A',
        };

        weaponTypes.forEach(type => {
            const item = weapons.find(w => w?.assigned_to === soldier.soldier_id && w?.weapon_type === type);
            row[`${type} (SN)`] = item ? item.weapon_id : '';
        });
        gearTypes.forEach(type => {
            const item = serializedGear.find(g => g?.assigned_to === soldier.soldier_id && g?.gear_type === type);
            row[`${type} (SN)`] = item ? item.gear_id : '';
        });
        droneSetTypes.forEach(type => {
            const item = droneSets.find(ds => ds?.assigned_to === soldier.soldier_id && ds?.set_type === type);
            row[`${type} (SN)`] = item ? item.set_serial_number : '';
        });
        equipmentTypes.forEach(type => {
            const totalQty = equipment
                .filter(e => e?.assigned_to === soldier.soldier_id && e?.equipment_type === type)
                .reduce((sum, item) => sum + (item.quantity || 0), 0);
            row[`${type} (Qty)`] = totalQty;
        });
        return row;
    }).filter(Boolean);

    // 3. Convert to CSV with proper UTF-8 encoding and quoting
    const headerString = headers.map(header => `"${String(header).replace(/"/g, '""')}"`).join(',');
    const rowStrings = dataRows.map(row =>
        headers.map(header => {
            const value = row[header];
            const stringValue = value === null || value === undefined ? '' : String(value);
            // Ensure all values are quoted and inner quotes are escaped
            return `"${stringValue.replace(/"/g, '""')}"`;
        }).join(',')
    );
    const csvContent = [headerString, ...rowStrings].join('\n');
    const filename = `${divisionName}_${teamName === 'all' ? 'All_Teams' : teamName}_Report_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96" /></div>
        <div className="space-y-4">{Array(2).fill(0).map((_, i) => (<Card key={i}><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>))}</div>
      </div>
    );
  }

  const divisionKeys = Object.keys(divisionGroups).sort();
  const defaultDivisionTab = divisionKeys.length > 0 ? divisionKeys[0] : undefined;

  const handleTeamFilterChange = (division, team) => {
    setTeamFilters(prev => ({ ...prev, [division]: team }));
  };

  return (
    <div className="p-3 space-y-4 max-w-full mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Division Overview</h1>
        <p className="text-sm text-slate-600">Cross-table view of personnel and equipment assignments by division</p>
      </div>

      {defaultDivisionTab ? (
        <Tabs defaultValue={defaultDivisionTab} className="space-y-4">
          <div className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto min-h-[40px] flex-nowrap p-1">
              {divisionKeys.map(division => (
                <TabsTrigger 
                  key={division} 
                  value={division} 
                  className="text-xs px-4 py-2 h-8 whitespace-nowrap flex-shrink-0 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-medium">{division}</span>
                    <span className="text-[10px] opacity-70">({divisionGroups[division].length} soldiers)</span>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {divisionKeys.map(divisionName => {
            const teamsInDivision = ['all', ...new Set((divisionGroups[divisionName] || []).map(s => s.team_name).filter(Boolean))].sort();
            const selectedTeam = teamFilters[divisionName] || 'all';
            const filteredSoldiers = selectedTeam === 'all' 
              ? divisionGroups[divisionName] 
              : (divisionGroups[divisionName] || []).filter(s => s.team_name === selectedTeam);
              
            const teamOptions = [
                { value: 'all', label: 'All Teams' },
                ...[...new Set((divisionGroups[divisionName] || []).map(s => s.team_name).filter(Boolean))].sort().map(team => ({ value: team, label: team }))
            ];

            return (
              <TabsContent key={divisionName} value={divisionName} className="space-y-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <Tabs defaultValue="serialized" className="w-full">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
                        <div className="flex items-center gap-4 w-full md:w-auto flex-wrap">
                           <div className="flex items-center gap-2">
                              <Filter className="w-4 h-4 text-slate-500"/>
                              <Label htmlFor={`team-filter-${divisionName}`} className="text-sm font-medium shrink-0">Team:</Label>
                              <div className="w-[180px]">
                                <ComboBox
                                    options={teamOptions}
                                    value={selectedTeam}
                                    onSelect={(val) => handleTeamFilterChange(divisionName, val || 'all')}
                                    placeholder="Filter by team..."
                                    searchPlaceholder="Search teams..."
                                />
                              </div>
                            </div>
                           <TabsList className="w-full md:w-auto">
                            <TabsTrigger value="serialized" className="flex-1 text-sm">
                              <div className="flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                Serialized Items
                              </div>
                            </TabsTrigger>
                            <TabsTrigger value="equipment" className="flex-1 text-sm">
                              <div className="flex items-center gap-2">
                                <Wrench className="w-4 h-4" />
                                Standard Equipment
                              </div>
                            </TabsTrigger>
                          </TabsList>
                        </div>
                        <div className="flex items-center gap-3 justify-end flex-1">
                          <h3 className="text-lg font-semibold text-slate-900 hidden lg:block">
                            {divisionName}
                          </h3>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportCSV(divisionName, selectedTeam, filteredSoldiers)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export CSV
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <TabsContent value="serialized" className="mt-0">
                          <DivisionSerializedTable
                            divisionName={divisionName}
                            divisionSoldiers={filteredSoldiers}
                            weapons={weapons}
                            serializedGear={serializedGear}
                            droneSets={droneSets}
                            weaponTypes={weaponTypes}
                            gearTypes={gearTypes}
                            droneSetTypes={droneSetTypes}
                          />
                        </TabsContent>
                        <TabsContent value="equipment" className="mt-0">
                          <DivisionEquipmentTable
                            divisionName={divisionName}
                            divisionSoldiers={filteredSoldiers}
                            equipment={equipment}
                            equipmentTypes={equipmentTypes}
                          />
                        </TabsContent>
                      </div>
                    </Tabs>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      ) : (
        <div className="text-center text-slate-500 py-10">No divisions or soldier data available for your assigned division.</div>
      )}
    </div>
  );
}
