'use client';

import React from 'react';
import { FileText, BarChart3, Users, Calendar } from 'lucide-react';

interface MockExtractionResultsProps {
  documents: any[];
}

export const MockExtractionResults: React.FC<MockExtractionResultsProps> = ({ documents }) => {
  const mockData = {
    totalEntities: 247,
    keyFindings: [
      'Contract value: $1.2M',
      'Delivery date: March 15, 2024',
      '3 key stakeholders identified',
      '12 action items extracted'
    ],
    entityBreakdown: [
      { type: 'Dates', count: 18, color: 'bg-blue-500' },
      { type: 'People', count: 15, color: 'bg-green-500' },
      { type: 'Amounts', count: 8, color: 'bg-yellow-500' },
      { type: 'Organizations', count: 12, color: 'bg-purple-500' }
    ],
    confidence: 94
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <FileText className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Extraction Complete</h3>
          <p className="text-sm text-gray-600">{documents.length} files processed</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Total Entities</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{mockData.totalEntities}</p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Confidence</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{mockData.confidence}%</p>
        </div>
      </div>

      {/* Key Findings */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-3">Key Findings</h4>
        <div className="space-y-2">
          {mockData.keyFindings.map((finding, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-700">{finding}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Entity Breakdown */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-3">Entity Breakdown</h4>
        <div className="space-y-3">
          {mockData.entityBreakdown.map((entity, index) => (
            <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${entity.color}`}></div>
                <span className="text-sm font-medium text-gray-700">{entity.type}</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{entity.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
          Export Results
        </button>
        <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
          View Details
        </button>
      </div>
    </div>
  );
};