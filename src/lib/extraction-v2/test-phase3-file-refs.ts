/**
 * Test script to validate Phase 3 file reference integration
 * This tests the updated Phase 3 enrichment with Gemini file uploads
 */

import { enrichMenuItems } from '../phases/phase3-enrichment';
import { RealTokenTracker } from '../utils/token-tracker';
import { initializeFileManager } from '../gemini-file-manager';

// Mock data for testing
const mockDocuments = [
  {
    id: 'doc1',
    name: 'Test Menu 1',
    type: 'image' as const,
    content: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...', // Mock base64
    metadata: {
      fileSize: 1024,
      mimeType: 'image/jpeg'
    }
  }
];

const mockRawItems = [
  {
    name: 'Margherita Pizza',
    description: 'Classic pizza with tomato sauce, mozzarella, and basil',
    category: 'Pizza',
    price: '$12.99',
    section: 'Main Dishes',
    sourceInfo: {
      documentId: 'doc1',
      page: 1
    }
  },
  {
    name: 'Caesar Salad',
    description: 'Romaine lettuce with Caesar dressing, croutons, and parmesan',
    category: 'Salads',
    price: '$8.99',
    section: 'Appetizers',
    sourceInfo: {
      documentId: 'doc1',
      page: 1
    }
  }
];

async function testPhase3FileReferences() {
  console.log('🧪 Testing Phase 3 File Reference Integration...');

  try {
    // Initialize file manager (mock API key for testing)
    initializeFileManager('test-api-key');

    // Create token tracker
    const tokenTracker = new RealTokenTracker();

    // Test the enrichment function
    console.log('📤 Calling enrichMenuItems with file references...');
    const enrichedItems = await enrichMenuItems(mockRawItems, mockDocuments, tokenTracker);

    console.log('✅ Phase 3 enrichment completed successfully!');
    console.log(`📊 Enriched ${enrichedItems.length} items`);

    // Log results
    enrichedItems.forEach((item, index) => {
      console.log(`\n🍕 Item ${index + 1}: ${item.name}`);
      console.log(`   Category: ${item.category}`);
      console.log(`   Sizes: ${item.sizes.length} (${item.sizes.map(s => s.size).join(', ')})`);
      console.log(`   Modifiers: ${item.modifierGroups.length} groups`);
      item.modifierGroups.forEach((group, i) => {
        console.log(`     Group ${i + 1}: ${group.name} (${group.options.length} options)`);
      });
    });

    // Log token usage
    const stats = tokenTracker.getStats();
    console.log('\n💰 Token Usage:');
    console.log(`   Input: ${stats.totalInputTokens}`);
    console.log(`   Output: ${stats.totalOutputTokens}`);
    console.log(`   Cost: $${stats.totalCost.toFixed(4)}`);

    return enrichedItems;

  } catch (error) {
    console.error('❌ Phase 3 test failed:', error);
    throw error;
  }
}

// Export for use in other test files
export { testPhase3FileReferences };

// Run if called directly
if (require.main === module) {
  testPhase3FileReferences()
    .then(() => {
      console.log('\n🎉 All Phase 3 file reference tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Phase 3 file reference test failed:', error);
      process.exit(1);
    });
}