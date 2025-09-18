import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Get user from cookies to verify admin access
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check if user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check admin role
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Create service client for database operations
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('🗑️  Starting database purge (preserving users)...');

    // List of tables to purge (excluding users table)
    const tablesToPurge = [
      'menu_items',
      'item_sizes',
      'item_modifiers',
      'jobs',
      'extractions',
      'extraction_results',
      'activity_logs'
    ];

    const results: { table: string; deleted: number; error?: string }[] = [];

    // Purge each table
    for (const table of tablesToPurge) {
      try {
        console.log(`🗑️  Purging table: ${table}`);

        // First count the records
        const { count: recordCount, error: countError } = await serviceSupabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (countError) {
          console.warn(`⚠️  Could not count records in ${table}:`, countError);
        }

        // Delete all records from the table
        const { error: deleteError } = await serviceSupabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything (dummy condition)

        if (deleteError) {
          console.error(`❌ Error purging ${table}:`, deleteError);
          results.push({
            table,
            deleted: 0,
            error: deleteError.message
          });
        } else {
          const deletedCount = recordCount || 0;
          console.log(`✅ Purged ${table}: ${deletedCount} records deleted`);
          results.push({
            table,
            deleted: deletedCount
          });
        }
      } catch (error) {
        console.error(`❌ Exception purging ${table}:`, error);
        results.push({
          table,
          deleted: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Count remaining users to verify they were preserved
    const { count: userCount, error: userCountError } = await serviceSupabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    console.log('🎉 Database purge completed!');
    console.log(`👥 Users preserved: ${userCount || 'unknown'}`);

    // Log the admin action
    try {
      await serviceSupabase
        .from('activity_logs')
        .insert({
          user_id: profile?.id || user.id,
          action: 'database_purged',
          details: {
            tables_purged: tablesToPurge,
            results: results,
            users_preserved: userCount
          }
        });
    } catch (logError) {
      console.warn('Failed to log purge action:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'Database purged successfully',
      results: results,
      usersPreserved: userCount,
      summary: {
        totalTablesProcessed: tablesToPurge.length,
        totalRecordsDeleted: results.reduce((sum, r) => sum + r.deleted, 0),
        errors: results.filter(r => r.error).length
      }
    });

  } catch (error) {
    console.error('❌ Database purge failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Database purge failed'
    }, { status: 500 });
  }
}