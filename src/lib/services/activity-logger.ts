import { createSupabaseServer } from '@/lib/api/auth-middleware';

export type ActivityAction =
  // Job actions
  | 'job.created'
  | 'job.updated'
  | 'job.deleted'
  | 'job.ownership_transferred'
  | 'job.collaborator_added'
  | 'job.collaborator_removed'
  | 'job.status_changed'
  | 'job.extraction_initiated'
  | 'job.extraction_processing'
  | 'job.extraction_completed'
  | 'job.extraction_failed'
  | 'job.extraction_error'
  // User actions
  | 'user.profile_updated'
  | 'user.color_changed'
  | 'user.role_changed'
  | 'user.approved'
  | 'user.deleted'
  // Auth actions
  | 'auth.login'
  | 'auth.logout'
  | 'auth.signup'
  // Admin actions
  | 'admin.logs_cleared';

export interface ActivityDetails {
  [key: string]: any;
}

export class ActivityLogger {
  /**
   * Generate a human-readable description for an activity
   */
  private static generateDescription(action: ActivityAction, details: ActivityDetails): string {
    const userName = details.user_name || details.added_by_name || details.removed_by_name || 'User';

    switch (action) {
      case 'job.created':
        return `${userName} created job ${details.job_number || details.job_id} for ${details.job_venue || 'venue'}`;
      case 'job.updated':
        // Handle specific collaborator changes
        if (details.collaborator_changes) {
          const { added, removed } = details.collaborator_changes;
          const jobRef = `job ${details.job_number || details.job_id} for ${details.job_venue || 'venue'}`;

          if (added?.length > 0 && removed?.length > 0) {
            // Mixed changes
            const addedNames = added.map((u: any) => u.name).join(', ');
            const removedNames = removed.map((u: any) => u.name).join(', ');
            return `${userName} managed collaborators for ${jobRef}, adding ${addedNames} and removing ${removedNames}`;
          } else if (added?.length > 0) {
            // Only additions
            const addedNames = added.map((u: any) => u.name).join(', ');
            return `${userName} added ${addedNames} as ${added.length === 1 ? 'collaborator' : 'collaborators'} to ${jobRef}`;
          } else if (removed?.length > 0) {
            // Only removals
            const removedNames = removed.map((u: any) => u.name).join(', ');
            return `${userName} removed ${removedNames} from ${jobRef}`;
          }
        }

        // Handle other field updates
        if (details.updated_fields && details.updated_fields.length > 0) {
          const fields = details.updated_fields.join(', ');
          return `${userName} updated ${fields} for job ${details.job_number || details.job_id} at ${details.job_venue || 'venue'}`;
        }

        // Fallback for generic updates
        return `${userName} updated job ${details.job_number || details.job_id} for ${details.job_venue || 'venue'}`;
      case 'job.deleted':
        return `${userName} deleted job ${details.job_number || details.job_id} for ${details.job_venue || 'venue'}`;
      case 'job.ownership_transferred':
        const newOwner = details.new_owner_name || details.target_user_name || 'another user';
        return `${userName} transferred ownership of job ${details.job_number || details.job_id} for ${details.job_venue || 'venue'} to ${newOwner}`;
      case 'job.collaborator_added':
        return `${userName} added ${details.collaborator_name || 'collaborator'} to job ${details.job_number || details.job_id}`;
      case 'job.collaborator_removed':
        return `${userName} removed ${details.collaborator_name || 'collaborator'} from job ${details.job_number || details.job_id}`;
      case 'job.status_changed':
        return `${userName} changed status of job ${details.job_number || details.job_id} from ${details.old_status || 'previous'} to ${details.new_status || 'new'}`;
      case 'job.extraction_initiated':
        return `${userName} initiated extraction for job ${details.job_number || details.job_id} at ${details.job_venue || 'venue'}`;
      case 'job.extraction_processing':
        return `${userName} is processing documents for job ${details.job_number || details.job_id} at ${details.job_venue || 'venue'}`;
      case 'job.extraction_completed':
        return `${userName} completed extraction for job ${details.job_number || details.job_id} at ${details.job_venue || 'venue'}`;
      case 'job.extraction_failed':
        return `${userName} encountered an extraction failure for job ${details.job_number || details.job_id} at ${details.job_venue || 'venue'}`;
      case 'job.extraction_error':
        return `${userName} encountered an extraction error for job ${details.job_number || details.job_id}`;
      case 'user.profile_updated':
        return `${userName} updated ${details.target_user_name || 'user'} profile`;
      case 'user.color_changed':
        return `${userName} changed ${details.target_user_name || 'user'} color to ${details.new_color || 'new color'}`;
      case 'user.role_changed':
        return `${userName} changed ${details.target_user_name || 'user'} role from ${details.old_role || 'previous'} to ${details.new_role || 'new'}`;
      case 'user.approved':
        return `${userName} approved ${details.target_user_name || 'user'} access`;
      case 'user.deleted':
        return `${userName} deleted user ${details.target_user_name || 'account'}`;
      case 'auth.login':
        return `${userName} logged in`;
      case 'auth.logout':
        return `${userName} logged out`;
      case 'auth.signup':
        return `${userName} signed up`;
      case 'admin.logs_cleared':
        return `${userName} cleared all activity logs`;
      default:
        return `${userName} performed ${action}`;
    }
  }

  /**
   * Log an activity to the database
   * This should be called from API routes after successful actions
   */
  static async log(
    userId: string,
    action: ActivityAction,
    status: 'success' | 'error' = 'success',
    details?: ActivityDetails
  ): Promise<void> {
    try {
      const supabase = await createSupabaseServer();

      // Generate human-readable description
      const description = this.generateDescription(action, details || {});

      const { error } = await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          action,
          status,
          details: details || {},
          description,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (error) {
      console.error('Error in activity logger:', error);
      // Don't throw - logging failures shouldn't break the app
    }
  }

  /**
   * Log a job-related activity
   */
  static async logJobActivity(
    userId: string,
    action: ActivityAction,
    jobId: string,
    details?: ActivityDetails
  ): Promise<void> {
    await this.log(userId, action, 'success', {
      job_id: jobId,
      ...details
    });
  }

  /**
   * Log a user-related activity
   */
  static async logUserActivity(
    userId: string,
    action: ActivityAction,
    targetUserId: string,
    details?: ActivityDetails
  ): Promise<void> {
    await this.log(userId, action, 'success', {
      target_user_id: targetUserId,
      ...details
    });
  }
}