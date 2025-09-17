import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';

// Initialize Genkit for extraction pipeline
const ai = genkit({
  plugins: [googleAI({
    apiKey: process.env.GOOGLE_API_KEY
  })],
  model: gemini15Flash,
});

// Core types for the extraction pipeline
export interface TextChunk {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontWeight?: string;
  reliable: boolean; // true for direct extraction, false for OCR
  assetId: string; // reference to the source asset
}

export interface Asset {
  id: string;
  type: 'pdf' | 'image' | 'spreadsheet';
  name: string;
  data?: string; // base64 for images/PDFs, structured text for spreadsheets
  jpegBase64?: string; // standardized JPEG representation
  textChunks: TextChunk[];
}

export interface ExtractionAssets {
  assets: Asset[];
  imageParts: Part[]; // for Gemini multimodal API
  textContext: string; // aggregated text chunks with coordinates
}

export interface Part {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export interface MenuSection {
  name: string;
  sourceAssetIds: string[];
  confidence: number;
}

export interface ExtractedMenuItem {
  name: string;
  price?: string;
  description?: string;
  category: string;
  size?: string;
  modifiers?: string[];
  sourceInfo: {
    assetId: string;
    textChunks: TextChunk[];
  };
}

export interface SizeConsolidationSuggestion {
  originalSizes: string[];
  suggestedSize: string;
  confidence: number;
}

export interface ItemOptionSuggestion {
  originalItem: ExtractedMenuItem;
  suggestedStructure: {
    baseItem: Partial<ExtractedMenuItem>;
    modifierGroups?: {
      name: string;
      options: { name: string; price?: string }[];
    }[];
    variants?: Partial<ExtractedMenuItem>[];
  };
}

/**
 * Class implementing the sophisticated PDF extraction pipeline
 */
export class ExtractionPipeline {

  /**
   * Helper: Download file from URL and return as ArrayBuffer
   */
  private async downloadFile(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }

