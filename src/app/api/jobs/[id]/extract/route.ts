import { NextRequest } from 'next/server';
import { requireNonPending, handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';
import { ActivityLogger } from '@/lib/services/activity-logger';
import { OptimizedExtractionPipeline, type DocumentMeta } from '@/lib/optimized-extraction-pipeline';
import type { FoodItem } from '@/lib/food-data';
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

// Helper function to convert JobDocument to document URL format for the pipeline
function convertJobDocumentToUrlFormat(doc: JobDocument): { id: string; url: string; type: string; name: string } {
  return {
    id: doc.id,
    url: doc.file_url,
    type: doc.file_type,
    name: doc.file_name
  };
}

// Helper function to save extracted items to normalized tables
async function saveExtractedItemsToNormalizedTables(
  supabase: any,
  extractionId: string,
  jobId: string,
  userId: string,
  items: FoodItem[]
): Promise<void> {
  console.log(`Saving ${items.length} items to normalized tables...`);

  // Insert all menu items first
  const menuItemsToInsert = items.map(item => ({
    job_id: jobId,
    extraction_id: extractionId,
    name: item.name,
    description: item.description || '',
    subcategory: item.subcategory,
    menus: item.menus || 'General',
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

  console.log(`Inserted ${insertedItems.length} menu items`);

  // Now insert sizes and modifiers for each item
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
          size: size.size || 'Regular',
          price: parseFloat(size.price) || 0.00
        });
      });
    } else {
      // Default size if none specified
      sizesToInsert.push({
        item_id: insertedItem.id,
        size: 'Regular',
        price: 0.00
      });
    }

    // Add modifiers if present
    if (item.modifierGroups && item.modifierGroups.trim()) {
      modifiersToInsert.push({
        item_id: insertedItem.id,
        modifier_group: item.modifierGroups,
        options: []
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

    console.log(`Inserted ${sizesToInsert.length} item sizes`);
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

    console.log(`Inserted ${modifiersToInsert.length} item modifiers`);
  }

  console.log('Successfully saved all extracted items to normalized tables');
}

// Helper function to map AI subcategories to existing tab structure
function getTabForCategory(subcategory: string): string {
  if (!subcategory) return "Food";

  const lowerSubcat = subcategory.toLowerCase();

  // Food categories (most common)
  if (["appetizer", "salad", "entree", "burger", "steak", "pasta", "seafood", "poultry", "side", "dessert", "soup", "sandwich", "pizza"].includes(lowerSubcat)) {
    return "Food";
  }

  // Cocktails + Shots
  if (["cocktail", "shot", "mixed drink", "martini", "margarita"].includes(lowerSubcat)) {
    return "Cocktails + Shots";
  }

  // Beer + RTDs
  if (["beer", "rtd", "draft", "bottle beer", "can beer", "ready to drink", "hard seltzer", "cider"].includes(lowerSubcat)) {
    return "Beer + RTDs";
  }

  // Wine
  if (["wine", "red wine", "white wine", "sparkling wine", "champagne", "prosecco"].includes(lowerSubcat)) {
    return "Wine";
  }

  // Liquor
  if (["tequila", "mezcal", "vodka", "whiskey", "whisky", "scotch", "gin", "rum", "bourbon", "brandy", "liqueur", "spirit"].includes(lowerSubcat)) {
    return "Liquor";
  }

  // Non-Alcoholic
  if (["non-alcoholic", "mocktail", "soda", "juice", "coffee", "tea", "water", "soft drink"].includes(lowerSubcat)) {
    return "Non-Alcoholic";
  }

  // Merchandise
  if (["merchandise", "gift", "souvenir", "retail", "clothing", "accessory"].includes(lowerSubcat)) {
    return "Merchandise";
  }

  // Default to Food for unrecognized categories
  return "Food";
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

    // Get all extraction results for this job to calculate total cost
    const { data: allExtractions, error: extractionError } = await supabase
      .from('extraction_results')
      .select('id, extraction_status, item_count, extraction_cost, api_calls_count, processing_time_ms, created_at')
      .eq('job_id', jobId)
      .eq('extraction_status', 'completed')
      .order('created_at', { ascending: false });

    if (extractionError || !allExtractions || allExtractions.length === 0) {
      // No extraction results found - return empty array
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
      .eq('extraction_id', extractionResult.id);

    console.log(`📊 GET: Found ${menuItems?.length || 0} menu items`);

    if (menuItemsError) {
      console.error('Failed to fetch menu items:', menuItemsError);
      return Response.json({
        success: false,
        error: 'Failed to fetch extraction results'
      }, { status: 500 });
    }

    // Transform to FoodItem format for backward compatibility
    const items: FoodItem[] = (menuItems || []).map(item => ({
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

    // Initialize all tabs from the predefined structure
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

    const hasAnyItems = items.length > 0;

    return Response.json({
      success: true,
      data: {
        items,
        organizedData,
        hasResults: hasAnyItems,
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


    // Get job details for logging
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

    // Check if user can modify this job
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

    console.log('Documents from DB:', documents);

    if (documentsError || !documents || documents.length === 0) {
      await ActivityLogger.logJobActivity(
        user.id,
        'job.extraction_failed',
        jobId,
        {
          description: `I regret to inform you that no documents were found for "${job.venue}" to perform the extraction. Perhaps some files should be uploaded first before attempting the analysis.`,
          error: documentsError?.message || 'No documents available for extraction',
          job_venue: job.venue,
          job_number: job.job_id
        }
      );

      return Response.json(
        { error: documentsError?.message || 'No documents found for extraction' },
        { status: 400 }
      );
    }

    // Create signed URLs for documents to ensure server/external access (in case bucket is private)
    const STORAGE_BUCKET = 'job-documents';
    const signedDocuments: JobDocument[] = await Promise.all(
      (documents || []).map(async (doc) => {
        try {
          const { data: signed, error: signErr } = await supabase
            .storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(doc.storage_path, 60 * 60); // 1 hour

          if (signErr) {
            console.warn('Failed to sign URL for', doc.storage_path, signErr.message);
            return doc;
          }

          if (signed?.signedUrl) {
            return { ...doc, file_url: signed.signedUrl } as JobDocument;
          }

          return doc;
        } catch (e) {
          console.warn('Error creating signed URL for', doc.storage_path, e);
          return doc;
        }
      })
    );

    // Update job status to processing
    const { error: statusUpdateError } = await supabase
      .from('jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);

    if (statusUpdateError) {
      console.error('Failed to update job status:', statusUpdateError);
    }

    // Log extraction initiation with butler-style description
  const fileTypes = signedDocuments.map(doc => doc.file_type.split('/')[1]?.toUpperCase() || 'FILE').join(', ');
  const totalSize = signedDocuments.reduce((sum, doc) => sum + doc.file_size, 0);
    const formattedSize = formatFileSize(totalSize);

    await ActivityLogger.logJobActivity(
      user.id,
      'job.extraction_initiated',
      jobId,
      {
        description: `Sir ${user.full_name || user.email} has requested that I analyze ${documents.length} document${documents.length > 1 ? 's' : ''} for the establishment "${job.venue}". I shall commence the extraction process forthwith, examining ${fileTypes} files totalling ${formattedSize} to discern the culinary offerings contained within.`,
        documents: signedDocuments.map(doc => doc.file_name),
        total_files: documents.length,
        total_size: formattedSize,
        file_types: fileTypes,
        job_venue: job.venue,
        job_number: job.job_id
      }
    );

    // Create initial extraction result record
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
        description: `I am presently engaged in a thorough analysis of the documents for "${job.venue}". The artificial intelligence is carefully examining each page, identifying menu items, prices, and categories with meticulous attention to detail. This process may take a few moments as I ensure nothing is overlooked.`,
        documents_total: documents.length,
        extraction_id: extractionRecord.id,
        job_venue: job.venue
      }
    );

    // Perform the optimized extraction
    let extractionResult;
    try {
      console.log('🚀 Starting optimized extraction pipeline');

      // Convert documents to DocumentMeta format for optimized pipeline
      const documentMetas: DocumentMeta[] = signedDocuments.map(doc => ({
        id: doc.id,
        name: doc.file_name,
        type: doc.file_type,
        url: doc.file_url
      }));

      const optimizedPipeline = new OptimizedExtractionPipeline();
      const optimizedResult = await optimizedPipeline.processDocumentsOptimized(documentMetas);

      console.log('✅ Optimized pipeline completed successfully');
      console.log(`📊 Results: ${optimizedResult.phase3Results.enrichedItems.length} enriched items`);

      // Convert optimized results to FoodItem format
      const foodItems: FoodItem[] = optimizedResult.phase3Results.enrichedItems.map(enrichedItem => {
        const coreItem = enrichedItem.coreItem;

        return {
          name: coreItem.name,
          description: coreItem.description || '',
          subcategory: coreItem.category,
          menus: 'General',
          sizes: enrichedItem.sizeOptions?.map(sizeOption => ({
            size: sizeOption.name,
            price: sizeOption.priceAdjustment ?
              (parseFloat(coreItem.basePrice.replace(/[^0-9.]/g, '')) +
               parseFloat(sizeOption.priceAdjustment.replace(/[^0-9.]/g, ''))).toFixed(2) :
              coreItem.basePrice.replace(/[^0-9.]/g, '') || '0.00'
          })) || [{
            size: 'Regular',
            price: coreItem.basePrice.replace(/[^0-9.]/g, '') || '0.00'
          }],
          modifierGroups: enrichedItem.modifierGroups?.map(group =>
            group.options.map(opt => opt.name).join(', ')
          ).join('; ') || ''
        };
      });

      const categoryBreakdown = foodItems.reduce((acc: Record<string, number>, item) => {
        acc[item.subcategory] = (acc[item.subcategory] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      extractionResult = {
        success: true,
        items: foodItems,
        organizedData: {
          phase1: optimizedResult.phase1Results,
          phase2: optimizedResult.phase2Results,
          phase3: optimizedResult.phase3Results
        },
        categoryBreakdown,
        documentsProcessed: documentMetas.map(doc => doc.name),
        extractionDuration: optimizedResult.costAnalysis.processingTimeMs,
        optimizedPipeline: true,
        costAnalysis: optimizedResult.costAnalysis
      };

    } catch (extractionError) {
      console.error('Gemini extraction failed:', extractionError);

      // Update extraction record as failed
      await supabase
        .from('extraction_results')
        .update({
          extraction_status: 'failed',
          error_message: extractionError instanceof Error ? extractionError.message : 'Unknown extraction error'
        })
        .eq('id', extractionRecord.id);

      // Update job status to extraction_failed
      await supabase
        .from('jobs')
        .update({ status: 'extraction_failed' })
        .eq('id', jobId);

      // Log extraction failure
      await ActivityLogger.logJobActivity(
        user.id,
        'job.extraction_failed',
        jobId,
        {
          description: `I regret to inform you that the extraction process for "${job.venue}" has encountered an unexpected difficulty with the artificial intelligence service. The error appears to be: "${extractionError instanceof Error ? extractionError.message : 'Unknown error'}". I recommend reviewing the documents and perhaps trying again momentarily.`,
          error: extractionError instanceof Error ? extractionError.message : 'Unknown extraction error',
          documents_attempted: signedDocuments.map(doc => doc.file_name),
          extraction_duration: 0,
          job_venue: job.venue,
          job_number: job.job_id
        }
      );

      return Response.json(
        { error: 'Extraction failed: ' + (extractionError instanceof Error ? extractionError.message : 'Unknown error') },
        { status: 500 }
      );
    }

    if (!extractionResult.success) {
      // Update extraction record as failed
      await supabase
        .from('extraction_results')
        .update({
          extraction_status: 'failed',
          error_message: extractionResult.error || 'Extraction failed'
        })
        .eq('id', extractionRecord.id);

      // Update job status to extraction_failed
      await supabase
        .from('jobs')
        .update({ status: 'extraction_failed' })
        .eq('id', jobId);

      // Log extraction failure with butler-style description
      await ActivityLogger.logJobActivity(
        user.id,
        'job.extraction_failed',
        jobId,
        {
          description: `I regret to inform you that the extraction process for "${job.venue}" has encountered an unexpected difficulty. ${extractionResult.error || 'The analysis could not be completed successfully'}. I recommend reviewing the documents and perhaps trying again momentarily.`,
          error: extractionResult.error || 'Extraction failed',
          documents_attempted: extractionResult.documentsProcessed || signedDocuments.map(doc => doc.file_name),
          extraction_duration: extractionResult.extractionDuration,
          job_venue: job.venue,
          job_number: job.job_id
        }
      );

      return Response.json(
        { error: extractionResult.error || 'Extraction failed' },
        { status: 500 }
      );
    }

    // Extraction successful - save items to normalized tables
    try {
      await saveExtractedItemsToNormalizedTables(
        supabase,
        extractionRecord.id,
        jobId,
        user.id,
        extractionResult.items || []
      );

      // Update extraction record as completed with cost data
      const { error: updateError } = await supabase
        .from('extraction_results')
        .update({
          extraction_status: 'completed',
          item_count: extractionResult.items?.length || 0,
          extraction_cost: extractionResult.costAnalysis?.breakdown.total || 0,
          api_calls_count: (extractionResult.costAnalysis?.metrics.apiCalls.flash || 0) +
                          (extractionResult.costAnalysis?.metrics.apiCalls.pro || 0),
          processing_time_ms: extractionResult.costAnalysis?.processingTimeMs || 0
        })
        .eq('id', extractionRecord.id);

      if (updateError) {
        console.error('Failed to update extraction record:', updateError);
      }
    } catch (saveError) {
      console.error('Failed to save items to normalized tables:', saveError);

      // Mark extraction as failed
      await supabase
        .from('extraction_results')
        .update({
          extraction_status: 'failed',
          error_message: saveError instanceof Error ? saveError.message : 'Failed to save extracted items'
        })
        .eq('id', extractionRecord.id);

      return Response.json(
        { error: 'Failed to save extraction results: ' + (saveError instanceof Error ? saveError.message : 'Unknown error') },
        { status: 500 }
      );
    }

    // Update job status to complete
    await supabase
      .from('jobs')
      .update({ status: 'complete' })
      .eq('id', jobId);

    // Create natural language description of the results
    const itemCount = extractionResult.items?.length || 0;
    const categoryBreakdown = extractionResult.categoryBreakdown || {};
    const categories = Object.keys(categoryBreakdown);
    const formattedBreakdown = Object.entries(categoryBreakdown)
      .map(([category, count]) => `${count} ${category.toLowerCase()} item${count !== 1 ? 's' : ''}`)
      .join(', ');
    const durationInSeconds = Math.round((extractionResult.extractionDuration || 0) / 1000);

    // Log successful extraction with detailed butler-style description
    await ActivityLogger.logJobActivity(
      user.id,
      'job.extraction_completed',
      jobId,
      {
        description: `Splendid! I have successfully extracted ${itemCount} menu item${itemCount !== 1 ? 's' : ''} from the provided documents for "${job.venue}". The analysis revealed ${formattedBreakdown} across ${categories.length} distinct categor${categories.length !== 1 ? 'ies' : 'y'}. The entire process was completed in ${durationInSeconds} second${durationInSeconds !== 1 ? 's' : ''}, and the data has been meticulously organized and is now available for your perusal.`,
        items_extracted: itemCount,
        categories_found: categories,
        category_breakdown: categoryBreakdown,
        extraction_duration: durationInSeconds,
        documents_processed: extractionResult.documentsProcessed,
        job_venue: job.venue,
        job_number: job.job_id,
        extraction_id: extractionRecord.id
      }
    );

    // Return the extracted data
    return Response.json({
      success: true,
      data: {
        items: extractionResult.items,
        organizedData: extractionResult.organizedData || {},
        extractionId: extractionRecord.id,
        itemCount,
        categories,
        categoryBreakdown,
        documentsProcessed: extractionResult.documentsProcessed,
        extractionDuration: extractionResult.extractionDuration
      },
      message: `Successfully extracted ${itemCount} menu items`
    });

  } catch (error) {
    console.error('Extraction API error:', error);

    // Try to log the error if we have the necessary information
    try {
      const params = await context.params;
      if (params.id) {
        const user = await requireNonPending(request);
        await ActivityLogger.logJobActivity(
          user.id,
          'job.extraction_error',
          params.id,
          {
            description: `I regret to inform you that an unexpected error occurred during the extraction process. The system encountered: "${error instanceof Error ? error.message : 'Unknown system error'}". Please try again, and if the issue persists, contact support.`,
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