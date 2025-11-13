import React from 'react';
import { Binoculars, AlertTriangle, Package, HelpCircle } from 'lucide-react';
import InventorySummary from './InventorySummary';

export default function GearSummary({ gear = [], isLoading }) {
  const safeGear = Array.isArray(gear) ? gear : [];
  
  const notFunctioningCount = safeGear.filter(g => g && g.status === 'not_functioning').length;
  const missingCount = safeGear.filter(g => g && g.status === 'missing').length;
  const inDepositCount = safeGear.filter(g => g && g.armory_status === 'in_deposit').length;
  
  const stats = [
    {
      value: notFunctioningCount,
      label: 'Not Functioning',
      Icon: AlertTriangle,
      color: 'text-red-500',
    },
    {
      value: inDepositCount,
      label: 'In Deposit',
      Icon: Package,
      color: 'text-amber-500',
    },
    {
      value: missingCount,
      label: 'Missing',
      Icon: HelpCircle,
      color: 'text-slate-500',
    },
  ];
  
  return (
    <InventorySummary
      title="Serialized Gear"
      total={safeGear.length}
      stats={stats}
      Icon={Binoculars}
      color="text-purple-600"
      isLoading={isLoading}
      viewAllUrl="/SerializedGear"
      items={safeGear}
      itemTypeField="gear_type"
      itemTypeLabel="Serialized Gear by Type"
    />
  );
}