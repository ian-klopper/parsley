/**
 * Direct test of the simplified extraction logic
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

async function testSimpleExtraction() {
  try {
    console.log('🧪 Testing simplified extraction...');

    // Download a test document
    const testUrl = 'https://drwytmbsonrfbzxpjkzm.supabase.co/storage/v1/object/public/job-documents/jobs/f2f8f9bd-b5e0-4dcb-a1c4-cae560d9a084/a76c5427-c32d-4eaa-8fb9-b7edc0084b1b_17545915925878020917982127401456.jpg';

    const response = await fetch(testUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    // Create temp file
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, 'test-menu.jpg');

    fs.writeFileSync(tempPath, Buffer.from(buffer));
    console.log(`� Downloaded test document to: ${tempPath}`);

    // Upload to Gemini Files API
    const fileManager = new genAI.GoogleAIFileManager(process.env.GOOGLE_AI_API_KEY!);
    const uploadResult = await fileManager.uploadFile(tempPath, {
      mimeType: 'image/jpeg',
      displayName: 'test-menu'
    });

    console.log(`� Uploaded to Gemini: ${uploadResult.file.uri}`);

    // Test simple extraction
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4000
      }
    });

    const prompt = `Extract menu items from this document.

Look for food, drinks, and beverages with their prices.

Return ONLY a JSON array like this:
[
  {
    "name": "Item Name",
    "price": "Price",
    "category": "Beverage"
  }
]

Extract ALL items you can find. Return valid JSON only.`;

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            fileData: {
              mimeType: 'image/jpeg',
              fileUri: uploadResult.file.uri
            }
          }
        ]
      }]
    });

    const responseText = result.response.text();
    console.log(`� Gemini response:\n${responseText}`);

    // Try to parse the response
    try {
      let jsonText = responseText.trim();

      // Remove markdown if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7).trim();
      }
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3).trim();
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3).trim();
      }

      console.log(`🔧 Cleaned JSON:\n${jsonText}`);

      // If it's just a JSON array, wrap it in an object
      if (jsonText.startsWith('[') && jsonText.endsWith(']')) {
        const items = JSON.parse(jsonText);
        console.log(`✅ Successfully parsed ${items.length} items:`);
        items.forEach((item: any, i: number) => {
          console.log(`  ${i + 1}. ${item.name} - ${item.price || 'no price'} (${item.category || 'no category'})`);
        });
      } else {
        const parsed = JSON.parse(jsonText);
        console.log(`✅ Successfully parsed object with ${parsed.items?.length || 0} items`);
      }
    } catch (parseError) {
      console.error(`❌ Failed to parse JSON:`, parseError);
    }

    // Clean up
    fs.unlinkSync(tempPath);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSimpleExtraction();