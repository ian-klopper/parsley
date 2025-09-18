import { NextRequest, NextResponse } from 'next/server';
import { requireNonPending, handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireNonPending(request);
    const { id: jobId } = await params;
    const supabase = await createSupabaseServer();

    // Get job details to verify access
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, venue, job_id, owner_id, created_by, status, extraction_progress')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if user can view this job
    const canView = job.created_by === user.id || job.owner_id === user.id || user.role === 'admin';

    if (!canView) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Get current extraction progress from the job record
    const extractionProgress = job.extraction_progress || {
      phase: 'idle',
      currentFile: '',
      filesProcessed: 0,
      totalFiles: 0,
      itemsExtracted: 0,
      currentStep: '',
      progress: 0,
      startTime: null,
      estimatedTimeRemaining: null
    };

    return NextResponse.json({
      success: true,
      jobId,
      status: job.status,
      progress: extractionProgress
    });

  } catch (error) {
    console.error('Error fetching extraction progress:', error);
    return handleApiError(error);
  }
}