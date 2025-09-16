'use client';

import React, { useEffect, useState } from 'react';
import { StorageService, JobDocument } from '@/lib/storage-service';
import { FilePreviewService, FilePreview } from '@/lib/file-preview-service';
import { PdfPreview } from './PdfPreview';
import { ImagePreview } from './ImagePreview';
import { SpreadsheetPreview } from './SpreadsheetPreview';

interface FilePreviewPanelProps {
  jobId: string;
}

export const FilePreviewPanel: React.FC<FilePreviewPanelProps> = ({ jobId }) => {
  const [documents, setDocuments] = useState<JobDocument[]>([]);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await StorageService.getJobDocuments(jobId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to load documents');
      }

      const docs = result.documents || [];
      setDocuments(docs);

      // Generate previews for all documents
      const previewPromises = docs.map(async (doc) => {
        try {
          const previewUrl = await StorageService.getFilePreviewUrl(doc.storage_path);
          const fileType = FilePreviewService.getFileType(doc.file_name, doc.file_type);

          return await FilePreviewService.generatePreview(
            previewUrl,
            fileType,
            doc.file_name
          );
        } catch (error) {
          console.error(`Failed to generate preview for ${doc.file_name}:`, error);
          return {
            id: `${doc.file_name}-${Date.now()}`,
            type: 'image' as const,
            error: error instanceof Error ? error.message : 'Preview generation failed'
          };
        }
      });

      const generatedPreviews = await Promise.all(previewPromises);
      setPreviews(generatedPreviews);

    } catch (error) {
      console.error('Error loading documents:', error);
      setError(error instanceof Error ? error.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobId) {
      loadDocuments();
    }
  }, [jobId]);

  const renderPreview = (preview: FilePreview, document: JobDocument) => {
    if (preview.error) {
      return (
        <div className="p-4 text-red-500 text-sm">
          Error loading preview: {preview.error}
        </div>
      );
    }

    switch (preview.type) {
      case 'pdf':
        return <PdfPreview preview={preview} document={document} />;
      case 'image':
        return <ImagePreview preview={preview} document={document} />;
      case 'spreadsheet':
        return <SpreadsheetPreview preview={preview} document={document} />;
      default:
        return (
          <div className="p-4 text-gray-500 text-sm">
            Unsupported file type
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading previews...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 text-sm">
        {error}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No files uploaded yet
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 pb-8">
      {previews.map((preview, index) => {
        const document = documents[index];
        if (!document) return null;

        return (
          <div key={`${document.id}-${preview.id}`} className="relative w-full">
            {renderPreview(preview, document)}
            {index < previews.length - 1 && (
              <div className="mt-8 border-b border-gray-200" />
            )}
          </div>
        );
      })}
    </div>
  );
};