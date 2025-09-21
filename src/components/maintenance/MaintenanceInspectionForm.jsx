import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Target, Binoculars, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import SignatureCanvas from '../soldiers/SignatureCanvas';
import { format } from "date-fns";

export default function MaintenanceInspectionForm({ soldier, assignedWeapons, assignedGear, onSubmit, onCancel, isLoading }) {
  const [inspectionStatuses, setInspectionStatuses] = useState({ weapons: {}, gear: {} });
  const [signature, setSignature] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalItems = assignedWeapons.length + assignedGear.length;
  const inspectedItems = Object.keys(inspectionStatuses.weapons).length + Object.keys(inspectionStatuses.gear).length;
  const isFormComplete = totalItems > 0 && totalItems === inspectedItems && signature;

  const handleStatusChange = (type, id, status) => {
    setInspectionStatuses(prev => ({
      ...prev,
      [type]: { ...prev[type], [id]: status }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormComplete) {
      alert("Please check all items and provide a signature before submitting.");
      return;
    }
    setIsSubmitting(true);
    await onSubmit(inspectionStatuses);
    setIsSubmitting(false);
  };

  const renderItem = (item, type) => {
    const id = item.id;
    const typePlural = type === 'weapon' ? 'weapons' : 'gear';
    const status = inspectionStatuses[typePlural][id];

    return (
      <div key={id} className="p-4 border rounded-lg bg-white shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold">{item.weapon_type || item.gear_type}</p>
            <p className="text-sm text-slate-500">ID: {item.weapon_id || item.gear_id}</p>
            {item.last_checked_date && (
                <p className="text-xs text-slate-500 mt-1">Last Checked: {format(new Date(item.last_checked_date), 'PPP')}</p>
            )}
          </div>
          <RadioGroup 
            value={status} 
            onValueChange={(value) => handleStatusChange(typePlural, id, value)}
            className="flex gap-4"
          >
            <Label htmlFor={`${type}-${id}-func`} className={`flex items-center gap-2 p-2 rounded-md cursor-pointer border-2 ${status === 'functioning' ? 'border-green-500 bg-green-50' : 'border-transparent'}`}>
              <RadioGroupItem value="functioning" id={`${type}-${id}-func`} className="sr-only" />
              <ThumbsUp className="w-5 h-5 text-green-600" />
              <span className="font-medium text-sm">Functioning</span>
            </Label>
            <Label htmlFor={`${type}-${id}-not-func`} className={`flex items-center gap-2 p-2 rounded-md cursor-pointer border-2 ${status === 'not_functioning' ? 'border-red-500 bg-red-50' : 'border-transparent'}`}>
              <RadioGroupItem value="not_functioning" id={`${type}-${id}-not-func`} className="sr-only" />
              <ThumbsDown className="w-5 h-5 text-red-600" />
              <span className="font-medium text-sm">Not Functioning</span>
            </Label>
          </RadioGroup>
        </div>
      </div>
    );
  };
  
  if (totalItems === 0 && !isLoading) {
    return (
       <Card>
        <CardHeader>
          <CardTitle>{soldier.first_name} {soldier.last_name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-slate-600 py-8">This soldier has no equipment assigned to them.</p>
        </CardContent>
        <CardFooter>
            <Button variant="outline" onClick={onCancel}>Back</Button>
        </CardFooter>
       </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Inspecting Equipment for {soldier.first_name} {soldier.last_name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {assignedWeapons.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2"><Target className="w-5 h-5" /> Assigned Weapons</h3>
              <div className="space-y-3">{assignedWeapons.map(w => renderItem(w, 'weapon'))}</div>
            </div>
          )}
          {assignedGear.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2"><Binoculars className="w-5 h-5" /> Assigned Serialized Gear</h3>
              <div className="space-y-3">{assignedGear.map(g => renderItem(g, 'gear'))}</div>
            </div>
          )}
           <div className="space-y-4 pt-6 border-t">
              <h3 className="font-semibold text-lg">Inspector's Signature</h3>
              <SignatureCanvas onSignatureChange={setSignature} soldierName={`${soldier?.first_name} ${soldier?.last_name}`} />
           </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
            <div>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
            </div>
            <div className="flex items-center gap-4">
                <p className="text-sm text-slate-600">{inspectedItems} of {totalItems} items checked</p>
                <Button type="submit" disabled={!isFormComplete || isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit Inspection
                </Button>
            </div>
        </CardFooter>
      </Card>
    </form>
  );
}