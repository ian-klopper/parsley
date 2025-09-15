import { supabase } from '@/lib/supabase';

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  }

  private async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session');
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = `API Error (${response.status}): ${errorText}`;

        // Log the error
        console.error(`API Request Failed:`, {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });

        // Always show to user
        const error = new Error(errorMessage);
        throw error;
      }

      return response.json();
    } catch (error) {
      // Ensure all errors are visible
      console.error(`Request to ${endpoint} failed:`, error);

      // Re-throw to ensure it propagates
      throw error;
    }
  }

  // User endpoints
  async getCurrentUser() {
    return this.request<{ data: any }>('/users/me');
  }

  async updateCurrentUser(data: any) {
    return this.request<{ data: any }>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Job endpoints
  async getJobs() {
    return this.request<{ data: any[] }>('/jobs');
  }

  async getJob(id: string) {
    return this.request<{ data: any }>(`/jobs/${id}`);
  }

  async createJob(data: any) {
    return this.request<{ data: any }>('/jobs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateJob(id: string, data: any) {
    return this.request<{ data: any }>(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteJob(jobId: string) {
    return this.request<{ data: { success: boolean } }>(`/jobs/${jobId}`, {
      method: 'DELETE'
    });
  }

  async transferJobOwnership(jobId: string, newOwnerEmail: string) {
    return this.request<{ data: any }>(`/jobs/${jobId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ newOwnerEmail })
    });
  }

  // Admin endpoints
  async getAllUsers() {
    return this.request<{ data: any[] }>('/admin/users');
  }

  async updateUser(userId: string, data: any) {
    return this.request<{ data: any }>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteUser(userId: string) {
    return this.request<{ message: string }>(`/admin/users/${userId}`, {
      method: 'DELETE'
    });
  }

  async getActivityLogs(page = 1, limit = 50) {
    return this.request<{ data: any[]; pagination: any }>(`/admin/logs?page=${page}&limit=${limit}`);
  }
}

export const apiClient = new ApiClient();