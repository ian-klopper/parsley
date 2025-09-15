"use client";

import { memo } from "react";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { getHashColor, getStatusStyle, getStatusVariant } from "@/lib/theme-utils";

interface OptimizedBadgeProps {
  variant?: "default" | "secondary" | "destructive" | "outline";
  children: React.ReactNode;
  className?: string;
  name?: string;
  theme?: string;
  mounted?: boolean;
  isStatus?: boolean;
  status?: string;
}

export const OptimizedBadge = memo(function OptimizedBadge({
  variant,
  children,
  className,
  name,
  theme,
  mounted,
  isStatus,
  status
}: OptimizedBadgeProps) {
  const getStyle = () => {
    if (isStatus && status) {
      return getStatusStyle(status, theme, mounted);
    }
    if (name && theme !== undefined && mounted !== undefined) {
      return getHashColor(name, theme, mounted);
    }
    return {};
  };

  const getVariant = (): BadgeProps['variant'] => {
    if (isStatus && status) {
      return getStatusVariant(status) as BadgeProps['variant'];
    }
    return variant || "default";
  };

  return (
    <Badge 
      variant={getVariant()} 
      style={getStyle()} 
      className={className}
      suppressHydrationWarning
    >
      {children}
    </Badge>
  );
});