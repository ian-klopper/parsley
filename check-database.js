require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabase() {
  try {
    console.log('🔍 Checking database state...\n');

    // Check jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, venue, job_id, status, created_at');

    if (jobsError) {
      console.error('❌ Error fetching jobs:', jobsError);
      return;
    }

    console.log(`📋 Total jobs in database: ${jobs.length}`);
    jobs.forEach((job, index) => {
      console.log(`  ${index + 1}. ID: ${job.id}`);
      console.log(`     Venue: ${job.venue}`);
      console.log(`     Job ID: ${job.job_id}`);
      console.log(`     Status: ${job.status}`);
      console.log(`     Created: ${job.created_at}`);
      console.log('');
    });

    // Check job documents for each job
    for (const job of jobs) {
      const { data: documents, error: docsError } = await supabase
        .from('job_documents')
        .select('id, file_name, file_type, file_size')
        .eq('job_id', job.id);

      if (docsError) {
        console.error(`❌ Error fetching documents for job ${job.id}:`, docsError);
        continue;
      }

      console.log(`📄 Documents for job "${job.venue}" (${job.id}):`);
      if (documents.length === 0) {
        console.log('   No documents found');
      } else {
        documents.forEach((doc, index) => {
          console.log(`   ${index + 1}. ${doc.file_name} (${doc.file_type}, ${Math.round(doc.file_size / 1024)}KB)`);
        });
      }
      console.log('');
    }

    // Check extraction results
    for (const job of jobs) {
      const { data: extractions, error: extractError } = await supabase
        .from('extraction_results')
        .select('id, extraction_status, item_count, created_at')
        .eq('job_id', job.id);

      if (extractError) {
        console.error(`❌ Error fetching extractions for job ${job.id}:`, extractError);
        continue;
      }

      console.log(`🔍 Extractions for job "${job.venue}" (${job.id}):`);
      if (extractions.length === 0) {
        console.log('   No extractions found');
      } else {
        extractions.forEach((ext, index) => {
          console.log(`   ${index + 1}. Status: ${ext.extraction_status}, Items: ${ext.item_count}, Created: ${ext.created_at}`);
        });
      }
      console.log('');

      // Check actual extracted items for each extraction
      for (const extraction of extractions) {
        const { data: items, error: itemsError } = await supabase
          .from('extracted_items')
          .select('id, name, description, price, category, source_document')
          .eq('extraction_result_id', extraction.id);

        if (itemsError) {
          console.error(`❌ Error fetching items for extraction ${extraction.id}:`, itemsError);
          continue;
        }

        console.log(`📊 Actual extracted items for extraction ${extraction.id}:`);
        if (items.length === 0) {
          console.log('   ❌ NO ITEMS FOUND IN DATABASE - This explains the 0 count!');
        } else {
          console.log(`   ✅ Found ${items.length} items:`);
          items.forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.name} - $${item.price} (${item.category}) [from: ${item.source_document}]`);
          });
        }
        console.log('');
      }
    }

    // Check menu_items for the job's extraction results
    for (const job of jobs) {
      const { data: menuItems, error: menuError } = await supabase
        .from('menu_items')
        .select(`
          id,
          name,
          description,
          subcategory,
          menus,
          item_sizes (
            id,
            size,
            price
          ),
          item_modifiers (
            id,
            modifier_group,
            options
          )
        `)
        .eq('job_id', job.id);

      if (menuError) {
        console.error(`❌ Error fetching menu items for job ${job.id}:`, menuError);
        continue;
      }

      console.log(`🍽️  Menu items for job "${job.venue}" (${job.id}):`);
      if (menuItems.length === 0) {
        console.log('   ❌ NO MENU ITEMS FOUND - This explains why the table shows 0!');
      } else {
        console.log(`   ✅ Found ${menuItems.length} menu items:`);
        menuItems.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.name} (${item.subcategory || 'No category'})`);
          if (item.description) {
            console.log(`      Description: ${item.description}`);
          }
          if (item.item_sizes && item.item_sizes.length > 0) {
            console.log(`      Sizes: ${item.item_sizes.map(s => `${s.size}: $${s.price}`).join(', ')}`);
          }
          if (item.item_modifiers && item.item_modifiers.length > 0) {
            console.log(`      Modifiers: ${item.item_modifiers.length} groups`);
          }
        });
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

checkDatabase();