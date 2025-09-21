
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, ArrowRight, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function VerificationSummary({ soldiers, dailyVerifications, isLoading, userDivision, isManagerOrAdmin }) {
  const [showAllDivisions, setShowAllDivisions] = useState(false);

  const divisionStats = useMemo(() => {
    if (!Array.isArray(soldiers) || !Array.isArray(dailyVerifications)) {
      return { divisions: [], totalVerified: 0, totalToVerify: 0 };
    }

    // Filter soldiers to only those that need verification (arrived status)
    const soldiersToVerify = soldiers.filter(s => s?.enlistment_status === 'arrived');
    const verifiedSoldierIds = new Set(dailyVerifications.map(v => v?.soldier_id).filter(Boolean));

    // Group by division
    const divisionGroups = {};
    soldiersToVerify.forEach(soldier => {
      const division = soldier.division_name || 'Unassigned';
      if (!divisionGroups[division]) {
        divisionGroups[division] = { total: 0, verified: 0 };
      }
      divisionGroups[division].total++;
      if (verifiedSoldierIds.has(soldier.soldier_id)) {
        divisionGroups[division].verified++;
      }
    });

    const divisions = Object.entries(divisionGroups)
      .map(([name, stats]) => ({
        name,
        verified: stats.verified,
        total: stats.total,
        progress: stats.total > 0 ? (stats.verified / stats.total) * 100 : 0,
        isComplete: stats.verified === stats.total && stats.total > 0
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const totalVerified = divisions.reduce((sum, d) => sum + d.verified, 0);
    const totalToVerify = divisions.reduce((sum, d) => sum + d.total, 0);

    return { divisions, totalVerified, totalToVerify };
  }, [soldiers, dailyVerifications]);

  if (isLoading) {
    return (
      <Card className="border-slate-200 shadow-sm h-full">
        <CardHeader>
          <Skeleton className="h-5 w-3/5" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-2.5 w-full" />
            <div className="space-y-2 mt-4">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { divisions, totalVerified, totalToVerify } = divisionStats;
  const overallProgress = totalToVerify > 0 ? (totalVerified / totalToVerify) * 100 : 0;
  const allComplete = totalVerified === totalToVerify && totalToVerify > 0;

  // If user is not manager/admin, show only their division
  const visibleDivisions = !isManagerOrAdmin && userDivision 
    ? divisions.filter(d => d.name === userDivision)
    : divisions;

  const hasMoreDivisions = visibleDivisions.length > 5;
  const displayedDivisions = showAllDivisions ? visibleDivisions : visibleDivisions.slice(0, 5);

  return (
    <Card className={`border-slate-200 shadow-sm h-full flex flex-col transition-all duration-300 ${allComplete ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900 text-base md:text-lg">
          <ClipboardCheck className={`w-5 h-5 ${allComplete ? 'text-green-600' : 'text-slate-500'}`} />
          Daily Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div>
          <p className="text-sm text-slate-600 mb-2">
            {isManagerOrAdmin ? 'Overall progress for today:' : 'Progress for today:'}
          </p>
          <div className="flex justify-between items-baseline mb-2">
            <span className={`text-xl font-bold ${allComplete ? 'text-green-700' : 'text-slate-800'}`}>
              {totalVerified}
            </span>
            <span className="text-sm text-slate-500">/ {totalToVerify} Verified</span>
          </div>
          <Progress value={overallProgress} className="h-2 mb-4" />
        </div>

        {visibleDivisions.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">By Division:</p>
            <div className="space-y-1.5">
              {displayedDivisions.map(division => (
                <div key={division.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Shield className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-slate-600 truncate">{division.name}</span>
                    {division.isComplete && (
                      <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5">
                        ✓
                      </Badge>
                    )}
                  </div>
                  <span className="text-slate-500 shrink-0 ml-2">
                    {division.verified}/{division.total}
                  </span>
                </div>
              ))}
            </div>
            {hasMoreDivisions && (
               <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllDivisions(!showAllDivisions)}
                className="w-full h-8 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 mt-2 transition-all"
              >
                {showAllDivisions ? (
                  <>
                    Show Less <ChevronUp className="w-3 h-3 ml-1" />
                  </>
                ) : (
                  <>
                    Show All ({visibleDivisions.length - 5} more) <ChevronDown className="w-3 h-3 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
      <div className="p-4 pt-0 space-y-2">
        <Link to={createPageUrl("DailyVerification")} className="w-full">
          <div className={`w-full text-center px-4 py-2 rounded-md font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${allComplete ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {allComplete ? 'Review Verifications' : 'Perform Verification'}
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
        <Link to={createPageUrl("VerificationHistory")} className="w-full">
          <div className="w-full text-center px-4 py-2 rounded-md font-semibold text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
            View History
          </div>
        </Link>
      </div>
    </Card>
  );
}
