/**
 * Phase 0: Document Preparation
 * Prepares PDFs (multi-page), spreadsheets (multi-sheet), and images for AI processing
 */

import { debugLogger } from '../utils/debug-logger';
import { estimateTextTokens, estimateImageTokens } from '../models/gemini-models';
import type { DocumentMeta, PreparedDocument, PreparedPage, PreparedSheet } from '../types';

/**
 * Extract text from PDF buffer using pdf-parse
 */
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfParseModule: any = await import('pdf-parse');
    const pdfParse = (pdfParseModule?.default || pdfParseModule) as (data: Buffer) => Promise<{ text: string }>;
    const buf = Buffer.from(buffer);
    const result = await pdfParse(buf);
    return result.text || '';
  } catch (error) {
    debugLogger.warn(0, 'PDF_TEXT_EXTRACTION_FAILED', (error as Error).message);
    return '';
  }
}

/**
 * Extract individual pages from PDF
 * For now, we'll extract text and if empty, treat as image
 * TODO: Add proper page-by-page extraction with PDF libraries
 */
async function extractPdfPages(buffer: ArrayBuffer): Promise<PreparedPage[]> {
  try {
    // Extract all text first
    const fullText = await extractPdfText(buffer);

    if (!fullText || fullText.trim().length === 0) {
      // No text found - treat entire PDF as single image
      const base64 = Buffer.from(buffer).toString('base64');
      return [{
        pageNumber: 1,
        content: base64,
        isImage: true,
        tokens: estimateImageTokens(),
        hasContent: true
      }];
    }

    // For now, treat as single text page
    // TODO: Implement proper page-by-page extraction
    return [{
      pageNumber: 1,
      content: fullText,
      isImage: false,
      tokens: estimateTextTokens(fullText),
      hasContent: true
    }];

  } catch (error) {
    debugLogger.error(0, 'PDF_PAGE_EXTRACTION_FAILED', (error as Error).message);

    // Fallback: treat as single image
    const base64 = Buffer.from(buffer).toString('base64');
    return [{
      pageNumber: 1,
      content: base64,
      isImage: true,
      tokens: estimateImageTokens(),
      hasContent: true
    }];
  }
}

/**
 * Extract sheets from spreadsheet
 */
async function extractSpreadsheetSheets(buffer: ArrayBuffer): Promise<PreparedSheet[]> {
  try {
    const xlsxModule: any = await import('xlsx');
    const XLSX = xlsxModule;

    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheets: PreparedSheet[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];

      // Convert to CSV format for AI processing
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);

      if (csvContent && csvContent.trim().length > 0) {
        // Count non-empty rows
        const rows = csvContent.split('\n').filter(row => row.trim().length > 0).length;

        sheets.push({
          name: sheetName,
          content: csvContent,
          rows,
          tokens: estimateTextTokens(csvContent),
          hasContent: true
        });
      } else {
        debugLogger.warn(0, 'EMPTY_SHEET_SKIPPED', `Sheet "${sheetName}" is empty`);
      }
    }

    return sheets;

  } catch (error) {
    debugLogger.error(0, 'SPREADSHEET_EXTRACTION_FAILED', (error as Error).message);
    return [];
  }
}

/**
 * Get file buffer from document metadata
 */
async function getFileBuffer(doc: DocumentMeta): Promise<ArrayBuffer> {
  if (doc.content) {
    // Base64 content provided directly
    return Buffer.from(doc.content, 'base64').buffer;
  }

  if (doc.url) {
    // Download from URL
    const response = await fetch(doc.url);
    if (!response.ok) {
      throw new Error(`Failed to download ${doc.name}: ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }

  throw new Error(`Document ${doc.name} has no content or url`);
}

/**
 * Get document file size
 */
async function getDocumentSize(doc: DocumentMeta): Promise<number> {
  if (doc.content) {
    return Buffer.from(doc.content, 'base64').length;
  }

  if (doc.url) {
    try {
      const response = await fetch(doc.url, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Cannot access ${doc.name}: ${response.statusText}`);
      }
      return parseInt(response.headers.get('content-length') || '0');
    } catch (error) {
      debugLogger.warn(0, 'SIZE_DETECTION_FAILED', `${doc.name}: ${(error as Error).message}`);
      return 0;
    }
  }

  return 0;
}

/**
 * Main document preparation function
 */
