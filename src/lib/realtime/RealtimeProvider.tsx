'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface RealtimeContextType {
  subscribe: (table: string, callback: (payload: any) => void) => () => void;
  isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [channels, setChannels] = useState<Map<string, RealtimeChannel>>(new Map());
  const { userProfile } = useAuth();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!userProfile) return;

    // Set up connection status monitoring
    const handleConnect = () => {
      setIsConnected(true);
      toast({
        title: "Real-time connection established",
        description: "You'll receive live updates",
      });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      toast({
        title: "Connection lost",
        description: "Trying to reconnect...",
        variant: "destructive",
      });
    };

    // Listen for connection status changes
    supabase.realtime.onOpen(handleConnect);
    supabase.realtime.onClose(handleDisconnect);
    supabase.realtime.onError((error) => {
      console.error('Realtime error:', error);
      setIsConnected(false);
    });

    return () => {
      // Clean up all channels
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
      setChannels(new Map());
    };
  }, [userProfile]);

  const subscribe = (table: string, callback: (payload: any) => void) => {
    if (!userProfile) return () => {};

    const channelName = `realtime:${table}`;
    
    // Remove existing channel if it exists
    const existingChannel = channels.get(channelName);
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    // Create new channel with RLS-aware subscription
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          console.log(`Realtime update on ${table}:`, payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to ${table} changes`);
          setIsConnected(true);
        }
      });

    // Store the channel
    setChannels(prev => new Map(prev).set(channelName, channel));

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
      setChannels(prev => {
        const newMap = new Map(prev);
        newMap.delete(channelName);
        return newMap;
      });
    };
  };

  return (
    <RealtimeContext.Provider value={{ subscribe, isConnected }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}