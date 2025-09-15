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
  // User actions
  | 'user.profile_updated'
  | 'user.color_changed'
  | 'user.role_changed'
  | 'user.approved'
  | 'user.deleted'
  // Auth actions
  | 'auth.login'
  | 'auth.logout'
  | 'auth.signup';

export interface ActivityDetails {
  [key: string]: any;
}

export class ActivityLogger {
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

      const { error } = await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          action,
          status,
          details: details || {},
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