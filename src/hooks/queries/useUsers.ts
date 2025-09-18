'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserService } from '@/lib/user-service';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/types/database';

const ALL_USERS_QUERY_KEY = 'allUsers';
const USERS_QUERY_KEY = 'users';
const ACTIVE_USERS_QUERY_KEY = 'activeUsers';
const CURRENT_USER_QUERY_KEY = 'currentUser';

// Get active users for collaboration (available to all users)
export function useActiveUsers() {
  return useQuery({
    queryKey: [ACTIVE_USERS_QUERY_KEY],
    queryFn: async () => {
      const result = await UserService.getActiveUsers();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.users || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get all users with caching (admin only)
export function useUsers() {
  return useQuery({
    queryKey: [USERS_QUERY_KEY],
    queryFn: async () => {
      const result = await UserService.getActiveUsers();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.users || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get current user with caching
export function useCurrentUser() {
  return useQuery({
    queryKey: [CURRENT_USER_QUERY_KEY],
    queryFn: async () => {
      const result = await UserService.getCurrentUser();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.user;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.message?.includes('authentication') ||
          error?.message?.includes('not found') ||
          error?.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

// Update user role with optimistic updates
export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, role, currentUserId }: {
      userId: string;
      role: 'pending' | 'user' | 'admin';
      currentUserId: string;
    }) => {
      const result = await UserService.updateUserRole(userId, role, currentUserId);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.user!;
    },
    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey: [ALL_USERS_QUERY_KEY] });

      const previousUsers = queryClient.getQueryData<User[]>([ALL_USERS_QUERY_KEY]);

      // Optimistically update user role
      if (previousUsers) {
        const updatedUsers = previousUsers.map(user =>
          user.id === userId
            ? { ...user, role, updated_at: new Date().toISOString() }
            : user
        );
        queryClient.setQueryData([ALL_USERS_QUERY_KEY], updatedUsers);
      }

      return { previousUsers };
    },
    onError: (err, { userId }, context) => {
      // Rollback optimistic update
      if (context?.previousUsers) {
        queryClient.setQueryData([ALL_USERS_QUERY_KEY], context.previousUsers);
      }
      toast({
        title: "Error updating user role",
        description: err.message,
        variant: "destructive",
      });
    },
    onSuccess: (data, { role }) => {
      toast({
        title: "User role updated",
        description: `User role has been changed to ${role}.`,
      });

      // Invalidate queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: [ALL_USERS_QUERY_KEY] });
    },
  });
}

// Update user color with optimistic updates
export function useUpdateUserColor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, colorIndex }: { userId: string; colorIndex: number }) => {
      const result = await UserService.updateUserColor(userId, colorIndex);
      if (result.error) {
        throw new Error(result.error);
      }
      return { userId, colorIndex };
    },
    onMutate: async ({ userId, colorIndex }) => {
      await queryClient.cancelQueries({ queryKey: [ALL_USERS_QUERY_KEY] });

      const previousUsers = queryClient.getQueryData<User[]>([ALL_USERS_QUERY_KEY]);

      // Optimistically update user color
      if (previousUsers) {
        const updatedUsers = previousUsers.map(user =>
          user.id === userId
            ? { ...user, color_index: colorIndex, updated_at: new Date().toISOString() }
            : user
        );
        queryClient.setQueryData([ALL_USERS_QUERY_KEY], updatedUsers);
      }

      // Also update current user if it's the same user
      const currentUser = queryClient.getQueryData<User>([CURRENT_USER_QUERY_KEY]);
      if (currentUser && currentUser.id === userId) {
        queryClient.setQueryData([CURRENT_USER_QUERY_KEY], {
          ...currentUser,
          color_index: colorIndex,
          updated_at: new Date().toISOString(),
        });
      }

      return { previousUsers, previousCurrentUser: currentUser };
    },
    onError: (err, { userId }, context) => {
      // Rollback optimistic updates
      if (context?.previousUsers) {
        queryClient.setQueryData([ALL_USERS_QUERY_KEY], context.previousUsers);
      }
      if (context?.previousCurrentUser) {
        queryClient.setQueryData([CURRENT_USER_QUERY_KEY], context.previousCurrentUser);
      }
      toast({
        title: "Error updating user color",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

// Update current user profile
export function useUpdateCurrentUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userData: Partial<User>) => {
      const result = await UserService.updateCurrentUser(userData);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.user!;
    },
    onMutate: async (userData) => {
      await queryClient.cancelQueries({ queryKey: [CURRENT_USER_QUERY_KEY] });

      const previousUser = queryClient.getQueryData<User>([CURRENT_USER_QUERY_KEY]);

      // Optimistically update current user
      if (previousUser) {
        const updatedUser = {
          ...previousUser,
          ...userData,
          updated_at: new Date().toISOString()
        };
        queryClient.setQueryData([CURRENT_USER_QUERY_KEY], updatedUser);
      }

      return { previousUser };
    },
    onError: (err, userData, context) => {
      // Rollback optimistic update
      if (context?.previousUser) {
        queryClient.setQueryData([CURRENT_USER_QUERY_KEY], context.previousUser);
      }
      toast({
        title: "Error updating profile",
        description: err.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Profile updated successfully",
        description: "Your profile has been updated.",
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [ALL_USERS_QUERY_KEY] });
    },
  });
}