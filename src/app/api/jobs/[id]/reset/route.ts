import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Get user from cookies to verify access
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get job to check ownership/access
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, created_by, owner_id, collaborators, venue')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check if user has permission to reset this job
    const canReset = profile.role === 'admin' ||
                     profile.id === job.created_by ||
                     profile.id === job.owner_id ||
                     (job.collaborators && job.collaborators.includes(profile.id));

    if (!canReset) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Create service client for database operations
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`🔄 Starting reset for job ${jobId} (${job.venue})`);

    // Tables to clear for this job
    const results: { table: string; deleted: number; error?: string }[] = [];

    // 1. Delete menu items and related data
    try {
      // Get count of menu items first
      const { count: menuItemCount, error: countError } = await serviceSupabase
        .from('menu_items')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId);

      // Delete menu items (cascading should handle item_sizes and item_modifiers)
      const { error: menuItemsError } = await serviceSupabase
        .from('menu_items')
        .delete()
        .eq('job_id', jobId);

      if (menuItemsError) {
        results.push({ table: 'menu_items', deleted: 0, error: menuItemsError.message });
      } else {
        results.push({ table: 'menu_items', deleted: menuItemCount || 0 });
        console.log(`✅ Deleted ${menuItemCount || 0} menu items`);
      }
    } catch (error) {
      results.push({
        table: 'menu_items',
        deleted: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // 2. Delete item sizes
    try {
      const { count: sizesCount, error: sizesCountError } = await serviceSupabase
        .from('item_sizes')
        .select('item_id!inner(job_id)', { count: 'exact', head: true })
        .eq('item_id.job_id', jobId);

      const { error: sizesError } = await serviceSupabase
        .from('item_sizes')
        .delete()
        .in('item_id',
          serviceSupabase
            .from('menu_items')
            .select('id')
            .eq('job_id', jobId)
        );

      if (sizesError) {
        results.push({ table: 'item_sizes', deleted: 0, error: sizesError.message });
      } else {
        results.push({ table: 'item_sizes', deleted: sizesCount || 0 });
        console.log(`✅ Deleted ${sizesCount || 0} item sizes`);
      }
    } catch (error) {
      results.push({
        table: 'item_sizes',
        deleted: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // 3. Delete item modifiers
    try {
      const { count: modifiersCount, error: modifiersCountError } = await serviceSupabase
        .from('item_modifiers')
        .select('item_id!inner(job_id)', { count: 'exact', head: true })
        .eq('item_id.job_id', jobId);

      const { error: modifiersError } = await serviceSupabase
        .from('item_modifiers')
        .delete()
        .in('item_id',
          serviceSupabase
            .from('menu_items')
            .select('id')
            .eq('job_id', jobId)
        );

      if (modifiersError) {
        results.push({ table: 'item_modifiers', deleted: 0, error: modifiersError.message });
      } else {
        results.push({ table: 'item_modifiers', deleted: modifiersCount || 0 });
        console.log(`✅ Deleted ${modifiersCount || 0} item modifiers`);
      }
    } catch (error) {
      results.push({
        table: 'item_modifiers',
        deleted: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // 4. Delete extraction results
    try {
      const { count: extractionResultsCount, error: extractionResultsCountError } = await serviceSupabase
        .from('extraction_results')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId);

      const { error: extractionResultsError } = await serviceSupabase
        .from('extraction_results')
        .delete()
        .eq('job_id', jobId);

      if (extractionResultsError) {
        results.push({ table: 'extraction_results', deleted: 0, error: extractionResultsError.message });
      } else {
        results.push({ table: 'extraction_results', deleted: extractionResultsCount || 0 });
        console.log(`✅ Deleted ${extractionResultsCount || 0} extraction results`);
      }
    } catch (error) {
      results.push({
        table: 'extraction_results',
        deleted: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // 5. Delete extractions
    try {
      const { count: extractionsCount, error: extractionsCountError } = await serviceSupabase
        .from('extractions')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId);

      const { error: extractionsError } = await serviceSupabase
        .from('extractions')
        .delete()
        .eq('job_id', jobId);

      if (extractionsError) {
        results.push({ table: 'extractions', deleted: 0, error: extractionsError.message });
      } else {
        results.push({ table: 'extractions', deleted: extractionsCount || 0 });
        console.log(`✅ Deleted ${extractionsCount || 0} extractions`);
      }
    } catch (error) {
      results.push({
        table: 'extractions',
        deleted: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // 6. Reset job status to 'pending' and clear results
    try {
      const { error: jobUpdateError } = await serviceSupabase
        .from('jobs')
        .update({
          status: 'pending',
          results: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (jobUpdateError) {
        results.push({ table: 'jobs_update', deleted: 0, error: jobUpdateError.message });
      } else {
        results.push({ table: 'jobs_update', deleted: 1 });
        console.log(`✅ Reset job status to pending`);
      }
    } catch (error) {
      results.push({
        table: 'jobs_update',
        deleted: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Log the reset action
    try {
      await serviceSupabase
        .from('activity_logs')
        .insert({
          user_id: profile.id,
          action: 'job_reset',
          details: {
            job_id: jobId,
            venue: job.venue,
            results: results,
            total_records_deleted: results.reduce((sum, r) => sum + r.deleted, 0)
          }
        });
    } catch (logError) {
      console.warn('Failed to log reset action:', logError);
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
    const errors = results.filter(r => r.error);

    console.log(`🎉 Job reset completed: ${totalDeleted} records deleted`);
    if (errors.length > 0) {
      console.warn(`⚠️  Some errors occurred:`, errors);
    }

    return NextResponse.json({
      success: true,
      message: 'Job reset successfully',
      results: results,
      summary: {
        totalRecordsDeleted: totalDeleted,
        tablesProcessed: results.length,
        errors: errors.length
      }
    });

  } catch (error) {
    console.error('❌ Job reset failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Job reset failed'
    }, { status: 500 });
  }
}