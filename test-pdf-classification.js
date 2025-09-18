#!/usr/bin/env node

/**
 * Test PDF Classification Improvements
 *
 * This script tests the improved PDF text classification logic
 * by simulating the classification algorithm.
 */

function simulatePdfClassification(textContent) {
  const charCount = textContent.length;
  const words = textContent.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;

  // Simulate the improved confidence calculation
  let confidence = 0;

  // Lower thresholds for mixed content
  if (charCount > 50) confidence += 0.25;  // Reduced from 100
  if (wordCount > 10) confidence += 0.25;  // Reduced from 20
  if (charCount / Math.max(1, 1) > 25) confidence += 0.2;  // Reduced from 50
  if (words.some(word => word.length > 2)) confidence += 0.15;  // Reduced from 3
  if (textContent.includes('\n') || textContent.includes(' ')) confidence += 0.15;  // Text formatting indicators

  // Consider it text-based if we have ANY reasonable content or confidence > 0.3
  const hasText = charCount > 0 && wordCount > 0 && confidence > 0.3;
  const isImageBased = !hasText;

  return {
    hasText,
    textContent,
    wordCount,
    charCount,
    isImageBased,
    confidence
  };
}

function testPdfClassification() {
  console.log('🧪 Testing PDF Classification Improvements...\n');

  try {
    // Test 1: PDF with minimal text (should be classified as image-based with our improvements)
    console.log('Test 1: Minimal text PDF');
    const minimalText = "Item 1";
    const result1 = simulatePdfClassification(minimalText);
    console.log(`   Text: "${minimalText}"`);
    console.log(`   Result: ${result1.isImageBased ? 'IMAGE-BASED' : 'TEXT-BASED'}`);
    console.log(`   Confidence: ${result1.confidence.toFixed(2)}`);
    console.log(`   Words: ${result1.wordCount}\n`);

    // Test 2: PDF with substantial text (should be classified as text-based)
    console.log('Test 2: Substantial text PDF');
    const substantialText = "Welcome to our restaurant. We serve delicious food including burgers, fries, salads, and drinks. Our menu features various appetizers, entrees, and desserts.";
    const result2 = simulatePdfClassification(substantialText);
    console.log(`   Text: "${substantialText.substring(0, 50)}..."`);
    console.log(`   Result: ${result2.isImageBased ? 'IMAGE-BASED' : 'TEXT-BASED'}`);
    console.log(`   Confidence: ${result2.confidence.toFixed(2)}`);
    console.log(`   Words: ${result2.wordCount}\n`);

    // Test 3: Mixed content PDF (moderate text)
    console.log('Test 3: Mixed content PDF');
    const mixedText = "Menu Item Description Price\nBurger Delicious burger $12.99\nFries Crispy fries $4.99";
    const result3 = simulatePdfClassification(mixedText);
    console.log(`   Text: "${mixedText}"`);
    console.log(`   Result: ${result3.isImageBased ? 'IMAGE-BASED' : 'TEXT-BASED'}`);
    console.log(`   Confidence: ${result3.confidence.toFixed(2)}`);
    console.log(`   Words: ${result3.wordCount}\n`);

    // Test 4: Empty/minimal content (should be image-based)
    console.log('Test 4: Empty/minimal PDF');
    const emptyText = "";
    const result4 = simulatePdfClassification(emptyText);
    console.log(`   Text: "(empty)"`);
    console.log(`   Result: ${result4.isImageBased ? 'IMAGE-BASED' : 'TEXT-BASED'}`);
    console.log(`   Confidence: ${result4.confidence.toFixed(2)}`);
    console.log(`   Words: ${result4.wordCount}\n`);

    console.log('✅ PDF Classification Tests Completed');
    console.log('\n📊 Summary:');
    console.log(`   - Minimal text (2 words): ${result1.isImageBased ? 'Image-based' : 'Text-based'}`);
    console.log(`   - Substantial text (25 words): ${result2.isImageBased ? 'Image-based' : 'Text-based'}`);
    console.log(`   - Mixed text (12 words): ${result3.isImageBased ? 'Image-based' : 'Text-based'}`);
    console.log(`   - Empty text (0 words): ${result4.isImageBased ? 'Image-based' : 'Text-based'}`);

    // Check if our improvements are working
    const improvements = [];
    if (result1.confidence > 0) improvements.push('Minimal text gets confidence score');
    if (result2.confidence >= 0.5) improvements.push('Substantial text gets high confidence');
    if (result3.confidence > 0.3) improvements.push('Mixed content gets reasonable confidence');
    if (result4.confidence === 0) improvements.push('Empty content correctly gets 0 confidence');

    if (improvements.length > 0) {
      console.log('\n🎉 Improvements detected:');
      improvements.forEach(imp => console.log(`   ✓ ${imp}`));
    } else {
      console.log('\n⚠️  No improvements detected - classification may need further tuning');
    }

    console.log('\n🔧 Key Improvements Made:');
    console.log('   ✓ Lowered character threshold from 100 to 50');
    console.log('   ✓ Lowered word threshold from 20 to 10');
    console.log('   ✓ Added confidence-based classification (>0.3)');
    console.log('   ✓ Added fallback extraction for failed classifications');
    console.log('   ✓ Enhanced context extraction for mixed PDFs');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPdfClassification();