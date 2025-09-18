/**
 * PDF Text Content Checker
 * Determines if a PDF is text-based or image-based
 */

/**
 * Fallback text extraction for PDFs that fail primary extraction
 */
async function fallbackTextExtraction(buffer: ArrayBuffer): Promise<{
  hasText: boolean;
  textContent: string;
  wordCount: number;
  charCount: number;
  isImageBased: boolean;
  confidence: number;
}> {
  try {
    // Try alternative PDF parsing approach
    const pdfParseModule: any = await import('pdf-parse');
    const pdfParse = (pdfParseModule?.default || pdfParseModule) as (data: Buffer) => Promise<{ text: string; numpages: number }>;

    const buf = Buffer.from(buffer);

    // Try basic parsing without options
    const data = await pdfParse(buf);

    const textContent = data.text.trim();
    const charCount = textContent.length;
    const words = textContent.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    // Even more lenient fallback thresholds
    const hasText = charCount > 10 && wordCount > 2; // Very low threshold for fallback
    const confidence = hasText ? 0.4 : 0; // Low confidence for fallback

    return {
      hasText,
      textContent,
      wordCount,
      charCount,
      isImageBased: !hasText,
      confidence
    };
  } catch (error) {
    console.error(`[PDF_FALLBACK] Fallback extraction failed: ${(error as Error).message}`);
    return {
      hasText: false,
      textContent: '',
      wordCount: 0,
      charCount: 0,
      isImageBased: true,
      confidence: 0
    };
  }
}

/**
 * Test if a PDF contains extractable text or is image-based
 * @param buffer PDF file buffer
 * @returns Object with text content analysis
 */
export async function testPdfTextContent(buffer: ArrayBuffer): Promise<{
  hasText: boolean;
  textContent: string;
  wordCount: number;
  charCount: number;
  isImageBased: boolean;
  confidence: number; // 0-1 confidence that it's text-based
}> {
  try {
    // Import pdf-parse dynamically
    const pdfParseModule: any = await import('pdf-parse');
    const pdfParse = (pdfParseModule?.default || pdfParseModule) as (data: Buffer) => Promise<{ text: string; numpages: number }>;

    const buf = Buffer.from(buffer);
    const data = await pdfParse(buf);

    const textContent = data.text.trim();
    const charCount = textContent.length;
    const words = textContent.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    // More lenient confidence calculation for mixed PDF types
    let confidence = 0;

    // Lower thresholds for mixed content
    if (charCount > 50) confidence += 0.25;  // Reduced from 100
    if (wordCount > 10) confidence += 0.25;  // Reduced from 20
    if (charCount / Math.max(data.numpages, 1) > 25) confidence += 0.2;  // Reduced from 50
    if (words.some(word => word.length > 2)) confidence += 0.15;  // Reduced from 3
    if (textContent.includes('\n') || textContent.includes(' ')) confidence += 0.15;  // Text formatting indicators

    // Consider it text-based if we have ANY reasonable content or confidence > 0.3
    // This handles mixed PDFs better
    const hasText = charCount > 0 && wordCount > 0 && confidence > 0.3;
    const isImageBased = !hasText;

    console.log(`[PDF_TEXT_CHECK] Pages: ${data.numpages}, Chars: ${charCount}, Words: ${wordCount}, Confidence: ${confidence.toFixed(2)}, Type: ${hasText ? 'TEXT-BASED' : 'IMAGE-BASED'}`);

    // Debug logging for mixed content detection
    if (charCount > 0 && wordCount === 0) {
      console.log(`[PDF_TEXT_CHECK] WARNING: ${charCount} chars but 0 words - possible encoding issue`);
    }
    if (confidence > 0 && confidence < 0.5) {
      console.log(`[PDF_TEXT_CHECK] LOW CONFIDENCE: May be mixed content PDF`);
    }

    return {
      hasText,
      textContent,
      wordCount,
      charCount,
      isImageBased,
      confidence
    };
  } catch (error) {
    console.error(`[PDF_TEXT_CHECK] Failed to extract text from PDF: ${(error as Error).message}`);

    // Try a simpler extraction approach as fallback
    try {
      console.log(`[PDF_TEXT_CHECK] Attempting fallback extraction...`);
      const fallbackResult = await fallbackTextExtraction(buffer);
      if (fallbackResult.hasText) {
        console.log(`[PDF_TEXT_CHECK] Fallback extraction successful`);
        return fallbackResult;
      }
    } catch (fallbackError) {
      console.error(`[PDF_TEXT_CHECK] Fallback extraction also failed: ${(fallbackError as Error).message}`);
    }

    // If all extraction methods fail, assume it's image-based
    return {
      hasText: false,
      textContent: '',
      wordCount: 0,
      charCount: 0,
      isImageBased: true,
      confidence: 0
    };
  }
}

/**
 * Quick test to determine PDF type without full processing
 * @param buffer PDF file buffer
 * @returns true if PDF is image-based, false if text-based
 */
export async function isImageBasedPdf(buffer: ArrayBuffer): Promise<boolean> {
  try {
    // Import pdf-parse dynamically
    const pdfParseModule: any = await import('pdf-parse');
    const pdfParse = (pdfParseModule?.default || pdfParseModule) as (data: Buffer) => Promise<{ text: string; numpages: number }>;

    const buf = Buffer.from(buffer);

    // Quick test - process full PDF but analyze quickly
    const data = await pdfParse(buf);

    const textContent = data.text.trim();
    const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
    const avgWordsPerPage = wordCount / Math.min(data.numpages, 2);

    // Quick threshold test - if we have less than 10 words per page on average, likely image-based
    const isImageBased = avgWordsPerPage < 10;

    console.log(`[PDF_QUICK_CHECK] ${data.numpages} pages, ${wordCount} words (${avgWordsPerPage.toFixed(1)} per page avg), Type: ${isImageBased ? 'IMAGE-BASED' : 'TEXT-BASED'}`);

    return isImageBased;
  } catch (error) {
    console.error(`[PDF_QUICK_CHECK] Quick test failed: ${(error as Error).message}`);
    return true; // Assume image-based if we can't test
  }
}

/**
 * Enhanced text extraction with better text/image detection
 * @param buffer PDF file buffer
 * @returns Extracted text or empty string if image-based
 */
export async function extractPdfTextWithDetection(buffer: ArrayBuffer): Promise<{
  text: string;
  isImageBased: boolean;
  wordCount: number;
  confidence: number;
}> {
  const result = await testPdfTextContent(buffer);

  return {
    text: result.hasText ? result.textContent : '',
    isImageBased: result.isImageBased,
    wordCount: result.wordCount,
    confidence: result.confidence
  };
}