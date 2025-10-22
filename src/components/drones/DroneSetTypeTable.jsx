
import React from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Badge } from "@/components/ui/badge";

export default function DroneSetTypeTable({
  droneSetTypes,
  onEdit,
  onDelete,
  isLoading,
  selectedItems,
  onSelectItem,
  onSelectAll,
  isAdminOrManager
}) {
  const [expandedRows, setExpandedRows] = React.useState([]);

  const toggleRow = (id) => {
    setExpandedRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  if (!droneSetTypes || droneSetTypes.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No drone set types found. Add your first type to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="p-3 text-left">
              <Checkbox
                checked={selectedItems.length === droneSetTypes.length && droneSetTypes.length > 0}
                onCheckedChange={onSelectAll}
              />
            </th>
            <th className="p-3 text-left text-sm font-semibold text-slate-700">Type Name</th>
            <th className="p-3 text-left text-sm font-semibold text-slate-700">Component Slots</th>
            <th className="p-3 text-right text-sm font-semibold text-slate-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {droneSetTypes.map((type) => {
            const isExpanded = expandedRows.includes(type.id);
            const slotCount = type.component_slots ? Object.keys(type.component_slots).length : 0;

            return (
              <React.Fragment key={type.id}>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="p-3">
                    <Checkbox
                      checked={selectedItems.includes(type.id)}
                      onCheckedChange={() => onSelectItem(type.id)}
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-slate-900">{type.type_name}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {slotCount} slot{slotCount !== 1 ? 's' : ''}
                      </Badge>
                      {slotCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRow(type.id)}
                          className="h-6 px-2"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(type)}
                        disabled={!isAdminOrManager}
                        className="text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!isAdminOrManager}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the drone set type "{type.type_name}".
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDelete(type)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
                {isExpanded && type.component_slots && (
                  <tr>
                    <td colSpan="4" className="p-0 bg-slate-50">
                      <div className="px-12 py-4 space-y-2">
                        <div className="text-sm font-semibold text-slate-700 mb-3">Component Slots:</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {Object.entries(type.component_slots).map(([slotName, componentType]) => (
                            <div
                              key={slotName}
                              className="flex items-start gap-2 p-2 bg-white rounded border border-slate-200"
                            >
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-700">{slotName}:</div>
                                <div className="text-sm text-slate-600">{componentType}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
