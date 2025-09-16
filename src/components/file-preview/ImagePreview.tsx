'use client';

import React, { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import { FilePreview } from '@/lib/file-preview-service';
import { JobDocument } from '@/lib/storage-service';

interface ImagePreviewProps {
  preview: FilePreview;
  document: JobDocument;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ preview, document }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!preview.imageUrl) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No image URL available
      </div>
    );
  }

  const handleImageClick = () => {
    setIsZoomed(true);
  };

  const handleZoomedImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsZoomed(false);
  };

  if (imageError) {
    return (
      <div className="p-4 text-red-500 text-sm">
        Failed to load image: {document.file_name}
      </div>
    );
  }

  return (
    <>
      {/* Main Image */}
      <div className="w-full flex justify-center">
        <div className="relative group cursor-pointer w-full" onClick={handleImageClick}>
          <img
            src={preview.imageUrl}
            alt={document.file_name}
            className="max-w-full h-auto block"
            style={{
              width: '100%',
              objectFit: 'contain'
            }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />

          {/* Loading state */}
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-gray-500">Loading image...</div>
            </div>
          )}

          {/* Zoom overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-75 text-white p-2 rounded-lg flex items-center gap-2">
              <ZoomIn size={16} />
              <span className="text-sm">Click to zoom</span>
            </div>
          </div>
        </div>
      </div>

      {/* Zoomed Modal */}
      {isZoomed && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={handleZoomedImageClick}
        >
          <div className="max-w-full max-h-full overflow-auto">
            <img
              src={preview.imageUrl}
              alt={document.file_name}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Close instruction */}
          <div className="absolute top-4 right-4 text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded">
            Click anywhere to close
          </div>
        </div>
      )}
    </>
  );
};