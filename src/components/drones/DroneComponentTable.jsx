
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

const statusColors = {
  Operational: "bg-green-100 text-green-800 border-green-200",
  Maintenance: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Damaged: "bg-red-100 text-red-800 border-red-200",
  Missing: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function DroneComponentTable({
  components,
  droneSets,
  onEdit,
  onDelete,
  isLoading,
  selectedItems = [],
  onSelectItem = () => {},
  onSelectAll = () => {},
  currentUser = null
}) {

  if (isLoading) {
    return (
      <div className="p-4">
        {Array(5).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full mb-2" />
        ))}
      </div>
    );
  }

  if (components.length === 0) {
    return <div className="text-center py-12 text-slate-500">No drone components found.</div>;
  }

  // The previous allSelected and someSelected variables are replaced by direct calculations in JSX.

  const allSets = Array.isArray(droneSets) ? droneSets : []; // New line as per outline

  const findAssignedSet = (componentId) => {
    // Keep existing code for findAssignedSet
    if (!Array.isArray(droneSets)) return null;
    return droneSets.find(set => 
      set.components && Object.values(set.components).includes(componentId)
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 sticky top-0 left-0 z-40 bg-slate-50 px-4">
            <Checkbox
              checked={selectedItems.length === components.length && components.length > 0}
              indeterminate={selectedItems.length > 0 && selectedItems.length < components.length}
              onCheckedChange={onSelectAll}
            />
          </TableHead>
          <TableHead className="w-48 sticky top-0 left-12 z-40 bg-slate-50">Component ID</TableHead>
          <TableHead className="sticky top-0 z-20 bg-slate-50">Component Type</TableHead>
          <TableHead className="sticky top-0 z-20 bg-slate-50">Status</TableHead>
          <TableHead className="sticky top-0 z-20 bg-slate-50">Assigned to Set</TableHead>
          <TableHead className="text-right sticky top-0 z-20 bg-slate-50">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {components.map((component) => { // Changed map variable from 'c' to 'component'
          const assignedSet = findAssignedSet(component.id);
          return (
            <TableRow key={component.id} className="group hover:bg-slate-50">
              <TableCell className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-4">
                <Checkbox
                  checked={selectedItems.includes(component.id)}
                  onCheckedChange={() => onSelectItem(component.id)}
                />
              </TableCell>
              <TableCell className="font-mono sticky left-12 z-10 bg-white group-hover:bg-slate-50">{component.component_id}</TableCell>
              <TableCell>{component.component_type}</TableCell>
              <TableCell>
                <Badge className={`${statusColors[component.status] || 'bg-gray-100 text-gray-800 border-gray-200'} border`}>
                  {component.status || 'Unknown'}
                </Badge>
              </TableCell>
              <TableCell>
                {assignedSet ? (
                  <span className="font-mono text-xs">{assignedSet.set_serial_number}</span>
                ) : (
                  <span className="text-slate-500">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(component)}><Edit className="w-4 h-4" /></Button>
                  {(currentUser?.permissions?.['equipment.delete'] || currentUser?.role === 'admin') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => onDelete(component)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
