'use client'

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
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




export default function AdminPage() {
  const { theme } = useTheme();
  const { userProfile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

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
        </div>
      </PageLayout>
    </AccessControl>
  );
}
