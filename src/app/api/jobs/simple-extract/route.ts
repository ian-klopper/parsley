import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import * as extractor from '@/lib/extraction-v2/simple-extractor';

/**
 * Parse modifier options to extract structured data with pricing
 */
function parseModifierOptions(options: string[]): Array<{name: string, price?: string}> {
  return options.map(option => {
    if (typeof option !== 'string') {
      return typeof option === 'object' && 'name' in option ? option as {name: string, price?: string} : { name: String(option) };
    }

    // Look for price patterns: "+$4", "(+$2.50)", "($3)", etc.
    const priceMatch = option.match(/[\(+]?\+?\$?([\d.]+)\)?/);

    if (priceMatch) {
      const price = priceMatch[1];
      const name = option.replace(/[\(+]?\+?\$?[\d.]+\)?/g, '').trim();
      return {
        name: name || option, // Fallback to full string if name becomes empty
        price: price
      };
    }

    // No price found, just return the name
    return { name: option.trim() };
  });
}

interface SimpleExtractionRequest {
  jobId: string;
  documents: Array<{
    url: string;
    name: string;
    type: string;
  }>;
}

export async function POST(request: NextRequest) {
  let jobId: string | undefined;

  try {
    console.log('🚀 Simple extract API called - parsing request...');
    const { jobId: extractedJobId, documents }: SimpleExtractionRequest = await request.json();
    jobId = extractedJobId;

    console.log(`📝 Request parsed - JobId: ${jobId}, Documents: ${documents?.length || 0}`);

    if (!jobId || !documents || documents.length === 0) {
      console.error('❌ Invalid request - missing jobId or documents');
      return NextResponse.json({
        error: 'Missing jobId or documents'
      }, { status: 400 });
    }

    console.log(`🚀 Starting simple extraction for job ${jobId} with ${documents.length} documents`);

    // Environment check
    console.log('🔍 Environment check:', {
      nodeEnv: process.env.NODE_ENV,
      hasGoogleAI: !!process.env.GOOGLE_AI_API_KEY,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      platform: process.platform
    });

    // Get Supabase client (regular client for storage, service client for database writes)
    console.log('🔗 Creating Supabase clients...');
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    // Create service client for database operations
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    console.log('✅ Supabase clients created');

    // Update job status to processing
    console.log('📝 Updating job status to processing...');
    await serviceSupabase
      .from('jobs')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
    console.log('✅ Job status updated');

    // Download documents from URLs to temporary files
    console.log('📥 Downloading documents...');
    const tempFiles: string[] = [];
    const documentIds: string[] = [];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      try {
        // Validate document has required properties
        if (!doc.url) {
          throw new Error(`Document ${doc.name || 'unknown'} has no URL`);
        }
        if (!doc.name) {
          throw new Error(`Document has no name`);
        }

        // Download to temp file
        console.log(`📥 Downloading: ${doc.name} from ${doc.url}`);
        const response = await fetch(doc.url);
        if (!response.ok) {
          throw new Error(`Failed to download ${doc.name}: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');

        // Create temp file
        const tempDir = os.tmpdir();
        const extension = doc.name.split('.').pop() || 'bin';
        const tempPath = path.join(tempDir, `${jobId}-${i}-${Date.now()}.${extension}`);

        fs.writeFileSync(tempPath, Buffer.from(buffer));
        tempFiles.push(tempPath);
        documentIds.push(doc.name.replace(/\.[^/.]+$/, ''));

        console.log(`✅ Downloaded: ${doc.name} -> ${tempPath}`);
      } catch (error) {
        console.error(`❌ Failed to download ${doc.name}:`, error);
        throw new Error(`Failed to download document: ${doc.name}`);
      }
    }

    // Run simple extraction (without progress tracking for now)
    console.log('🔍 Starting extraction...');
    const extractionResults = await extractor.extractMenuSimple(tempFiles, documentIds);

    // Save results to file
    const resultPath = `/tmp/extraction-${jobId}.json`;
    await extractor.saveResults(extractionResults, resultPath);

    // Upload results to storage and update database
    const fs = await import('fs');
    const resultsBuffer = fs.readFileSync(resultPath);
    const resultsBlob = new Blob([resultsBuffer], { type: 'application/json' });

    // Upload results file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('extraction-results')
      .upload(`${jobId}/simple-extraction-results.json`, resultsBlob, {
        contentType: 'application/json',
        upsert: true
      });

    if (uploadError) {
      console.error('Failed to upload results:', uploadError);
    }

    // Clean up temp files
    tempFiles.forEach(file => {
      try {
        fs.unlinkSync(file);
      } catch (error) {
        console.warn(`Failed to delete temp file ${file}:`, error);
      }
    });

    try {
      fs.unlinkSync(resultPath);
    } catch (error) {
      console.warn(`Failed to delete results file ${resultPath}:`, error);
    }

    // Save items to menu_items table with deduplication
    if (extractionResults.items.length > 0) {
      console.log(`💾 Saving ${extractionResults.items.length} items to menu_items table with deduplication...`);

      // Check for existing items in this job to prevent duplicates
      const { data: existingItems } = await serviceSupabase
        .from('menu_items')
        .select('name')
        .eq('job_id', jobId);

      const existingNames = new Set(existingItems?.map(item => item.name.toLowerCase().trim()) || []);

      // Filter out items that already exist for this job
      const uniqueItems = extractionResults.items.filter(item =>
        !existingNames.has(item.name.toLowerCase().trim())
      );

      const duplicateCount = extractionResults.items.length - uniqueItems.length;
      if (duplicateCount > 0) {
        console.log(`🔍 Found ${duplicateCount} duplicate items, inserting only ${uniqueItems.length} unique items`);
      }

      let insertedItems: any[] = [];

      if (uniqueItems.length > 0) {
        const menuItemsToInsert = uniqueItems.map(item => ({
          job_id: jobId,
          extraction_id: null, // Simple extraction doesn't have extraction records
          name: item.name,
          description: item.description || '',
          subcategory: item.category || 'Uncategorized',
          menus: item.section || 'Unknown',
          created_by: null // Simple extraction doesn't have user context
        }));

        const { data: insertedItemsData, error: itemsError } = await serviceSupabase
          .from('menu_items')
          .insert(menuItemsToInsert)
          .select('id, name');

        if (itemsError) {
          console.error('Failed to insert menu items:', itemsError);
          throw new Error(`Failed to save menu items: ${itemsError.message}`);
        }

        insertedItems = insertedItemsData || [];
        console.log(`✅ Inserted ${insertedItems.length} unique menu items to table`);
      } else {
        console.log(`📝 No unique items to insert - all items already exist in database`);
      }

      // Insert sizes and modifiers for each unique item that was actually inserted
      const sizesToInsert: any[] = [];
      const modifiersToInsert: any[] = [];

      if (uniqueItems.length > 0 && insertedItems && insertedItems.length > 0) {
        for (let i = 0; i < uniqueItems.length; i++) {
          const item = uniqueItems[i];
          const insertedItem = insertedItems[i];

          // Add sizes
          if (item.sizes && item.sizes.length > 0) {
            item.sizes.forEach(size => {
              sizesToInsert.push({
                item_id: insertedItem.id,
                size: size.size || 'Regular',
                price: parseFloat(size.price) || 0.00,
                active: true
              });
            });
          }

          // Add modifiers with structured parsing
          if (item.modifierGroups && item.modifierGroups.length > 0) {
            item.modifierGroups.forEach(group => {
              // Parse options to extract pricing information
              const parsedOptions = Array.isArray(group.options)
                ? parseModifierOptions(group.options)
                : [];

              modifiersToInsert.push({
                item_id: insertedItem.id,
                modifier_group: group.name,
                options: parsedOptions
              });
            });
          }
        }
      }

      // Insert sizes
      if (sizesToInsert.length > 0) {
        const { error: sizesError } = await serviceSupabase
          .from('item_sizes')
          .insert(sizesToInsert);

        if (sizesError) {
          console.error('Failed to insert item sizes:', sizesError);
          throw new Error(`Failed to save item sizes: ${sizesError.message}`);
        }

        console.log(`✅ Inserted ${sizesToInsert.length} item sizes`);
      }

      // Insert modifiers
      if (modifiersToInsert.length > 0) {
        const { error: modifiersError } = await serviceSupabase
          .from('item_modifiers')
          .insert(modifiersToInsert);

        if (modifiersError) {
          console.error('Failed to insert item modifiers:', modifiersError);
          throw new Error(`Failed to save item modifiers: ${modifiersError.message}`);
        }

        console.log(`✅ Inserted ${modifiersToInsert.length} item modifiers`);
      }

      console.log('🎉 Successfully saved all extracted items with sizes and modifiers to database');
    }

    // Update job with results
    const jobUpdate = {
      status: 'complete' as const,
      results: {
        success: true,
        totalItems: extractionResults.items.length,
        totalDocuments: extractionResults.processedFiles.length,
        totalCost: extractionResults.totalCost,
        extractionType: 'simple',
        items: extractionResults.items,
        summary: {
          categories: extractionResults.items.reduce((acc, item) => {
            const cat = item.category || 'Uncategorized';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      },
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await serviceSupabase
      .from('jobs')
      .update(jobUpdate)
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to update job:', updateError);
      throw updateError;
    }

    console.log(`✅ Simple extraction completed for job ${jobId}`);
    console.log(`📊 Results: ${extractionResults.items.length} items from ${extractionResults.processedFiles.length} documents`);
    console.log(`💰 Total cost: $${extractionResults.totalCost.toFixed(6)}`);

    return NextResponse.json({
      success: true,
      jobId,
      results: {
        totalItems: extractionResults.items.length,
        totalDocuments: extractionResults.processedFiles.length,
        totalCost: extractionResults.totalCost,
        processedFiles: extractionResults.processedFiles,
        extractionType: 'simple'
      }
    });

  } catch (error) {
    console.error('Simple extraction failed:', error);

    // Try to update job status to failed (if we have a jobId)
    if (jobId) {
      try {
        const { createClient: createServiceClient } = await import('@supabase/supabase-js');
        const serviceSupabase = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        await serviceSupabase
          .from('jobs')
          .update({
            status: 'failed',
            results: {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              extractionType: 'simple'
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
      } catch (updateError) {
        console.error('Failed to update job status to failed:', updateError);
      }
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Simple extraction failed'
    }, { status: 500 });
  }
}