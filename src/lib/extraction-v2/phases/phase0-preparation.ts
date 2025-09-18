/**
 * Phase 0: Document Preparation
 * Prepares PDFs (multi-page), spreadsheets (multi-sheet), and images for AI processing
 */

import { debugLogger } from '../utils/debug-logger';
import { estimateTextTokens, estimateImageTokens } from '../models/gemini-models';
import { extractPdfTextWithDetection } from '../../pdf-text-checker';
import type { DocumentMeta, PreparedDocument, PreparedPage, PreparedSheet } from '../types';

/**
 * Resolution tracking for observability
 */
interface DocumentResolution {
  width: number;
  height: number;
  dpi?: number;
}

class ResolutionTracker {
  private maxResolution: DocumentResolution | null = null;
  private maxDocId: string = '';

  update(docId: string, resolution: DocumentResolution) {
    if (!this.maxResolution || 
        (resolution.width * resolution.height) > (this.maxResolution.width * this.maxResolution.height)) {
      this.maxResolution = resolution;
      this.maxDocId = docId;
      console.log(`[OBSERVABILITY] MAX_RESOLUTION_UPDATED | doc=${docId} width=${resolution.width} height=${resolution.height} dpi=${resolution.dpi || 'N/A'}`);
    }
  }

  getMax() {
    return { resolution: this.maxResolution, docId: this.maxDocId };
  }
}

const resolutionTracker = new ResolutionTracker();

/**
 * Extract resolution from document for observability
 */
async function extractResolution(doc: DocumentMeta, buffer: ArrayBuffer): Promise<DocumentResolution | null> {
  try {
    if (doc.type.startsWith('image/')) {
      // For images, use sharp if available, otherwise estimate
      try {
        const sharp = await import('sharp');
        const metadata = await sharp.default(Buffer.from(buffer)).metadata();
        return { width: metadata.width || 0, height: metadata.height || 0 };
      } catch {
        // Fallback: estimate based on file size (rough approximation)
        const size = buffer.byteLength;
        const estimatedPixels = Math.sqrt(size / 3); // RGB approximation
        return { width: Math.round(estimatedPixels), height: Math.round(estimatedPixels) };
      }
    } else if (doc.type === 'application/pdf') {
      // For PDFs, use basic fallback (standard page size)
      return { width: 612, height: 792, dpi: 72 }; // 8.5x11 inches at 72 DPI
    }
    return null;
  } catch (error) {
    console.warn(`[OBSERVABILITY] RESOLUTION_EXTRACTION_FAILED | doc=${doc.id} error=${(error as Error).message}`);
    return null;
  }
}
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
 * Enhanced PDF processing with text/image detection
 * Now stores text content even for image-classified PDFs to help with mixed content
 */
async function extractPdfPages(buffer: ArrayBuffer): Promise<PreparedPage[]> {
  try {
    // Use enhanced text extraction with detection
    const extractionResult = await extractPdfTextWithDetection(buffer);
    const { text: fullText, isImageBased, wordCount, confidence } = extractionResult;
    
    debugLogger.debug(0, 'PDF_TEXT_ANALYSIS', 
      `Words: ${wordCount}, Confidence: ${confidence.toFixed(2)}, Type: ${isImageBased ? 'Image-based' : 'Text-based'}`);

    const pages: PreparedPage[] = [];
    
    if (!isImageBased && fullText.length > 0) {
      // PDF has extractable text - create text page
      debugLogger.debug(0, 'PDF_TEXT_EXTRACTED', `Extracted ${fullText.length} text characters (${wordCount} words)`);

      // Debug: Log raw content to diagnose content issues
      console.log('🔍 PDF RAW CONTENT DEBUG:');
      console.log('Content length:', fullText.length);
      console.log('Word count:', wordCount);
      console.log('Raw content (JSON):', JSON.stringify(fullText));
      console.log('First 100 chars:', fullText.substring(0, 100));
      console.log('Has NULL chars:', fullText.includes('\x00'));
      console.log('Has special chars:', /[\x00-\x1F]/.test(fullText));

      pages.push({
        pageNumber: 1,
        content: fullText,
        isImage: false,
        tokens: estimateTextTokens(fullText),
        hasContent: true
      });
    } else {
      // PDF is image-based OR has no text - create image page
      debugLogger.debug(0, 'PDF_IMAGE_BASED', 'PDF appears to be image-based, using image processing');
      const base64 = Buffer.from(buffer).toString('base64');
      
      // Enhanced: Store any extracted text along with image data for mixed content PDFs
      let content: string;
      if (fullText.length > 0) {
        // Mixed content PDF - store both text and image info
        content = `[MIXED_CONTENT_PDF]\nExtracted Text (${wordCount} words):\n${fullText}\n\n[IMAGE_DATA]\n${base64}`;
        debugLogger.debug(0, 'PDF_MIXED_CONTENT', `Stored ${wordCount} words of text with image data`);
      } else {
        // Pure image PDF
        content = base64;
      }
      
      pages.push({
        pageNumber: 1,
        content: content,
        isImage: true,
        tokens: estimateImageTokens(),
        hasContent: true
      });
    }

    return pages;

  } catch (error) {
    debugLogger.error(0, 'PDF_PAGE_EXTRACTION_FAILED', (error as Error).message);

    // Fallback to image processing on any error
    debugLogger.debug(0, 'PDF_FALLBACK_TO_IMAGE', 'Using image processing as fallback');
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
        const rows = csvContent.split('\n').filter((row: string) => row.trim().length > 0).length;

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

      // Extract resolution for observability
      const resolution = await extractResolution(doc, buffer);
      if (resolution) {
        resolutionTracker.update(doc.id, resolution);
      }

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

  // Log maximum resolution for observability
  const max = resolutionTracker.getMax();
  if (max.resolution) {
    console.log(`[OBSERVABILITY] PHASE0_MAX_RESOLUTION | doc=${max.docId} width=${max.resolution.width} height=${max.resolution.height} dpi=${max.resolution.dpi || 'N/A'}`);
  }

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