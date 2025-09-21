
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, ArrowRight, ChevronUp, ChevronDown, Eye, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

const statusColors = {
  Operational: "bg-green-100 text-green-800 border-green-200",
  Maintenance: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Damaged: "bg-red-100 text-red-800 border-red-200",
};

export default function DroneSetTable({
  droneSets = [],
  soldiers = [],
  onEdit,
  onDelete,
  onReassign,
  onViewDetails,
  isLoading,
  selectedItems = [],
  onSelectItem = () => {},
  onSelectAll = () => {}
}) {

  // Sortable Header Component is removed as per the outline.

  // Skeleton Row Component
  const SkeletonRow = () => (
    <TableRow>
      <TableCell className="w-12 px-4"><Skeleton className="h-4 w-4" /></TableCell> {/* Checkbox */}
      <TableCell className="w-48"><Skeleton className="h-4 w-3/4" /></TableCell> {/* For Set Serial */}
      <TableCell className="w-40"><Skeleton className="h-4 w-2/3" /></TableCell> {/* For Type */}
      <TableCell className="w-48"><Skeleton className="h-4 w-3/4" /></TableCell> {/* For Division */}
      <TableCell className="w-48"><Skeleton className="h-4 w-3/4" /></TableCell> {/* For Assigned To */}
      <TableCell className="w-36"><Skeleton className="h-4 w-1/2" /></TableCell> {/* For Status */}
      <TableCell className="w-48"><Skeleton className="h-4 w-2/3" /></TableCell> {/* For Components (New) */}
      <TableCell className="w-20 text-right pr-4">
        <div className="flex justify-end gap-1">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <Table className="overflow-auto max-h-[70vh]"> {/* Apply scrolling and max-height directly to the Table component */}
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 px-4 sticky top-0 left-0 z-40 bg-slate-50">
            <Checkbox
              checked={selectedItems.length === droneSets.length && droneSets.length > 0}
              indeterminate={selectedItems.length > 0 && selectedItems.length < droneSets.length}
              onCheckedChange={onSelectAll}
            />
          </TableHead>
          <TableHead className="w-48 sticky top-0 left-12 z-40 bg-slate-50">Set Serial Number</TableHead>
          <TableHead className="sticky top-0 z-20 bg-slate-50">Set Type</TableHead>
          <TableHead className="sticky top-0 z-20 bg-slate-50">Division</TableHead>
          <TableHead className="sticky top-0 z-20 bg-slate-50">Assigned To</TableHead>
          <TableHead className="sticky top-0 z-20 bg-slate-50">Status</TableHead>
          <TableHead className="sticky top-0 z-20 bg-slate-50">Components</TableHead>
          <TableHead className="text-right sticky top-0 z-20 bg-slate-50">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)
        ) : !Array.isArray(droneSets) || droneSets.length === 0 ? (
          <TableRow>
            {/* colSpan updated to 8 for the new "Components" column */}
            <TableCell colSpan={8} className="text-center h-24 text-slate-500">
              No drone sets found.
            </TableCell>
          </TableRow>
        ) : (
          droneSets.map(droneSet => {
            const assignedSoldier = Array.isArray(soldiers) ? soldiers.find(s => s && s.soldier_id === droneSet.assigned_to) : null;
            return (
              <TableRow key={droneSet.id} className="hover:bg-slate-50 group">
                <TableCell className="px-4 sticky left-0 z-10 bg-white group-hover:bg-slate-50">
                  <Checkbox
                    checked={selectedItems.includes(droneSet.id)}
                    onCheckedChange={() => onSelectItem(droneSet.id)}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs sticky left-12 z-10 bg-white group-hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span>{droneSet.set_serial_number}</span>
                    {droneSet.comments && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center justify-center"> {/* Added flex for consistent alignment if button had content */}
                            <MessageSquare className="w-4 h-4 text-blue-500 hover:text-blue-600" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64">
                          <p className="text-sm">{droneSet.comments}</p>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div>{droneSet.set_type}</div>
                  {droneSet.armory_status === 'in_deposit' && (
                    <Badge variant="outline" className="mt-1 text-xs font-normal text-amber-800 bg-amber-50 border-amber-200">
                      In Deposit
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{droneSet.division_name || <span className="text-slate-500">N/A</span>}</TableCell>
                <TableCell>
                  {assignedSoldier ? `${assignedSoldier.first_name} ${assignedSoldier.last_name}` :
                   (droneSet.assigned_to ? <span className="text-slate-500 italic">Unlinked ID</span> : <span className="text-slate-500">Unassigned</span>)}
                </TableCell>
                <TableCell>
                  <Badge className={`${statusColors[droneSet.status] || 'bg-gray-100 text-gray-800 border-gray-200'} border`}>{droneSet.status || 'Unknown'}</Badge>
                </TableCell>
                {/* Placeholder for Components column - data to be implemented */}
                <TableCell>
                  <span className="text-slate-400 italic">N/A</span>
                </TableCell>
                <TableCell className="text-right pr-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(droneSet)}
                      className="text-gray-600 hover:text-gray-700"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(droneSet)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReassign(droneSet)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Reassign Drone Set"
                    >
                      Reassign
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Drone Set?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the set "{droneSet.set_serial_number}". This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(droneSet)} className="bg-red-600 hover:bg-red-700">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
