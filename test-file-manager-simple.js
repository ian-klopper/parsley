/**
 * Simple test for Gemini File Manager core functionality
 */

import { GeminiFileManager } from './gemini-file-manager.js';

// Mock document for testing
const mockDocument = {
  id: 'test-doc-1',
  name: 'test-document.pdf',
  type: 'pdf',
  content: 'JVBERi0xLjQK', // Minimal base64 PDF
  pages: [{
    pageNumber: 1,
    content: 'JVBERi0xLjQK',
    isImage: false,
    tokens: 50,
    hasContent: true
  }],
  metadata: {
    totalPages: 1,
    fileSize: 1024,
    hasText: true,
    totalTokens: 50
  }
};

async function testFileManager() {
  console.log('🧪 Testing Gemini File Manager...\n');

  // Initialize file manager
  const fileManager = new GeminiFileManager('test-api-key');

  try {
    // Test 1: Upload single document
    console.log('📤 Test 1: Uploading single document...');
    const uploadedFile = await fileManager.uploadDocument(mockDocument);
    console.log('✅ Upload successful:', {
      uri: uploadedFile.uri,
      name: uploadedFile.name,
      size: uploadedFile.size
    });

    // Test 2: Cache hit
    console.log('\n📋 Test 2: Testing cache (should be instant)...');
    const startTime = Date.now();
    const cachedFile = await fileManager.uploadDocument(mockDocument);
    const cacheTime = Date.now() - startTime;
    console.log(`✅ Cache hit in ${cacheTime}ms:`, cachedFile.uri);

    // Test 3: Get uploaded file
    console.log('\n🔍 Test 3: Retrieving uploaded file...');
    const retrievedFile = fileManager.getUploadedFile(mockDocument.id);
    console.log('✅ Retrieved file:', retrievedFile?.name);

    // Test 4: Get all files
    console.log('\n📊 Test 4: Getting all uploaded files...');
    const allFiles = fileManager.getAllUploadedFiles();
    console.log(`✅ Total files: ${allFiles.size}`);

    // Test 5: Get stats
    console.log('\n📈 Test 5: Getting upload statistics...');
    const stats = fileManager.getStats();
    console.log('✅ Stats:', stats);

    // Test 6: Delete file
    console.log('\n🗑️  Test 6: Deleting file...');
    const deleteResult = await fileManager.deleteFile(mockDocument.id);
    console.log(`✅ Delete result: ${deleteResult}`);

    // Test 7: Verify deletion
    console.log('\n🔍 Test 7: Verifying deletion...');
    const afterDelete = fileManager.getUploadedFile(mockDocument.id);
    console.log(`✅ File after deletion: ${afterDelete ? 'Still exists' : 'Removed'}`);

    // Test 8: Clear cache
    console.log('\n🧹 Test 8: Clearing cache...');
    fileManager.clearCache();
    const afterClear = fileManager.getAllUploadedFiles();
    console.log(`✅ Files after clear: ${afterClear.size}`);

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testFileManager().catch(console.error);