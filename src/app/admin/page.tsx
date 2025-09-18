'use client'

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { getUserColor } from "@/lib/theme-utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTheme } from "next-themes"
import { useState, useEffect, useCallback } from "react"
import { ColorPicker } from "@/components/ui/color-picker"
import { AccessControl } from "@/components/AccessControl"
import { PageLayout } from "@/components/PageLayout"
import { LoadingWithTips } from "@/components/LoadingWithTips"
import { useAuth } from "@/contexts/AuthContext"
import { UserService } from "@/lib/user-service"
import { User } from "@/types/database"
import { useToast } from "@/hooks/use-toast"
import { Trash2, AlertTriangle } from "lucide-react"




export default function AdminPage() {
  const { theme } = useTheme();
  const { userProfile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data: userData, error } = await UserService.getAllUsers();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load users: " + error,
        variant: "destructive",
      });
    } else {
      setUsers(userData || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    setMounted(true);
    loadUsers();
  }, [loadUsers]);

  const handleRoleChange = async (userId: string, role: 'pending' | 'user' | 'admin') => {
    setUpdating(userId);
    const { success, error } = await UserService.updateUserRole(userId, role);
    
    if (success) {
      toast({
        title: "Success",
        description: `User role updated to ${role}`,
      });
      await loadUsers();
      await refreshProfile();
    } else {
      toast({
        title: "Error",
        description: "Failed to update user role: " + error,
        variant: "destructive",
      });
    }
    setUpdating(null);
  };

  const handleColorChange = async (userId: string, colorIndex: number) => {
    const { success, error } = await UserService.updateAnyUserColor(userId, colorIndex);

    if (success) {
      toast({
        title: "Success",
        description: "User color updated",
      });
      await loadUsers();
    } else {
      toast({
        title: "Error",
        description: "Failed to update user color: " + error,
        variant: "destructive",
      });
    }
  };

  const handlePurgeDatabase = async () => {
    setPurging(true);

    try {
      const response = await fetch('/api/admin/purge-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Database Purged",
          description: `Successfully deleted ${result.summary.totalRecordsDeleted} records from ${result.summary.totalTablesProcessed} tables. ${result.usersPreserved} users preserved.`,
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to purge database: " + result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to purge database: " + (error instanceof Error ? error.message : 'Unknown error'),
        variant: "destructive",
      });
    } finally {
      setPurging(false);
    }
  };



  return (
    <AccessControl requireRole="admin">
      <PageLayout title="Admin Panel" showBackButton={true}>
        <div className="w-full">
              {loading ? (
                <LoadingWithTips size="sm" className="py-8" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className="border-b-0 hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ColorPicker 
                              onColorSelect={(colorIndex) => handleColorChange(user.id, colorIndex)}
                              currentColorIndex={user.color_index || undefined}
                              trigger={
                                <Avatar className="cursor-pointer hover:ring-2 hover:ring-black hover:ring-offset-2 transition-all">
                                  <AvatarFallback style={getUserColor(user, theme, mounted)} suppressHydrationWarning>
                                    {user.initials || UserService.generateInitials(user.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                              }
                            />
                            <div>
                              <div className="font-medium">{user.full_name || 'Unknown User'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value: 'pending' | 'user' | 'admin') => handleRoleChange(user.id, value)}
                            disabled={updating === user.id || user.id === userProfile?.id}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {/* Dangerous Actions Section */}
              <div className="mt-12 border-t pt-8">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Dangerous Actions
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    These actions cannot be undone. Use with extreme caution.
                  </p>
                </div>

                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-destructive mb-2">Purge Database</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Delete ALL data from the database including jobs, extractions, menu items, and activity logs.
                        <strong className="text-foreground"> User accounts will be preserved.</strong>
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>• All extraction jobs and results will be deleted</div>
                        <div>• All menu items and related data will be deleted</div>
                        <div>• All activity logs will be deleted</div>
                        <div>• User accounts and settings will remain intact</div>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={purging}
                          className="ml-4 flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          {purging ? 'Purging...' : 'Purge Database'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Purge Database
                          </AlertDialogTitle>
                          <AlertDialogDescription className="space-y-3">
                            <p>
                              <strong>This action cannot be undone.</strong> You are about to delete ALL data from the database except user accounts.
                            </p>
                            <div className="bg-muted p-3 rounded text-sm">
                              <div className="font-medium mb-2">The following will be permanently deleted:</div>
                              <ul className="space-y-1 text-xs">
                                <li>• All extraction jobs and results</li>
                                <li>• All menu items, sizes, and modifiers</li>
                                <li>• All activity logs</li>
                                <li>• All storage files and data</li>
                              </ul>
                            </div>
                            <p className="text-green-600 font-medium">
                              ✓ User accounts and settings will be preserved
                            </p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handlePurgeDatabase}
                            disabled={purging}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            {purging ? 'Purging Database...' : 'Yes, Purge Database'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
        </div>
      </PageLayout>
    </AccessControl>
  );
}
