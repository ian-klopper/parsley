'use client'

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface BackButtonProps {
  className?: string;
  fallbackUrl?: string;
}

export function BackButton({ className, fallbackUrl = "/dashboard" }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackUrl);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={className}
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}