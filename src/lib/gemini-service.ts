import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';
import { FoodItem } from '@/lib/food-data';
import { JobDocument } from '@/lib/storage-service';
import { allowedCategories, allowedSizes, tabCategories, allTabs } from '@/lib/menu-data';

// Initialize Genkit with Google AI
const ai = genkit({
  plugins: [googleAI({
    apiKey: process.env.GOOGLE_API_KEY
  })],
  model: gemini15Flash,
});

export interface ModifierOption {
  name: string;
  price?: string;
}

export interface ModifierGroup {
  name: string;
  category: 'food' | 'beverage';
  options: ModifierOption[];
}

export interface OrganizedExtractionData {
  [tabName: string]: FoodItem[] | string[] | { food: ModifierGroup[], beverage: ModifierGroup[] };
}

export interface ExtractionResult {
  success: boolean;
  organizedData?: OrganizedExtractionData;
  items?: FoodItem[]; // flat list of extracted items for immediate UI use
  error?: string;
  documentsProcessed?: string[];
  extractionDuration?: number;
  categoryBreakdown?: Record<string, number>;
}

export interface DocumentContent {
  fileName: string;
  fileType: string;
  url: string;
  content?: string; // For text-based files
  base64?: string; // For images
  textContent?: string; // Extracted text from PDFs/images
}

export class GeminiExtractionService {
  private static readonly EXTRACTION_PROMPT = `You are analyzing restaurant menu documents. Extract ALL menu data and structure it precisely in this JSON format:

{
  "items": [
    {
      "name": "Item name exactly as shown",
      "description": "Full description if available, otherwise empty string",
      "subcategory": "MUST be one of: ${allowedCategories.join(', ')}",
      "menus": "Comma-separated menu names where this item appears",
      "sizes": [{"size": "MUST be one of: ${allowedSizes.join(', ')}", "price": "12.99"}],
      "modifierGroups": "Brief description of any modifications available"
    }
  ],
  "menus": [
    "List all menu names found (e.g., Brunch, Lunch, Dinner, Happy Hour, etc.)"
  ],
  "modifiers": [
    {
      "name": "Modifier group name (e.g., Toppings, Add Protein)",
      "category": "food or beverage",
      "options": [
        {"name": "Option name", "price": "2.50"}
      ]
    }
  ]
}

CRITICAL RULES:
1. subcategory MUST be exactly one of the allowed categories - no variations
2. size MUST be exactly one of the allowed sizes - if you see a different size, create it as a modifier instead
3. Extract ALL menu names into the "menus" array
4. Extract ALL modifier groups with their options and prices
5. Classify modifiers as "food" or "beverage" based on what they modify
6. Use numeric format for prices (12.99 not $12.99)
7. Return only valid JSON - no markdown formatting or additional text

OCR INSTRUCTIONS FOR IMAGE-BASED DOCUMENTS:
- Carefully read ALL text visible in images and scanned PDFs using OCR
- Pay special attention to menu sections, item names, descriptions, and prices
- Look for cocktail menus, wine lists, beer selections, and food sections
- Extract text from all areas of the document, including headers, footers, and sidebars

Analyze the documents thoroughly and extract everything you can find.`;

