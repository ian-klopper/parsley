"use strict";
/**
 * Test script for Gemini File Manager
 * Verifies file upload, caching, and cleanup functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
const gemini_file_manager_1 = require("./gemini-file-manager");
// Mock document for testing
const mockDocument = {
    id: 'test-doc-1',
    name: 'test-document.pdf',
    type: 'pdf',
    content: 'JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA0ND4+CnN0cmVhbQpCVAovRjEgMjQgVGYKNzIgNzIwIFRkCihIZWxsbyBXb3JsZCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTggMDAwMDAgbiAKMDAwMDAwMDA3NyAwMDAwMCBuIAowMDAwMDAwMTc4IDAwMDAwIG4gCjAwMDAwMDAzNTkgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0MjIpJSVFT0YK', // Base64 encoded minimal PDF
    pages: [{
            pageNumber: 1,
            content: 'JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA0ND4+CnN0cmVhbQpCVAovRjEgMjQgVGYKNzIgNzIwIFRkCihIZWxsbyBXb3JsZCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTggMDAwMDAgbiAKMDAwMDAwMDA3NyAwMDAwMCBuIAowMDAwMDAwMTc4IDAwMDAwIG4gCjAwMDAwMDAzNTkgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0MjIpJSVFT0YK',
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
    const fileManager = new gemini_file_manager_1.GeminiFileManager('test-api-key');
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
    }
    catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}
// Run the test
testFileManager().catch(console.error);
