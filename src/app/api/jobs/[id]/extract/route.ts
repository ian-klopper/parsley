import { NextRequest } from 'next/server';
import { requireNonPending, handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';
import { ActivityLogger } from '@/lib/services/activity-logger';
import { extractMenu, validateDocuments, type DocumentMeta, type FinalMenuItem } from '@/lib/extraction-v2';
import { tabCategories, allTabs } from '@/lib/menu-data';

// Interface for job documents
interface JobDocument {
  id: string;
  job_id: string;
  file_name: string;
  storage_path: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
  uploader?: {
    full_name: string;
    email: string;
    initials: string;
  };
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Convert JobDocument to DocumentMeta for new extraction pipeline
function convertToDocumentMeta(doc: JobDocument): DocumentMeta {
  return {
    id: doc.id,
    name: doc.file_name,
    type: doc.file_type,
    url: doc.file_url
  };
}

// Helper function to map AI categories to tab structure using exact matching
function getTabForCategory(subcategory: string): string {
  if (!subcategory) return "Food";

  // Find which tab contains this exact category
  for (const [tabName, categories] of Object.entries(tabCategories)) {
    if (categories.includes(subcategory)) {
      return tabName;
    }
  }

  // Default to Food for unrecognized categories
  return "Food";
}

// Convert FinalMenuItem to legacy FoodItem format for backward compatibility
function convertToLegacyFormat(item: FinalMenuItem): any {
  return {
    name: item.name,
    description: item.description,
    subcategory: item.category,
    menus: item.section,
    sizes: item.sizes.map(size => ({
      size: size.size,
      price: size.price
    })),
    modifierGroups: item.modifierGroups.map(group => group.name).join(', ')
  };
}

// Save extracted items to normalized database tables
async function saveExtractedItems(
  supabase: any,
  extractionId: string,
  jobId: string,
  userId: string,
  items: FinalMenuItem[]
): Promise<void> {
  console.log(`💾 Saving ${items.length} items to normalized tables...`);

  if (items.length === 0) {
    console.log('No items to save');
    return;
  }

  // Insert menu items
  const menuItemsToInsert = items.map(item => ({
    job_id: jobId,
    extraction_id: extractionId,
    name: item.name,
    description: item.description,
    subcategory: item.category,
    menus: item.section,
    created_by: userId
  }));

  const { data: insertedItems, error: itemsError } = await supabase
    .from('menu_items')
    .insert(menuItemsToInsert)
    .select('id, name');

  if (itemsError) {
    console.error('Failed to insert menu items:', itemsError);
    throw new Error(`Failed to save menu items: ${itemsError.message}`);
  }

  console.log(`✅ Inserted ${insertedItems.length} menu items`);

  // Insert sizes and modifiers
  const sizesToInsert: any[] = [];
  const modifiersToInsert: any[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const insertedItem = insertedItems[i];

    // Add sizes
    if (item.sizes && item.sizes.length > 0) {
      item.sizes.forEach(size => {
        sizesToInsert.push({
          item_id: insertedItem.id,
          size: size.size,
          price: parseFloat(size.price) || 0.00
        });
      });
    }

    // Add modifiers
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      item.modifierGroups.forEach(group => {
        modifiersToInsert.push({
          item_id: insertedItem.id,
          modifier_group: group.name,
          options: group.options
        });
      });
    }
  }

  // Insert sizes
  if (sizesToInsert.length > 0) {
    const { error: sizesError } = await supabase
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
    const { error: modifiersError } = await supabase
      .from('item_modifiers')
      .insert(modifiersToInsert);

    if (modifiersError) {
      console.error('Failed to insert item modifiers:', modifiersError);
      throw new Error(`Failed to save item modifiers: ${modifiersError.message}`);
    }

    console.log(`✅ Inserted ${modifiersToInsert.length} item modifiers`);
  }

  console.log('🎉 Successfully saved all extracted items to normalized tables');
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireNonPending(request);
    const supabase = await createSupabaseServer();
    const params = await context.params;
    const jobId = params.id;

    // Get job details to verify access
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, venue, job_id, owner_id, created_by, status')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return Response.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if user can view this job
    const canView = job.created_by === user.id || job.owner_id === user.id || user.role === 'admin';

    if (!canView) {
      return Response.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Get all extraction results for this job
    const { data: allExtractions, error: extractionError } = await supabase
      .from('extraction_results')
      .select('id, extraction_status, item_count, extraction_cost, api_calls_count, processing_time_ms, created_at')
      .eq('job_id', jobId)
      .eq('extraction_status', 'completed')
      .order('created_at', { ascending: false });

    if (extractionError) {
      console.error('Error fetching extractions:', extractionError);
      return Response.json({ error: 'Failed to fetch extractions' }, { status: 500 });
    }

    if (!allExtractions || allExtractions.length === 0) {
      return Response.json({
        success: true,
        data: {
          items: [],
          hasResults: false,
          extractions: []
        }
      });
    }

    // Use the latest extraction for menu items
    const latestExtraction = allExtractions[0];

    // Fetch menu items with their sizes and modifiers
    console.log(`🔍 GET: Fetching menu items for job ${jobId}, extraction ${latestExtraction.id}`);
    const { data: menuItems, error: menuItemsError } = await supabase
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
          price,
          active
        ),
        item_modifiers (
          id,
          modifier_group,
          options
        )
      `)
      .eq('job_id', jobId)
      .eq('extraction_id', latestExtraction.id);

    console.log(`📊 GET: Found ${menuItems?.length || 0} menu items`);

    if (menuItemsError) {
      console.error('Failed to fetch menu items:', menuItemsError);
      return Response.json({
        success: false,
        error: 'Failed to fetch extraction results'
      }, { status: 500 });
    }

    // Transform to legacy format for backward compatibility
    const items = (menuItems || []).map(item => ({
      name: item.name,
      description: item.description || '',
      subcategory: item.subcategory,
      menus: item.menus || 'General',
      sizes: (item.item_sizes || [])
        .filter((size: any) => size.active)
        .map((size: any) => ({
          size: size.size || 'Regular',
          price: size.price?.toString() || '0.00'
        })),
      modifierGroups: (item.item_modifiers || [])
        .map((mod: any) => mod.modifier_group)
        .join(', ')
    }));

    // Group items by mapped tab categories
    const organizedData: Record<string, any> = {};

    // Initialize all tabs
    allTabs.forEach(tab => {
      organizedData[tab] = [];
    });

    // Map each item to its appropriate tab
    items.forEach(item => {
      const tab = getTabForCategory(item.subcategory);
      organizedData[tab].push(item);
    });

    // Update Menu Structure tab with overview info
    organizedData['Menu Structure'] = {
      totalItems: items.length,
      categories: Object.keys(organizedData).filter(key =>
        key !== 'Menu Structure' && key !== 'Modifiers' && organizedData[key].length > 0
      ).length,
      categoriesList: Object.keys(organizedData).filter(key =>
        key !== 'Menu Structure' && key !== 'Modifiers' && organizedData[key].length > 0
      )
    };

    return Response.json({
      success: true,
      data: {
        items,
        organizedData,
        hasResults: items.length > 0,
        extractions: allExtractions.map(ext => ({
          id: ext.id,
          itemCount: ext.item_count,
          extractionCost: ext.extraction_cost,
          apiCallsCount: ext.api_calls_count,
          processingTimeMs: ext.processing_time_ms,
          createdAt: ext.created_at
        }))
      }
    });

  } catch (error) {
    console.error('Get extraction results error:', error);
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireNonPending(request);
    const supabase = await createSupabaseServer();
    const params = await context.params;
    const jobId = params.id;

    console.log(`\n🚀 Starting 3-Phase Extraction for job ${jobId}`);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, venue, job_id, owner_id, created_by, status')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return Response.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const canEdit = job.created_by === user.id || job.owner_id === user.id || user.role === 'admin';

    if (!canEdit) {
      return Response.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Get all documents for this job
    const { data: documents, error: documentsError } = await supabase
      .from('job_documents')
      .select(`
        *,
        uploader:uploaded_by (
          full_name,
          email,
          initials
        )
      `)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (documentsError || !documents || documents.length === 0) {
      await ActivityLogger.logJobActivity(
        user.id,
        'job.extraction_failed',
        jobId,
        {
          description: `No documents found for "${job.venue}" to perform the extraction.`,
          error: documentsError?.message || 'No documents available',
          job_venue: job.venue,
          job_number: job.job_id
        }
      );

      return Response.json(
        { error: documentsError?.message || 'No documents found for extraction' },
        { status: 400 }
      );
    }

    // Download document content and convert to DocumentMeta format
    const documentMetas: DocumentMeta[] = await Promise.all(
      documents.map(async (doc) => {
        const { data, error } = await supabase.storage
          .from('job-documents')
          .download(doc.storage_path);

        if (error) {
          throw new Error(`Failed to download document ${doc.file_name}: ${error.message}`);
        }

        const buffer = await data.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');

        return {
          id: doc.id,
          name: doc.file_name,
          type: doc.file_type,
          content: base64
        };
      })
    );

    // Validate documents before processing
    const validation = validateDocuments(documentMetas);
    if (!validation.isValid) {
      console.error('Document validation failed:', validation.errors);
      return Response.json(
        { error: `Document validation failed: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
    }

    // Update job status to processing
    await supabase
      .from('jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);

    // Log extraction initiation
    const fileTypes = documents.map(doc => doc.file_type.split('/')[1]?.toUpperCase() || 'FILE').join(', ');
    const totalSize = documents.reduce((sum, doc) => sum + doc.file_size, 0);
    const formattedSize = formatFileSize(totalSize);

    await ActivityLogger.logJobActivity(
      user.id,
      'job.extraction_initiated',
      jobId,
      {
        description: `Starting 3-phase extraction for "${job.venue}" with ${documents.length} document(s). Using new pipeline with Gemini Pro for structure analysis and Flash models for item extraction.`,
        documents: documents.map(doc => doc.file_name),
        total_files: documents.length,
        total_size: formattedSize,
        file_types: fileTypes,
        job_venue: job.venue,
        job_number: job.job_id
      }
    );

    // Create extraction record
    const { data: extractionRecord, error: extractionInsertError } = await supabase
      .from('extraction_results')
      .insert({
        job_id: jobId,
        extraction_status: 'processing',
        extracted_by: user.id,
        item_count: 0
      })
      .select('id')
      .single();

    if (extractionInsertError || !extractionRecord) {
      console.error('Failed to create extraction record:', extractionInsertError);
      return Response.json(
        { error: 'Failed to initialize extraction' },
        { status: 500 }
      );
    }

    // Log processing start
    await ActivityLogger.logJobActivity(
      user.id,
      'job.extraction_processing',
      jobId,
      {
        description: `Processing "${job.venue}" through 3-phase pipeline: Phase 1 (Structure Analysis), Phase 2 (Item Extraction), Phase 3 (Modifier Enrichment).`,
        documents_total: documents.length,
        extraction_id: extractionRecord.id,
        job_venue: job.venue
      }
    );

    // Run the new 3-phase extraction pipeline
    console.log('🧠 Starting 3-Phase Extraction Pipeline...');
    const result = await extractMenu(documentMetas);

    if (!result.success) {
      // Handle extraction failure
      console.error('❌ 3-Phase extraction failed:', result.error);

      await supabase
        .from('extraction_results')
        .update({
          extraction_status: 'failed',
          error_message: result.error
        })
        .eq('id', extractionRecord.id);

      await supabase
        .from('jobs')
        .update({ status: 'error' })
        .eq('id', jobId);

      await ActivityLogger.logJobActivity(
        user.id,
        'job.extraction_failed',
        jobId,
        {
          description: `3-phase extraction failed for "${job.venue}": ${result.error}`,
          error: result.error,
          extraction_cost: result.costs.total,
          extraction_id: extractionRecord.id,
          job_venue: job.venue
        }
      );

      return Response.json(
        {
          error: result.error,
          logs: result.logs,
          totalCost: result.costs.total
        },
        { status: 500 }
      );
    }

    // Save extracted items to database
    console.log('💾 Saving extraction results...');
    await saveExtractedItems(
      supabase,
      extractionRecord.id,
      jobId,
      user.id,
      result.items || []
    );

    // Update extraction record with final results
    await supabase
      .from('extraction_results')
      .update({
        extraction_status: 'completed',
        item_count: result.items?.length || 0,
        extraction_cost: result.costs.total,
        api_calls_count: result.costs.totalCalls,
        processing_time_ms: result.processingTime
      })
      .eq('id', extractionRecord.id);

    // Update job status to complete
    await supabase
      .from('jobs')
      .update({ status: 'complete' })
      .eq('id', jobId);

    // Log successful completion
    const itemCount = result.items?.length || 0;
    const costPerItem = itemCount > 0 ? result.costs.total / itemCount : 0;

    await ActivityLogger.logJobActivity(
      user.id,
      'job.extraction_completed',
      jobId,
      {
        description: `Successfully completed 3-phase extraction for "${job.venue}". Extracted ${itemCount} items across ${result.structure?.sections.length || 0} menu sections. Real cost: $${result.costs.total.toFixed(6)} (${result.costs.totalCalls} API calls).`,
        items_extracted: itemCount,
        total_cost: result.costs.total,
        cost_per_item: costPerItem,
        api_calls: result.costs.totalCalls,
        processing_time: result.processingTime,
        phase_breakdown: {
          phase1_cost: result.costs.phase1.cost,
          phase2_cost: result.costs.phase2.cost,
          phase3_cost: result.costs.phase3.cost
        },
        extraction_id: extractionRecord.id,
        job_venue: job.venue
      }
    );

    console.log(`✅ 3-Phase extraction completed successfully!`);
    console.log(`📊 Results: ${itemCount} items, $${result.costs.total.toFixed(6)} total cost`);

    // Convert to legacy format for frontend compatibility
    const legacyItems = (result.items || []).map(convertToLegacyFormat);

    return Response.json({
      success: true,
      data: {
        items: legacyItems,
        structure: result.structure,
        extractionId: extractionRecord.id,
        itemCount,
        totalCost: result.costs.total,
        costBreakdown: {
          phase1: result.costs.phase1.cost,
          phase2: result.costs.phase2.cost,
          phase3: result.costs.phase3.cost
        },
        apiCalls: result.costs.totalCalls,
        processingTime: result.processingTime
      },
      message: `Successfully extracted ${itemCount} menu items using 3-phase pipeline ($${result.costs.total.toFixed(6)})`
    });

  } catch (error) {
    console.error('💥 Extraction API error:', error);

    // Try to log the error
    try {
      const params = await context.params;
      if (params.id) {
        const user = await requireNonPending(request);
        await ActivityLogger.logJobActivity(
          user.id,
          'job.extraction_error',
          params.id,
          {
            description: `Unexpected system error during 3-phase extraction: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error: error instanceof Error ? error.message : 'Unknown system error',
            error_type: 'system_error'
          }
        );
      }
    } catch (loggingError) {
      console.error('Failed to log extraction error:', loggingError);
    }

    return handleApiError(error);
  }
}