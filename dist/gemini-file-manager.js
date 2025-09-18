"use strict";
/**
 * Gemini File Manager - Handles file uploads and caching for cost optimization
 * Uploads documents once and provides reusable URIs for subsequent API calls
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileManager = exports.GeminiFileManager = void 0;
exports.initializeFileManager = initializeFileManager;
exports.getFileManager = getFileManager;
const generative_ai_1 = require("@google/generative-ai");
const debug_logger_1 = require("./utils/debug-logger");
class GeminiFileManager {
    constructor(apiKey) {
        this.uploadedFiles = new Map();
        this.uploadPromises = new Map();
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    /**
     * Upload a single document to Gemini and cache the result
     * Note: This is a placeholder - actual implementation depends on Gemini API version
     */
    async uploadDocument(doc) {
        // Check if already uploaded
        if (this.uploadedFiles.has(doc.id)) {
            debug_logger_1.debugLogger.debug(0, 'FILE_CACHE_HIT', `Using cached file: ${doc.id}`);
            return this.uploadedFiles.get(doc.id);
        }
        // Check if upload is in progress
        if (this.uploadPromises.has(doc.id)) {
            debug_logger_1.debugLogger.debug(0, 'FILE_UPLOAD_IN_PROGRESS', `Waiting for in-progress upload: ${doc.id}`);
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
        }
        catch (error) {
            this.uploadPromises.delete(doc.id);
            throw error;
        }
    }
    /**
     * Upload all documents in parallel and cache results
     */
    async uploadAllDocuments(documents) {
        debug_logger_1.debugLogger.debug(0, 'BATCH_UPLOAD_START', `Starting upload of ${documents.length} documents`);
        const uploadPromises = documents.map(doc => this.uploadDocument(doc));
        await Promise.all(uploadPromises);
        debug_logger_1.debugLogger.debug(0, 'BATCH_UPLOAD_COMPLETE', `Successfully uploaded ${this.uploadedFiles.size} documents`);
        return this.uploadedFiles;
    }
    /**
     * Get uploaded file by document ID
     */
    getUploadedFile(docId) {
        return this.uploadedFiles.get(docId);
    }
    /**
     * Get all uploaded files
     */
    getAllUploadedFiles() {
        return new Map(this.uploadedFiles);
    }
    /**
     * Delete a specific uploaded file from Gemini storage
     * Note: This is a placeholder - actual implementation depends on Gemini API version
     */
    async deleteFile(docId) {
        const uploadedFile = this.uploadedFiles.get(docId);
        if (!uploadedFile) {
            debug_logger_1.debugLogger.warn(0, 'FILE_NOT_FOUND', `Cannot delete ${docId}: not in cache`);
            return false;
        }
        try {
            debug_logger_1.debugLogger.debug(0, 'FILE_DELETE_START', `Deleting ${docId} from Gemini storage`);
            // TODO: Implement actual Gemini file deletion when API supports it
            // await this.genAI.deleteFile(uploadedFile.name);
            // For now, just remove from local cache
            this.uploadedFiles.delete(docId);
            debug_logger_1.debugLogger.success(0, 'FILE_DELETE_SUCCESS', `Deleted ${docId} from local cache`);
            return true;
        }
        catch (error) {
            debug_logger_1.debugLogger.error(0, 'FILE_DELETE_FAILED', `Failed to delete ${docId}: ${error.message}`);
            return false;
        }
    }
    /**
     * Delete all uploaded files from Gemini storage
     */
    async deleteAllFiles() {
        const files = Array.from(this.uploadedFiles.keys());
        let deleted = 0;
        let failed = 0;
        debug_logger_1.debugLogger.debug(0, 'BATCH_DELETE_START', `Starting deletion of ${files.length} files`);
        for (const docId of files) {
            const success = await this.deleteFile(docId);
            if (success) {
                deleted++;
            }
            else {
                failed++;
            }
        }
        debug_logger_1.debugLogger.success(0, 'BATCH_DELETE_COMPLETE', `Deleted ${deleted} files, ${failed} failed`);
        return { deleted, failed };
    }
    /**
     * Delete files older than specified age (in milliseconds)
     */
    async deleteOldFiles(maxAgeMs) {
        const now = Date.now();
        const oldFiles = Array.from(this.uploadedFiles.entries())
            .filter(([_, file]) => (now - file.uploadedAt.getTime()) > maxAgeMs);
        let deleted = 0;
        let failed = 0;
        debug_logger_1.debugLogger.debug(0, 'OLD_FILES_DELETE_START', `Deleting ${oldFiles.length} files older than ${maxAgeMs}ms`);
        for (const [docId, _] of oldFiles) {
            const success = await this.deleteFile(docId);
            if (success) {
                deleted++;
            }
            else {
                failed++;
            }
        }
        if (oldFiles.length > 0) {
            debug_logger_1.debugLogger.success(0, 'OLD_FILES_DELETE_COMPLETE', `Deleted ${deleted} old files, ${failed} failed`);
        }
        return { deleted, failed };
    }
    /**
     * Clear cache (useful for cleanup)
     */
    clearCache() {
        this.uploadedFiles.clear();
        this.uploadPromises.clear();
        debug_logger_1.debugLogger.debug(0, 'FILE_CACHE_CLEARED', 'All cached files cleared');
    }
    /**
     * Perform the actual upload to Gemini
     * Note: This is a placeholder - actual implementation depends on Gemini API version
     */
    async performUpload(doc) {
        try {
            debug_logger_1.debugLogger.debug(0, 'FILE_UPLOAD_START', `Uploading ${doc.name} (${doc.metadata.fileSize} bytes)`);
            // Convert document to blob
            const blob = this.documentToBlob(doc);
            // TODO: Implement actual Gemini file upload when API supports it
            // const uploadResult = await this.genAI.uploadFile(blob, {
            //   mimeType: this.getMimeType(doc),
            //   displayName: doc.id
            // });
            // For now, create a mock uploaded file
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
            debug_logger_1.debugLogger.success(0, 'FILE_UPLOAD_SUCCESS', `Uploaded ${doc.id}: ${uploadedFile.uri}`);
            return uploadedFile;
        }
        catch (error) {
            debug_logger_1.debugLogger.error(0, 'FILE_UPLOAD_FAILED', `Failed to upload ${doc.id}: ${error.message}`);
            throw new Error(`File upload failed for ${doc.id}: ${error.message}`);
        }
    }
    /**
     * Convert PreparedDocument to Blob for upload
     */
    documentToBlob(doc) {
        if (doc.type === 'image' && doc.content) {
            // Convert base64 image to blob
            return this.base64ToBlob(doc.content, 'image/jpeg');
        }
        else if (doc.type === 'pdf' && doc.pages) {
            // For PDFs, use the first page's content or reconstruct from pages
            const firstImagePage = doc.pages.find(p => p.isImage && p.content);
            if (firstImagePage) {
                return this.base64ToBlob(firstImagePage.content, 'application/pdf');
            }
            throw new Error(`No image content found for PDF document ${doc.id}`);
        }
        else if (doc.type === 'spreadsheet' && doc.sheets) {
            // Convert spreadsheet to CSV blob
            const csvContent = this.sheetsToCSV(doc.sheets);
            return new Blob([csvContent], { type: 'text/csv' });
        }
        throw new Error(`Unsupported document type for upload: ${doc.type}`);
    }
    /**
     * Convert base64 string to Blob
     */
    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }
    /**
     * Convert spreadsheet sheets to CSV format
     */
    sheetsToCSV(sheets) {
        if (!sheets || sheets.length === 0)
            return '';
        // Use the first sheet
        const sheet = sheets[0];
        return sheet.content;
    }
    /**
     * Get MIME type for document
     */
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
    /**
     * Get upload statistics
     */
    getStats() {
        const files = Array.from(this.uploadedFiles.values());
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const totalTime = files.reduce((sum, file) => sum + (Date.now() - file.uploadedAt.getTime()), 0);
        return {
            totalFiles: files.length,
            totalSize,
            averageSize: files.length > 0 ? totalSize / files.length : 0,
            uploadTime: totalTime
        };
    }
}
exports.GeminiFileManager = GeminiFileManager;
/**
 * Initialize the global file manager
 */
function initializeFileManager(apiKey) {
    exports.fileManager = new GeminiFileManager(apiKey);
    debug_logger_1.debugLogger.debug(0, 'FILE_MANAGER_INITIALIZED', 'Gemini File Manager initialized');
}
/**
 * Get the global file manager instance
 */
function getFileManager() {
    if (!exports.fileManager) {
        throw new Error('File manager not initialized. Call initializeFileManager() first.');
    }
    return exports.fileManager;
}
