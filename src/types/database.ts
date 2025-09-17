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
      job_documents: {
        Row: {
          id: string;
          job_id: string;
          file_name: string;
          storage_path: string;
          file_url: string;
          file_type: string;
          file_size: number;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          file_name: string;
          storage_path: string;
          file_url: string;
          file_type: string;
          file_size: number;
          uploaded_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          file_name?: string;
          storage_path?: string;
          file_url?: string;
          file_type?: string;
          file_size?: number;
          uploaded_by?: string;
          created_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          details: Record<string, unknown>;
          status: 'success' | 'failure' | 'pending';
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          details?: Record<string, unknown>;
          status?: 'success' | 'failure' | 'pending';
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          action?: string;
          details?: Record<string, unknown>;
          status?: 'success' | 'failure' | 'pending';
          description?: string | null;
          created_at?: string;
        };
      };
      extraction_results: {
        Row: {
          id: string;
          job_id: string;
          extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
          error_message: string | null;
          extracted_by: string | null;
          item_count: number;
          extraction_cost: number;
          api_calls_count: number;
          processing_time_ms: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          extraction_status?: 'pending' | 'processing' | 'completed' | 'failed';
          error_message?: string | null;
          extracted_by?: string | null;
          item_count?: number;
          extraction_cost?: number;
          api_calls_count?: number;
          processing_time_ms?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          extraction_status?: 'pending' | 'processing' | 'completed' | 'failed';
          error_message?: string | null;
          extracted_by?: string | null;
          item_count?: number;
          extraction_cost?: number;
          api_calls_count?: number;
          processing_time_ms?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      menu_items: {
        Row: {
          id: string;
          job_id: string;
          extraction_id: string | null;
          name: string;
          description: string;
          subcategory: string;
          menus: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          version: number;
        };
        Insert: {
          id?: string;
          job_id: string;
          extraction_id?: string | null;
          name: string;
          description?: string;
          subcategory: string;
          menus?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          version?: number;
        };
        Update: {
          id?: string;
          job_id?: string;
          extraction_id?: string | null;
          name?: string;
          description?: string;
          subcategory?: string;
          menus?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          version?: number;
        };
      };
      item_sizes: {
        Row: {
          id: string;
          item_id: string;
          size: string;
          price: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          size?: string;
          price?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          size?: string;
          price?: number;
          active?: boolean;
          created_at?: string;
        };
      };
      item_modifiers: {
        Row: {
          id: string;
          item_id: string;
          modifier_group: string;
          options: Record<string, unknown>[];
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          modifier_group: string;
          options?: Record<string, unknown>[];
          created_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          modifier_group?: string;
          options?: Record<string, unknown>[];
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

export type JobDocument = Database['public']['Tables']['job_documents']['Row'];
export type JobDocumentInsert = Database['public']['Tables']['job_documents']['Insert'];
export type JobDocumentUpdate = Database['public']['Tables']['job_documents']['Update'];

export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
export type ActivityLogInsert = Database['public']['Tables']['activity_logs']['Insert'];

export type ExtractionResult = Database['public']['Tables']['extraction_results']['Row'];
export type ExtractionResultInsert = Database['public']['Tables']['extraction_results']['Insert'];
export type ExtractionResultUpdate = Database['public']['Tables']['extraction_results']['Update'];

export type MenuItem = Database['public']['Tables']['menu_items']['Row'];
export type MenuItemInsert = Database['public']['Tables']['menu_items']['Insert'];
export type MenuItemUpdate = Database['public']['Tables']['menu_items']['Update'];

export type ItemSize = Database['public']['Tables']['item_sizes']['Row'];
export type ItemSizeInsert = Database['public']['Tables']['item_sizes']['Insert'];
export type ItemSizeUpdate = Database['public']['Tables']['item_sizes']['Update'];

export type ItemModifier = Database['public']['Tables']['item_modifiers']['Row'];
export type ItemModifierInsert = Database['public']['Tables']['item_modifiers']['Insert'];
export type ItemModifierUpdate = Database['public']['Tables']['item_modifiers']['Update'];

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
