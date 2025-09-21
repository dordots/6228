import React from 'react';
import { Wrench, AlertTriangle } from 'lucide-react';
import InventorySummary from './InventorySummary';

export default function EquipmentSummary({ equipment = [], isLoading }) {
  const safeEquipment = Array.isArray(equipment) ? equipment : [];

  const notFunctioningCount = safeEquipment.filter(e => e && e.condition === 'not_functioning').length;

  const stats = [
    {
      value: notFunctioningCount,
      label: 'Not Functioning',
      Icon: AlertTriangle,
      color: 'text-red-500',
    }
  ];

  return (
    <InventorySummary
      title="Equipment"
      total={safeEquipment.length}
      stats={stats}
      Icon={Wrench}
      color="text-orange-600"
      isLoading={isLoading}
      viewAllUrl="/Equipment"
      items={safeEquipment}
      itemTypeField="equipment_type"
      itemTypeLabel="Equipment by Type"
    />
  );
}