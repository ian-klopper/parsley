import * as XLSX from 'xlsx';

// PDF.js via CDN for better compatibility
let pdfjsLib: any = null;
let pdfjsInitialized = false;
let pdfjsLoading = false;

const initPdfJs = async (): Promise<any> => {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be used in browser environment');
  }

  if (pdfjsLib) {
    return pdfjsLib;
  }

  if (pdfjsLoading) {
    // Wait for existing load to complete
    while (pdfjsLoading && !pdfjsLib) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return pdfjsLib;
  }

  if (!pdfjsInitialized) {
    pdfjsInitialized = true;
    pdfjsLoading = true;

    try {
      // Check if PDF.js is already loaded globally
      if ((window as any).pdfjsLib) {
        pdfjsLib = (window as any).pdfjsLib;
        pdfjsLoading = false;
        return pdfjsLib;
      }

      // Load PDF.js from CDN
      await loadPdfJsFromCDN();

      // Wait for it to be available
      let attempts = 0;
      while (!(window as any).pdfjsLib && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if ((window as any).pdfjsLib) {
        pdfjsLib = (window as any).pdfjsLib;
        pdfjsLoading = false;
        return pdfjsLib;
      } else {
        throw new Error('PDF.js failed to load from CDN');
      }
    } catch (error) {
      pdfjsInitialized = false;
      pdfjsLoading = false;
      console.error('PDF.js initialization failed:', error);
      throw new Error(`Failed to initialize PDF.js: ${error}`);
    }
  }

  return pdfjsLib;
};

const loadPdfJsFromCDN = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    if (document.querySelector('script[src*="pdf.min.js"]')) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      // Set worker source
      if ((window as any).pdfjsLib) {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'));
    document.head.appendChild(script);
  });
};

export interface TextChunk {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasReliableCoordinates: boolean;
}

export interface FilePreview {
  id: string;
  type: 'pdf' | 'image' | 'spreadsheet';
  pages?: PdfPagePreview[];
  imageUrl?: string;
  spreadsheetData?: SpreadsheetData;
  error?: string;
}

export interface PdfPagePreview {
  pageNumber: number;
  imageUrl: string;
  textChunks: TextChunk[];
  width: number;
  height: number;
}

export interface SpreadsheetData {
  sheets: SheetData[];
  selectedSheetIndex: number;
}

export interface SheetData {
  name: string;
  data: any[][];
  headers: string[];
}

export class FilePreviewService {
  static async generatePreview(fileUrl: string, fileType: string, fileName: string): Promise<FilePreview> {
    try {
      const id = `${fileName}-${Date.now()}`;

      if (fileType === 'application/pdf') {
        try {
          return await this.generatePdfPreview(id, fileUrl);
        } catch (pdfError) {
          console.error('PDF preview failed, falling back to simple image display:', pdfError);
          // Fallback to displaying PDF as a link/image placeholder
          return {
            id,
            type: 'image',
            imageUrl: fileUrl,
            error: `PDF preview unavailable: ${pdfError instanceof Error ? pdfError.message : 'Unknown PDF error'}`
          };
        }
      } else if (fileType.startsWith('image/')) {
        return this.generateImagePreview(id, fileUrl);
      } else if (this.isSpreadsheetType(fileType)) {
        return await this.generateSpreadsheetPreview(id, fileUrl);
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      console.error('Preview generation failed:', error);
      return {
        id: `${fileName}-${Date.now()}`,
        type: 'image',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async generatePdfPreview(id: string, fileUrl: string): Promise<FilePreview> {
    const pdfjs = await initPdfJs();
    if (!pdfjs) {
      throw new Error('PDF.js failed to initialize');
    }

    const pdf = await pdfjs.getDocument(fileUrl).promise;
    const pages: PdfPagePreview[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      // Create canvas for rendering
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Convert canvas to data URL
      const imageUrl = canvas.toDataURL('image/jpeg', 0.9);

      // Extract text with coordinates
      const textContent = await page.getTextContent();
      const textChunks = this.extractTextChunks(textContent, viewport, pdfjs);

      pages.push({
        pageNumber: pageNum,
        imageUrl,
        textChunks,
        width: viewport.width,
        height: viewport.height
      });
    }

    return {
      id,
      type: 'pdf',
      pages
    };
  }

  private static generateImagePreview(id: string, fileUrl: string): FilePreview {
    return {
      id,
      type: 'image',
      imageUrl: fileUrl
    };
  }

  private static async generateSpreadsheetPreview(id: string, fileUrl: string): Promise<FilePreview> {
    // Fetch the file as array buffer
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();

    // Parse with xlsx
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const sheets: SheetData[] = workbook.SheetNames.map(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      // Extract headers and data
      const headers = jsonData.length > 0 ? (jsonData[0] as string[]) : [];
      const data = jsonData.slice(1) as any[][];

      return {
        name: sheetName,
        data: data.slice(0, 20), // Limit to first 20 rows for preview
        headers
      };
    });

    return {
      id,
      type: 'spreadsheet',
      spreadsheetData: {
        sheets,
        selectedSheetIndex: 0
      }
    };
  }

  private static extractTextChunks(textContent: any, viewport: any, pdfjs: any): TextChunk[] {
    const textChunks: TextChunk[] = [];

    for (const item of textContent.items) {
      if (item.str.trim()) {
        try {
          // Transform coordinates from PDF space to canvas space
          const transform = pdfjs.Util.transform(viewport.transform, item.transform);
          const x = transform[4];
          const y = viewport.height - transform[5]; // Flip Y coordinate

          textChunks.push({
            text: item.str,
            x,
            y: y - item.height, // Adjust for text baseline
            width: item.width,
            height: item.height,
            hasReliableCoordinates: true
          });
        } catch (error) {
          // If coordinate transformation fails, still include the text without coordinates
          textChunks.push({
            text: item.str,
            x: 0,
            y: 0,
            width: item.width || 0,
            height: item.height || 0,
            hasReliableCoordinates: false
          });
        }
      }
    }

    return textChunks;
  }

  private static isSpreadsheetType(fileType: string): boolean {
    return [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv'
    ].includes(fileType);
  }

  static getFileType(fileName: string, mimeType?: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (mimeType) {
      return mimeType;
    }

    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'csv':
        return 'text/csv';
      default:
        return 'application/octet-stream';
    }
  }
}