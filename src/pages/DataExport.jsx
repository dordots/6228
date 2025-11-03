
import React, { useState, useEffect, useMemo } from "react";
import { Soldier } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DroneSet } from "@/api/entities";
import { DroneComponent } from "@/api/entities";
import { Equipment } from "@/api/entities";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Users, Target, Binoculars, Joystick, Puzzle, Wrench, Shield, FileSpreadsheet, Package, Archive } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { exportAllData } from "@/api/functions";

const CORE_EXPORTS = [
  { name: "Personnel", entity: Soldier, icon: Users, color: "text-blue-600" },
  { name: "Weapons", entity: Weapon, icon: Target, color: "text-red-600" },
  { name: "Serialized Gear", entity: SerializedGear, icon: Binoculars, color: "text-purple-600" },
  { name: "Drone Sets", entity: DroneSet, icon: Joystick, color: "text-green-600" },
  { name: "Drone Components", entity: DroneComponent, icon: Puzzle, color: "text-orange-600" },
  { name: "Equipment", entity: Equipment, icon: Wrench, color: "text-gray-600" },
];

export default function DataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [divisions, setDivisions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchUserAndDivisions = async () => {
      setIsLoading(true);
      try {
        const user = await User.me();
        setCurrentUser(user);

        const isAdmin = user?.role === 'admin';
        const isManager = user?.custom_role === 'manager';
        const isDivisionManager = user?.custom_role === 'division_manager';
        const isTeamLeader = user?.custom_role === 'team_leader';
        const userDivision = user?.division;
        const userTeam = user?.team;

        // Build divisions list based on role
        if (isAdmin || isManager) {
          // Admins and managers see all divisions
          const allSoldiers = await Soldier.list();
          const uniqueDivisions = [...new Set(allSoldiers.map(s => s.division_name).filter(Boolean))].sort();
          setDivisions(uniqueDivisions);
        } else if (isDivisionManager && userDivision) {
          // Division managers only see their own division
          setDivisions([userDivision]);
        } else if (isTeamLeader && userDivision) {
          // Team leaders only see their own division (but filtered by team later)
          setDivisions([userDivision]);
        } else {
          // Regular users see only their division
          if (userDivision) {
            setDivisions([userDivision]);
          }
        }
      } catch (error) {
      }
      setIsLoading(false);
    };
    fetchUserAndDivisions();
  }, []);

  const convertToCSV = (data, headers, allComponents = []) => {
    const BOM = '\uFEFF'; // UTF-8 Byte Order Mark for proper Hebrew support
    if (!Array.isArray(data) || data.length === 0) {
      return BOM + (headers ? headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') : '');
    }

    // Create a map of component ID to component type for quick lookup
    const componentMap = {};
    if (Array.isArray(allComponents)) {
      allComponents.forEach(comp => {
        if (comp && comp.id && comp.component_type) {
          componentMap[comp.id] = comp.component_type;
        }
      });
    }

    const finalHeaders = headers || Object.keys(data[0]);
    const csvRows = [
      finalHeaders.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',')
    ];

    data.forEach(item => {
      const row = finalHeaders.map(header => {
        let value = item[header] !== undefined && item[header] !== null ? item[header] : '';

        // Special handling for components object (drone sets)
        // Format: slotName: componentName (componentId); slotName2: componentName2 (componentId2)
        if (header === 'components' && typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            // If it's an array, join component IDs
            value = value.map(comp => comp?.component_id || '').filter(Boolean).join('; ');
          } else {
            // If it's an object, format as slotName: componentName (componentId) pairs
            value = Object.entries(value)
              .filter(([key, val]) => val) // Filter out empty values
              .map(([key, val]) => {
                const componentName = componentMap[val] || 'Unknown Component';
                return `${key}: ${componentName} (${val})`;
              })
              .join('; ');
          }
        } else {
          value = String(value);
        }

        return `"${value.replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(','));
    });

    return BOM + csvRows.join('\n');
  };

  const downloadCSV = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCoreExport = async (config) => {
    setIsExporting(true);
    setExportStatus(`Exporting ${config.name}...`);
    try {
      // Apply filter based on role hierarchy
      const isAdmin = currentUser?.role === 'admin';
      const isManager = currentUser?.custom_role === 'manager';
      const isDivisionManager = currentUser?.custom_role === 'division_manager';
      const isTeamLeader = currentUser?.custom_role === 'team_leader';
      const userDivision = currentUser?.division;
      const userTeam = currentUser?.team;

      // Build filter based on role hierarchy
      let filter = {};
      if (isAdmin || isManager) {
        filter = {}; // Export everything
      } else if (isDivisionManager && userDivision) {
        filter = { division_name: userDivision }; // Export division only
      } else if (isTeamLeader && userDivision && userTeam) {
        filter = { division_name: userDivision, team_name: userTeam }; // Export team only
      } else if (userDivision) {
        filter = { division_name: userDivision }; // Fallback
      }

      let data;
      if (Object.keys(filter).length > 0) {
        data = await config.entity.filter(filter);
      } else {
        // Admins and managers export all data
        data = await config.entity.list();
      }

      // If exporting Drone Sets, fetch all components for name mapping
      let allComponents = [];
      if (config.name === 'Drone Sets') {
        try {
          allComponents = await DroneComponent.list();
        } catch (error) {
        }
      }

      const csvContent = convertToCSV(data, undefined, allComponents);
      downloadCSV(csvContent, config.name.replace(/\s+/g, '_'));
      setExportStatus(`${config.name} exported successfully!`);
    } catch (error) {
      setExportStatus(`Error exporting ${config.name}.`);
      throw error;
    }
    setTimeout(() => setIsExporting(false), 2000);
  };

  const handleDivisionExport = async (divisionName, type) => {
    setIsExporting(true);
    setExportStatus(`Exporting ${type} for ${divisionName}...`);
    try {
      let data, filename, headers;
      if (type === 'Serialized') {
        const [weaponsResult, gearResult, dronesResult] = await Promise.allSettled([
          Weapon.filter({ division_name: divisionName }),
          SerializedGear.filter({ division_name: divisionName }),
          DroneSet.filter({ division_name: divisionName }),
        ]);

        const weapons = weaponsResult.status === 'fulfilled' && Array.isArray(weaponsResult.value) ? weaponsResult.value : [];
        const gear = gearResult.status === 'fulfilled' && Array.isArray(gearResult.value) ? gearResult.value : [];
        const drones = dronesResult.status === 'fulfilled' && Array.isArray(dronesResult.value) ? dronesResult.value : [];

        const formatItem = (item, itemType, idField, typeField, snField) => ({
            'Item Type': itemType,
            'Sub-Type': item[typeField] || 'N/A',
            'Serial Number / ID': item[snField || idField] || 'N/A',
            'Status': item.status || 'N/A',
            'Assigned To (ID)': item.assigned_to || 'Unassigned',
            'Last Signed By': item.last_signed_by || '',
        });

        data = [
          ...weapons.map(w => formatItem(w, 'Weapon', 'weapon_id', 'weapon_type')),
          ...gear.map(g => formatItem(g, 'Serialized Gear', 'gear_id', 'gear_type')),
          ...drones.map(d => formatItem(d, 'Drone Set', 'id', 'set_type', 'set_serial_number')),
        ];
        filename = `${divisionName}_Serialized_Items`;
        headers = ['Item Type', 'Sub-Type', 'Serial Number / ID', 'Status', 'Assigned To (ID)', 'Last Signed By'];
      } else { // Equipment
        const equipmentResult = await Equipment.filter({ division_name: divisionName }).catch(() => []);
        data = Array.isArray(equipmentResult) ? equipmentResult : [];
        filename = `${divisionName}_Equipment`;
      }
      
      const csvContent = convertToCSV(data, headers);
      downloadCSV(csvContent, filename);
      setExportStatus(`${filename.replace(/_/g, ' ')} exported!`);

    } catch (error) {
      setExportStatus(`Error exporting for ${divisionName}.`);
      throw error;
    }
    setTimeout(() => setIsExporting(false), 2000);
  };
  
  const handleDownloadAllAsZip = async () => {
    setIsExporting(true);
    setExportStatus("Generating ZIP archive with all reports...");

    try {
      const response = await exportAllData();
      
      if (response.status === 200 && response.data.zip_base64) {
        const base64String = response.data.zip_base64;
        const byteCharacters = atob(base64String);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        
        const blob = new Blob([byteArray], { type: 'application/zip' });
        
        if (blob.size === 0) {
          throw new Error('Generated ZIP file is empty');
        }
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ARMORY_Complete_Export_${format(new Date(), 'yyyy-MM-dd')}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
        setExportStatus(`ZIP file downloaded successfully! (${(blob.size / 1024).toFixed(1)} KB)`);
      } else {
        const errorDetails = response.data?.error || 'Unknown error from backend.';
        throw new Error(`Failed to generate ZIP file: ${errorDetails}`);
      }
    } catch (error) {
      setExportStatus(`Error creating ZIP file: ${error.message}`);
    }

    setTimeout(() => {
      setIsExporting(false);
      setExportStatus("");
    }, 5000);
  };

  const handleDownloadAll = async () => {
    setIsExporting(true);
    setExportStatus("Starting full export... This will trigger multiple downloads.");

    for (const config of CORE_EXPORTS) {
      setExportStatus(`Exporting ${config.name}...`);
      await new Promise(r => setTimeout(r, 200));
      try {
        await handleCoreExport(config);
      } catch (error) {
        setExportStatus(`Failed to export ${config.name}. Continuing with others...`);
      }
    }
    
    for (const division of divisions) {
        setExportStatus(`Exporting Serialized Items for ${division}...`);
        await new Promise(r => setTimeout(r, 200));
        try {
          await handleDivisionExport(division, 'Serialized');
        } catch (error) {
          setExportStatus(`Failed to export serialized items for ${division}. Continuing...`);
        }

        setExportStatus(`Exporting Equipment for ${division}...`);
        await new Promise(r => setTimeout(r, 200));
        try {
          await handleDivisionExport(division, 'Equipment');
        } catch (error) {
          setExportStatus(`Failed to export equipment for ${division}. Continuing...`);
        }
    }

    setExportStatus("All reports have been downloaded!");
    setTimeout(() => {
      setIsExporting(false);
      setExportStatus("");
    }, 3000);
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Master Export</CardTitle>
          <CardDescription>Download all available CSV reports for the entire system. Choose between multiple files or a single ZIP archive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleDownloadAllAsZip} disabled={isExporting} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            <Archive className="w-5 h-5 mr-2" />
            {isExporting ? 'Creating ZIP Archive...' : 'Download All Reports as ZIP'}
          </Button>
          <Button onClick={handleDownloadAll} disabled={isExporting} size="lg" variant="outline" className="w-full">
            <Package className="w-5 h-5 mr-2" />
            {isExporting ? 'Exporting...' : 'Download All Reports (Multiple Files)'}
          </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Core Data Exports</CardTitle>
          <CardDescription>Download a complete CSV for each primary data category.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {CORE_EXPORTS.map(config => {
            const Icon = config.icon;
            return (
              <Button key={config.name} onClick={() => handleCoreExport(config)} variant="outline" disabled={isExporting} className="flex flex-col h-24 gap-2">
                <Icon className={`w-8 h-8 ${config.color}`} />
                <span className="text-sm font-medium">{config.name}</span>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Division-Specific Reports</CardTitle>
          <CardDescription>Export equipment and serialized item reports for each division.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            divisions.map(division => (
              <Card key={division} className="bg-slate-50">
                <CardHeader className="flex flex-row items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-slate-700"/>
                    <h3 className="text-lg font-semibold text-slate-800">{division}</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleDivisionExport(division, 'Serialized')} variant="secondary" size="sm" disabled={isExporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Export Serialized
                    </Button>
                    <Button onClick={() => handleDivisionExport(division, 'Equipment')} variant="secondary" size="sm" disabled={isExporting}>
                      <Wrench className="w-4 h-4 mr-2" />
                      Export Equipment
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      {exportStatus && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white py-2 px-4 rounded-lg shadow-lg animate-pulse">
          <p className="font-medium">{exportStatus}</p>
        </div>
      )}
    </div>
  );
}