export async function prepareDocuments(documents: DocumentMeta[]): Promise<PreparedDocument[]> {
  debugLogger.startPhase(0, 'Document Preparation');
  debugLogger.debug(0, 'PREPARATION_START', `Processing ${documents.length} documents`);

  const prepared: PreparedDocument[] = [];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    debugLogger.documentStart(0, i + 1, documents.length, doc.name, doc.type);

    try {
      // Get file buffer and size
      const buffer = await getFileBuffer(doc);
      const fileSize = await getDocumentSize(doc);

      debugLogger.debug(0, 'DOCUMENT_LOADED', `${doc.name}: ${buffer.byteLength} bytes`);

      if (doc.type === 'application/pdf') {
        // PDF Processing - extract pages
        const pages = await extractPdfPages(buffer);
        const totalTokens = pages.reduce((sum, page) => sum + page.tokens, 0);
        const hasText = pages.some(page => !page.isImage && page.hasContent);

        prepared.push({
          id: doc.id,
          name: doc.name,
          type: 'pdf',
          pages,
          metadata: {
            totalPages: pages.length,
            fileSize,
            hasText,
            totalTokens
          }
        });

        debugLogger.documentComplete(0, doc.name, undefined, pages.length);

      } else if (doc.type.includes('spreadsheet') || doc.type.includes('excel')) {
        // Spreadsheet Processing - extract sheets
        const sheets = await extractSpreadsheetSheets(buffer);
        const totalTokens = sheets.reduce((sum, sheet) => sum + sheet.tokens, 0);
        const hasText = sheets.length > 0;

        prepared.push({
          id: doc.id,
          name: doc.name,
          type: 'spreadsheet',
          sheets,
          metadata: {
            totalSheets: sheets.length,
            fileSize,
            hasText,
            totalTokens
          }
        });

        debugLogger.documentComplete(0, doc.name, undefined, sheets.length);

      } else if (doc.type.startsWith('image/')) {
        // Image Processing - direct base64
        const base64 = doc.content || Buffer.from(buffer).toString('base64');
        const tokens = estimateImageTokens();

        prepared.push({
          id: doc.id,
          name: doc.name,
          type: 'image',
          content: base64,
          metadata: {
            fileSize,
            hasText: false,
            totalTokens: tokens
          }
        });

        debugLogger.documentComplete(0, doc.name);

      } else {
        debugLogger.warn(0, 'UNSUPPORTED_TYPE', `${doc.name}: ${doc.type}`);
        continue;
      }

    } catch (error) {
      debugLogger.error(0, 'DOCUMENT_PREPARATION_FAILED', `${doc.name}: ${(error as Error).message}`);
      // Continue with other documents
      continue;
    }

    debugLogger.logMemoryUsage(`After document ${i + 1}`, 0);
  }

  const totalTokens = prepared.reduce((sum, doc) => sum + doc.metadata.totalTokens, 0);
  const totalPages = prepared.reduce((sum, doc) => sum + (doc.metadata.totalPages || 0), 0);
  const totalSheets = prepared.reduce((sum, doc) => sum + (doc.metadata.totalSheets || 0), 0);

  debugLogger.endPhase(0, `Prepared ${prepared.length} documents`, prepared.length);
  debugLogger.success(0, 'PREPARATION_COMPLETE',
    `${prepared.length} docs, ${totalPages} pages, ${totalSheets} sheets, ${totalTokens} tokens`);

  return prepared;
}

/**
 * Create a smart summary of documents for Phase 1 analysis
 * Respects token limits while providing maximum context
 */
export function createDocumentSummary(documents: PreparedDocument[], maxTokens: number): string {
  let summary = 'Document Overview:\n\n';
  let currentTokens = estimateTextTokens(summary);

  for (const doc of documents) {
    let docSummary = `${doc.name} (${doc.type}):\n`;

    if (doc.type === 'pdf' && doc.pages) {
      for (const page of doc.pages.slice(0, 3)) { // Max 3 pages per PDF for summary
        if (page.isImage) {
          docSummary += `  Page ${page.pageNumber}: [IMAGE]\n`;
        } else {
          // Include first 200 characters of text
          const preview = page.content.substring(0, 200) + (page.content.length > 200 ? '...' : '');
          docSummary += `  Page ${page.pageNumber}: ${preview}\n`;
        }
      }
      if (doc.pages.length > 3) {
        docSummary += `  ... and ${doc.pages.length - 3} more pages\n`;
      }
    } else if (doc.type === 'spreadsheet' && doc.sheets) {
      for (const sheet of doc.sheets.slice(0, 2)) { // Max 2 sheets per file for summary
        const preview = sheet.content.split('\n').slice(0, 3).join('\n'); // First 3 rows
        docSummary += `  Sheet "${sheet.name}" (${sheet.rows} rows):\n${preview}\n`;
      }
      if (doc.sheets.length > 2) {
        docSummary += `  ... and ${doc.sheets.length - 2} more sheets\n`;
      }
    } else if (doc.type === 'image') {
      docSummary += `  [IMAGE FILE]\n`;
    }

    docSummary += '\n';

    // Check if adding this document would exceed token limit
    const docTokens = estimateTextTokens(docSummary);
    if (currentTokens + docTokens > maxTokens) {
      summary += `... and ${documents.length - documents.indexOf(doc)} more documents\n`;
      break;
    }

    summary += docSummary;
    currentTokens += docTokens;
  }

  return summary;
}