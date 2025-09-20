import { apiClient } from './services/api-client';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'pending' | 'user' | 'admin';
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  avatar_url: string | null;
  color_index: number | null;
  initials: string | null;
}

export class UserService {
  // Generate user initials from full name
  static generateInitials(fullName?: string): string {
    if (!fullName) return '';
    
    return fullName
      .split(' ')
      .filter(name => name.length > 0)
      .map(name => name.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2); // Limit to 2 characters
  }

  // Get current user profile
  static async getCurrentUser(): Promise<{ data: User | null; error: string | null }> {
    // DEVELOPMENT BYPASS - RETURN MOCK SUPREME USER
    if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true') {
      console.log('🚀 [UserService] DEV BYPASS - RETURNING MOCK SUPREME USER!')

      const mockUser: User = {
        id: process.env.NEXT_PUBLIC_DEV_USER_ID || 'dev-mock-001',
        email: process.env.NEXT_PUBLIC_DEV_USER_EMAIL || 'dev@localhost.com',
        full_name: 'Development Supreme User',
        role: process.env.NEXT_PUBLIC_DEV_ADMIN === 'true' ? 'admin' : 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        approved_by: 'system',
        avatar_url: null,
        color_index: 0,
        initials: 'DS'
      }

      return { data: mockUser, error: null }
    }

    try {
      const result = await apiClient.getCurrentUser();
      return { data: result.data, error: null };
    } catch (error) {
      // Don't log "User profile not found" as an error - it's expected for new users
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch user profile';
      if (!errorMessage.includes('User profile not found')) {
        console.error('Error fetching current user:', error);
      }
      return { data: null, error: errorMessage };
    }
  }

  // Update current user profile
  static async updateCurrentUser(userData: Partial<User>): Promise<{ data: User | null; error: string | null }> {
    try {
      const result = await apiClient.updateCurrentUser(userData);
      return { data: result.data, error: null };
    } catch (error) {
      console.error('Error updating user:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Failed to update user profile' };
    }
  }

  // Get all active users (for collaboration - available to all authenticated users)
  static async getActiveUsers(): Promise<{ users: User[]; error: string | null }> {
    try {
      const response = await fetch('/api/users/list', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const result = await response.json();
      return { users: result.data || [], error: null };
    } catch (error) {
      console.error('Error fetching active users:', error);
      return { users: [], error: error instanceof Error ? error.message : 'Failed to fetch users' };
    }
  }

  // Admin: Get all users (including pending - admin only)
  static async getAllUsers(): Promise<{ data: User[] | null; error: string | null }> {
    try {
      const result = await apiClient.getAllUsers();
      return { data: result.data, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch users';

      // If user profile not found or insufficient permissions, return empty array
      if (errorMessage.includes('User profile not found') || errorMessage.includes('Insufficient permissions')) {
        return { data: [], error: null };
      }

      console.error('Error fetching users:', error);
      return { data: null, error: errorMessage };
    }
  }

  // Admin: Update any user
  static async updateUser(userId: string, userData: Partial<User>): Promise<{ data: User | null; error: string | null }> {
    try {
      const result = await apiClient.updateUser(userId, userData);
      return { data: result.data, error: null };
    } catch (error) {
      console.error('Error updating user:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Failed to update user' };
    }
  }

  // Update current user's color
  static async updateUserColor(colorIndex: number): Promise<{ success: boolean; error: string | null }> {
    try {
      const result = await apiClient.updateCurrentUser({ color_index: colorIndex });
      return { success: true, error: null };
    } catch (error) {
      console.error('Error updating user color:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update user color' };
    }
  }

  // Admin: Update any user's color
  static async updateAnyUserColor(userId: string, colorIndex: number): Promise<{ success: boolean; error: string | null }> {
    try {
      const result = await apiClient.updateUser(userId, { color_index: colorIndex });
      return { success: true, error: null };
    } catch (error) {
      console.error('Error updating user color:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update user color' };
    }
  }

  // Admin: Update user role
  static async updateUserRole(userId: string, role: 'pending' | 'user' | 'admin'): Promise<{ success: boolean; error: string | null }> {
    try {
      const result = await apiClient.updateUser(userId, { role });
      return { success: true, error: null };
    } catch (error) {
      console.error('Error updating user role:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update user role' };
    }
  }

  // Admin: Delete user
  static async deleteUser(userId: string): Promise<{ error: string | null }> {
    try {
      await apiClient.deleteUser(userId);
      return { error: null };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { error: error instanceof Error ? error.message : 'Failed to delete user' };
    }
  }

  // Admin: Get activity logs
  static async getActivityLogs(page = 1, limit = 50): Promise<{ data: any[] | null; pagination?: any; error: string | null }> {
    try {
      const result = await apiClient.getActivityLogs(page, limit);
      return { data: result.data, pagination: result.pagination, error: null };
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Failed to fetch activity logs' };
    }
  }

  // Admin: Clear all activity logs
  static async clearActivityLogs(): Promise<{ error: string | null }> {
    try {
      await apiClient.clearActivityLogs();
      return { error: null };
    } catch (error) {
      console.error('Error clearing activity logs:', error);
      return { error: error instanceof Error ? error.message : 'Failed to clear activity logs' };
    }
  }
}