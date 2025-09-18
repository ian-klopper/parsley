/**
 * Script to clean up duplicate menu items from the database
 * Keeps the newest record for each job_id + name combination
 *
 * Usage: node scripts/cleanup-duplicate-menu-items.js
 *
 * This script can be run independently or is also integrated into the admin panel's purge functionality.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupDuplicateMenuItems() {
  console.log('🧹 Starting cleanup of duplicate menu items...');

  try {
    // First, let's analyze the current duplication situation
    console.log('\n📊 Analyzing current duplication...');

    const { data: allItems, error: fetchError } = await supabase
      .from('menu_items')
      .select('id, job_id, name, created_at')
      .order('job_id', { ascending: true })
      .order('name', { ascending: true })
      .order('created_at', { ascending: false }); // Newest first

    if (fetchError) {
      throw new Error(`Failed to fetch menu items: ${fetchError.message}`);
    }

    console.log(`📋 Total menu items in database: ${allItems.length}`);

    // Group items by job_id + name combination
    const groupedItems = new Map();

    for (const item of allItems) {
      const key = `${item.job_id}:${item.name.toLowerCase().trim()}`;

      if (!groupedItems.has(key)) {
        groupedItems.set(key, []);
      }
      groupedItems.get(key).push(item);
    }

    // Find duplicates
    const duplicateGroups = [];
    let totalDuplicates = 0;

    for (const [key, items] of groupedItems.entries()) {
      if (items.length > 1) {
        duplicateGroups.push({ key, items });
        totalDuplicates += items.length - 1; // Keep one, remove the rest
      }
    }

    console.log(`🔍 Found ${duplicateGroups.length} groups with duplicates`);
    console.log(`🗑️  Total duplicate items to remove: ${totalDuplicates}`);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicates found! Database is already clean.');
      return;
    }

    // Show some examples
    console.log('\n📝 Examples of duplicate groups:');
    duplicateGroups.slice(0, 5).forEach(group => {
      const [jobId, name] = group.key.split(':');
      console.log(`   Job ${jobId}: "${name}" (${group.items.length} copies)`);
    });

    // Prepare cleanup operations
    const idsToDelete = [];

    for (const group of duplicateGroups) {
      // Keep the newest item (first in the sorted array), delete the rest
      const [keepItem, ...deleteItems] = group.items;
      idsToDelete.push(...deleteItems.map(item => item.id));

      console.log(`📌 Keeping newest: ${keepItem.name} (ID: ${keepItem.id}, Created: ${keepItem.created_at})`);
      console.log(`🗑️  Deleting ${deleteItems.length} older copies`);
    }

    // Perform the cleanup in batches
    console.log(`\n🗑️  Deleting ${idsToDelete.length} duplicate menu items...`);

    const batchSize = 100;
    let deletedCount = 0;

    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);

      const { error: deleteError } = await supabase
        .from('menu_items')
        .delete()
        .in('id', batch);

      if (deleteError) {
        console.error(`❌ Failed to delete batch ${i / batchSize + 1}:`, deleteError);
        throw deleteError;
      }

      deletedCount += batch.length;
      console.log(`✅ Deleted batch ${Math.floor(i / batchSize) + 1}: ${deletedCount}/${idsToDelete.length} items`);
    }

    // Verify cleanup
    console.log('\n📊 Verifying cleanup...');
    const { data: remainingItems, error: verifyError } = await supabase
      .from('menu_items')
      .select('id')
      .order('created_at', { ascending: false });

    if (verifyError) {
      throw new Error(`Failed to verify cleanup: ${verifyError.message}`);
    }

    console.log(`📋 Remaining menu items: ${remainingItems.length}`);
    console.log(`✅ Successfully removed ${deletedCount} duplicate items`);
    console.log('🎉 Database cleanup completed!');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupDuplicateMenuItems();