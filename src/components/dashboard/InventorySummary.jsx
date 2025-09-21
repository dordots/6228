import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function InventorySummary({ 
  title, 
  total, 
  stats, 
  Icon, 
  color, 
  isLoading, 
  viewAllUrl, 
  items, 
  itemTypeField, 
  itemTypeLabel 
}) {
  const [showAllItems, setShowAllItems] = useState(false);
  
  // Calculate assignment statistics per type
  const itemTypeCounts = React.useMemo(() => {
    if (!Array.isArray(items)) return [];
    
    const typeStats = items.reduce((acc, item) => {
      if (item && item[itemTypeField]) {
        const type = item[itemTypeField];
        if (!acc[type]) {
          acc[type] = { total: 0, assigned: 0, unassigned: 0 };
        }
        acc[type].total++;
        if (item.assigned_to) {
          acc[type].assigned++;
        } else {
          acc[type].unassigned++;
        }
      }
      return acc;
    }, {});
    
    return Object.entries(typeStats)
      .map(([type, stats]) => ({ type, ...stats }))
      .sort((a, b) => b.total - a.total);
  }, [items, itemTypeField]);

  const displayedItems = showAllItems ? itemTypeCounts : itemTypeCounts.slice(0, 10);
  const hasMoreItems = itemTypeCounts.length > 10;

  // Overall assignment statistics for header
  const overallStats = React.useMemo(() => {
    if (!Array.isArray(items)) return { assigned: 0, unassigned: 0 };
    
    const assigned = items.filter(item => item && item.assigned_to).length;
    const unassigned = items.length - assigned;
    
    return { assigned, unassigned };
  }, [items]);

  if (isLoading) {
    return (
      <Card className="border-slate-200 shadow-sm h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-16" />
          <div className="space-y-2">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-slate-200 shadow-sm transition-all duration-300 ${showAllItems ? 'h-auto' : 'h-full'} flex flex-col`}>
      <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-sm md:text-base ${color} font-semibold flex items-center gap-2`}>
            <Icon className="w-4 h-4 md:w-5 md:h-5" />
            {title}
          </CardTitle>
          <div className="text-lg md:text-2xl font-bold text-slate-900">
            {total}
          </div>
        </div>
        {/* Overall assignment summary */}
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span>{overallStats.assigned} assigned</span>
          <span>{overallStats.unassigned} unassigned</span>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-3 md:p-6 pt-0 space-y-3 md:space-y-4">
        {/* Additional Stats Section (like maintenance alerts) */}
        {Array.isArray(stats) && stats.length > 0 && (
          <div className="space-y-1.5 md:space-y-2">
            {stats.map((stat, index) => (
              <div key={index} className="flex items-center justify-between text-xs md:text-sm">
                <div className="flex items-center gap-1.5">
                  <stat.Icon className={`w-3 h-3 ${stat.color}`} />
                  <span className="text-slate-600">{stat.label}</span>
                </div>
                <Badge variant="outline" className="text-xs font-medium">
                  {stat.value}
                </Badge>
              </div>
            ))}
          </div>
        )}
        
        {/* Item Types with Assignment Statistics */}
        {itemTypeCounts.length > 0 && (
          <div className="flex-1 space-y-2 md:space-y-3 border-t border-slate-200 pt-2">
            <h4 className="text-xs md:text-sm font-semibold text-slate-700">
              {itemTypeLabel}
            </h4>
            {/* Remove max-height and overflow constraints to allow expansion */}
            <div className="space-y-2 md:space-y-2">
              {displayedItems.map(({ type, total, assigned, unassigned }, index) => (
                <div key={index} className="bg-slate-50 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-800 truncate flex-1 mr-2">
                      {type}
                    </span>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {total} total
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-green-700">
                        <span className="font-medium">{assigned}</span> assigned
                      </span>
                      <span className="text-amber-700">
                        <span className="font-medium">{unassigned}</span> unassigned
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Show All / Show Less Button */}
            {hasMoreItems && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllItems(!showAllItems)}
                className="w-full h-8 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-all duration-200"
              >
                {showAllItems ? (
                  <>
                    Show Less
                    <ChevronUp className="w-3 h-3 ml-1" />
                  </>
                ) : (
                  <>
                    Show All ({itemTypeCounts.length - 10} more)
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        )}
        
        {/* View All Button */}
        {viewAllUrl && (
          <div className={`${showAllItems ? 'mt-4' : 'mt-auto'} pt-2 md:pt-3 border-t border-slate-200`}>
            <Link to={createPageUrl(viewAllUrl)} className="w-full">
              <Button variant="outline" size="sm" className="w-full h-8 text-xs">
                View All {title}
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}