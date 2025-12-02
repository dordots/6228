
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox"; // Keep Checkbox as it might be used internally or in other parts not specified
import { Edit, Trash2, MoreHorizontal, MessageSquare, ArrowRightLeft } from "lucide-react"; // Updated imports based on outline and new features
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ArmoryStatusBadge from "@/components/common/ArmoryStatusBadge";

// getSortIcon and SortableHeaderContent are removed as sorting is no longer part of the outline's header.

const SkeletonRow = () => (
  <TableRow>
    {/* Updated SkeletonRow to match the new 10 columns */}
    <TableCell className="w-12 px-4"><Skeleton className="h-4 w-4" /></TableCell> {/* Checkbox */}
    <TableCell><Skeleton className="h-4 w-24" /></TableCell> {/* Gear ID */}
    <TableCell><Skeleton className="h-4 w-32" /></TableCell> {/* Type */}
    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell> {/* Status */}
    <TableCell><Skeleton className="h-4 w-28" /></TableCell> {/* Assigned To */}
    <TableCell><Skeleton className="h-4 w-28" /></TableCell> {/* Division */}
    <TableCell><Skeleton className="h-4 w-20" /></TableCell> {/* Armory Status */}
    <TableCell><Skeleton className="h-4 w-24" /></TableCell> {/* Last Signed By */}
    <TableCell><Skeleton className="h-4 w-40" /></TableCell> {/* Comments */}
    <TableCell className="text-center pr-4"><Skeleton className="h-8 w-8 rounded-full mx-auto" /></TableCell> {/* Actions */}
  </TableRow>
);

export default function GearTable({
  gear = [],
  soldiers = [],
  onEdit,
  onDelete,
  onReassign,
  isLoading,
  onViewComment, // New prop for viewing comments
  isAdminOrManager, // New prop for broader permissions
  permissions = { canEdit: false, canDelete: false, canReassign: false }, // New prop for granular permissions
  selectedItems = [],
  onSelectItem = () => {},
  onSelectAll = () => {},
  currentUser = null // Add currentUser to check admin role
}) {
  // Helper function to get soldier's full name, as implied by the outline
  const getSoldierName = (soldierId) => {
    // Check if soldierId is null, empty string, or undefined
    if (!soldierId || soldierId === null || soldierId === '') {
      return null;
    }
    const soldier = Array.isArray(soldiers) ? soldiers.find(s => s.soldier_id === soldierId) : null;
    return soldier ? `${soldier.first_name} ${soldier.last_name}` : null;
  };

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {/* TableHead elements are replaced as per the outline */}
            <TableHead className="w-12 px-4">
              <Checkbox
                checked={selectedItems.length === gear.length && gear.length > 0}
                indeterminate={selectedItems.length > 0 && selectedItems.length < gear.length}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead>Gear ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Division</TableHead>
            <TableHead>Armory Status</TableHead>
            <TableHead>Last Signed By</TableHead>
            <TableHead>Comments</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)
          ) : !Array.isArray(gear) || gear.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center h-24 text-slate-500">
                No gear found.
              </TableCell>
            </TableRow>
          ) : (
            gear.map(gearItem => {
              const assignedSoldierName = getSoldierName(gearItem.assigned_to);
              return (
                <TableRow key={gearItem.id} className="hover:bg-slate-50 group">
                  {/* TableCell contents and order are adjusted to match the new header */}
                  <TableCell className="w-12 px-4">
                    <Checkbox
                      checked={selectedItems.includes(gearItem.id)}
                      onCheckedChange={() => onSelectItem(gearItem.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{gearItem.gear_id}</TableCell>
                  <TableCell>{gearItem.gear_type || 'Unknown'}</TableCell>
                  <TableCell>
                    {(() => {
                      const statusConfig = {
                        functioning: {
                          label: 'FUNCTIONING',
                          className: 'bg-green-100 text-green-800 border-green-200'
                        },
                        not_functioning: {
                          label: 'NOT FUNCTIONING',
                          className: 'bg-red-100 text-red-800 border-red-200'
                        },
                        missing: {
                          label: 'MISSING',
                          className: 'bg-slate-200 text-slate-800 border-slate-300'
                        }
                      };
                      const config = statusConfig[gearItem.status] || {
                        label: (gearItem.status || 'UNKNOWN').toString().toUpperCase(),
                        className: 'bg-slate-100 text-slate-700 border-slate-200'
                      };
                      return (
                        <Badge className={`${config.className} border text-xs font-medium`}>
                          {config.label}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {assignedSoldierName ? (
                      assignedSoldierName
                    ) : gearItem.last_signed_by ? (
                      <span className="text-slate-500">Unassigned (Last: {gearItem.last_signed_by})</span>
                    ) : (
                      <span className="text-slate-500">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>{gearItem.division_name || 'N/A'}</TableCell>
                  <TableCell>
                    <ArmoryStatusBadge
                      status={gearItem.armory_status}
                      depositLocation={gearItem.deposit_location}
                    />
                  </TableCell>
                  <TableCell>{gearItem.last_signed_by || 'N/A'}</TableCell>
                  <TableCell className="max-w-xs">
                    {gearItem.comments ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="truncate text-sm text-slate-700"
                          title={gearItem.comments}
                        >
                          {gearItem.comments}
                        </span>
                        {typeof onViewComment === 'function' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onViewComment(gearItem)}
                            className="h-8 w-8"
                            aria-label="View full comment"
                          >
                            <MessageSquare className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(isAdminOrManager || permissions.canEdit) && (
                            <DropdownMenuItem onClick={() => onEdit(gearItem)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                          )}
                          {(isAdminOrManager || permissions.canReassign) && (
                            <DropdownMenuItem onClick={() => onReassign(gearItem)}>
                              <ArrowRightLeft className="mr-2 h-4 w-4" /> Reassign
                            </DropdownMenuItem>
                          )}
                          {(permissions['equipment.delete'] || currentUser?.role === 'admin') && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 focus:bg-red-50 focus:text-red-600"
                                onClick={() => onDelete(gearItem)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </>
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
    </div>
  );
}