  /**
   * Master pipeline orchestrator - processes documents through the complete pipeline
   */
  async processDocuments(documentUrls: { id: string; url: string; type: string; name: string }[]): Promise<{
    assets: Asset[];
    extractionAssets: ExtractionAssets;
    menuSections: MenuSection[];
    extractedItems: ExtractedMenuItem[];
    sizeConsolidations: SizeConsolidationSuggestion[];
    itemSuggestions: ItemOptionSuggestion[];
  }> {
    const assets: Asset[] = [];

    // Process each document
    for (const doc of documentUrls) {
      try {
        console.log('📄 Processing document:', doc.name, 'Type:', doc.type);

        if (doc.type === 'application/pdf') {
          // PDF processing - server-side optimized
          const pdfBuffer = await this.downloadFile(doc.url);

          // Process PDF with server-side approach
          const asset = await this.processPdfServerSide(pdfBuffer, doc.id, doc.name);
          assets.push(asset);
        } else if (doc.type.startsWith('image/')) {
          // Image processing with standardization and OCR
          const imageBuffer = await this.downloadFile(doc.url);

          const asset: Asset = {
            id: doc.id,
            type: 'image',
            name: doc.name,
            textChunks: []
          };

          // Server-side processing is the default and primary approach
          console.log('Server-side image processing - preparing for AI vision analysis');

          // Create a text chunk for the image
          const textChunk: TextChunk = {
            text: `Image Document: ${doc.name}\n[Content will be processed by AI vision]`,
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            reliable: false, // AI vision will extract the actual content
            assetId: doc.id
          };

          asset.textChunks = [textChunk];

          // Convert image buffer to base64 for AI processing
          const base64 = Buffer.from(imageBuffer).toString('base64');

          // Determine MIME type from file extension or use generic
          let mimeType = 'image/jpeg'; // default
          if (doc.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
          else if (doc.name.toLowerCase().endsWith('.gif')) mimeType = 'image/gif';
          else if (doc.name.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';

          asset.data = base64;
          asset.jpegBase64 = base64; // Use as-is for now

          console.log(`Server-side image processing: ${doc.name} prepared for AI vision analysis`);

          assets.push(asset);
        } else if (doc.type.includes('spreadsheet') || doc.type.includes('excel') || doc.type.includes('csv')) {
          // Spreadsheet processing
          const spreadsheetBuffer = await this.downloadFile(doc.url);
          const asset = await this.processSpreadsheet(spreadsheetBuffer, doc.id, doc.name, doc.type);
          assets.push(asset);
        } else {
          console.log(`⚠️ Unsupported document type: ${doc.type} for ${doc.name} - skipping`);
        }
      } catch (error) {
        console.error(`❌ Failed to process document ${doc.name}:`, error);
      }
    }

    // Create extraction assets structure
    const imageParts: Part[] = [];

    // Build image parts from processed assets
    for (const asset of assets) {
      if (asset.data) {
        if (asset.type === 'pdf') {
          // For PDFs, add as PDF document for AI processing
          imageParts.push({
            inlineData: {
              mimeType: 'application/pdf',
              data: asset.data
            }
          });
        } else if (asset.type === 'image') {
          // For images, determine MIME type from filename
          let mimeType = 'image/jpeg'; // default
          if (asset.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
          else if (asset.name.toLowerCase().endsWith('.gif')) mimeType = 'image/gif';
          else if (asset.name.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';

          imageParts.push({
            inlineData: {
              mimeType,
              data: asset.data
            }
          });
        }
      } else if (asset.jpegBase64) {
        // Fallback for legacy jpegBase64 format
        imageParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: asset.jpegBase64
          }
        });
      }
    }

    const extractionAssets: ExtractionAssets = {
      assets,
      imageParts,
      textContext: this.buildTextContext({ assets, imageParts, textContext: '' })
    };

    // Run the pipeline stages
    const menuSections = await this.extractMenus(extractionAssets);
    const extractedItems: ExtractedMenuItem[] = [];

    // Extract content for each section
    console.log(`\n🔄 EXTRACTION PHASE: Processing ${menuSections.length} sections`);
    for (const section of menuSections) {
      console.log(`\n📋 Processing section: "${section.name}"`);
      console.log(`- Source assets: ${section.sourceAssetIds?.join(', ') || 'none'}`);
      console.log(`- Pre-extraction total items: ${extractedItems.length}`);

      const sectionItems = await this.extractMenuContents(section, extractionAssets);
      console.log(`- Items extracted from "${section.name}": ${sectionItems.length}`);

      extractedItems.push(...sectionItems);
      console.log(`- Post-extraction total items: ${extractedItems.length}`);

      // Show sample of extracted items for debugging
      if (sectionItems.length > 0) {
        console.log(`- Sample items from "${section.name}":`);
        sectionItems.slice(0, 3).forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.name} - ${item.price} (${item.category})`);
        });
      }
    }

    console.log(`\n✅ FINAL EXTRACTION RESULTS:`);
    console.log(`- Total sections processed: ${menuSections.length}`);
    console.log(`- Total items extracted: ${extractedItems.length}`);
    console.log(`- Items by category:`);
    const itemsByCategory = extractedItems.reduce((acc, item) => {
      acc[item.category || 'Unknown'] = (acc[item.category || 'Unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    Object.entries(itemsByCategory).forEach(([category, count]) => {
      console.log(`  - ${category}: ${count} items`);
    });

    // Post-processing
    const sizeConsolidations = await this.findSizeConsolidationSuggestions(extractedItems);
    const itemSuggestions = await this.findItemOptionSuggestions(extractedItems);

    return {
      assets,
      extractionAssets,
      menuSections,
      extractedItems,
      sizeConsolidations,
      itemSuggestions
    };
  }

  /**
   * Dual-path PDF processing: Try direct text extraction, fallback to OCR if needed
   */
  async processPdfWithDualPath(pdfBuffer: ArrayBuffer, id: string, name: string): Promise<Asset> {
    const asset: Asset = {
      id,
      type: 'pdf',
      name,
      textChunks: []
    };

    // Server-side processing is the default and primary approach
    console.log('Server-side PDF processing - preparing for AI vision analysis');

    // Create a single text chunk for the whole PDF
    // This allows the AI to process the document using its vision capabilities
    const textChunk: TextChunk = {
      text: `PDF Document: ${name}\n[Content will be processed by AI vision]`,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      reliable: false, // AI vision will extract the actual content
      assetId: id
    };

    asset.textChunks = [textChunk];

    // Convert PDF buffer to base64 for AI processing
    const base64 = Buffer.from(pdfBuffer).toString('base64');
    asset.data = base64;

    console.log(`Server-side PDF processing: ${name} prepared for AI vision analysis`);
    return asset;

    try {
      // Step 1: Render PDF pages as JPEGs
      const pdfjsLib = await this.loadPdfJs();
      const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
      const numPages = pdf.numPages;

      console.log(`Processing PDF with ${numPages} pages`);

      // Process each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          // Render page to JPEG
          const { jpegBase64, width, height } = await this.renderPdfPageAsJpeg(pdfBuffer, pageNum);

          // Try direct text extraction first
          let textChunks: TextChunk[] = [];
          try {
            textChunks = await this.extractTextWithBoundingBoxes(pdfBuffer, pageNum, width, height);
            console.log(`Direct extraction: ${textChunks.length} chunks from page ${pageNum}`);
          } catch (directError) {
            console.warn(`Direct text extraction failed for page ${pageNum}, trying OCR:`, directError);
          }

          // If direct extraction failed or yielded few results, try OCR
          if (textChunks.length < 5) {
            try {
              const ocrChunks = await this.performImageOcr(jpegBase64, `${id}-page-${pageNum}`);
              if (ocrChunks.length > textChunks.length) {
                console.log(`OCR extraction: ${ocrChunks.length} chunks from page ${pageNum} (better than direct)`);
                textChunks = ocrChunks;
              }
            } catch (ocrError) {
              console.warn(`OCR extraction also failed for page ${pageNum}:`, ocrError);
            }
          }

          // Add chunks to asset
          asset.textChunks.push(...textChunks);

          // Store JPEG for multimodal processing
          if (!asset.jpegBase64) {
            asset.jpegBase64 = jpegBase64; // Store first page as representative
          }

        } catch (pageError) {
          console.error(`Failed to process page ${pageNum}:`, pageError);
        }
      }

      console.log(`Total text chunks extracted: ${asset.textChunks.length}`);
      return asset;

    } catch (error) {
      console.error('PDF processing failed:', error);
      return asset; // Return empty asset rather than fail completely
    }
  }

  /**
   * Server-side PDF processing using pdf-parse for text extraction
   */
  async processPdfServerSide(pdfBuffer: ArrayBuffer, id: string, name: string): Promise<Asset> {
    const asset: Asset = {
      id,
      type: 'pdf',
      name,
      textChunks: []
    };

    console.log('Server-side PDF processing - extracting text with pdf-parse');

    try {
      // Extract text using pdf-parse
      const text = await this.extractTextFromPdfServerSide(pdfBuffer);

      if (text && text.trim().length > 10) {
        // Create text chunks from extracted text (only if we got substantial text)
        const textChunk: TextChunk = {
          text: text,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          reliable: true, // Server-side extraction is reliable
          assetId: id
        };
        asset.textChunks = [textChunk];
        console.log(`📑 Extracted ${text.length} characters of text from PDF using server-side parsing`);

        // Still provide base64 for potential AI enhancement
        const base64 = Buffer.from(pdfBuffer).toString('base64');
        asset.data = base64;
      } else {
        // If no significant text extracted, prepare for AI vision analysis
        const textChunk: TextChunk = {
          text: `PDF Document: ${name}\n[Content will be processed by AI vision]`,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          reliable: false, // AI vision will extract the actual content
          assetId: id
        };
        asset.textChunks = [textChunk];
        console.log(`📑 No significant text extracted from PDF, preparing for AI vision analysis`);

        // Convert PDF buffer to base64 for AI processing
        const base64 = Buffer.from(pdfBuffer).toString('base64');
        asset.data = base64;
      }

      console.log(`Server-side PDF processing: ${name} completed`);
      return asset;

    } catch (error) {
      console.warn('Server-side PDF text extraction failed, falling back to AI vision:', error.message);

      // Fallback: prepare for AI vision analysis
      const textChunk: TextChunk = {
        text: `PDF Document: ${name}\n[Content will be processed by AI vision]`,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        reliable: false,
        assetId: id
      };
      asset.textChunks = [textChunk];

      // Convert PDF buffer to base64 for AI processing
      const base64 = Buffer.from(pdfBuffer).toString('base64');
      asset.data = base64;

      console.log(`PDF processing completed with AI vision fallback for: ${name}`);
      return asset;
    }
  }

  /**
   * Process spreadsheet files (Excel, CSV, etc.)
   */
  async processSpreadsheet(spreadsheetBuffer: ArrayBuffer, id: string, name: string, fileType: string): Promise<Asset> {
    const asset: Asset = {
      id,
      type: 'spreadsheet',
      name,
      textChunks: []
    };

    console.log('Processing spreadsheet - extracting text content');

    try {
      const text = await this.extractTextFromSpreadsheetServerSide(spreadsheetBuffer, fileType);

      if (text && text.trim().length > 0) {
        const textChunk: TextChunk = {
          text: text,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          reliable: true, // Spreadsheet extraction is reliable
          assetId: id
        };
        asset.textChunks = [textChunk];
        console.log(`📊 Extracted ${text.length} characters from spreadsheet`);
      } else {
        console.log('📊 No content extracted from spreadsheet');
      }

      return asset;

    } catch (error) {
      console.error('Spreadsheet processing failed:', error);
      return asset; // Return empty asset rather than fail completely
    }
  }

  /**
   * Extract text from PDF using pdf-parse (server-side)
   */
  private async extractTextFromPdfServerSide(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      // Dynamic import to avoid bundling issues
      const pdfParseModule: any = await import('pdf-parse');
      const pdfParse = (pdfParseModule?.default || pdfParseModule) as (data: Buffer) => Promise<{ text: string }>;

      const buffer = Buffer.from(arrayBuffer);
      const result = await pdfParse(buffer);
      return typeof result.text === 'string' ? result.text : '';
    } catch (err) {
      console.warn('PDF text extraction failed:', err instanceof Error ? err.message : err);
      return '';
    }
  }

  /**
   * Extract text from spreadsheet files using XLSX
   */
  private async extractTextFromSpreadsheetServerSide(arrayBuffer: ArrayBuffer, fileType: string): Promise<string> {
    try {
      // Dynamic import to avoid SSR issues
      const XLSX = await import('xlsx');

      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      let fullText = '';

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Add sheet name as header
        fullText += `\n=== ${sheetName} ===\n`;

        // Convert to text representation
        jsonData.forEach((row: any) => {
          if (Array.isArray(row)) {
            fullText += row.join(' | ') + '\n';
          }
        });
      });

      return fullText.trim();
    } catch (error) {
      console.error('Spreadsheet extraction error:', error);
      return '';
    }
  }

  /**
   * Step 1: Convert PDF pages to standardized JPEG assets
   */
  async renderPdfPageAsJpeg(
    pdfFile: ArrayBuffer,
    pageNumber: number
  ): Promise<{ jpegBase64: string; width: number; height: number }> {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('PDF rendering must be done in browser environment. Server-side rendering not yet implemented.');
    }

    try {
      const pdfjsLib = await this.loadPdfJs();
      const pdf = await pdfjsLib.getDocument({ data: pdfFile }).promise;
      const page = await pdf.getPage(pageNumber);

      // Standard high resolution - target width of 1536px
      const originalViewport = page.getViewport({ scale: 1 });
      const scale = 1536 / originalViewport.width;
      const viewport = page.getViewport({ scale });

      // Create canvas for rendering
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Could not get canvas 2D context');
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Fill with white background to handle transparency
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Render the PDF page onto the canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Convert canvas to JPEG base64
      const jpegBase64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];

      return {
        jpegBase64,
        width: canvas.width,
        height: canvas.height
      };
    } catch (error) {
      console.error('PDF rendering failed:', error);
      throw new Error(`Failed to render PDF page ${pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 2A: Extract text with bounding boxes for text-based PDFs
   */
  async extractTextWithBoundingBoxes(
    pdfFile: ArrayBuffer,
    pageNumber: number,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<TextChunk[]> {
    if (typeof window === 'undefined') {
      throw new Error('PDF text extraction must be done in browser environment');
    }

    try {
      const pdfjsLib = await this.loadPdfJs();
      const pdf = await pdfjsLib.getDocument({ data: pdfFile }).promise;
      const page = await pdf.getPage(pageNumber);

      // Get text content with positioning information
      const textContent = await page.getTextContent();
      const chunks: TextChunk[] = [];

      // Calculate scaling factor to match the rendered canvas
      const originalViewport = page.getViewport({ scale: 1 });
      const scale = canvasWidth / originalViewport.width;

      textContent.items.forEach((item: any, index: number) => {
        // Only process items with visible text
        if (item.str && item.str.trim()) {
          const transform = item.transform;

          // Extract coordinates from transformation matrix
          // transform[4] = x position, transform[5] = y position
          const x = transform[4] * scale;
          const y = canvasHeight - (transform[5] * scale); // Flip Y coordinate (PDF origin is bottom-left)

          // Calculate dimensions
          const width = item.width * scale;
          const height = item.height * scale;

          // Determine font weight from font name
          const fontWeight = item.fontName?.toLowerCase().includes('bold') ? 'bold' : 'normal';

          chunks.push({
            text: item.str,
            x: Math.round(x),
            y: Math.round(y - height), // Adjust Y to be top-left origin
            width: Math.round(width),
            height: Math.round(height),
            fontWeight,
            reliable: true, // Direct PDF text extraction is reliable
            assetId: `pdf-page-${pageNumber}`
          });
        }
      });

      console.log(`Extracted ${chunks.length} text chunks from PDF page ${pageNumber}`);
      return chunks;

    } catch (error) {
      console.error(`Text extraction failed for page ${pageNumber}:`, error);
      throw new Error(`Failed to extract text from PDF page ${pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 2B: AI-powered OCR for scanned PDFs and images
   */
  async performImageOcr(
    jpegBase64: string,
    assetId: string
  ): Promise<TextChunk[]> {
    const prompt = `You are a high-precision OCR engine. Analyze this image and extract ALL visible text with accurate bounding box coordinates.

For each piece of text you find, return it in this exact format:
[(x, y, width, height, fontWeight) "text content"]

Requirements:
- x, y are the top-left coordinates in pixels
- width, height are the dimensions of the text
- fontWeight should be "bold" or "normal"
- Include even small text, numbers, and symbols
- Be as accurate as possible with coordinates
- Return ONLY the text chunks in the specified format, no other commentary

Image to analyze:`;

    try {
      // Use Genkit's multimodal capabilities for OCR
      const response = await ai.generate({
        prompt,
        media: [
          {
            contentType: 'image/jpeg',
            url: `data:image/jpeg;base64,${jpegBase64}`
          }
        ],
        config: {
          temperature: 0.1,
          maxOutputTokens: 4000,
        }
      });

      return this.parseOcrResponse(response.text, assetId);
    } catch (error) {
      console.error('OCR failed:', error);

      // Try fallback approach without multimodal
      try {
        console.log('Trying OCR fallback without multimodal');
        const fallbackResponse = await ai.generate({
          prompt: `${prompt}\n\nImage data (base64): ${jpegBase64.substring(0, 100)}... [truncated]`,
          config: {
            temperature: 0.1,
            maxOutputTokens: 4000,
          }
        });

        return this.parseOcrResponse(fallbackResponse.text, assetId);
      } catch (fallbackError) {
        console.error('OCR fallback also failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Step 3: Standardize images to consistent format
   */
  async standardizeImage(
    imageFile: File | ArrayBuffer,
    targetWidth: number = 1536
  ): Promise<{ jpegBase64: string; width: number; height: number }> {
    if (typeof window === 'undefined') {
      throw new Error('Image standardization must be done in browser environment');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Calculate dimensions maintaining aspect ratio
        const aspectRatio = img.height / img.width;
        const width = targetWidth;
        const height = Math.round(width * aspectRatio);

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = width;
        canvas.height = height;

        // Fill with white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG
        const jpegBase64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];

        resolve({ jpegBase64, width, height });
      };

      img.onerror = reject;

      if (imageFile instanceof File) {
        img.src = URL.createObjectURL(imageFile);
      } else {
        const blob = new Blob([imageFile]);
        img.src = URL.createObjectURL(blob);
      }
    });
  }

  /**
   * Step 4: Create high-contrast OCR optimized image
   */
  createOcrImage(jpegBase64: string): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('OCR image creation must be done in browser environment');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Apply high-contrast filter
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          // Convert to grayscale
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          // Apply high contrast
          const contrast = gray > 128 ? 255 : 0;

          data[i] = contrast;     // R
          data[i + 1] = contrast; // G
          data[i + 2] = contrast; // B
          // Alpha stays the same
        }

        ctx.putImageData(imageData, 0, 0);

        const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
        resolve(optimizedBase64);
      };

      img.onerror = reject;
      img.src = `data:image/jpeg;base64,${jpegBase64}`;
    });
  }

  /**
   * Step 5: Multi-stage AI extraction - Menu section identification
   */
  async extractMenus(assets: ExtractionAssets): Promise<MenuSection[]> {
    // Build comprehensive text context from all text chunks
    const textContext = this.buildTextContext(assets);

    console.log('🔍 Menu extraction debug:');
    console.log('- Assets count:', assets.assets.length);
    console.log('- Image parts count:', assets.imageParts.length);
    console.log('- Text context length:', textContext.length);
    console.log('- Text context preview:', textContext.substring(0, 200) + '...');

    // Debug asset types
    assets.assets.forEach((asset, i) => {
      console.log(`- Asset ${i + 1}: ${asset.name} (${asset.type}) - Text chunks: ${asset.textChunks.length}, Has data: ${!!asset.data}, Has jpegBase64: ${!!asset.jpegBase64}`);
    });

    const assetsList = assets.assets.map(asset => `- ${asset.name} (${asset.type})`).join('\n');

    const prompt = `You are an expert menu analyst. Analyze ALL the provided documents and identify the primary menu sections.

Available assets:
${assetsList}

Context from extracted text:
${textContext}

Images: ${assets.imageParts.length} visual assets provided

Your task: Identify all distinct menu sections (e.g., "Appetizers", "Entrees", "Cocktails", "Beer", "Wine", etc.)

CRITICAL: For sourceAssetIds, you MUST use the exact asset names from the list above.
- If content appears to come from an image, use the image filename (e.g., "menu-image.jpg")
- If content appears to come from a PDF, use the PDF filename (e.g., "menu.pdf")
- If content appears to come from a spreadsheet, use the spreadsheet filename (e.g., "menu.xlsx")

Be very careful to assign sections to the correct source assets based on where you actually see the content.

Return ONLY a JSON array of menu sections in this format:
[
  {
    "name": "Section Name",
    "sourceAssetIds": ["exact-filename-from-list-above"],
    "confidence": 0.95
  }
]`;

    try {
      let response;

      // Try multimodal approach if we have images
      if (assets.imageParts.length > 0) {
        try {
          response = await ai.generate({
            prompt,
            media: assets.imageParts, // Process ALL images for menu section identification
            config: {
              temperature: 0.1,
              maxOutputTokens: 2000,
            }
          });
        } catch (multimodalError) {
          console.warn('Multimodal menu extraction failed, falling back to text-only:', multimodalError);
          response = await ai.generate({
            prompt,
            config: {
              temperature: 0.1,
              maxOutputTokens: 2000,
            }
          });
        }
      } else {
        response = await ai.generate({
          prompt,
          config: {
            temperature: 0.1,
            maxOutputTokens: 2000,
          }
        });
      }

      console.log('🤖 AI Response for menu sections:');
      console.log('- Response type:', typeof response.text);
      console.log('- Response length:', response.text?.length || 0);
      console.log('- Response preview:', response.text?.substring(0, 500) + '...');

      return this.parseMenuSections(response.text);
    } catch (error) {
      console.error('Menu section extraction failed:', error);
      return [];
    }
  }

  /**
   * Step 6: Multi-stage AI extraction - Menu content extraction
   */
  async extractMenuContents(
    section: MenuSection,
    relevantAssets: ExtractionAssets
  ): Promise<ExtractedMenuItem[]> {
    console.log(`🔍 Section "${section.name}" debug:`);
    console.log('- Section assets:', section.sourceAssetIds);
    console.log('- Pre-extraction total items:', 0);

    // Build focused context for this section
    const textContext = this.buildTextContext(relevantAssets);

    // Check if this section contains image assets for specialized prompt
    const sectionAssets = relevantAssets.assets.filter(asset => {
      // Check if the asset ID is directly listed (UUID format)
      if (section.sourceAssetIds.includes(asset.id)) {
        return true;
      }
      // Check if the asset name matches any of the sourceAssetIds (file names)
      return section.sourceAssetIds.some(sourceId =>
        asset.name === sourceId ||
        asset.name.includes(sourceId) ||
        sourceId.includes(asset.name)
      );
    });

    const hasImageAssets = sectionAssets.some(asset => asset.type === 'image');

    console.log(`🔍 Section "${section.name}" debug:`);
    console.log('- Section assets:', sectionAssets.length);
    console.log('- Section image parts:', hasImageAssets ? sectionAssets.filter(a => a.type === 'image').length : 0);
    sectionAssets.forEach((asset, i) => {
      console.log(`  Asset ${i + 1}: ${asset.name} (${asset.type})`);
    });

    let prompt;
    if (hasImageAssets && section.name === 'Unknown') {
      // Special prompt for image-only extraction
      prompt = `Extract ALL visible menu items from the provided image(s).

Requirements:
- Extract ALL menu items you can see in the image
- Include name, price, description if visible
- Categorize items based on their type (e.g., "Appetizers", "Entrees", "Cocktails", "Desserts")
- Include size information if visible
- Return ONLY valid JSON array of items

Format:
[
  {
    "name": "Item Name",
    "price": "$12.99",
    "description": "Item description",
    "category": "Category",
    "size": "Size if applicable",
    "sourceInfo": {
      "assetId": "asset-id",
      "textChunks": []
    }
  }
]`;
    } else {
      // Original prompt for text-based extraction
      prompt = `Extract ALL menu items from the "${section.name}" section ONLY.

Context for this section:
${textContext}

Requirements:
- Extract items ONLY from the "${section.name}" section
- Include name, price, description if available
- Categorize appropriately
- Include size information
- Return ONLY valid JSON array of items

Format:
[
  {
    "name": "Item Name",
    "price": "$12.99",
    "description": "Item description",
    "category": "Category",
    "size": "Size if applicable",
    "sourceInfo": {
      "assetId": "asset-id",
      "textChunks": []
    }
  }
]`;
    }

    try {
      let response;

      // Try multimodal approach if we have images for this section

      // Get image parts that correspond to assets in this section
      const sectionImageParts: Part[] = [];
      console.log(`🖼️ Building image parts for "${section.name}":`)
      sectionAssets.forEach(asset => {
        console.log(`- Checking asset: ${asset.name} (${asset.type})`);
        console.log(`  - Has data: ${!!asset.data}`);
        console.log(`  - Has jpegBase64: ${!!asset.jpegBase64}`);

        // Find corresponding image parts by checking asset type and data availability
        if (asset.type === 'image' && asset.jpegBase64) {
          let mimeType = 'image/jpeg';
          if (asset.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
          else if (asset.name.toLowerCase().endsWith('.gif')) mimeType = 'image/gif';
          else if (asset.name.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';

          sectionImageParts.push({
            inlineData: {
              mimeType,
              data: asset.jpegBase64
            }
          });
          console.log(`  ✅ Added image part with jpegBase64 data`);
        } else if (asset.type === 'pdf' && asset.data) {
          sectionImageParts.push({
            inlineData: {
              mimeType: 'application/pdf',
              data: asset.data
            }
          });
          console.log(`  ✅ Added PDF part with data`);
        } else if (asset.jpegBase64) {
          // Fallback for legacy format
          sectionImageParts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: asset.jpegBase64
            }
          });
          console.log(`  ✅ Added image part with jpegBase64`);
        } else {
          console.log(`  ❌ No usable data found for this asset`);
        }
      });

      console.log(`🖼️ Total image parts for "${section.name}": ${sectionImageParts.length}`);

      if (sectionImageParts.length > 0) {
        try {
          console.log(`🖼️ Using multimodal extraction for "${section.name}" with ${sectionImageParts.length} image(s)`);
          response = await ai.generate({
            prompt,
            media: sectionImageParts, // Process ALL relevant images for this section
            config: {
              temperature: 0.1,
              maxOutputTokens: 4000,
            }
          });
        } catch (multimodalError) {
          console.warn(`Multimodal extraction failed for ${section.name}, falling back to text:`, multimodalError);
          response = await ai.generate({
            prompt,
            config: {
              temperature: 0.1,
              maxOutputTokens: 4000,
            }
          });
        }
      } else {
        response = await ai.generate({
          prompt,
          config: {
            temperature: 0.1,
            maxOutputTokens: 4000,
          }
        });
      }

      const extractedItems = this.parseMenuItems(response.text, section.name);
      console.log(`- Items extracted from "${section.name}": ${extractedItems.length}`);

      if (extractedItems.length > 0) {
        console.log(`- Sample items from "${section.name}":`);
        extractedItems.slice(0, 3).forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.name} - ${item.price} (${item.category})`);
        });
      }

      return extractedItems;
    } catch (error) {
      console.error(`Menu content extraction failed for ${section.name}:`, error);
      return [];
    }
  }

  /**
   * Step 7: Size consolidation suggestions
   */
  async findSizeConsolidationSuggestions(
    allItems: ExtractedMenuItem[]
  ): Promise<SizeConsolidationSuggestion[]> {
    const allSizes = [...new Set(allItems.map(item => item.size).filter(Boolean))];

    const prompt = `Analyze these size names and suggest consolidations for synonyms:

Sizes: ${JSON.stringify(allSizes)}

Look for synonyms like:
- "Gls.", "Glass", "6oz" might all be the same
- "Pint", "16oz", "Pt" might be the same
- "Bottle", "Btl", "750ml" might be the same

Return JSON array of consolidation suggestions:
[
  {
    "originalSizes": ["Gls.", "Glass", "6oz"],
    "suggestedSize": "Glass",
    "confidence": 0.9
  }
]`;

    try {
      const response = await ai.generate({
        prompt,
        config: {
          temperature: 0.1,
          maxOutputTokens: 2000,
        }
      });

      return this.parseSizeConsolidation(response.text);
    } catch (error) {
      console.error('Size consolidation failed:', error);
      return [];
    }
  }

  /**
   * Step 8: Complex item analysis
   */
  async findItemOptionSuggestions(
    items: ExtractedMenuItem[]
  ): Promise<ItemOptionSuggestion[]> {
    const complexItems = items.filter(item =>
      item.description?.includes('choice') ||
      item.description?.includes('add') ||
      item.description?.includes('with') ||
      item.name.includes('/')
    );

    const suggestions: ItemOptionSuggestion[] = [];

    for (const item of complexItems) {
      const prompt = `Analyze this menu item for complex variations or add-ons:

Item: ${JSON.stringify(item)}

If this item has choices, add-ons, or should be split into multiple items, suggest a restructure.

Return JSON:
{
  "originalItem": ${JSON.stringify(item)},
  "suggestedStructure": {
    "baseItem": { "name": "Base item name", "price": "$X.XX" },
    "modifierGroups": [
      {
        "name": "Group name",
        "options": [{"name": "Option", "price": "$X.XX"}]
      }
    ],
    "variants": [
      { "name": "Variant name", "price": "$X.XX" }
    ]
  }
}`;

      try {
        const response = await ai.generate({
          prompt,
          config: {
            temperature: 0.1,
            maxOutputTokens: 1000,
          }
        });

        const suggestion = this.parseItemSuggestion(response.text);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      } catch (error) {
        console.error(`Item analysis failed for ${item.name}:`, error);
      }
    }

    return suggestions;
  }

  // Helper methods
  private buildTextContext(assets: ExtractionAssets): string {
    let context = '';
    for (const asset of assets.assets) {
      if (asset.textChunks.length > 0) {
        context += `\n\n=== ${asset.name} ===\n`;
        for (const chunk of asset.textChunks) {
          context += `${chunk.text} `;
        }
      }
    }
    return context.trim();
  }

  private async loadPdfJs(): Promise<any> {
    if (typeof window === 'undefined') {
      throw new Error('PDF.js can only be loaded in browser environment');
    }

    // Try to get from global first
    if ((window as any).pdfjsLib) {
      return (window as any).pdfjsLib;
    }

    // Dynamic import for PDF.js
    try {
      const pdfjsLib = await import('pdfjs-dist');

      // Set worker path for PDF.js
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      // Store globally for reuse
      (window as any).pdfjsLib = pdfjsLib;

      return pdfjsLib;
    } catch (error) {
      console.error('Failed to load PDF.js:', error);
      throw new Error('PDF.js library could not be loaded');
    }
  }

  private parseOcrResponse(response: string, assetId: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    const lines = response.split('\n');

    for (const line of lines) {
      const match = line.match(/\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\w+)\)\s*"([^"]+)"/);
      if (match) {
        chunks.push({
          text: match[6],
          x: parseInt(match[1]),
          y: parseInt(match[2]),
          width: parseInt(match[3]),
          height: parseInt(match[4]),
          fontWeight: match[5],
          reliable: false,
          assetId
        });
      }
    }

