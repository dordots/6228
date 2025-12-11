
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronUp, ChevronDown, ChevronsUpDown, Target, Binoculars, Plane, Edit, Trash2, UserCheck, UserCog, History, Package, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getArmoryStatusDisplay } from "@/lib/armoryStatus";
import { generateEquipmentFormHTML } from "@/utils/equipmentFormGenerator";

const statusColors = {
  expected: "bg-yellow-100 text-yellow-800 border-yellow-200",
  arrived: "bg-green-100 text-green-800 border-green-200"
};

const renderDepositIndicator = (item) => {
  if (!item || item.armory_status !== 'in_deposit') return null;
  const display = getArmoryStatusDisplay(item.armory_status, item.deposit_location);
  if (!display) return null;

  const toneClass = display.tone === 'naura' ? 'text-indigo-700' : 'text-amber-600';

  return (
    <span className={`ml-2 text-[11px] font-semibold ${toneClass}`}>
      [{display.label}]
    </span>
  );
};

const AllEquipmentPopover = ({ soldier, weapons, gear, drones, equipment }) => {
  if (!soldier) return null;

  const assignedWeapons = (weapons || []).filter(w => w && w.assigned_to === soldier.soldier_id);
  const assignedGear = (gear || []).filter(g => g && g.assigned_to === soldier.soldier_id);
  const assignedDrones = (drones || []).filter(d => d && d.assigned_to === soldier.soldier_id);
  const assignedEquipment = (equipment || []).filter(eq => eq && eq.assigned_to === soldier.soldier_id);

  const totalItems = assignedWeapons.length + assignedGear.length + assignedDrones.length + assignedEquipment.length;

  if (totalItems === 0) {
    return <span className="text-slate-500">-</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-auto px-2 py-1 text-xs">
          {totalItems} item(s)
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] max-h-[80vh] p-0" align="end" side="left">
        <div className="p-4 border-b bg-white sticky top-0 z-10">
          <h4 className="font-medium leading-none text-slate-900">Assigned Equipment</h4>
          <p className="text-sm text-muted-foreground">
            For {soldier.first_name} {soldier.last_name} ({totalItems} items total)
          </p>
        </div>
        <div className="overflow-y-auto max-h-[60vh] p-4 space-y-4">
          {assignedWeapons.length > 0 && (
            <div>
              <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-red-600"/> 
                Weapons ({assignedWeapons.length})
              </h5>
              <div className="space-y-1 pl-1">
                {assignedWeapons.map(item => (
                  <div key={`w-${item.id}`} className="flex justify-between items-center text-xs py-1">
                    <div className="flex-1">
                      <span className="text-slate-700 font-medium">{item.weapon_type}</span>
                      {renderDepositIndicator(item)}
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">{item.weapon_id}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {assignedGear.length > 0 && (
            <div>
              <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Binoculars className="w-4 h-4 text-purple-600"/> 
                Serialized Gear ({assignedGear.length})
              </h5>
              <div className="space-y-1 pl-1">
                {assignedGear.map(item => (
                  <div key={`g-${item.id}`} className="flex justify-between items-center text-xs py-1">
                    <div className="flex-1">
                      <span className="text-slate-700 font-medium">{item.gear_type}</span>
                      {renderDepositIndicator(item)}
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">{item.gear_id}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {assignedDrones.length > 0 && (
            <div>
              <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Plane className="w-4 h-4 text-blue-600"/> 
                Drone Sets ({assignedDrones.length})
              </h5>
              <div className="space-y-1 pl-1">
                {assignedDrones.map(item => (
                  <div key={`d-${item.id}`} className="flex justify-between items-center text-xs py-1">
                    <div className="flex-1">
                      <span className="text-slate-700 font-medium">{item.set_type} Set</span>
                      {renderDepositIndicator(item)}
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">{item.set_serial_number}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {assignedEquipment.length > 0 && (
            <div>
              <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Package className="w-4 h-4 text-green-600"/> 
                Standard Equipment ({assignedEquipment.length})
              </h5>
              <div className="space-y-1 pl-1">
                {assignedEquipment.map(item => (
                  <div key={`eq-${item.id}`} className="flex justify-between items-center text-xs py-1">
                    <div className="flex-1">
                      <span className="text-slate-700 font-medium">{item.equipment_type}</span>
                      <span className="text-slate-500 ml-1">(x{item.quantity})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.serial_number && <Badge variant="secondary" className="font-mono text-xs">{item.serial_number}</Badge>}
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${item.condition === 'functioning' ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}`}
                      >
                        {item.condition}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};


// SkeletonRow component for loading state
const SkeletonRow = () => (
  <TableRow>
    <TableCell className="w-12 px-2"><Skeleton className="h-6 w-6 rounded" /></TableCell> {/* Checkbox */}
    <TableCell className="w-48"><Skeleton className="h-4 w-32" /></TableCell> {/* Name */}
    <TableCell className="w-32"><Skeleton className="h-4 w-24" /></TableCell> {/* Soldier ID */}
    <TableCell className="w-48"><Skeleton className="h-4 w-full" /></TableCell> {/* Email */}
    <TableCell className="w-32"><Skeleton className="h-4 w-24" /></TableCell> {/* Phone */}
    <TableCell className="w-32"><Skeleton className="h-4 w-20" /></TableCell> {/* Division */}
    <TableCell className="w-32"><Skeleton className="h-4 w-20" /></TableCell> {/* Team */}
    <TableCell className="w-32"><Skeleton className="h-4 w-24" /></TableCell> {/* Profession */}
    <TableCell className="w-32"><Skeleton className="h-4 w-28" /></TableCell> {/* Equipment */}
    <TableCell className="w-32"><Skeleton className="h-4 w-20" /></TableCell> {/* Status */}
    <TableCell className="w-48 text-right pr-4"><Skeleton className="h-8 w-full ml-auto" /></TableCell> {/* Actions */}
  </TableRow>
);

export default function SoldierTable({
  soldiers = [],
  weapons = [],
  serializedGear = [],
  droneSets = [],
  equipment = [],
  onEdit,
  onDelete,
  onMarkArrived,
  onShowHistory, // New prop for showing history
  isLoading,
  sortConfig = { key: null, direction: 'asc' },
  onSort = () => {},
  selectedItems = [],
  onSelectItem = () => {},
  onSelectAll = () => {},
  currentUser = null
}) {
  const SortableHeader = ({ column, children, sortConfig, onSort, className = '' }) => {
    const getSortIcon = (column) => {
      if (sortConfig.key !== column) {
        return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
      }
      return sortConfig.direction === 'asc'
        ? <ChevronUp className="w-4 h-4 text-blue-600" />
        : <ChevronDown className="w-4 h-4 text-blue-600" />;
    };

    return (
      <TableHead
        className={`cursor-pointer hover:bg-slate-100 select-none ${className}`}
        onClick={() => onSort(column)}
      >
        <div className="flex items-center gap-1">
          {children}
          {getSortIcon(column)}
        </div>
      </TableHead>
    );
  };

  const getAssignmentIndicators = (soldier) => {
    const assignedWeapons = (weapons || []).filter(w => w && w.assigned_to === soldier.soldier_id);
    const assignedGear = (serializedGear || []).filter(g => g && g.assigned_to === soldier.soldier_id);
    const assignedDrones = (droneSets || []).filter(d => d && d.assigned_to === soldier.soldier_id);

    const hasCompleteDetails = soldier.enlistment_status === 'completed' ||
                              (soldier.email && soldier.phone_number && soldier.street_address);

    return {
      assignedWeapons,
      assignedGear,
      assignedDrones,
      hasCompleteDetails
    };
  };

  const getSoldierEquipment = (soldier) => {
    // Collect all assigned items for this soldier
    const assignedItems = [];

    // Add weapons
    (weapons || [])
      .filter(w => w && w.assigned_to === soldier.soldier_id)
      .forEach(weapon => {
        assignedItems.push({ type: 'Weapon', ...weapon });
      });

    // Add gear
    (serializedGear || [])
      .filter(g => g && g.assigned_to === soldier.soldier_id)
      .forEach(gear => {
        assignedItems.push({ type: 'Gear', ...gear });
      });

    // Add drone sets
    (droneSets || [])
      .filter(d => d && d.assigned_to === soldier.soldier_id)
      .forEach(droneSet => {
        assignedItems.push({ type: 'Drone Set', ...droneSet });
      });

    // Add equipment
    (equipment || [])
      .filter(e => e && e.assigned_to === soldier.soldier_id && (e.quantity || 0) > 0)
      .forEach(eq => {
        assignedItems.push({ type: 'Equipment', ...eq });
      });

    return assignedItems;
  };

  const handleOpenForm = (soldier) => {
    const assignedItems = getSoldierEquipment(soldier);
    const html = generateEquipmentFormHTML(soldier, assignedItems);

    // Create blob URL and open in new tab
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    
    if (!newWindow) {
      alert('Cannot open new window. Please check your popup blocker settings.');
      URL.revokeObjectURL(url);
    } else {
      // Clean up URL after window loads
      newWindow.addEventListener('load', () => {
        URL.revokeObjectURL(url);
      });
    }
  };

  return (
    <Table className="text-xs whitespace-nowrap">
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 px-2 sticky top-0 left-0 z-40 bg-slate-50">
            <Checkbox
              checked={selectedItems.length === soldiers.length && soldiers.length > 0}
              indeterminate={selectedItems.length > 0 && selectedItems.length < soldiers.length}
              onCheckedChange={onSelectAll}
            />
          </TableHead>
          <SortableHeader column="name" sortConfig={sortConfig} onSort={onSort} className="w-52 sticky top-0 left-12 z-40 bg-slate-50 pr-3">Name</SortableHeader>
          <SortableHeader column="soldier_id" sortConfig={sortConfig} onSort={onSort} className="w-44 sticky top-0 z-20 bg-slate-50 pl-10">Personal #</SortableHeader>
          <SortableHeader column="id_number" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">ID Number</SortableHeader>
          <SortableHeader column="email" sortConfig={sortConfig} onSort={onSort} className="w-48 sticky top-0 z-20 bg-slate-50">Email</SortableHeader>
          <SortableHeader column="phone_number" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Phone</SortableHeader>
          <SortableHeader column="city" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">City</SortableHeader>
          <SortableHeader column="street_address" sortConfig={sortConfig} onSort={onSort} className="w-40 sticky top-0 z-20 bg-slate-50">Street</SortableHeader>
          <SortableHeader column="division_name" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Division</SortableHeader>
          <SortableHeader column="team_name" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Team</SortableHeader>
          <SortableHeader column="crew" sortConfig={sortConfig} onSort={onSort} className="w-28 sticky top-0 z-20 bg-slate-50">Crew</SortableHeader>
          <SortableHeader column="profession" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Profession</SortableHeader>
          <SortableHeader column="secondary_profession" sortConfig={sortConfig} onSort={onSort} className="w-36 sticky top-0 z-20 bg-slate-50">Secondary Profession</SortableHeader>
          <SortableHeader column="sex" sortConfig={sortConfig} onSort={onSort} className="w-24 sticky top-0 z-20 bg-slate-50">Sex</SortableHeader>
          <SortableHeader column="marital_status" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Marital Status</SortableHeader>
          <SortableHeader column="date_of_birth" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Date of Birth</SortableHeader>
          <SortableHeader column="trainings" sortConfig={sortConfig} onSort={onSort} className="w-40 sticky top-0 z-20 bg-slate-50">Trainings</SortableHeader>
          <SortableHeader column="driving_license" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Driving License</SortableHeader>
          <SortableHeader column="driving_license_type" sortConfig={sortConfig} onSort={onSort} className="w-36 sticky top-0 z-20 bg-slate-50">License Type</SortableHeader>
          <SortableHeader column="equipment" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Equipment</SortableHeader>
          <SortableHeader column="enlistment_status" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Status</SortableHeader>
          <TableHead className="w-48 text-right pr-4 sticky top-0 z-20 bg-slate-50">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)
        ) : soldiers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={11} className="h-24 text-center">
              <p className="text-slate-500">No soldiers found</p>
            </TableCell>
          </TableRow>
        ) : (
          soldiers.map((soldier) => {
            const indicators = getAssignmentIndicators(soldier);
            const canDelete = !indicators.assignedWeapons.length && !indicators.assignedGear.length && !indicators.assignedDrones.length;

            return (
              <TableRow key={soldier.id} className="group hover:bg-slate-50 h-12">
                <TableCell className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-2">
                  <Checkbox
                    checked={selectedItems.includes(soldier.id)}
                    onCheckedChange={() => onSelectItem(soldier.id)}
                  />
                </TableCell>
                <TableCell className="sticky left-12 z-10 bg-white group-hover:bg-slate-50 font-medium text-slate-800 pr-4 max-w-[180px]">
                  <div className="truncate">{soldier.first_name} {soldier.last_name}</div>
                </TableCell>
                <TableCell className="font-mono whitespace-pre pl-10 pr-2 min-w-[140px] ml-40">{soldier.soldier_id}</TableCell>
                <TableCell className="text-slate-600">{soldier.id_number || '-'}</TableCell>
                <TableCell className="text-slate-600">
                  <div className="max-w-40 truncate" title={soldier.email}>
                    {soldier.email || '-'}
                  </div>
                </TableCell>
                <TableCell className="text-slate-600">{soldier.phone_number || '-'}</TableCell>
                <TableCell className="text-slate-600">{soldier.city || '-'}</TableCell>
                <TableCell className="text-slate-600">{soldier.street_address || '-'}</TableCell>
                <TableCell className="text-slate-600">{soldier.division_name || '-'}</TableCell>
                <TableCell>
                  {soldier.team_name && <Badge variant="outline" className="text-xs">{soldier.team_name}</Badge>}
                </TableCell>
                <TableCell className="text-slate-600">{soldier.crew || '-'}</TableCell>
                <TableCell className="text-slate-600">{soldier.profession || '-'}</TableCell>
                <TableCell className="text-slate-600">{soldier.secondary_profession || '-'}</TableCell>
                <TableCell className="text-slate-600">{soldier.sex || '-'}</TableCell>
                <TableCell className="text-slate-600">{soldier.marital_status || '-'}</TableCell>
                <TableCell className="text-slate-600">
                  {soldier.date_of_birth
                    ? (() => {
                        const d = new Date(soldier.date_of_birth);
                        return isNaN(d.getTime()) ? soldier.date_of_birth : d.toLocaleDateString('en-GB');
                      })()
                    : '-'}
                </TableCell>
                <TableCell className="text-slate-600 truncate max-w-40" title={Array.isArray(soldier.trainings) ? soldier.trainings.join(', ') : soldier.trainings}>
                  {Array.isArray(soldier.trainings) ? (soldier.trainings.length ? soldier.trainings.join(', ') : '-') : (soldier.trainings || '-')}
                </TableCell>
                <TableCell className="text-slate-600">{soldier.driving_license || '-'}</TableCell>
                <TableCell className="text-slate-600">{soldier.driving_license_type || '-'}</TableCell>
                <TableCell>
                  <AllEquipmentPopover 
                    soldier={soldier} 
                    weapons={weapons} 
                    gear={serializedGear} 
                    drones={droneSets} 
                    equipment={equipment} 
                  />
                </TableCell>
                <TableCell>
                  <Badge className={`${statusColors[soldier.enlistment_status || 'expected']} border font-medium`}>
                    {(soldier.enlistment_status || 'expected').toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right pr-2">
                  <div className="flex items-center justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleOpenForm(soldier)} 
                      className="h-8"
                      title="Open equipment form"
                    >
                      <FileText className="w-3 h-3 mr-2" /> Form
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onShowHistory(soldier)} className="h-8">
                      <History className="w-3 h-3 mr-2" /> History
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8">Actions</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(soldier.enlistment_status === 'expected') && (
                          <DropdownMenuItem onClick={() => onMarkArrived(soldier)}>
                            <UserCheck className="w-3 h-3 mr-2" /> Mark as Arrived / Assign
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onEdit(soldier)}>
                          <Edit className="w-3 h-3 mr-2" /> Edit Soldier
                        </DropdownMenuItem>
                        {(currentUser?.permissions?.['personnel.delete'] || currentUser?.role === 'admin') && canDelete && (
                          <DropdownMenuItem
                            className="text-red-600 focus:bg-red-50 focus:text-red-700"
                            onClick={() => onDelete(soldier)}
                          >
                            <Trash2 className="w-3 h-3 mr-2" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
