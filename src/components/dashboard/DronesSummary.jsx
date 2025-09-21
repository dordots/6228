import React from 'react';
import { Joystick, AlertTriangle, Package } from 'lucide-react';
import InventorySummary from './InventorySummary';

export default function DronesSummary({ drones = [], isLoading }) {
  const safeDrones = Array.isArray(drones) ? drones : [];
  
  const maintenanceCount = safeDrones.filter(d => d && d.status !== 'Operational').length;
  const inDepositCount = safeDrones.filter(d => d && d.armory_status === 'in_deposit').length;

  const stats = [
    {
      value: maintenanceCount,
      label: 'Need Maintenance',
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
      title="Drone Sets"
      total={safeDrones.length}
      stats={stats}
      Icon={Joystick}
      color="text-sky-600"
      isLoading={isLoading}
      viewAllUrl="/Drones"
      items={safeDrones}
      itemTypeField="set_type"
      itemTypeLabel="Drones by Type"
    />
  );
}