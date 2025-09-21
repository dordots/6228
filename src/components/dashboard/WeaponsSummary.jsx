import React from 'react';
import { Target, AlertTriangle, Package } from 'lucide-react';
import InventorySummary from './InventorySummary';

export default function WeaponsSummary({ weapons = [], isLoading }) {
  const safeWeapons = Array.isArray(weapons) ? weapons : [];

  const notFunctioningCount = safeWeapons.filter(w => w && w.status === 'not_functioning').length;
  const inDepositCount = safeWeapons.filter(w => w && w.armory_status === 'in_deposit').length;

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
  ];

  return (
    <InventorySummary
      title="Weapons"
      total={safeWeapons.length}
      stats={stats}
      Icon={Target}
      color="text-red-600"
      isLoading={isLoading}
      viewAllUrl="/Weapons"
      items={safeWeapons}
      itemTypeField="weapon_type"
      itemTypeLabel="Weapons by Type"
    />
  );
}