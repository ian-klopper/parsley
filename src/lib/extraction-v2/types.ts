/**
 * Shared Types for 3-Phase Extraction Pipeline
 */

import { allowedCategories, allowedSizes } from '@/lib/menu-data';

// Re-export predefined options for AI prompts
export { allowedCategories, allowedSizes };

export interface DocumentMeta {
  id: string;
  name: string;
  type: string;
  url?: string;
  content?: string; // Base64 content if provided directly
}

export interface PreparedPage {
  pageNumber: number;
  content: string; // Text or base64 image data
  isImage: boolean;
  tokens: number;
  hasContent: boolean;
}

export interface PreparedSheet {
  name: string;
  content: string; // CSV-like text representation
  rows: number;
  tokens: number;
  hasContent: boolean;
}

export interface PreparedDocument {
  id: string;
  name: string;
  type: 'pdf' | 'spreadsheet' | 'image';

  // For PDFs
  pages?: PreparedPage[];

  // For spreadsheets
  sheets?: PreparedSheet[];

  // For images
  content?: string;

  metadata: {
    totalPages?: number;
    totalSheets?: number;
    fileSize: number;
    hasText: boolean;
    totalTokens: number;
  };
}

export interface DocumentLocation {
  documentId: string;
  pageNumbers?: number[];
  sheetNames?: string[];
}

export interface MenuSection {
  name: string;
  documentLocations: DocumentLocation[];
  description: string;
  estimatedItems: number;
  isSuperBig: boolean; // >100 items
  confidence: number;
}

export interface MenuStructure {
  sections: MenuSection[];
  overallConfidence: number;
  totalEstimatedItems: number;
}

export interface RawMenuItem {
  name: string;
  description: string;
  price: string;
  category: string;
  section: string;
  sourceInfo: {
    documentId: string;
    page?: number;
    sheet?: string;
  };
}

export interface SizeOption {
  size: string; // Must be from allowedSizes
  price: string;
  isDefault?: boolean;
}

export interface ModifierGroup {
  name: string;
  options: string[];
  required: boolean;
  multiSelect: boolean;
}

export interface FinalMenuItem {
  name: string;
  description: string;
  category: string; // Must be from allowedCategories
  section: string;
  sizes: SizeOption[];
  modifierGroups: ModifierGroup[];
  sourceInfo: {
    documentId: string;
    page?: number;
    sheet?: string;
  };
}

export interface ExtractionBatch {
  id: string;
  phase: number;
  section?: MenuSection;
  content: string; // Text or base64
  isImage: boolean;
  contentType?: string; // MIME type for images: 'image/jpeg' or 'application/pdf'
  tokens: number;
  model: 'pro' | 'flash' | 'flashLite';
  sourceRefs: DocumentLocation[];
  fileRefs?: Array<{ uri: string; mimeType: string }>; // File references for cost optimization
}

export interface TokenUsage {
  input: number;
  output: number;
  cost: number;
}

export interface PhaseResult {
  success: boolean;
  phase: number;
  data: any;
  tokens: TokenUsage;
  apiCalls: number;
  processingTime: number;
  error?: string;
}

export interface ExtractionCosts {
  phase1: {
    cost: number;
    calls: number;
    tokens: { input: number; output: number };
  };
  phase2: {
    cost: number;
    calls: number;
    tokens: { input: number; output: number };
  };
  phase3: {
    cost: number;
    calls: number;
    tokens: { input: number; output: number };
  };
  total: number;
  totalCalls: number;
  totalTokens: { input: number; output: number };
}

export interface ExtractionResult {
  success: boolean;
  structure?: MenuStructure;
  items?: FinalMenuItem[];
  costs: ExtractionCosts;
  processingTime: number;
  error?: string;
  logs: string;
}