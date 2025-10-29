import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Target, Binoculars, CheckCircle, ShieldCheck, Loader2, Undo2 } from "lucide-react";
import { format } from "date-fns";

export default function SoldierVerificationCard({ soldier, assignedWeapons, assignedGear, isVerified, verificationRecord, onVerify, onUndoVerify, isSelected, onToggleSelect }) {
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isUndoing, setIsUndoing] = React.useState(false);

  const handleVerifyClick = async () => {
    setIsVerifying(true);
    await onVerify();
    setIsVerifying(false);
  };

  const handleUndoClick = async () => {
    setIsUndoing(true);
    await onUndoVerify();
    // isUndoing state will reset when component re-renders after parent state change
  };

  return (
    <Card className={`flex flex-col h-full transition-all duration-300 ${isVerified ? (isSelected ? 'bg-green-100 border-green-400' : 'bg-green-50 border-green-200') : (isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white')}`}>
      <CardHeader>
        <div className="flex items-center gap-3">
            {onToggleSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                className="mt-1"
              />
            )}
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-slate-600" />
            </div>
            <div>
                <CardTitle className="text-base">{soldier.first_name} {soldier.last_name}</CardTitle>
                <p className="text-xs text-slate-500">ID: {soldier.soldier_id}</p>
            </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Target className="w-4 h-4 text-slate-500" />Weapons</h4>
          {assignedWeapons.length > 0 ? (
            <div className="space-y-1">
              {assignedWeapons.map(w => (
                <p key={w.id} className="text-sm text-slate-700">{w.weapon_type} <span className="text-xs text-slate-500">(SN: {w.weapon_id})</span></p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No weapons assigned.</p>
          )}
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Binoculars className="w-4 h-4 text-slate-500" />Serialized Gear</h4>
          {assignedGear.length > 0 ? (
            <div className="space-y-1">
              {assignedGear.map(g => (
                <p key={g.id} className="text-sm text-slate-700">{g.gear_type} <span className="text-xs text-slate-500">(SN: {g.gear_id})</span></p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No gear assigned.</p>
          )}
        </div>
      </CardContent>
      <CardFooter>
        {isVerified ? (
          <div className="w-full flex flex-col items-center gap-2 text-center">
             <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                <CheckCircle className="w-4 h-4 mr-2" />
                Verified by {verificationRecord?.verified_by_user_name}
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleUndoClick} disabled={isUndoing} className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 h-auto px-2 py-1">
              {isUndoing ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Undo2 className="w-3 h-3 mr-1" />
              )}
              Undo
            </Button>
          </div>
        ) : (
          <Button onClick={handleVerifyClick} className="w-full bg-blue-600 hover:bg-blue-700" disabled={isVerifying}>
            {isVerifying ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4 mr-2" />
            )}
            Verify Equipment
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}