"use client";

import { memo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getHashColor } from "@/lib/theme-utils";

interface OptimizedAvatarProps {
  name: string;
  initials: string;
  theme?: string;
  mounted: boolean;
  className?: string;
}

export const OptimizedAvatar = memo(function OptimizedAvatar({
  name,
  initials,
  theme,
  mounted,
  className
}: OptimizedAvatarProps) {
  return (
    <Avatar className={className}>
      <AvatarFallback style={getHashColor(name, theme, mounted)} suppressHydrationWarning>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
});