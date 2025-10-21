
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const statusColors = {
  Operational: "bg-green-100 text-green-800 border-green-200",
  Maintenance: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Damaged: "bg-red-100 text-red-800 border-red-200",
  Missing: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function DroneSetDetailsDialog({ droneSet, allComponents, soldiers, open, onOpenChange }) {
  if (!droneSet) return null;

  const assignedSoldier = soldiers.find(s => s.soldier_id === droneSet.assigned_to);
  
  const getComponentDetails = (componentId) => {
    return allComponents.find(c => c.id === componentId);
  };

  const setComponents = droneSet.components ? Object.entries(droneSet.components) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Drone Set Details</DialogTitle>
          <DialogDescription>
            <span className="font-mono bg-slate-100 text-slate-800 px-2 py-1 rounded-md text-sm">
              {droneSet.set_serial_number}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="font-semibold">Set Type</Label>
              <p>{droneSet.set_type}</p>
            </div>
            <div>
              <Label className="font-semibold">Status</Label>
              <p><Badge className={`${statusColors[droneSet.status]} border`}>{droneSet.status}</Badge></p>
            </div>
            <div>
              <Label className="font-semibold">Division</Label>
              <p>{droneSet.division_name || "N/A"}</p>
            </div>
          </div>
          <div>
            <Label className="font-semibold">Assigned To</Label>
            <p>{assignedSoldier ? `${assignedSoldier.first_name} ${assignedSoldier.last_name}` : "Unassigned"}</p>
          </div>

          {droneSet.comments && (
            <div>
              <Label className="font-semibold">Comments</Label>
              <p className="text-sm p-3 bg-slate-50 rounded-md border">{droneSet.comments}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <h4 className="font-semibold text-lg border-b pb-2">Assigned Components</h4>
            {setComponents.length > 0 ? (
                <div className="space-y-3">
                {setComponents.map(([key, componentId]) => {
                    const component = getComponentDetails(componentId);
                    return (
                    <div key={key} className="grid grid-cols-3 gap-4 items-center p-2 rounded-lg bg-slate-50">
                        <div className="capitalize font-medium text-slate-700">{key.replace(/_/g, ' ')}</div>
                        {component ? (
                        <>
                            <div className="col-span-1">
                                <div>{component.component_type}</div>
                                <div className="font-mono text-xs text-slate-500">{component.component_id}</div>
                            </div>
                            <div className="col-span-1">
                                <Badge variant="outline" className={statusColors[component.status]}>{component.status}</Badge>
                            </div>
                        </>
                        ) : (
                        <div className="col-span-2 text-slate-500">Not Assigned</div>
                        )}
                    </div>
                    );
                })}
                </div>
            ) : (
                <p className="text-slate-500">No components are assigned to this set.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
