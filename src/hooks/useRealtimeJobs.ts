'use client';

import { useEffect, useState } from 'react';
import { useRealtime } from '@/lib/realtime/RealtimeProvider';
import { JobService } from '@/lib/job-service';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface Job {
  id: string;
  venue: string;
  job_id: string;
  status: string;
  created_by: string;
  owner_id: string;
  collaborators: string[];
  created_at: string;
  updated_at: string;
  creator?: { id: string; email: string; full_name?: string };
  owner?: { id: string; email: string; full_name?: string };
  collaborator_users?: { id: string; email: string; full_name?: string }[];
}

export function useRealtimeJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { subscribe, isConnected } = useRealtime();
  const { userProfile } = useAuth();

  // Initial load
  useEffect(() => {
    if (!userProfile) return;

    async function loadJobs() {
      try {
        setLoading(true);
        const result = await JobService.getJobs();
        if (result.error) {
          setError(result.error);
        } else {
          setJobs(result.data || []);
        }
      } catch (err) {
        setError('Failed to load jobs');
        console.error('Error loading jobs:', err);
      } finally {
        setLoading(false);
      }
    }

    loadJobs();
  }, [userProfile]);

  // Set up real-time subscription
  useEffect(() => {
    if (!userProfile) return;

    const unsubscribe = subscribe('jobs', (payload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case 'INSERT':
          if (newRecord) {
            setJobs(prev => [newRecord, ...prev]);
            toast({
              title: "New job created",
              description: `${newRecord.venue} has been added`,
            });
          }
          break;

        case 'UPDATE':
          if (newRecord) {
            setJobs(prev => prev.map(job => 
              job.id === newRecord.id ? newRecord : job
            ));
            
            // Show ownership transfer notification
            if (oldRecord?.owner_id !== newRecord.owner_id) {
              toast({
                title: "Job ownership transferred",
                description: `${newRecord.venue} has a new owner`,
              });
            } else {
              toast({
                title: "Job updated",
                description: `${newRecord.venue} has been modified`,
              });
            }
          }
          break;

        case 'DELETE':
          if (oldRecord) {
            setJobs(prev => prev.filter(job => job.id !== oldRecord.id));
            toast({
              title: "Job deleted",
              description: `${oldRecord.venue} has been removed`,
              variant: "destructive",
            });
          }
          break;
      }
    });

    return unsubscribe;
  }, [userProfile, subscribe]);

  const refetch = async () => {
    if (!userProfile) return;
    
    try {
      setLoading(true);
      const result = await JobService.getJobs();
      if (result.error) {
        setError(result.error);
      } else {
        setJobs(result.data || []);
        setError(null);
      }
    } catch (err) {
      setError('Failed to refresh jobs');
    } finally {
      setLoading(false);
    }
  };

  return {
    jobs,
    loading,
    error,
    refetch,
    isConnected
  };
}