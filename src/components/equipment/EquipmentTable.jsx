
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Trash2, ArrowUpDown } from "lucide-react";
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

const conditionColors = {
  functioning: "bg-green-100 text-green-800 border-green-200",
  not_functioning: "bg-red-100 text-red-800 border-red-200",
};

export default function EquipmentTable({
  equipment = [],
  soldiers = [],
  onEdit = () => {},
  onDelete = () => {},
  isLoading,
  sortConfig = { key: null, direction: 'asc' },
  onSort = () => {},
  selectedItems = [],
  onSelectItem = () => {},
  onSelectAll = () => {}
}) {

  const getSoldierName = (soldierID) => {
    const safeSoldiers = Array.isArray(soldiers) ? soldiers : [];
    if (!soldierID) return <span className="text-blue-600 font-medium">In Division Storage</span>;
    const soldier = safeSoldiers.find(s => s && s.soldier_id === soldierID);
    return soldier ? `${soldier.first_name} ${soldier.last_name}` : <span className="text-amber-600">Unknown Soldier</span>;
  };

  const getSortIcon = (column, currentSortConfig) => {
    if (currentSortConfig?.key !== column) return <ArrowUpDown className="w-4 h-4 ml-2 opacity-30" />;
    return currentSortConfig.direction === 'asc' ? '▲' : '▼';
  };

  // SortableHeader component expects to be wrapped by TableHead
  const SortableHeader = ({ children, column, sortConfig, onSort }) => (
    <Button variant="ghost" onClick={() => onSort(column)} className="px-2 py-1 h-auto">
      {children}
      <span className="ml-2">{getSortIcon(column, sortConfig)}</span>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array(5).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const safeEquipment = Array.isArray(equipment) ? equipment : [];

  if (safeEquipment.length === 0) {
    return <div className="text-center py-12 text-slate-500">No equipment found.</div>;
  }

  return (
    <div className="overflow-x-auto relative">
      <Table>
        <TableHeader className="bg-slate-50 sticky top-0 z-10">
          <TableRow>
            <TableHead className="w-12 px-4 bg-slate-50">
              <Checkbox
                checked={selectedItems.length === safeEquipment.length && safeEquipment.length > 0}
                indeterminate={selectedItems.length > 0 && selectedItems.length < safeEquipment.length}
                onCheckedChange={(checked) => onSelectAll(checked)}
              />
            </TableHead>
            <TableHead className="w-48 bg-slate-50">
              <SortableHeader column="equipment_type" sortConfig={sortConfig} onSort={onSort}>Equipment Type</SortableHeader>
            </TableHead>
            <TableHead className="w-40 bg-slate-50">
              <SortableHeader column="serial_number" sortConfig={sortConfig} onSort={onSort}>Serial Number</SortableHeader>
            </TableHead>
            <TableHead className="w-32 bg-slate-50">
              <SortableHeader column="division_name" sortConfig={sortConfig} onSort={onSort}>Division</SortableHeader>
            </TableHead>
            <TableHead className="w-48 bg-slate-50">
              <SortableHeader column="assigned_to" sortConfig={sortConfig} onSort={onSort}>Assigned To</SortableHeader>
            </TableHead>
            <TableHead className="w-24 bg-slate-50">
              <SortableHeader column="quantity" sortConfig={sortConfig} onSort={onSort}>Quantity</SortableHeader>
            </TableHead>
            <TableHead className="w-32 bg-slate-50">
              <SortableHeader column="condition" sortConfig={sortConfig} onSort={onSort}>Condition</SortableHeader>
            </TableHead>
            <TableHead className="w-20 text-right pr-4 bg-slate-50">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {safeEquipment.map((item) => (
            <TableRow key={item.id} className="hover:bg-slate-50">
              <TableCell>
                <Checkbox
                  checked={selectedItems.includes(item.id)}
                  onCheckedChange={() => onSelectItem(item.id)}
                />
              </TableCell>
              <TableCell className="font-medium text-slate-900">{item.equipment_type}</TableCell>
              <TableCell className="font-mono text-sm">{item.serial_number || '-'}</TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {item.division_name || 'No Division'}
                </Badge>
              </TableCell>
              <TableCell>{getSoldierName(item.assigned_to)}</TableCell>
              <TableCell className="text-center font-medium">{item.quantity || 1}</TableCell>
              <TableCell>
                <Badge className={`${conditionColors[item.condition] || 'bg-gray-100 text-gray-800'} border capitalize`}>
                  {item.condition === 'functioning' ? 'Functioning' : 'Not Functioning'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Equipment?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{item.equipment_type}" from {item.division_name}. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(item)} className="bg-red-600 hover:bg-red-700">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
