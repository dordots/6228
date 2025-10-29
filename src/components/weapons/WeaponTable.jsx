
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, MessageSquare } from "lucide-react"; // Removed sorting chevrons, added MessageSquare
import { Skeleton } from "@/components/ui/skeleton";
// Removed 'format' import as 'last_checked_date' column is no longer present
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function WeaponTable({
  weapons = [],
  soldiers = [],
  onEdit,
  onDelete,
  onReassign,
  onViewComment, // New prop for viewing comments
  isLoading,
  isAdminOrManager, // New prop for broader permission checks
  permissions = {}, // New prop for granular permissions
  selectedItems = [],
  onSelectItem = () => {},
  onSelectAll = () => {}
}) {

  // Removed SortableHeader component as sorting is removed from the table headers

  const SkeletonRow = () => (
    <TableRow>
      {/* Skeleton cells adjusted to match the new column structure */}
      <TableCell className="w-12 px-4"><Skeleton className="h-4 w-4" /></TableCell> {/* Checkbox */}
      <TableCell><Skeleton className="h-4 w-24" /></TableCell> {/* Weapon ID */}
      <TableCell><Skeleton className="h-4 w-32" /></TableCell> {/* Type */}
      <TableCell><Skeleton className="h-4 w-40" /></TableCell> {/* Assigned To */}
      <TableCell><Skeleton className="h-4 w-24" /></TableCell> {/* Division */}
      <TableCell><Skeleton className="h-4 w-24" /></TableCell> {/* Status */}
      <TableCell><Skeleton className="h-4 w-20" /></TableCell> {/* Armory Status */}
      <TableCell className="text-center"><Skeleton className="h-8 w-8" /></TableCell> {/* Actions */}
    </TableRow>
  );

  return (
    <div className="overflow-auto"> {/* Added wrapper div as per outline */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 px-4">
              <Checkbox
                checked={selectedItems.length === weapons.length && weapons.length > 0}
                indeterminate={selectedItems.length > 0 && selectedItems.length < weapons.length}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead className="w-40">Weapon ID</TableHead>
            <TableHead className="w-48">Type</TableHead>
            <TableHead className="w-48">Assigned To</TableHead>
            <TableHead className="w-48">Division</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead className="w-32">Armory Status</TableHead>
            <TableHead className="w-20 text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)
          ) : !Array.isArray(weapons) || weapons.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center h-24 text-slate-500">
                No weapons found.
              </TableCell>
            </TableRow>
          ) : (
            weapons.map(weapon => {
              const assignedSoldier = Array.isArray(soldiers) ? soldiers.find(s => s.soldier_id === weapon.assigned_to) : null;
              return (
                <TableRow key={weapon.id} className="hover:bg-slate-50 group">
                  <TableCell className="w-12 px-4">
                    <Checkbox
                      checked={selectedItems.includes(weapon.id)}
                      onCheckedChange={() => onSelectItem(weapon.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{weapon.weapon_id}</TableCell>
                  <TableCell>{weapon.weapon_type}</TableCell>
                  <TableCell>
                    {assignedSoldier ? (
                      `${assignedSoldier.first_name} ${assignedSoldier.last_name}`
                    ) : (
                      <span className="text-slate-500">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>{weapon.division_name || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={weapon.status === 'functioning' ? 'success' : 'destructive'}>
                      {weapon.status === 'functioning' ? 'FUNCTIONING' : 'NOT FUNCTIONING'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {weapon.armory_status === 'in_deposit' ? (
                      <Badge variant="outline" className="text-xs font-normal text-amber-800 bg-amber-50 border-amber-200">
                        In Deposit
                      </Badge>
                    ) : weapon.armory_status === 'with_soldier' ? (
                      <Badge variant="outline" className="text-xs font-normal text-green-800 bg-green-50 border-green-200">
                        With Soldier
                      </Badge>
                    ) : (
                      <span className="text-slate-500">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center pr-4">
                    <div className="flex items-center justify-center gap-1"> {/* Added flex container for actions */}
                      {weapon.comments && ( // Conditionally render comments button
                        <Button variant="ghost" size="icon" onClick={() => onViewComment(weapon)}>
                          <MessageSquare className="w-4 h-4 text-blue-600" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onEdit(weapon)}
                            disabled={!isAdminOrManager && !permissions['equipment.update']}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onReassign(weapon)}
                            // Disabled if not manager/admin AND (doesn't have edit weapons OR doesn't have transfer equipment)
                            disabled={!isAdminOrManager && !(permissions['equipment.update'] || permissions['operations.transfer'])}
                          >
                            Reassign
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => onDelete(weapon)}
                            disabled={!isAdminOrManager && !permissions['equipment.delete']}
                          >
                            Delete
                          </DropdownMenuItem>
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
    </div>
  );
}
