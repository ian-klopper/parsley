require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createExtractionTables() {
  try {
    console.log('🔧 Creating missing extraction tables...\n');

    // Create extracted_items table
    const createExtractedItemsSQL = `
      CREATE TABLE IF NOT EXISTS extracted_items (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        extraction_result_id UUID REFERENCES extraction_results(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10,2),
        category TEXT,
        subcategory TEXT,
        sizes JSONB DEFAULT '[]'::jsonb,
        modifier_groups JSONB DEFAULT '[]'::jsonb,
        source_document TEXT,
        confidence_score DECIMAL(3,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    const { error: createError } = await supabase.rpc('exec_sql', {
      sql_query: createExtractedItemsSQL
    });

    if (createError) {
      console.error('❌ Failed to create extracted_items table via RPC, trying direct SQL...');

      // Try alternative approach - execute via a simple INSERT to trigger SQL
      const { error: altError } = await supabase
        .from('information_schema.columns') // This exists and we can query it
        .select('*')
        .limit(1);

      console.log('Let me try creating the table via a different method...');

      // Let's use the raw SQL approach
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS extracted_items (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          extraction_result_id UUID REFERENCES extraction_results(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          price DECIMAL(10,2),
          category TEXT,
          subcategory TEXT,
          sizes JSONB DEFAULT '[]'::jsonb,
          modifier_groups JSONB DEFAULT '[]'::jsonb,
          source_document TEXT,
          confidence_score DECIMAL(3,2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_extracted_items_extraction_result_id
        ON extracted_items(extraction_result_id);

        CREATE INDEX IF NOT EXISTS idx_extracted_items_category
        ON extracted_items(category);
      `;

      console.log('⚠️  MANUAL SQL REQUIRED:');
      console.log('Please execute this SQL in your Supabase SQL editor:');
      console.log('');
      console.log(createTableQuery);
      console.log('');

    } else {
      console.log('✅ extracted_items table created successfully');
    }

    // Also check if we need to update the types file
    console.log('🔍 Checking current database types...');

  } catch (error) {
    console.error('❌ Failed to create tables:', error);

    // Print the SQL for manual execution
    console.log('');
    console.log('⚠️  PLEASE EXECUTE THIS SQL MANUALLY IN SUPABASE:');
    console.log('');
    console.log(`
CREATE TABLE IF NOT EXISTS extracted_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extraction_result_id UUID REFERENCES extraction_results(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  category TEXT,
  subcategory TEXT,
  sizes JSONB DEFAULT '[]'::jsonb,
  modifier_groups JSONB DEFAULT '[]'::jsonb,
  source_document TEXT,
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extracted_items_extraction_result_id
ON extracted_items(extraction_result_id);

CREATE INDEX IF NOT EXISTS idx_extracted_items_category
ON extracted_items(category);

-- Enable RLS
ALTER TABLE extracted_items ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can view extracted items for their jobs" ON extracted_items
FOR SELECT USING (
  extraction_result_id IN (
    SELECT er.id FROM extraction_results er
    JOIN jobs j ON j.id = er.job_id
    WHERE j.owner_id = auth.uid() OR j.id IN (
      SELECT job_id FROM job_collaborators WHERE user_id = auth.uid()
    )
  )
);
    `);
  }
}

createExtractionTables();