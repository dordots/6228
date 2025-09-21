
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  // Removed props related to sorting and selection: sortConfig, onSort, selectedItems, onSelectItem, onSelectAll, currentUser
  isAdminOrManager, // New prop for broader permission checks
  permissions = {}, // New prop for granular permissions
}) {

  // Removed SortableHeader component as sorting is removed from the table headers

  const SkeletonRow = () => (
    <TableRow>
      {/* Skeleton cells adjusted to match the new column structure */}
      <TableCell><Skeleton className="h-4 w-24" /></TableCell> {/* Weapon ID */}
      <TableCell><Skeleton className="h-4 w-32" /></TableCell> {/* Type */}
      <TableCell><Skeleton className="h-4 w-24" /></TableCell> {/* Status */}
      <TableCell><Skeleton className="h-4 w-40" /></TableCell> {/* Assigned To */}
      <TableCell><Skeleton className="h-4 w-24" /></TableCell> {/* Division */}
      <TableCell><Skeleton className="h-4 w-20" /></TableCell> {/* Armory Status */}
      <TableCell><Skeleton className="h-4 w-32" /></TableCell> {/* Deposit Location */}
      <TableCell><Skeleton className="h-4 w-24" /></TableCell> {/* Last Signed By */}
      <TableCell className="text-center"><Skeleton className="h-8 w-8" /></TableCell> {/* Actions */}
    </TableRow>
  );

  return (
    <div className="overflow-auto"> {/* Added wrapper div as per outline */}
      <Table>
        <TableHeader> {/* Removed sticky and bg-slate-50 classes from TableHeader */}
          <TableRow>
            {/* Removed the checkbox TableHead */}
            <TableHead className="w-40">Weapon ID</TableHead> {/* Removed SortableHeader */}
            <TableHead className="w-48">Type</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead className="w-48">Assigned To</TableHead>
            <TableHead className="w-48">Division</TableHead>
            <TableHead className="w-32">Armory Status</TableHead> {/* New column */}
            <TableHead className="w-36">Deposit Location</TableHead> {/* New column for deposit location */}
            <TableHead className="w-36">Last Signed By</TableHead> {/* New column */}
            <TableHead className="w-20 text-center">Actions</TableHead> {/* Changed to text-center */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)
          ) : !Array.isArray(weapons) || weapons.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center h-24 text-slate-500"> {/* Colspan adjusted for 9 columns */}
                No weapons found.
              </TableCell>
            </TableRow>
          ) : (
            weapons.map(weapon => {
              const assignedSoldier = Array.isArray(soldiers) ? soldiers.find(s => s.soldier_id === weapon.assigned_to) : null;
              return (
                <TableRow key={weapon.id} className="hover:bg-slate-50 group">
                  {/* Removed checkbox TableCell */}
                  <TableCell className="font-mono text-xs">{weapon.weapon_id}</TableCell> {/* Removed sticky classes */}
                  <TableCell>{weapon.weapon_type}</TableCell>
                  <TableCell>
                    <Badge variant={weapon.status === 'functioning' ? 'success' : 'destructive'}>
                      {weapon.status === 'functioning' ? 'FUNCTIONING' : 'NOT FUNCTIONING'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {assignedSoldier ? (
                      `${assignedSoldier.first_name} ${assignedSoldier.last_name}`
                    ) : (
                      <span className="text-slate-500">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>{weapon.division_name || 'N/A'}</TableCell>
                  <TableCell> {/* Dedicated cell for Armory Status */}
                    {weapon.armory_status === 'in_deposit' ? (
                      <Badge variant="outline" className="text-xs font-normal text-amber-800 bg-amber-50 border-amber-200">
                        In Deposit
                      </Badge>
                    ) : 'N/A'} {/* Display 'N/A' if not in deposit, or other relevant status */}
                  </TableCell>
                  <TableCell> {/* New cell for Deposit Location */}
                    {weapon.deposit_location ? (
                      <Badge variant="outline" className={`text-xs font-normal ${
                        weapon.deposit_location === 'division_deposit'
                          ? 'text-blue-800 bg-blue-50 border-blue-200'
                          : 'text-purple-800 bg-purple-50 border-purple-200'
                      }`}>
                        {weapon.deposit_location === 'division_deposit' ? 'Division' : 'Armory'}
                      </Badge>
                    ) : 'N/A'}
                  </TableCell>
                  <TableCell>{weapon.last_signed_by || 'N/A'}</TableCell> {/* Dedicated cell for Last Signed By */}
                  {/* Removed Last Checked Date cell */}
                  <TableCell className="text-center pr-4"> {/* Changed to text-center */}
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
                            disabled={!isAdminOrManager && !permissions.can_edit_weapons}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onReassign(weapon)}
                            // Disabled if not manager/admin AND (doesn't have edit weapons OR doesn't have transfer equipment)
                            disabled={!isAdminOrManager && !(permissions.can_edit_weapons || permissions.can_transfer_equipment)}
                          >
                            Reassign
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => onDelete(weapon)}
                            disabled={!isAdminOrManager && !permissions.can_delete_weapons}
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
