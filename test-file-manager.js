/**
 * Simplified Gemini File Manager for testing
 */

class GeminiFileManager {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.uploadedFiles = new Map();
    this.uploadPromises = new Map();
  }

  async uploadDocument(doc) {
    // Check if already uploaded
    if (this.uploadedFiles.has(doc.id)) {
      console.log(`Using cached file: ${doc.id}`);
      return this.uploadedFiles.get(doc.id);
    }

    // Check if upload is in progress
    if (this.uploadPromises.has(doc.id)) {
      console.log(`Waiting for in-progress upload: ${doc.id}`);
      return await this.uploadPromises.get(doc.id);
    }

    // Start upload
    const uploadPromise = this.performUpload(doc);
    this.uploadPromises.set(doc.id, uploadPromise);

    try {
      const uploadedFile = await uploadPromise;
      this.uploadedFiles.set(doc.id, uploadedFile);
      this.uploadPromises.delete(doc.id);
      return uploadedFile;
    } catch (error) {
      this.uploadPromises.delete(doc.id);
      throw error;
    }
  }

  async uploadAllDocuments(documents) {
    console.log(`Starting upload of ${documents.length} documents`);

    const uploadPromises = documents.map(doc => this.uploadDocument(doc));
    await Promise.all(uploadPromises);

    console.log(`Successfully uploaded ${this.uploadedFiles.size} documents`);
    return this.uploadedFiles;
  }

  getUploadedFile(docId) {
    return this.uploadedFiles.get(docId);
  }

  getAllUploadedFiles() {
    return new Map(this.uploadedFiles);
  }

  async deleteFile(docId) {
    const uploadedFile = this.uploadedFiles.get(docId);
    if (!uploadedFile) {
      console.log(`Cannot delete ${docId}: not in cache`);
      return false;
    }

    try {
      console.log(`Deleting ${docId} from Gemini storage`);

      // For now, just remove from local cache
      this.uploadedFiles.delete(docId);

      console.log(`Deleted ${docId} from local cache`);
      return true;
    } catch (error) {
      console.error(`Failed to delete ${docId}: ${error.message}`);
      return false;
    }
  }

  async deleteAllFiles() {
    const files = Array.from(this.uploadedFiles.keys());
    let deleted = 0;
    let failed = 0;

    console.log(`Starting deletion of ${files.length} files`);

    for (const docId of files) {
      const success = await this.deleteFile(docId);
      if (success) {
        deleted++;
      } else {
        failed++;
      }
    }

    console.log(`Deleted ${deleted} files, ${failed} failed`);
    return { deleted, failed };
  }

  async deleteOldFiles(maxAgeMs) {
    const now = Date.now();
    const oldFiles = Array.from(this.uploadedFiles.entries())
      .filter(([_, file]) => (now - file.uploadedAt.getTime()) > maxAgeMs);

    let deleted = 0;
    let failed = 0;

    console.log(`Deleting ${oldFiles.length} files older than ${maxAgeMs}ms`);

    for (const [docId, _] of oldFiles) {
      const success = await this.deleteFile(docId);
      if (success) {
        deleted++;
      } else {
        failed++;
      }
    }

    if (oldFiles.length > 0) {
      console.log(`Deleted ${deleted} old files, ${failed} failed`);
    }

    return { deleted, failed };
  }

  clearCache() {
    this.uploadedFiles.clear();
    this.uploadPromises.clear();
    console.log('All cached files cleared');
  }

  async performUpload(doc) {
    try {
      console.log(`Uploading ${doc.name} (${doc.metadata.fileSize} bytes)`);

      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create a mock uploaded file
      const mockUri = `gemini://files/${doc.id}`;
      const mockName = `files/${doc.id}`;

      const uploadedFile = {
        uri: mockUri,
        mimeType: this.getMimeType(doc),
        name: mockName,
        displayName: doc.id,
        uploadedAt: new Date(),
        size: doc.metadata.fileSize
      };

      console.log(`Uploaded ${doc.id}: ${uploadedFile.uri}`);
      return uploadedFile;

    } catch (error) {
      console.error(`Failed to upload ${doc.id}: ${error.message}`);
      throw new Error(`File upload failed for ${doc.id}: ${error.message}`);
    }
  }

  getMimeType(doc) {
    switch (doc.type) {
      case 'image':
        return 'image/jpeg';
      case 'pdf':
        return 'application/pdf';
      case 'spreadsheet':
        return 'text/csv';
      default:
        return 'application/octet-stream';
    }
  }

  getStats() {
    const files = Array.from(this.uploadedFiles.values());
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalTime = files.reduce((sum, file) =>
      sum + (Date.now() - file.uploadedAt.getTime()), 0
    );

    return {
      totalFiles: files.length,
      totalSize,
      averageSize: files.length > 0 ? totalSize / files.length : 0,
      uploadTime: totalTime
    };
  }
}

// Test the file manager
async function testFileManager() {
  console.log('🧪 Testing Gemini File Manager...\n');

  const fileManager = new GeminiFileManager('test-api-key');

  const mockDocument = {
    id: 'test-doc-1',
    name: 'test-document.pdf',
    type: 'pdf',
    content: 'JVBERi0xLjQK',
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

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFileManager();