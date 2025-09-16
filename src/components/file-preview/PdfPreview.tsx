'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FilePreview, PdfPagePreview } from '@/lib/file-preview-service';
import { JobDocument } from '@/lib/storage-service';

interface PdfPreviewProps {
  preview: FilePreview;
  document: JobDocument;
}

export const PdfPreview: React.FC<PdfPreviewProps> = ({ preview, document }) => {
  const [currentPage, setCurrentPage] = useState(0);

  if (!preview.pages || preview.pages.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No pages found in PDF
      </div>
    );
  }

  const currentPageData = preview.pages[currentPage];
  const totalPages = preview.pages.length;

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="relative">
      {/* PDF Page Image */}
      <div className="w-full">
        <img
          src={currentPageData.imageUrl}
          alt={`${document.file_name} - Page ${currentPage + 1}`}
          className="w-full h-auto max-w-none"
          style={{
            maxHeight: '80vh',
            objectFit: 'contain'
          }}
        />
      </div>

      {/* Page Navigation */}
      {totalPages > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg flex items-center gap-4">
          <button
            onClick={goToPreviousPage}
            disabled={currentPage === 0}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} />
          </button>

          <span className="text-sm font-medium">
            Page {currentPage + 1} of {totalPages}
          </span>

          <button
            onClick={goToNextPage}
            disabled={currentPage === totalPages - 1}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Page Thumbnails for multi-page PDFs */}
      {totalPages > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {preview.pages.map((page, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`flex-shrink-0 border-2 rounded ${
                index === currentPage
                  ? 'border-blue-500'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <img
                src={page.imageUrl}
                alt={`Page ${index + 1}`}
                className="w-16 h-20 object-contain bg-white"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};