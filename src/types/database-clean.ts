// Clean Database Types - Matches the new schema exactly

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          auth_id: string | null;
          email: string;
          full_name: string | null;
          initials: string | null;
          avatar_url: string | null;
          role: 'pending' | 'user' | 'admin';
          color_index: number | null;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_id?: string | null;
          email: string;
          full_name?: string | null;
          initials?: string | null;
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
          auth_id?: string | null;
          email?: string;
          full_name?: string | null;
          initials?: string | null;
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
    Functions: {
      generate_initials: {
        Args: { full_name: string };
        Returns: string;
      };
      update_user_role: {
        Args: {
          p_user_id: string;
          p_new_role: 'pending' | 'user' | 'admin';
          p_admin_id: string;
        };
        Returns: void;
      };
      get_jobs_for_user: {
        Args: { user_id: string };
        Returns: {
          id: string;
          venue: string;
          job_id: string;
          status: 'draft' | 'live' | 'processing' | 'complete' | 'error';
          created_by: string;
          owner_id: string;
          last_activity: string;
          created_at: string;
          updated_at: string;
          collaborator_count: number;
        }[];
      };
      transfer_job_ownership: {
        Args: {
          p_job_id: string;
          p_new_owner_id: string;
          p_current_user_id: string;
        };
        Returns: void;
      };
      add_job_collaborator: {
        Args: {
          p_job_id: string;
          p_user_email: string;
          p_current_user_id: string;
        };
        Returns: {
          id: string;
          email: string;
          full_name: string | null;
          initials: string | null;
        };
      };
      remove_job_collaborator: {
        Args: {
          p_job_id: string;
          p_collaborator_id: string;
          p_current_user_id: string;
        };
        Returns: void;
      };
    };
  };
}

// Convenience type exports
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
export type UserWithProfile = User & {
  is_current_user?: boolean;
};

export type JobWithDetails = Job & {
  creator?: User;
  owner?: User;
  collaborators?: User[];
  collaborator_count?: number;
  user_can_edit?: boolean;
  user_can_transfer?: boolean;
};

export type JobCollaboratorWithUser = JobCollaborator & {
  user?: User;
};

export type ActivityLogWithUser = ActivityLog & {
  user?: User;
};

// API request/response types
export interface CreateJobRequest {
  venue: string;
  job_id: string;
  status?: 'draft' | 'live';
  collaborator_emails?: string[];
}

export interface UpdateJobRequest {
  venue?: string;
  status?: 'draft' | 'live' | 'processing' | 'complete' | 'error';
}

export interface TransferOwnershipRequest {
  new_owner_email: string;
}

export interface AddCollaboratorRequest {
  email: string;
}

export interface UpdateUserRoleRequest {
  role: 'pending' | 'user' | 'admin';
}

export interface UpdateUserProfileRequest {
  full_name?: string;
  avatar_url?: string;
  color_index?: number;
}

// API response wrappers
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface ApiError {
  error: string;
  status: number;
}

// RPC function return types
export type GetJobsForUserResult = Database['public']['Functions']['get_jobs_for_user']['Returns'][0];
export type AddCollaboratorResult = Database['public']['Functions']['add_job_collaborator']['Returns'];