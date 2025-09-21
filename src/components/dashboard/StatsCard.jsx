
import React from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const colorConfig = {
  blue: {
    bg: "bg-blue-500",
    light: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200"
  },
  green: {
    bg: "bg-green-600",
    light: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200"
  },
  red: {
    bg: "bg-red-500",
    light: "bg-red-50",
    text: "text-red-600",
    border: "border-red-200"
  },
  amber: {
    bg: "bg-amber-500",
    light: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200"
  }
};

export default function StatsCard({ title, value, icon: Icon, color, subtitle, isLoading }) {
  const colors = colorConfig[color];

  if (isLoading) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2 md:pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1 md:space-y-2">
              <Skeleton className="h-3 md:h-4 w-16 md:w-24" />
              <Skeleton className="h-6 md:h-8 w-12 md:w-16" />
            </div>
            <Skeleton className="h-8 md:h-12 w-8 md:w-12 rounded-lg md:rounded-xl" />
          </div>
          <Skeleton className="h-2 md:h-3 w-14 md:w-20" />
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={`border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 ${colors.light} ${colors.border}`}>
      <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs md:text-sm font-medium text-slate-600 mb-0.5 md:mb-1 leading-tight">{title}</p>
            <p className="text-xl md:text-3xl font-bold text-slate-900">{value}</p>
          </div>
          <div className={`p-2 md:p-3 rounded-lg md:rounded-xl ${colors.light} ${colors.border} border`}>
            <Icon className={`w-4 h-4 md:w-6 md:h-6 ${colors.text}`} />
          </div>
        </div>
        {subtitle && (
          <p className={`text-xs md:text-sm ${colors.text} font-medium mt-1 md:mt-2 leading-tight`}>
            {subtitle}
          </p>
        )}
      </CardHeader>
    </Card>
  );
}