    return chunks;
  }

  private parseMenuSections(response: string): MenuSection[] {
    try {
      console.log(`🔍 Parsing menu sections`);
      console.log(`📝 Raw response length: ${response.length}`);
      console.log(`📝 Raw response preview: ${response.substring(0, 500)}...`);

      // Enhanced cleaning for AI responses
      let cleanResponse = response.trim();

      // Remove markdown code blocks
      cleanResponse = cleanResponse.replace(/```json\s*\n?/gi, '');
      cleanResponse = cleanResponse.replace(/\n?\s*```/g, '');
      cleanResponse = cleanResponse.replace(/```\s*\n?/gi, '');

      // Remove any leading/trailing text that's not JSON
      const jsonStartIndex = cleanResponse.indexOf('[');
      const jsonEndIndex = cleanResponse.lastIndexOf(']');

      if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
        cleanResponse = cleanResponse.substring(jsonStartIndex, jsonEndIndex + 1);
      }

      // Additional cleanup
      cleanResponse = cleanResponse.trim();

      console.log(`✨ Cleaned response: ${cleanResponse.substring(0, 200)}...`);

      const sections = JSON.parse(cleanResponse);

      if (!Array.isArray(sections)) {
        console.warn(`⚠️ Menu sections response is not an array`);
        return [];
      }

      console.log(`✅ Successfully parsed ${sections.length} menu sections`);
      return sections;
    } catch (error) {
      console.error('❌ Failed to parse menu sections:', error);
      console.error(`📝 Failed response: ${response.substring(0, 1000)}...`);
      return [];
    }
  }

  private parseMenuItems(response: string, sectionName: string): ExtractedMenuItem[] {
    try {
      console.log(`🔍 Parsing menu items for "${sectionName}"`);
      console.log(`📝 Raw response length: ${response.length}`);
      console.log(`📝 Raw response preview: ${response.substring(0, 500)}...`);

      // Enhanced cleaning for AI responses
      let cleanResponse = response.trim();

      // Remove markdown code blocks
      cleanResponse = cleanResponse.replace(/```json\s*\n?/gi, '');
      cleanResponse = cleanResponse.replace(/\n?\s*```/g, '');
      cleanResponse = cleanResponse.replace(/```\s*\n?/gi, '');

      // Remove any leading/trailing text that's not JSON
      const jsonStartIndex = cleanResponse.indexOf('[');
      const jsonEndIndex = cleanResponse.lastIndexOf(']');

      if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
        cleanResponse = cleanResponse.substring(jsonStartIndex, jsonEndIndex + 1);
      }

      // Additional cleanup
      cleanResponse = cleanResponse.trim();

      console.log(`✨ Cleaned response: ${cleanResponse.substring(0, 200)}...`);

      const items = JSON.parse(cleanResponse);

      if (!Array.isArray(items)) {
        console.warn(`⚠️ Response is not an array for section "${sectionName}"`);
        return [];
      }

      console.log(`✅ Successfully parsed ${items.length} items for "${sectionName}"`);

      // Ensure each item has the section name as category
      return items.map((item: any) => ({
        ...item,
        category: item.category || sectionName
      }));
    } catch (error) {
      console.error(`❌ Failed to parse menu items for "${sectionName}":`, error);
      console.error(`📝 Failed response: ${response.substring(0, 1000)}...`);
      return [];
    }
  }

  private parseSizeConsolidation(response: string): SizeConsolidationSuggestion[] {
    try {
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Failed to parse size consolidation:', error);
      return [];
    }
  }

  private parseItemSuggestion(response: string): ItemOptionSuggestion | null {
    try {
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Failed to parse item suggestion:', error);
      return null;
    }
  }
}

// Export singleton instance
export const extractionPipeline = new ExtractionPipeline();