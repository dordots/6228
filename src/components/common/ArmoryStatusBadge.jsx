import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getArmoryStatusDisplay } from "@/lib/armoryStatus";

export default function ArmoryStatusBadge({
  status,
  depositLocation,
  className = "",
  labelOnly = false,
  textClassName = "text-xs text-slate-600",
  overrideLabel
}) {
  const display = getArmoryStatusDisplay(status, depositLocation);
  const label = overrideLabel || display?.label;

  if (!display) {
    return (
      <span className={cn(textClassName, className)}>
        Unknown
      </span>
    );
  }

  if (labelOnly) {
    return (
      <span className={cn(textClassName, className)}>
        {label}
      </span>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", display.className, className)}
    >
      {label}
    </Badge>
  );
}

