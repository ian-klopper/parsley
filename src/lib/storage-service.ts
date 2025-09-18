'use client';

import { createClient } from './supabase-browser';
import { v4 as uuidv4 } from 'uuid';
import type { Database } from '@/types/database';

export interface UploadResult {
  success: boolean;
  file_url?: string;
  storage_path?: string;
  error?: string;
}

export interface JobDocument {
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

const STORAGE_BUCKET = 'job-documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv'
];

export class StorageService {
  private static supabase = createClient();

  /**
   * Validate file before upload
   */
  static validateFile(file: File): { valid: boolean; error?: string } {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'File type not supported. Please upload PDF, PNG, JPG, Excel, or CSV files.'
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
      };
    }

    return { valid: true };
  }

  /**
   * Generate unique file path for storage
   */
  static generateFilePath(jobId: string, fileName: string): string {
    // Validate inputs
    if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
      throw new Error('Invalid job ID provided');
    }

    if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
      throw new Error('Invalid file name provided');
    }

    const uuid = uuidv4();
    const extension = fileName.split('.').pop();

    // Validate extension
    if (!extension || extension.length > 10) {
      throw new Error('Invalid file extension');
    }

    const baseName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize filename

    // Ensure sanitized name is not empty
    const finalName = sanitizedName || 'file';

    const filePath = `jobs/${jobId}/${uuid}_${finalName}.${extension}`;

    // Validate final path format
    if (filePath.length > 1000) {
      throw new Error('Generated file path is too long');
    }

    return filePath;
  }

  /**
   * Upload file to Supabase Storage
   */
  static async uploadFile(
    file: File,
    jobId: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Generate unique file path
      const filePath = this.generateFilePath(jobId, file.name);

      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          upsert: false // Don't overwrite existing files
        });

      if (error) {
        console.error('Storage upload error:', error);
        return { success: false, error: error.message };
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      // Save to database
      const documentResult = await this.saveDocumentRecord({
        job_id: jobId,
        file_name: file.name,
        storage_path: filePath,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size
      });

      if (!documentResult.success) {
        // Clean up uploaded file if database save failed
        await this.deleteFile(filePath);
        return { success: false, error: documentResult.error };
      }

      return {
        success: true,
        file_url: urlData.publicUrl,
        storage_path: filePath
      };

    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Save document record to database
   */
  static async saveDocumentRecord(document: {
    job_id: string;
    file_name: string;
    storage_path: string;
    file_url: string;
    file_type: string;
    file_size: number;
  }): Promise<{ success: boolean; error?: string; document?: JobDocument }> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user.user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { data, error } = await this.supabase
        .from('job_documents')
        .insert({
          ...document,
          uploaded_by: user.user.id
        })
        .select('*')
        .single();

      if (error) {
        console.error('Database save error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, document: data };
    } catch (error) {
      console.error('Save document error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save document'
      };
    }
  }

  /**
   * Get all documents for a job
   */
  static async getJobDocuments(jobId: string): Promise<{
    success: boolean;
    documents?: JobDocument[];
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
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

      if (error) {
        console.error('Get documents error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, documents: data || [] };
    } catch (error) {
      console.error('Get documents error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get documents'
      };
    }
  }

  /**
   * Delete file from storage and database
   */
  static async deleteDocument(documentId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get document record first
      const { data: document, error: fetchError } = await this.supabase
        .from('job_documents')
        .select('storage_path')
        .eq('id', documentId)
        .single();

      if (fetchError || !document) {
        return { success: false, error: 'Document not found' };
      }

      // Delete from storage
      const { error: storageError } = await this.supabase.storage
        .from(STORAGE_BUCKET)
        .remove([document.storage_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await this.supabase
        .from('job_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) {
        console.error('Database delete error:', dbError);
        return { success: false, error: dbError.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Delete document error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete document'
      };
    }
  }

  /**
   * Delete file from storage (utility method)
   */
  private static async deleteFile(filePath: string): Promise<void> {
    try {
      await this.supabase.storage
        .from(STORAGE_BUCKET)
        .remove([filePath]);
    } catch (error) {
      console.error('Error deleting file from storage:', error);
    }
  }

  /**
   * Get file download URL (signed URL for private files)
   */
  static async getDownloadUrl(filePath: string): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, url: data.signedUrl };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get download URL'
      };
    }
  }

  /**
   * Get file preview URL (for displaying in previews)
   */
  static async getFilePreviewUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to generate preview URL for ${storagePath}: ${error?.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Get public URL for a file (for public files)
   */
  static getPublicUrl(storagePath: string): string {
    const { data } = this.supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    return data.publicUrl;
  }

  /**
   * Get file type icon name
   */
  static getFileIcon(fileType: string): string {
    if (fileType.includes('pdf')) return 'FileText';
    if (fileType.includes('image')) return 'Image';
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return 'FileSpreadsheet';
    if (fileType.includes('csv')) return 'Table';
    return 'File';
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}