require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testImageExtraction() {
  try {
    const jobId = '635214c5-9b7a-4cf5-918f-b67e64b34af1';

    console.log('🔍 Testing image extraction specifically...\n');

    // Get the image document
    const { data: documents, error: docsError } = await supabase
      .from('job_documents')
      .select('*')
      .eq('job_id', jobId)
      .eq('file_name', 'camino-real-menu-02.jpg');

    if (docsError || !documents.length) {
      console.error('❌ Could not find image document:', docsError);
      return;
    }

    const imageDoc = documents[0];
    console.log(`📸 Found image: ${imageDoc.file_name}`);
    console.log(`   File type: ${imageDoc.file_type}`);
    console.log(`   Storage path: ${imageDoc.storage_path}`);
    console.log(`   File URL: ${imageDoc.file_url}`);

    // Check if we can access the file
    try {
      const response = await fetch(imageDoc.file_url);
      if (response.ok) {
        const size = response.headers.get('content-length');
        console.log(`✅ File is accessible, size: ${size} bytes`);
      } else {
        console.log(`❌ File not accessible: ${response.status} ${response.statusText}`);
      }
    } catch (fetchError) {
      console.log(`❌ Failed to fetch file:`, fetchError.message);
    }

    // Check what items were extracted from sources
    const { data: menuItems, error: itemsError } = await supabase
      .from('menu_items')
      .select('name, description, subcategory')
      .eq('job_id', jobId);

    if (itemsError) {
      console.error('❌ Error fetching menu items:', itemsError);
      return;
    }

    console.log(`\n📋 All extracted items (${menuItems.length} total):`);

    // Look for items that might be from Camino Real vs generic
    const uniqueItems = new Set();
    menuItems.forEach(item => {
      if (!uniqueItems.has(item.name)) {
        uniqueItems.add(item.name);
        const isGeneric = ['Crispy Calamari', 'Burrata Caprese', 'Steakhouse Burger', 'Pan-Seared Salmon'].includes(item.name);
        const indicator = isGeneric ? '🤔 (Generic?)' : '✅ (Specific?)';
        console.log(`   ${indicator} ${item.name} - ${item.subcategory}`);
        if (item.description) {
          console.log(`      "${item.description}"`);
        }
      }
    });

    console.log(`\n🎯 Analysis:`);
    console.log(`   - Total unique items: ${uniqueItems.size}`);
    console.log(`   - These items look very generic for a restaurant menu`);
    console.log(`   - Camino Real should have more specific/unique items`);
    console.log(`   - The AI might be hallucinating instead of reading the actual image`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testImageExtraction();