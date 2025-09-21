
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

const conditionColors = {
  excellent: "bg-green-100 text-green-800 border-green-200",
  good: "bg-blue-100 text-blue-800 border-blue-200", 
  fair: "bg-yellow-100 text-yellow-800 border-yellow-200",
  poor: "bg-red-100 text-red-800 border-red-200",
  needs_repair: "bg-red-100 text-red-800 border-red-200",
  functioning: "bg-green-100 text-green-800 border-green-200",
  not_functioning: "bg-red-100 text-red-800 border-red-200"
};

const statusColors = {
  active: "bg-green-100 text-green-800 border-green-200",
  on_leave: "bg-yellow-100 text-yellow-800 border-yellow-200",
  deployed: "bg-blue-100 text-blue-800 border-blue-200",
  training: "bg-purple-100 text-purple-800 border-purple-200",
  // Added for enlistment statuses
  arrived: "bg-green-100 text-green-800 border-green-200",
  expected: "bg-yellow-100 text-yellow-800 border-yellow-200"
};

export default function StatusOverview({ soldiers, equipment, weapons, isLoading }) {
  const [showAllPersonnel, setShowAllPersonnel] = useState(false);

  const getConditionStats = (items, conditionField = 'condition') => {
    const stats = {};
    items.forEach(item => {
      const condition = item[conditionField] || 'unknown';
      stats[condition] = (stats[condition] || 0) + 1;
    });
    return stats;
  };

  const getAssignmentStats = (items) => {
    const assigned = items.filter(item => item.assigned_to).length;
    const unassigned = items.length - assigned;
    return { assigned, unassigned, total: items.length };
  };

  if (isLoading) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-base md:text-lg">Status Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <div className="space-y-3 md:space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 md:h-4 w-24 md:w-32" />
                <Skeleton className="h-1.5 md:h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const soldierStats = soldiers.reduce((acc, soldier) => {
    const status = soldier.enlistment_status || 'expected'; // Changed to enlistment_status
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const equipmentConditions = getConditionStats(equipment);
  const weaponConditions = getConditionStats(weapons);
  const equipmentAssignment = getAssignmentStats(equipment);
  const weaponAssignment = getAssignmentStats(weapons);

  const totalSoldiers = soldiers.length;
  const arrivedCount = soldierStats.arrived || 0;
  const expectedCount = soldierStats.expected || 0;

  const soldierStatusEntries = Object.entries(soldierStats);
  const hasMorePersonnel = soldierStatusEntries.length > 4;
  const displayedPersonnel = showAllPersonnel ? soldierStatusEntries : soldierStatusEntries.slice(0, 4);

  return (
    <Card className="border-slate-200 shadow-sm transition-all duration-300">
      <CardHeader className="p-3 md:p-6">
        <CardTitle className="flex items-center gap-2 text-slate-900 text-base md:text-lg">
          Status Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 md:p-6 pt-0">
        <Tabs defaultValue="personnel" className="space-y-4 md:space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-8 md:h-10">
            <TabsTrigger value="personnel" className="text-xs md:text-sm">Personnel</TabsTrigger>
            <TabsTrigger value="equipment" className="text-xs md:text-sm">Equipment</TabsTrigger>
            <TabsTrigger value="weapons" className="text-xs md:text-sm">Weapons</TabsTrigger>
          </TabsList>

          <TabsContent value="personnel" className="space-y-3 md:space-y-4">
            <div className="space-y-3 md:space-y-4">
              {/* Summary Section */}
              <div className="bg-slate-50 rounded-lg p-3 md:p-4">
                <h4 className="text-sm md:text-base font-semibold text-slate-900 mb-2">Personnel Summary</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                  <div className="text-center">
                    <div className="text-xl md:text-2xl font-bold text-slate-900">{totalSoldiers}</div>
                    <div className="text-xs md:text-sm text-slate-600">Total Personnel</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl md:text-2xl font-bold text-green-600">{arrivedCount}</div>
                    <div className="text-xs md:text-sm text-slate-600">Arrived</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl md:text-2xl font-bold text-amber-600">{expectedCount}</div>
                    <div className="text-xs md:text-sm text-slate-600">Expected</div>
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-2 md:space-y-3">
                {displayedPersonnel.map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      <Badge className={`${statusColors[status]} border font-medium text-xs shrink-0`}>
                        {status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-xs md:text-sm text-slate-600 truncate">
                        {count} personnel ({totalSoldiers > 0 ? Math.round((count / totalSoldiers) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-16 md:w-24 shrink-0">
                      <Progress 
                        value={totalSoldiers > 0 ? (count / totalSoldiers) * 100 : 0} 
                        className="h-1.5 md:h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {hasMorePersonnel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllPersonnel(!showAllPersonnel)}
                  className="w-full h-8 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 mt-2 transition-all"
                >
                  {showAllPersonnel ? (
                    <>
                      Show Less <ChevronUp className="w-3 h-3 ml-1" />
                    </>
                  ) : (
                    <>
                      Show All ({soldierStatusEntries.length - 4} more) <ChevronDown className="w-3 h-3 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="equipment" className="space-y-3 md:space-y-4">
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs md:text-sm font-medium text-slate-700">Assignment Status</span>
                <span className="text-xs md:text-sm text-slate-600 shrink-0">
                  {equipmentAssignment.assigned}/{equipmentAssignment.total} assigned
                </span>
              </div>
              <Progress 
                value={equipmentAssignment.total > 0 ? (equipmentAssignment.assigned / equipmentAssignment.total) * 100 : 0}
                className="h-1.5 md:h-2"
              />
              
              <div className="space-y-1.5 md:space-y-2 pt-1 md:pt-2">
                {Object.entries(equipmentConditions).map(([condition, count]) => (
                  <div key={condition} className="flex items-center justify-between gap-2">
                    <Badge className={`${conditionColors[condition]} border text-xs shrink-0`}>
                      {condition.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <span className="text-xs md:text-sm text-slate-600">{count} items</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="weapons" className="space-y-3 md:space-y-4">
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs md:text-sm font-medium text-slate-700">Assignment Status</span>
                <span className="text-xs md:text-sm text-slate-600 shrink-0">
                  {weaponAssignment.assigned}/{weaponAssignment.total} assigned
                </span>
              </div>
              <Progress 
                value={weaponAssignment.total > 0 ? (weaponAssignment.assigned / weaponAssignment.total) * 100 : 0}
                className="h-1.5 md:h-2"
              />
              
              <div className="space-y-1.5 md:space-y-2 pt-1 md:pt-2">
                {Object.entries(weaponConditions).map(([condition, count]) => (
                  <div key={condition} className="flex items-center justify-between gap-2">
                    <Badge className={`${conditionColors[condition]} border text-xs shrink-0`}>
                      {condition === 'functioning' ? 'FUNCTIONING' : condition === 'not_functioning' ? 'NOT FUNCTIONING' : condition.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <span className="text-xs md:text-sm text-slate-600">{count} weapons</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
