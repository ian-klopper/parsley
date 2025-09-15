'use client'

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { getHashColor, getUserColor, getStatusStyle } from "@/lib/theme-utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import { UserService } from "@/lib/user-service"
import { useToast } from "@/hooks/use-toast"
import { AccessControl } from "@/components/AccessControl"
import { PageLayout } from "@/components/PageLayout"
import { LoadingWithTips } from "@/components/LoadingWithTips"
import { logsTips } from "@/lib/loading-tips"
import { useTheme } from "next-themes"
import { useState, useEffect, useCallback } from "react"
import { ActivityLogWithUser } from "@/types/database";





const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "success":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "default";
  }
}

const getActionBadgeStyle = (action: string, theme?: string, mounted?: boolean) => {
  // Generate a consistent hash-based color for each action type
  let hash = 0;
  for (let i = 0; i < action.length; i++) {
    const char = action.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Generate HSL color with theme-aware saturation and lightness
  const hue = Math.abs(hash) % 360;
  const saturation = mounted && theme === 'dark' ? 85 : 90; // Theme-aware saturation
  const lightness = mounted && theme === 'dark' ? 35 : 70; // Dark theme: dark colors, Light theme: light colors
  const textColor = mounted && theme === 'dark' ? 'white' : 'black';

  return {
    backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    color: textColor,
    border: 'none'
  };
}



export default function LogsPage() {
  const { theme } = useTheme();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<ActivityLogWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const { data: logsData, error } = await UserService.getActivityLogs();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load logs: " + error,
        variant: "destructive",
      });
    } else {
      setLogs(logsData || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    setMounted(true);
    loadLogs();
  }, [loadLogs]);

  return (
    <AccessControl requireRole="admin">
      <PageLayout title="Activity Logs" showBackButton={true}>
        <div className="w-full">
              {loading ? (
                <LoadingWithTips
                  title="Loading Activity Logs"
                  subtitle="Retrieving system activity and user actions..."
                  tips={logsTips}
                  size="sm"
                  className="py-8"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log, index) => (
                      <TableRow key={log.id || index} className="border-b-0 hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all">
                              <AvatarFallback style={getUserColor(log.users, theme, mounted)} suppressHydrationWarning>
                                {log.users?.initials || UserService.generateInitials(log.users?.full_name) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{log.users?.full_name || 'Unknown User'}</div>
                              <div className="text-xs text-muted-foreground">{log.users?.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge style={getActionBadgeStyle(log.action, theme, mounted)}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(log.status)} style={getStatusStyle(log.status, theme, mounted)}>
                            {log.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {logs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No activity logs found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
        </div>
      </PageLayout>
    </AccessControl>
  );
}
