/**
 * Spreadsheet Parser for Menu Extraction
 * Handles CSV and XLSX files that can't be processed by Gemini Files API
 */

import * as fs from 'fs';
import { allowedCategories, allowedSizes } from '../menu-data';
import type { SimpleMenuItem, SizeOption, ModifierGroup } from './simple-extractor';

// Types for parsed spreadsheet data
interface SpreadsheetRow {
  [key: string]: string | number;
}

interface ParsedSpreadsheet {
  headers: string[];
  rows: SpreadsheetRow[];
  fileName: string;
}

/**
 * Parse CSV file into structured data with robust CSV parsing
 */
async function parseCSV(filePath: string): Promise<ParsedSpreadsheet> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    if (!content || content.trim().length === 0) {
      throw new Error('CSV file is empty or unreadable');
    }

    // More robust CSV parsing that handles quoted values with commas
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('CSV file contains no data');
    }

    // Parse CSV line by line with proper quote handling
    function parseCSVLine(line: string): string[] {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      result.push(current.trim());
      return result;
    }

    // Parse headers
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim()).filter(h => h);

    if (headers.length === 0) {
      throw new Error('CSV file has no valid headers');
    }

    const rows: SpreadsheetRow[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map(v => v.replace(/"/g, '').trim());

      // Skip empty rows
      if (values.every(v => !v)) continue;

      const row: SpreadsheetRow = {};
      headers.forEach((header, index) => {
        const value = values[index] || '';
        // Try to parse as number, otherwise keep as string
        row[header] = value && !isNaN(Number(value)) && value !== '' ? Number(value) : value;
      });
      rows.push(row);
    }

    console.log(`📊 CSV parsed: ${headers.length} columns, ${rows.length} data rows`);

    return {
      headers,
      rows,
      fileName: filePath.split('/').pop() || 'unknown.csv'
    };
  } catch (error) {
    console.error(`❌ CSV parsing error for ${filePath}:`, error);
    throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse XLSX file into structured data
 */
async function parseXLSX(filePath: string): Promise<ParsedSpreadsheet> {
  try {
    // Import xlsx dynamically to avoid issues if not installed
    const XLSX = await import('xlsx');

    if (!fs.existsSync(filePath)) {
      throw new Error('XLSX file not found');
    }

    // Read file as buffer to avoid file access issues
    console.log(`🔍 XLSX DEBUG: Reading file ${filePath}`);
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`🔍 XLSX DEBUG: File buffer size: ${fileBuffer.length} bytes`);

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('XLSX file contains no sheets');
    }

    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error(`Sheet "${sheetName}" not found in XLSX file`);
    }

    // Convert to JSON with header row as keys
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!jsonData || jsonData.length === 0) {
      throw new Error('XLSX sheet is empty or cannot be parsed');
    }

    // Extract and clean headers
    const rawHeaders = jsonData[0] as any[];
    console.log(`🔍 XLSX DEBUG: Raw headers:`, rawHeaders);

    // Don't filter out headers - keep all columns including empty ones
    const headers = rawHeaders.map((h, index) => {
      const headerStr = String(h || '').trim();
      // If header is empty, use column index as fallback
      return headerStr || `Column_${index + 1}`;
    });

    console.log(`🔍 XLSX DEBUG: Processed headers:`, headers);

    if (headers.length === 0) {
      throw new Error('XLSX file has no valid headers');
    }

    const rows: SpreadsheetRow[] = [];

    // Parse data rows
    for (let i = 1; i < jsonData.length; i++) {
      const values = jsonData[i] as any[];
      if (!values || values.length === 0) continue;

      // Skip completely empty rows
      if (values.every(v => !v || String(v).trim() === '')) continue;

      const row: SpreadsheetRow = {};
      headers.forEach((header, index) => {
        const value = values[index];
        // Convert to string and trim, then try to parse as number if appropriate
        const stringValue = String(value || '').trim();
        row[header] = stringValue && !isNaN(Number(stringValue)) && stringValue !== ''
          ? Number(stringValue)
          : stringValue;
      });
      rows.push(row);
    }

    console.log(`📊 XLSX parsed: "${sheetName}" sheet, ${headers.length} columns, ${rows.length} data rows`);

    return {
      headers,
      rows,
      fileName: filePath.split('/').pop() || 'unknown.xlsx'
    };
  } catch (error) {
    console.error(`❌ XLSX parsing error for ${filePath}:`, error);
    throw new Error(`Failed to parse XLSX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Detect common menu item column patterns
 */
function detectColumnMappings(headers: string[]): {
  name?: string;
  description?: string;
  price?: string;
  category?: string;
  section?: string;
  size?: string;
} {
  console.log(`🔍 COLUMN MAPPING DEBUG: Input headers:`, headers);
  const lowercaseHeaders = headers.map(h => h.toLowerCase());
  console.log(`🔍 COLUMN MAPPING DEBUG: Lowercase headers:`, lowercaseHeaders);

  const mappings: { [key: string]: string } = {};

  // Name column patterns
  const namePatterns = ['name', 'item', 'product', 'menu item', 'dish', 'title'];
  mappings.name = headers[lowercaseHeaders.findIndex(h =>
    namePatterns.some(pattern => h.includes(pattern))
  )] || headers[0]; // Default to first column

  // Description patterns
  const descPatterns = ['description', 'desc', 'details', 'ingredients'];
  const descIndex = lowercaseHeaders.findIndex(h =>
    descPatterns.some(pattern => h.includes(pattern))
  );
  if (descIndex >= 0) mappings.description = headers[descIndex];

  // Price patterns
  const pricePatterns = ['price', 'cost', 'amount', '$'];
  const priceIndex = lowercaseHeaders.findIndex(h =>
    pricePatterns.some(pattern => h.includes(pattern))
  );
  if (priceIndex >= 0) mappings.price = headers[priceIndex];

  // Category patterns
  const categoryPatterns = ['category', 'type', 'group', 'classification'];
  const categoryIndex = lowercaseHeaders.findIndex(h =>
    categoryPatterns.some(pattern => h.includes(pattern))
  );
  if (categoryIndex >= 0) mappings.category = headers[categoryIndex];

  // Section patterns
  const sectionPatterns = ['section', 'menu', 'area', 'division'];
  const sectionIndex = lowercaseHeaders.findIndex(h =>
    sectionPatterns.some(pattern => h.includes(pattern))
  );
  if (sectionIndex >= 0) mappings.section = headers[sectionIndex];

  // Size patterns
  const sizePatterns = ['size', 'portion', 'serving'];
  const sizeIndex = lowercaseHeaders.findIndex(h =>
    sizePatterns.some(pattern => h.includes(pattern))
  );
  if (sizeIndex >= 0) mappings.size = headers[sizeIndex];

  console.log(`🔍 COLUMN MAPPING DEBUG: Final mappings:`, mappings);
  return mappings;
}

/**
 * Normalize category to match allowed categories
 */
function normalizeCategory(category: string): string {
  if (!category) return 'Open Food';

  const normalized = category.toLowerCase().trim();

  // Specific mappings for common food categories
  const foodCategoryMappings: { [key: string]: string } = {
    'tacos': 'Entrees',
    'taco': 'Entrees',
    'burritos': 'Entrees',
    'burrito': 'Entrees',
    'quesadillas': 'Entrees',
    'quesadilla': 'Entrees',
    'appetizer': 'Appetizers',
    'appetizers': 'Appetizers',
    'starter': 'Appetizers',
    'starters': 'Appetizers',
    'salad': 'Salads',
    'salads': 'Salads',
    'entree': 'Entrees',
    'entrees': 'Entrees',
    'main': 'Entrees',
    'main course': 'Entrees',
    'side': 'Sides',
    'sides': 'Sides',
    'dessert': 'Desserts',
    'desserts': 'Desserts'
  };

  // Check direct mappings first
  if (foodCategoryMappings[normalized]) {
    console.log(`🔍 CATEGORY MAPPING: "${category}" -> "${foodCategoryMappings[normalized]}"`);
    return foodCategoryMappings[normalized];
  }

  // Find closest match in allowed categories
  const match = allowedCategories.find(allowed =>
    allowed.toLowerCase().includes(normalized) ||
    normalized.includes(allowed.toLowerCase())
  );

  const result = match || 'Open Food';
  console.log(`🔍 CATEGORY MAPPING: "${category}" -> "${result}" ${match ? '(matched)' : '(default)'}`);
  return result;
}

/**
 * Parse price string to extract numeric value
 */
function parsePrice(priceStr: string | number): string {
  if (typeof priceStr === 'number') {
    return priceStr.toFixed(2);
  }

  const str = String(priceStr).replace(/[^0-9.]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

/**
 * Convert spreadsheet data to menu items
 */
function convertToMenuItems(data: ParsedSpreadsheet, documentId: string): SimpleMenuItem[] {
  const mappings = detectColumnMappings(data.headers);
  const items: SimpleMenuItem[] = [];

  console.log(`📊 Detected column mappings:`, mappings);
  console.log(`📊 Processing ${data.rows.length} rows from ${data.fileName}`);

  // Add safety check for excessive rows
  if (data.rows.length > 50) {
    console.log(`🔍 WARNING: ${data.rows.length} rows found - checking for data issues`);
  }

  let validItemCount = 0;
  let emptyRowCount = 0;
  let headerRowCount = 0;

  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];

    // DEBUG: Log first few rows to see what we're getting
    if (i < 5) {
      console.log(`🔍 ROW ${i + 1} DEBUG:`, row);
    }

    // Skip empty rows
    if (!row[mappings.name!] || String(row[mappings.name!]).trim() === '') {
      emptyRowCount++;
      if (i < 5) console.log(`🔍 ROW ${i + 1} SKIPPED: Empty name field`);
      continue;
    }

    const nameValue = String(row[mappings.name!]).trim();

    // Skip header row if it appears in data
    if (nameValue === 'Item Name' || nameValue === 'Name' || nameValue === 'item name') {
      headerRowCount++;
      if (i < 5) console.log(`🔍 ROW ${i + 1} SKIPPED: Header row in data`);
      continue;
    }

    // Skip rows with numeric-only names (likely row numbers)
    if (/^\d+$/.test(nameValue)) {
      if (i < 10) console.log(`🔍 ROW ${i + 1} SKIPPED: Numeric name "${nameValue}" (likely row number)`);
      continue;
    }

    const name = String(row[mappings.name!]).trim();
    const description = mappings.description ? String(row[mappings.description] || '').trim() : '';
    const category = mappings.category ? normalizeCategory(String(row[mappings.category] || '')) : 'Entrees';
    const section = mappings.section ? String(row[mappings.section] || '').trim() : 'Main Menu';

    // DEBUG: Log first few items being processed
    if (i < 5) {
      console.log(`🔍 ROW ${i + 1} PARSED: name="${name}", category="${category}", price="${row[mappings.price!]}"`);
    }

    // Handle sizes and prices
    const sizes: SizeOption[] = [];
    if (mappings.price && row[mappings.price]) {
      const price = parsePrice(row[mappings.price]);
      const size = mappings.size ? String(row[mappings.size] || 'Regular').trim() : 'Regular';

      sizes.push({
        size,
        price,
        isDefault: true
      });
    }

    // For now, we don't extract modifiers from spreadsheets (would need more sophisticated parsing)
    const modifierGroups: ModifierGroup[] = [];

    const menuItem: SimpleMenuItem = {
      name,
      description,
      category,
      section,
      sizes,
      modifierGroups,
      sourceInfo: {
        documentId,
        page: undefined,
        sheet: data.fileName
      }
    };

    items.push(menuItem);
    validItemCount++;
  }

  // Summary logging
  console.log(`📊 PROCESSING SUMMARY:`);
  console.log(`   - Total rows processed: ${data.rows.length}`);
  console.log(`   - Empty rows skipped: ${emptyRowCount}`);
  console.log(`   - Header rows skipped: ${headerRowCount}`);
  console.log(`   - Valid items extracted: ${validItemCount}`);
  console.log(`✅ Converted ${items.length} valid menu items from spreadsheet`);

  return items;
}

/**
 * Main function to parse spreadsheet and extract menu items
 */
export async function parseSpreadsheetToMenuItems(
  filePath: string,
  documentId: string
): Promise<SimpleMenuItem[]> {
  const extension = filePath.toLowerCase().split('.').pop();

  console.log(`📊 Parsing spreadsheet: ${documentId} (${extension})`);

  try {
    let data: ParsedSpreadsheet;

    if (extension === 'csv') {
      data = await parseCSV(filePath);
    } else if (extension === 'xlsx' || extension === 'xls') {
      data = await parseXLSX(filePath);
    } else {
      throw new Error(`Unsupported spreadsheet format: ${extension}`);
    }

    return convertToMenuItems(data, documentId);
  } catch (error) {
    console.error(`❌ Failed to parse spreadsheet ${documentId}:`, error);
    return [];
  }
}

/**
 * Check if a file is a spreadsheet based on extension
 */
export function isSpreadsheet(filePath: string): boolean {
  const extension = filePath.toLowerCase().split('.').pop();
  return ['csv', 'xlsx', 'xls'].includes(extension || '');
}

/**
 * Get spreadsheet format summary for logging
 */
export async function analyzeSpreadsheet(filePath: string): Promise<{
  format: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  sampleRows: any[];
}> {
  const extension = filePath.toLowerCase().split('.').pop();

  try {
    let data: ParsedSpreadsheet;

    if (extension === 'csv') {
      data = await parseCSV(filePath);
    } else if (extension === 'xlsx' || extension === 'xls') {
      data = await parseXLSX(filePath);
    } else {
      throw new Error(`Unsupported format: ${extension}`);
    }

    return {
      format: extension || 'unknown',
      rowCount: data.rows.length,
      columnCount: data.headers.length,
      headers: data.headers,
      sampleRows: data.rows.slice(0, 3) // First 3 rows as sample
    };
  } catch (error) {
    throw new Error(`Failed to analyze spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}