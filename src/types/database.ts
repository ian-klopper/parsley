export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string; // Now directly references auth.users.id
          email: string;
          full_name: string | null;
          initials: string | null; // Generated column
          avatar_url: string | null;
          role: 'pending' | 'user' | 'admin';
          color_index: number | null; // Admin-controllable
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string; // Required - must match auth.users.id
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: 'pending' | 'user' | 'admin';
          color_index?: number | null;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: 'pending' | 'user' | 'admin';
          color_index?: number | null;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          venue: string;
          job_id: string;
          status: 'draft' | 'live' | 'processing' | 'complete' | 'error';
          created_by: string;
          owner_id: string;
          last_activity: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue: string;
          job_id: string;
          status?: 'draft' | 'live' | 'processing' | 'complete' | 'error';
          created_by: string;
          owner_id: string;
          last_activity?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          venue?: string;
          job_id?: string;
          status?: 'draft' | 'live' | 'processing' | 'complete' | 'error';
          created_by?: string;
          owner_id?: string;
          last_activity?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      job_collaborators: {
        Row: {
          job_id: string;
          user_id: string;
          added_at: string;
          added_by: string | null;
        };
        Insert: {
          job_id: string;
          user_id: string;
          added_at?: string;
          added_by?: string | null;
        };
        Update: {
          job_id?: string;
          user_id?: string;
          added_at?: string;
          added_by?: string | null;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          details: Record<string, unknown>;
          status: 'success' | 'failure' | 'pending';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          details?: Record<string, unknown>;
          status?: 'success' | 'failure' | 'pending';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          action?: string;
          details?: Record<string, unknown>;
          status?: 'success' | 'failure' | 'pending';
          created_at?: string;
        };
      };
    };
  };
}

export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type Job = Database['public']['Tables']['jobs']['Row'];
export type JobInsert = Database['public']['Tables']['jobs']['Insert'];
export type JobUpdate = Database['public']['Tables']['jobs']['Update'];

export type JobCollaborator = Database['public']['Tables']['job_collaborators']['Row'];
export type JobCollaboratorInsert = Database['public']['Tables']['job_collaborators']['Insert'];

export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
export type ActivityLogInsert = Database['public']['Tables']['activity_logs']['Insert'];

// Extended types for API responses
export type JobWithDetails = Job & {
  creator?: User;
  owner?: User;
  collaborators?: User[];
  collaborator_count?: number;
};

export type ActivityLogWithUser = ActivityLog & {
  users: User | null;
};
