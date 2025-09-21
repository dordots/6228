
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Target, Binoculars, Joystick, Package } from 'lucide-react';

const itemIcons = {
  Weapon: Target,
  Gear: Binoculars,
  Drone: Joystick,
  Equipment: Package
};

const itemColors = {
  Weapon: "border-red-200 bg-red-50 text-red-800",
  Gear: "border-purple-200 bg-purple-50 text-purple-800",
  Drone: "border-blue-200 bg-blue-50 text-blue-800",
  Equipment: "border-green-200 bg-green-50 text-green-800",
};

export default function AssignedItemsList({ 
  items, 
  selectedItems, 
  onSelectionChange,
  quantities = {},
  onQuantityChange 
}) {
  const handleSelectAll = (checked) => {
    onSelectionChange(checked ? items.map(item => item.id) : []);
  };

  const handleSelectItem = (itemId, checked) => {
    const newSelection = checked
      ? [...selectedItems, itemId]
      : selectedItems.filter(id => id !== itemId);
    onSelectionChange(newSelection);
  };

  const handleQuantityUpdate = (itemId, value, max) => {
    const numValue = parseInt(value, 10);
    if (value === '') { // Allow clearing the input
        onQuantityChange?.(itemId, '');
    } else if (!isNaN(numValue)) {
        // Clamp the value between 1 and the maximum allowed quantity
        const clampedValue = Math.max(1, Math.min(numValue, max));
        onQuantityChange?.(itemId, clampedValue);
    }
  };

  const isAllSelected = items.length > 0 && selectedItems.length === items.length;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 py-3">
        <CardTitle className="text-lg">Assigned Items ({items.length})</CardTitle>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="select-all"
            checked={isAllSelected}
            onCheckedChange={handleSelectAll}
            disabled={items.length === 0}
          />
          <label htmlFor="select-all" className="text-sm font-medium leading-none">
            Select All
          </label>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          {items.length > 0 ? (
            <div className="p-4 space-y-3">
              {items.map(item => {
                const Icon = itemIcons[item.itemType] || Package;
                const colors = itemColors[item.itemType] || itemColors.Equipment;
                const hasQuantity = item.itemType === 'Equipment' && item.quantity;
                const maxQuantity = hasQuantity ? item.quantity : 1;
                // Handle empty string case for controlled input
                const currentQuantity = quantities[item.id] === '' ? '' : (quantities[item.id] ?? (hasQuantity ? 1 : 1));
                
                return (
                  <div
                    key={item.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg border ${colors}`}
                  >
                    <Checkbox
                      id={`item-${item.id}`}
                      checked={selectedItems.includes(item.id)}
                      onCheckedChange={(checked) => handleSelectItem(item.id, checked)}
                    />
                    <Icon className="w-5 h-5" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{item.displayName}</p>
                      <p className="text-xs">{item.displayId}</p>
                      {hasQuantity && (
                        <p className="text-xs opacity-75">Available: {maxQuantity}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasQuantity && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs">Qty:</span>
                          <Input
                            type="number"
                            min="1"
                            max={maxQuantity}
                            value={currentQuantity}
                            onChange={(e) => handleQuantityUpdate(item.id, e.target.value, maxQuantity)}
                            className="w-16 h-6 text-xs"
                            disabled={!selectedItems.includes(item.id)}
                          />
                        </div>
                      )}
                      <Badge variant="outline" className="text-xs border">{item.itemType}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center p-10 text-slate-500">
              <p>This soldier has no items assigned.</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
