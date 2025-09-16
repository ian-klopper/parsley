'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { FilePreview, SpreadsheetData, SheetData } from '@/lib/file-preview-service';
import { JobDocument } from '@/lib/storage-service';

interface SpreadsheetPreviewProps {
  preview: FilePreview;
  document: JobDocument;
}

export const SpreadsheetPreview: React.FC<SpreadsheetPreviewProps> = ({ preview, document }) => {
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!preview.spreadsheetData || !preview.spreadsheetData.sheets.length) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No spreadsheet data available
      </div>
    );
  }

  const { sheets } = preview.spreadsheetData;
  const currentSheet = sheets[selectedSheetIndex];

  if (!currentSheet || !currentSheet.data.length) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No data found in spreadsheet
      </div>
    );
  }

  const displayData = isExpanded ? currentSheet.data : currentSheet.data.slice(0, 10);
  const hasMoreRows = currentSheet.data.length > 10;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Sheet selector for multi-sheet files */}
      {sheets.length > 1 && (
        <div className="mb-4 flex gap-2 flex-wrap justify-center">
          {sheets.map((sheet, index) => (
            <button
              key={index}
              onClick={() => setSelectedSheetIndex(index)}
              className={`px-3 py-1 rounded text-sm ${
                index === selectedSheetIndex
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Table container with horizontal scroll */}
      <div className="w-full max-w-full overflow-x-auto border border-gray-200 rounded">
        <table className="min-w-full bg-white">
          {/* Headers */}
          {currentSheet.headers.length > 0 && (
            <thead className="bg-gray-50">
              <tr>
                {currentSheet.headers.map((header, index) => (
                  <th
                    key={index}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200"
                  >
                    {header || `Column ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
          )}

          {/* Data rows */}
          <tbody className="divide-y divide-gray-200">
            {displayData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-3 py-2 text-sm text-gray-900 border-r border-gray-200 last:border-r-0"
                  >
                    <div className="max-w-[150px] truncate" title={String(cell || '')}>
                      {cell !== null && cell !== undefined ? String(cell) : ''}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expand/Collapse button for long tables */}
      {hasMoreRows && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp size={16} />
                Show less ({currentSheet.data.length} total rows)
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                Show all rows ({currentSheet.data.length} total)
              </>
            )}
          </button>
        </div>
      )}

      {/* Data info */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        {sheets.length > 1 && `Sheet: ${currentSheet.name} • `}
        {currentSheet.data.length} rows • {currentSheet.headers.length || (currentSheet.data[0]?.length || 0)} columns
      </div>
    </div>
  );
};