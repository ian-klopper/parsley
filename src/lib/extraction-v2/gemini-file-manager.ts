/**
 * Gemini File Manager - Handles file uploads and caching for cost optimization
 * Uploads documents once and provides reusable URIs for subsequent API calls
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { debugLogger } from './utils/debug-logger';
import type { PreparedDocument } from './types';

export interface UploadedFile {
  uri: string;
  mimeType: string;
  name: string;
  displayName: string;
  uploadedAt: Date;
  size: number;
}

export class GeminiFileManager {
  private genAI: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;
  private uploadedFiles: Map<string, UploadedFile> = new Map();
  private uploadPromises: Map<string, Promise<UploadedFile>> = new Map();

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.fileManager = new GoogleAIFileManager(apiKey);
  }

  /**
   * Upload a single document to Gemini and cache the result
   * Note: This is a placeholder - actual implementation depends on Gemini API version
   */
  async uploadDocument(doc: PreparedDocument): Promise<UploadedFile> {
    // Check if already uploaded
    if (this.uploadedFiles.has(doc.id)) {
      debugLogger.debug(0, 'FILE_CACHE_HIT', `Using cached file: ${doc.id}`);
      return this.uploadedFiles.get(doc.id)!;
    }

    // Check if upload is in progress
    if (this.uploadPromises.has(doc.id)) {
      debugLogger.debug(0, 'FILE_UPLOAD_IN_PROGRESS', `Waiting for in-progress upload: ${doc.id}`);
      return await this.uploadPromises.get(doc.id)!;
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

  /**
   * Upload all documents in parallel and cache results
   */
  async uploadAllDocuments(documents: PreparedDocument[]): Promise<Map<string, UploadedFile>> {
    debugLogger.debug(0, 'BATCH_UPLOAD_START', `Starting upload of ${documents.length} documents`);

    const uploadPromises = documents.map(doc => this.uploadDocument(doc));
    await Promise.all(uploadPromises);

    debugLogger.debug(0, 'BATCH_UPLOAD_COMPLETE', `Successfully uploaded ${this.uploadedFiles.size} documents`);
    return this.uploadedFiles;
  }

  /**
   * Get uploaded file by document ID
   */
  getUploadedFile(docId: string): UploadedFile | undefined {
    return this.uploadedFiles.get(docId);
  }

  /**
   * Get all uploaded files
   */
  getAllUploadedFiles(): Map<string, UploadedFile> {
    return new Map(this.uploadedFiles);
  }

  /**
   * Delete a specific uploaded file from Gemini storage
   * Note: This is a placeholder - actual implementation depends on Gemini API version
   */
  async deleteFile(docId: string): Promise<boolean> {
    const uploadedFile = this.uploadedFiles.get(docId);
    if (!uploadedFile) {
      debugLogger.warn(0, 'FILE_NOT_FOUND', `Cannot delete ${docId}: not in cache`);
      return false;
    }

    try {
      debugLogger.debug(0, 'FILE_DELETE_START', `Deleting ${docId} from Gemini storage`);

      // TODO: Implement actual Gemini file deletion when API supports it
      // await this.genAI.deleteFile(uploadedFile.name);

      // For now, just remove from local cache
      this.uploadedFiles.delete(docId);

      debugLogger.success(0, 'FILE_DELETE_SUCCESS', `Deleted ${docId} from local cache`);
      return true;
    } catch (error) {
      debugLogger.error(0, 'FILE_DELETE_FAILED', `Failed to delete ${docId}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Delete all uploaded files from Gemini storage
   */
  async deleteAllFiles(): Promise<{ deleted: number; failed: number }> {
    const files = Array.from(this.uploadedFiles.keys());
    let deleted = 0;
    let failed = 0;

    debugLogger.debug(0, 'BATCH_DELETE_START', `Starting deletion of ${files.length} files`);

    for (const docId of files) {
      const success = await this.deleteFile(docId);
      if (success) {
        deleted++;
      } else {
        failed++;
      }
    }

    debugLogger.success(0, 'BATCH_DELETE_COMPLETE', `Deleted ${deleted} files, ${failed} failed`);
    return { deleted, failed };
  }

  /**
   * Delete files older than specified age (in milliseconds)
   */
  async deleteOldFiles(maxAgeMs: number): Promise<{ deleted: number; failed: number }> {
    const now = Date.now();
    const oldFiles = Array.from(this.uploadedFiles.entries())
      .filter(([_, file]) => (now - file.uploadedAt.getTime()) > maxAgeMs);

    let deleted = 0;
    let failed = 0;

    debugLogger.debug(0, 'OLD_FILES_DELETE_START', `Deleting ${oldFiles.length} files older than ${maxAgeMs}ms`);

    for (const [docId, _] of oldFiles) {
      const success = await this.deleteFile(docId);
      if (success) {
        deleted++;
      } else {
        failed++;
      }
    }

    if (oldFiles.length > 0) {
      debugLogger.success(0, 'OLD_FILES_DELETE_COMPLETE', `Deleted ${deleted} old files, ${failed} failed`);
    }

    return { deleted, failed };
  }

  /**
   * Clear cache (useful for cleanup)
   */
  clearCache(): void {
    this.uploadedFiles.clear();
    this.uploadPromises.clear();
    debugLogger.debug(0, 'FILE_CACHE_CLEARED', 'All cached files cleared');
  }

  /**
   * Perform the actual upload to Gemini using the File API
   */
  private async performUpload(doc: PreparedDocument): Promise<UploadedFile> {
    try {
      debugLogger.debug(0, 'FILE_UPLOAD_START', `Uploading ${doc.name} (${doc.metadata.fileSize} bytes)`);

      // Convert document to buffer for upload
      const buffer = this.documentToBuffer(doc);
      const mimeType = this.getMimeType(doc);

      // Upload file to Gemini File API
      const uploadResult = await this.fileManager.uploadFile(buffer, {
        mimeType: mimeType,
        displayName: doc.name
      });

      const uploadedFile: UploadedFile = {
        uri: uploadResult.file.uri,
        mimeType: uploadResult.file.mimeType,
        name: uploadResult.file.name,
        displayName: uploadResult.file.displayName || doc.id,
        uploadedAt: new Date(),
        size: doc.metadata.fileSize
      };

      debugLogger.success(0, 'FILE_UPLOAD_SUCCESS', `Uploaded ${doc.id}: ${uploadedFile.uri}`);
      return uploadedFile;

    } catch (error) {
      debugLogger.error(0, 'FILE_UPLOAD_FAILED', `Failed to upload ${doc.id}: ${(error as Error).message}`);
      throw new Error(`File upload failed for ${doc.id}: ${(error as Error).message}`);
    }
  }

  /**
   * Convert PreparedDocument to Buffer for upload
   */
  private documentToBuffer(doc: PreparedDocument): Buffer {
    if (doc.type === 'image' && doc.content) {
      // Convert base64 image to buffer
      return Buffer.from(doc.content, 'base64');
    } else if (doc.type === 'pdf' && doc.pages) {
      // For PDFs, use the first page's content or reconstruct from pages
      const firstImagePage = doc.pages.find(p => p.isImage && p.content);
      if (firstImagePage) {
        return Buffer.from(firstImagePage.content, 'base64');
      }
      throw new Error(`No image content found for PDF document ${doc.id}`);
    } else if (doc.type === 'spreadsheet' && doc.sheets) {
      // Convert spreadsheet to CSV buffer
      const csvContent = this.sheetsToCSV(doc.sheets);
      return Buffer.from(csvContent, 'utf-8');
    }

    throw new Error(`Unsupported document type for upload: ${doc.type}`);
  }

  /**
   * Convert base64 string to Blob
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
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
  private sheetsToCSV(sheets: PreparedDocument['sheets']): string {
    if (!sheets || sheets.length === 0) return '';

    // Use the first sheet
    const sheet = sheets[0];
    return sheet.content;
  }

  /**
   * Get MIME type for document
   */
  private getMimeType(doc: PreparedDocument): string {
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
  getStats(): {
    totalFiles: number;
    totalSize: number;
    averageSize: number;
    uploadTime: number;
  } {
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

// Global instance - will be initialized with API key from environment
export let fileManager: GeminiFileManager;

/**
 * Initialize the global file manager
 */
export function initializeFileManager(apiKey: string): void {
  fileManager = new GeminiFileManager(apiKey);
  debugLogger.debug(0, 'FILE_MANAGER_INITIALIZED', 'Gemini File Manager initialized');
}

/**
 * Get the global file manager instance
 */
export function getFileManager(): GeminiFileManager {
  if (!fileManager) {
    throw new Error('File manager not initialized. Call initializeFileManager() first.');
  }
  return fileManager;
}