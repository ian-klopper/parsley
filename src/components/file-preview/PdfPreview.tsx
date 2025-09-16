'use client';

import React from 'react';
import { FilePreview, PdfPagePreview } from '@/lib/file-preview-service';
import { JobDocument } from '@/lib/storage-service';

interface PdfPreviewProps {
  preview: FilePreview;
  document: JobDocument;
}

export const PdfPreview: React.FC<PdfPreviewProps> = ({ preview, document }) => {
  if (!preview.pages || preview.pages.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No pages found in PDF
      </div>
    );
  }

  const totalPages = preview.pages.length;

  return (
    <div className="w-full space-y-6 flex flex-col items-center">
      {/* PDF Info */}
      <div className="text-center text-sm text-gray-600 mb-4">
        {document.file_name} • {totalPages} page{totalPages > 1 ? 's' : ''}
      </div>

      {/* All PDF Pages */}
      {preview.pages.map((page, index) => (
        <div key={index} className="w-full flex flex-col items-center">
          {/* Page Number */}
          <div className="text-center text-xs text-gray-500 mb-2">
            Page {index + 1}
          </div>

          {/* Page Image */}
          <img
            src={page.imageUrl}
            alt={`${document.file_name} - Page ${index + 1}`}
            className="max-w-full h-auto block"
            style={{
              width: '100%',
              objectFit: 'contain'
            }}
          />

          {/* Page Separator (except for last page) */}
          {index < totalPages - 1 && (
            <div className="mt-6 w-full border-t border-gray-200"></div>
          )}
        </div>
      ))}
    </div>
  );
};