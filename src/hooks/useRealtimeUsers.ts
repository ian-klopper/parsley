'use client';

import { useEffect, useState } from 'react';
import { useRealtime } from '@/lib/realtime/RealtimeProvider';
import { UserService } from '@/lib/user-service';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: 'pending' | 'user' | 'admin';
  created_at: string;
  updated_at: string;
  approved_at?: string;
  approved_by?: string;
  avatar_url?: string;
  color_index?: number;
  initials?: string;
}

export function useRealtimeUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { subscribe, isConnected } = useRealtime();
  const { userProfile } = useAuth();

  // Initial load (admin only)
  useEffect(() => {
    if (!userProfile || userProfile.role !== 'admin') return;

    async function loadUsers() {
      try {
        setLoading(true);
        const result = await UserService.getAllUsers();
        if (result.error) {
          setError(result.error);
        } else {
          setUsers(result.data || []);
        }
      } catch (err) {
        setError('Failed to load users');
        console.error('Error loading users:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [userProfile]);

  // Set up real-time subscription (admin only)
  useEffect(() => {
    if (!userProfile || userProfile.role !== 'admin') return;

    const unsubscribe = subscribe('users', (payload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case 'INSERT':
          if (newRecord) {
            setUsers(prev => [newRecord, ...prev]);
            toast({
              title: "New user registered",
              description: `${newRecord.email} has signed up`,
            });
          }
          break;

        case 'UPDATE':
          if (newRecord) {
            setUsers(prev => prev.map(user => 
              user.id === newRecord.id ? newRecord : user
            ));
            
            // Show role change notification
            if (oldRecord?.role !== newRecord.role) {
              if (oldRecord?.role === 'pending' && newRecord.role !== 'pending') {
                toast({
                  title: "User approved",
                  description: `${newRecord.email} is now a ${newRecord.role}`,
                });
              } else {
                toast({
                  title: "User role changed",
                  description: `${newRecord.email} is now a ${newRecord.role}`,
                });
              }
            }
          }
          break;

        case 'DELETE':
          if (oldRecord) {
            setUsers(prev => prev.filter(user => user.id !== oldRecord.id));
            toast({
              title: "User deleted",
              description: `${oldRecord.email} has been removed`,
              variant: "destructive",
            });
          }
          break;
      }
    });

    return unsubscribe;
  }, [userProfile, subscribe]);

  const refetch = async () => {
    if (!userProfile || userProfile.role !== 'admin') return;
    
    try {
      setLoading(true);
      const result = await UserService.getAllUsers();
      if (result.error) {
        setError(result.error);
      } else {
        setUsers(result.data || []);
        setError(null);
      }
    } catch (err) {
      setError('Failed to refresh users');
    } finally {
      setLoading(false);
    }
  };

  return {
    users,
    loading,
    error,
    refetch,
    isConnected
  };
}