
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronUp, ChevronDown, ChevronsUpDown, Target, Binoculars, Plane, Edit, Trash2, UserCheck, UserCog, History, Package } from "lucide-react";
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

const statusColors = {
  expected: "bg-yellow-100 text-yellow-800 border-yellow-200",
  arrived: "bg-green-100 text-green-800 border-green-200"
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
                      {item.armory_status === 'in_deposit' && (
                        <span className="ml-2 text-amber-600 font-semibold">[IN DEPOSIT]</span>
                      )}
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
                      {item.armory_status === 'in_deposit' && (
                        <span className="ml-2 text-amber-600 font-semibold">[IN DEPOSIT]</span>
                      )}
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
                      {item.armory_status === 'in_deposit' && (
                        <span className="ml-2 text-amber-600 font-semibold">[IN DEPOSIT]</span>
                      )}
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
  onUpdateDetails,
  onShowHistory, // New prop for showing history
  isLoading,
  sortConfig = { key: null, direction: 'asc' },
  onSort = () => {},
  selectedItems = [],
  onSelectItem = () => {},
  onSelectAll = () => {}
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
          <SortableHeader column="name" sortConfig={sortConfig} onSort={onSort} className="w-48 sticky top-0 left-12 z-40 bg-slate-50">Name</SortableHeader>
          <SortableHeader column="soldier_id" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Soldier ID</SortableHeader>
          <SortableHeader column="email" sortConfig={sortConfig} onSort={onSort} className="w-48 sticky top-0 z-20 bg-slate-50">Email</SortableHeader>
          <SortableHeader column="phone_number" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Phone</SortableHeader>
          <SortableHeader column="division_name" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Division</SortableHeader>
          <SortableHeader column="team_name" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Team</SortableHeader>
          <SortableHeader column="profession" sortConfig={sortConfig} onSort={onSort} className="w-32 sticky top-0 z-20 bg-slate-50">Profession</SortableHeader>
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
                <TableCell className="sticky left-12 z-10 bg-white group-hover:bg-slate-50 font-medium text-slate-800">
                  {soldier.first_name} {soldier.last_name}
                </TableCell>
                <TableCell className="font-mono">{soldier.soldier_id}</TableCell>
                <TableCell className="text-slate-600">
                  <div className="max-w-40 truncate" title={soldier.email}>
                    {soldier.email || '-'}
                  </div>
                </TableCell>
                <TableCell className="text-slate-600">{soldier.phone_number || '-'}</TableCell>
                <TableCell className="text-slate-600">{soldier.division_name || '-'}</TableCell>
                <TableCell>
                  {soldier.team_name && <Badge variant="outline" className="text-xs">{soldier.team_name}</Badge>}
                </TableCell>
                <TableCell className="text-slate-600">{soldier.profession || '-'}</TableCell>
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
                        <DropdownMenuItem onClick={() => onUpdateDetails(soldier)}>
                           <UserCog className="w-3 h-3 mr-2" /> Update Personal Details
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <DropdownMenuItem
                              className="text-red-600 focus:bg-red-50 focus:text-red-700"
                              disabled={!canDelete}
                              onSelect={(e) => e.preventDefault()} // Prevent closing menu
                            >
                               <Trash2 className="w-3 h-3 mr-2" /> Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the soldier record for {soldier.first_name} {soldier.last_name}. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(soldier)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
