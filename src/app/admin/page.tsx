'use client'

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { getHashColor, getUserColor } from "@/lib/theme-utils"
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
import { Badge } from "@/components/ui/badge"
import { useTheme } from "next-themes"
import { useState, useEffect, useCallback } from "react"
import { ColorPicker } from "@/components/ui/color-picker"
import { AccessControl } from "@/components/AccessControl"
import { PageLayout } from "@/components/PageLayout"
import { LoadingWithTips } from "@/components/LoadingWithTips"
import { adminTips } from "@/lib/loading-tips"
import { useAuth } from "@/contexts/AuthContext"
import { UserService } from "@/lib/user-service"
import { User } from "@/types/database"
import { useToast } from "@/hooks/use-toast"
import { colorSpectrum } from '@/lib/colors';




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

  const getLocalUserColor = (user: User) => {
    if (user.color_index !== null && user.color_index !== undefined) {
      const colorObj = colorSpectrum[user.color_index];
      return mounted && theme === 'dark' ? colorObj.dark : colorObj.light;
    }
    return getUserColor(user, theme, mounted).backgroundColor;
  };

  const getRoleStyle = (role: string) => {
    // Use specific color indices from the 64-color spectrum for roles
    let colorIndex;
    switch (role) {
      case 'admin': colorIndex = 0; break;    // Red spectrum
      case 'user': colorIndex = 21; break;    // Green spectrum
      case 'pending': colorIndex = 10; break; // Yellow spectrum
      default: colorIndex = 32; break;       // Gray/neutral spectrum
    }

    const colorObj = colorSpectrum[colorIndex];
    const backgroundColor = mounted && theme === 'dark' ? colorObj.dark : colorObj.light;
    const color = mounted && theme === 'dark' ? 'white' : 'black';

    return { backgroundColor, color };
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <CheckCircle2 className="h-4 w-4" />;
      case 'user': return <CheckCircle2 className="h-4 w-4" />;
      case 'pending': return <AlertCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };


  return (
    <AccessControl requireRole="admin">
      <PageLayout title="Admin Panel" showBackButton={true}>
        <div className="w-full">
              {loading ? (
                <LoadingWithTips
                  title="Loading Admin Panel"
                  subtitle="Fetching user data and permissions..."
                  tips={adminTips}
                  size="sm"
                  className="py-8"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
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
                              <div className="text-xs text-muted-foreground">{user.initials || UserService.generateInitials(user.full_name)}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" style={getRoleStyle(user.role)} suppressHydrationWarning>
                            {getRoleIcon(user.role)}
                            <span className="ml-1 capitalize">{user.role}</span>
                          </Badge>
                        </TableCell>
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
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