  /**
   * Extract menu data from multiple documents using Gemini
   */
  static async extractFromDocuments(
    documents: JobDocument[]
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      if (!documents || documents.length === 0) {
        return {
          success: false,
          error: 'No documents provided for extraction'
        };
      }

      // Prepare document contents for Gemini
      const documentContents = await this.prepareDocumentContents(documents);

      // Create the prompt with actual document content
      let fullPrompt = `${this.EXTRACTION_PROMPT}

Below are the contents of ${documentContents.length} restaurant menu document(s). Please extract all menu items from the actual content provided:

`;

      // Add each document's content to the prompt
      documentContents.forEach((doc, index) => {
        fullPrompt += `\n--- Document ${index + 1}: ${doc.fileName} ---\n`;

        if (doc.textContent) {
          fullPrompt += doc.textContent;
        } else if (doc.base64) {
          fullPrompt += `[IMAGE: This is a base64-encoded image that contains menu content. Please analyze this image for menu items.]`;
        } else {
          fullPrompt += `[No content extracted from this document]`;
        }

        fullPrompt += '\n';
      });

      fullPrompt += '\n\nPlease analyze ALL the document content above and extract every menu item you can find. Return only valid JSON with no additional text.';

      console.log(`📝 Sending prompt to Gemini (${fullPrompt.length} characters)`);

      // For multimodal content (images), use different API structure
      const hasImages = documentContents.some(doc => doc.base64);

      let response;
      try {
        if (hasImages) {
          // For now, just process as text-only to fix the immediate error
          // TODO: Implement proper multimodal support with the sophisticated pipeline
          console.log('⚠️ Falling back to text-only mode due to multimodal format issues');

          let textPrompt = this.EXTRACTION_PROMPT + '\n\nAnalyze these documents and extract all menu items:\n';

          documentContents.forEach(doc => {
            if (doc.textContent) {
              textPrompt += `\n--- ${doc.fileName} ---\n${doc.textContent}\n`;
            } else if (doc.base64) {
              textPrompt += `\n--- ${doc.fileName} (PDF/Image - OCR required) ---\n[Note: This is a ${doc.fileType} file that needs OCR processing]\n`;
            }
          });

          textPrompt += '\n\nReturn only valid JSON with extracted menu items.';

          console.log('🚀 Calling Gemini text API (fallback mode)...');
          response = await ai.generate({
            prompt: textPrompt,
            config: {
              temperature: 0.1,
              maxOutputTokens: 4000,
            }
          });
        } else {
          // Text-only mode
          console.log('🚀 Calling Gemini text API...');
          response = await ai.generate({
            prompt: fullPrompt,
            config: {
              temperature: 0.1,
              maxOutputTokens: 4000,
            }
          });
        }
      } catch (genAiError) {
        console.error('❌ Error calling ai.generate:', genAiError);
        console.error('❌ Error details:', {
          name: genAiError instanceof Error ? genAiError.name : 'Unknown',
          message: genAiError instanceof Error ? genAiError.message : 'Unknown error',
          stack: genAiError instanceof Error ? genAiError.stack : 'No stack trace'
        });
        return {
          success: false,
          error: `Gemini API error: ${genAiError instanceof Error ? genAiError.message : 'Unknown error'}`,
          documentsProcessed: documents.map(doc => doc.file_name),
          extractionDuration: Date.now() - startTime
        };
      }

      console.log('✅ Gemini API call completed, checking response...');
      console.log('📄 Response object:', {
        hasResponse: !!response,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : 'no response'
      });

      // Access response text via property (not function)
      const extractedText = response?.text;

      console.log('📝 Extracted text:', {
        hasText: !!extractedText,
        textLength: extractedText?.length || 0,
        textPreview: extractedText ? extractedText.substring(0, 200) + '...' : 'No text'
      });

      if (!extractedText) {
        console.error('❌ Gemini response missing text:', { response, hasResponse: !!response });
        return {
          success: false,
          error: 'No response text from Gemini API',
          documentsProcessed: documents.map(doc => doc.file_name),
          extractionDuration: Date.now() - startTime
        };
      }

      // Parse the JSON response
      const extractionData = this.parseExtractionResponse(extractedText);

      if (!extractionData.success) {
        return extractionData;
      }

      const items = extractionData.items || [];
      const menus = extractionData.menus || [];
      const modifiers = extractionData.modifiers || [];
      const duration = Date.now() - startTime;

      // Organize data by tabs
      const organizedData = this.organizeDataByTabs(items, menus, modifiers);

      // Calculate category breakdown
      const categoryBreakdown = this.calculateCategoryBreakdown(items);

      return {
        success: true,
        organizedData,
        items, // include flat items list so callers can render immediately
        documentsProcessed: documents.map(doc => doc.file_name),
        extractionDuration: duration,
        categoryBreakdown
      };

    } catch (error) {
      console.error('Gemini extraction error:', error);
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown extraction error',
        documentsProcessed: documents.map(doc => doc.file_name),
        extractionDuration: duration
      };
    }
  }

  /**
   * Prepare document contents for Gemini analysis
   */
  private static async prepareDocumentContents(
    documents: JobDocument[]
  ): Promise<DocumentContent[]> {
    const processedDocs: DocumentContent[] = [];

    for (const doc of documents) {
      try {
        console.log(`📄 Processing document: ${doc.file_name} (${doc.file_type})`);

        const processedDoc: DocumentContent = {
          fileName: doc.file_name,
          fileType: doc.file_type,
          url: doc.file_url
        };

        // Fetch the file
        const response = await fetch(doc.file_url);
        if (!response.ok) {
          console.error(`❌ Failed to fetch ${doc.file_name}: ${response.status}`);
          continue;
        }

        if (doc.file_type.includes('pdf')) {
          // Prefer extracting text from PDFs server-side for higher accuracy
          const arrayBuffer = await response.arrayBuffer();
          const text = await this.extractTextFromPdf(arrayBuffer);
          if (text && text.trim().length > 0) {
            processedDoc.textContent = text;
            console.log(`📑 Extracted ${text.length} characters of text from PDF`);
          } else {
            // Fallback to base64 for multimodal OCR if no text could be extracted
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            processedDoc.base64 = base64;
            console.log(`📑 PDF text extraction empty; falling back to base64 for OCR (${base64.length} chars)`);
          }
        }
        else if (doc.file_type.includes('image')) {
          // Process Image - convert to base64 for Gemini
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          processedDoc.base64 = base64;
          console.log(`🖼️ Converted image to base64 (${base64.length} chars)`);
        }
        else if (doc.file_type.includes('spreadsheet') || doc.file_type.includes('excel') || doc.file_type.includes('csv')) {
          // Process Spreadsheet
          const arrayBuffer = await response.arrayBuffer();
          const textContent = await this.extractTextFromSpreadsheet(arrayBuffer, doc.file_type);
          processedDoc.textContent = textContent;
          console.log(`📊 Extracted ${textContent.length} characters from spreadsheet`);
        }
        else {
          // Try to process as text
          const textContent = await response.text();
          processedDoc.textContent = textContent;
          console.log(`📝 Read ${textContent.length} characters as text`);
        }

        processedDocs.push(processedDoc);
      } catch (error) {
        console.error(`❌ Error processing ${doc.file_name}:`, error);
        // Continue with other documents
      }
    }

    console.log(`✅ Successfully processed ${processedDocs.length}/${documents.length} documents`);
    return processedDocs;
  }

  /**
   * Extract text from a PDF ArrayBuffer using pdf-parse
   */
  private static async extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      // Dynamic import to avoid bundling issues in edge/client
  const pdfParseModule: any = (await import('pdf-parse')) as any;
  const pdfParse = (pdfParseModule?.default || pdfParseModule) as (data: Buffer) => Promise<{ text: string }>;
      const buffer = Buffer.from(arrayBuffer);
      const result = await pdfParse(buffer);
      return typeof result.text === 'string' ? result.text : '';
    } catch (err) {
      console.warn('PDF text extraction failed, will fallback to OCR:', err instanceof Error ? err.message : err);
      return '';
    }
  }


  /**
   * Extract text from spreadsheet files
   */
  private static async extractTextFromSpreadsheet(arrayBuffer: ArrayBuffer, fileType: string): Promise<string> {
    try {
      // Dynamic import to avoid SSR issues
      const XLSX = await import('xlsx');

      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      let fullText = '';

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

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
   * Parse and validate the JSON response from Gemini
   */
  private static parseExtractionResponse(response: string): { success: boolean; items?: FoodItem[]; menus?: string[]; modifiers?: ModifierGroup[]; error?: string } {
    try {
      // Check if response exists
      if (!response || typeof response !== 'string') {
        return {
          success: false,
          error: `Invalid response from Gemini: ${response ? typeof response : 'null/undefined'}`
        };
      }

      // Clean up the response - remove any markdown formatting
      let cleanedResponse = response.trim();

      // Remove markdown code blocks if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleanedResponse);

      if (!parsed.items || !Array.isArray(parsed.items)) {
        return {
          success: false,
          error: 'Invalid response format: missing items array'
        };
      }

      // Validate and clean up each item
      const validatedItems: FoodItem[] = parsed.items
        .filter((item: any) => this.validateFoodItem(item))
        .map((item: any) => this.cleanFoodItem(item));

      // Extract menus and modifiers
      const menus: string[] = Array.isArray(parsed.menus) ? parsed.menus : [];
      const modifiers: ModifierGroup[] = Array.isArray(parsed.modifiers)
        ? (parsed.modifiers as any[])
            .map((mod: any) => this.cleanModifierGroup(mod))
            .filter((m: any) => Boolean(m)) as ModifierGroup[]
        : [];

      return {
        success: true,
        items: validatedItems,
        menus,
        modifiers
      };

    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      return {
        success: false,
        error: `Failed to parse extraction response: ${error instanceof Error ? error.message : 'Unknown parsing error'}`
      };
    }
  }

  /**
   * Validate that an item has required fields
   */
  private static validateFoodItem(item: any): boolean {
    return (
      typeof item === 'object' &&
      typeof item.name === 'string' &&
      item.name.trim().length > 0 &&
      typeof item.subcategory === 'string' &&
      item.subcategory.trim().length > 0
    );
  }

  /**
   * Clean and standardize a food item
   */
  private static cleanFoodItem(item: any): FoodItem {
    return {
      name: item.name.trim(),
      description: typeof item.description === 'string' ? item.description.trim() : '',
      subcategory: item.subcategory.trim(),
      menus: typeof item.menus === 'string' ? item.menus.trim() : 'General',
  sizes: Array.isArray(item.sizes) ? item.sizes.map((size: any) => ({
        size: typeof size.size === 'string' ? size.size.trim() : 'Regular',
        price: typeof size.price === 'string' ? size.price.trim() : '0.00'
      })) : [{ size: 'Regular', price: '0.00' }],
      modifierGroups: typeof item.modifierGroups === 'string' ? item.modifierGroups.trim() : ''
    };
  }

  /**
   * Calculate breakdown of items by category
   */
  private static calculateCategoryBreakdown(items: FoodItem[]): Record<string, number> {
    const breakdown: Record<string, number> = {};

    items.forEach(item => {
      const category = item.subcategory;
      breakdown[category] = (breakdown[category] || 0) + 1;
    });

    return breakdown;
  }

  /**
   * Format category breakdown for natural language description
   */
  static formatCategoryBreakdown(breakdown: Record<string, number>): string {
    const entries = Object.entries(breakdown);

    if (entries.length === 0) {
      return 'no items';
    }

    if (entries.length === 1) {
      const [category, count] = entries[0];
      return `${count} ${category.toLowerCase()}`;
    }

    const formatted = entries.map(([category, count]) =>
      `${count} ${category.toLowerCase()}`
    );

    if (formatted.length === 2) {
      return formatted.join(' and ');
    }

    return formatted.slice(0, -1).join(', ') + ', and ' + formatted.slice(-1);
  }

  /**
   * Get a natural language description of file types
   */
  static formatFileTypes(documents: JobDocument[]): string {
    const types = documents.map(doc => {
      if (doc.file_type.includes('pdf')) return 'PDF';
      if (doc.file_type.includes('image')) return 'image';
      if (doc.file_type.includes('spreadsheet') || doc.file_type.includes('excel')) return 'spreadsheet';
      if (doc.file_type.includes('csv')) return 'CSV';
      return 'document';
    });

    const uniqueTypes = [...new Set(types)];

    if (uniqueTypes.length === 1) {
      return uniqueTypes[0];
    }

    if (uniqueTypes.length === 2) {
      return uniqueTypes.join(' and ');
    }

    return uniqueTypes.slice(0, -1).join(', ') + ', and ' + uniqueTypes.slice(-1);
  }

  /**
   * Organize extracted data by tabs
   */
  static organizeDataByTabs(
    items: FoodItem[],
    menus: string[],
    modifiers: ModifierGroup[]
  ): OrganizedExtractionData {
    const organizedData: OrganizedExtractionData = {};

    // Initialize all tabs with empty arrays
    allTabs.forEach(tab => {
      if (tab === 'Menu Structure') {
        organizedData[tab] = [];
      } else if (tab === 'Modifiers') {
        organizedData[tab] = { food: [], beverage: [] };
      } else {
        organizedData[tab] = [];
      }
    });

    // Organize items by category tabs
    items.forEach(item => {
      const tab = this.findTabForCategory(item.subcategory);
      if (tab && Array.isArray(organizedData[tab])) {
        (organizedData[tab] as FoodItem[]).push(item);
      }
    });

    // Add menu structure
    organizedData['Menu Structure'] = menus;

    // Organize modifiers by food/beverage
    const modifierData = organizedData['Modifiers'] as { food: ModifierGroup[], beverage: ModifierGroup[] };
    modifiers.forEach(modifier => {
      if (modifier.category === 'food') {
        modifierData.food.push(modifier);
      } else if (modifier.category === 'beverage') {
        modifierData.beverage.push(modifier);
      }
    });

    return organizedData;
  }

  /**
   * Find which tab a category belongs to
   */
  private static findTabForCategory(category: string): string | null {
    for (const [tab, categories] of Object.entries(tabCategories)) {
      if (categories.includes(category)) {
        return tab;
      }
    }
    return null;
  }

  /**
   * Clean and validate a modifier group
   */
  private static cleanModifierGroup(modifier: any): ModifierGroup | null {
    if (!modifier || typeof modifier !== 'object') return null;
    if (!modifier.name || typeof modifier.name !== 'string') return null;
    if (!modifier.category || (modifier.category !== 'food' && modifier.category !== 'beverage')) return null;

    const options: ModifierOption[] = Array.isArray(modifier.options)
      ? (modifier.options as any[]).map((opt: any) => ({
          name: typeof opt.name === 'string' ? opt.name.trim() : '',
          price: typeof opt.price === 'string' ? opt.price.trim() : undefined
        })).filter((opt: ModifierOption) => opt.name.length > 0)
      : [];

    return {
      name: modifier.name.trim(),
      category: modifier.category,
      options
    };
  }
}