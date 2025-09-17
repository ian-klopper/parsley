require('dotenv').config({ path: '.env.local' });

// Simple test to verify mixed file detection logic
const documents = [
  { name: 'Test PDF.pdf', type: 'application/pdf' },
  { name: 'Test sheet (1).xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { name: 'camino-real-menu-02.jpg', type: 'image/jpeg' }
];

const fileTypes = documents.map(d => d.type);
const hasPdf = fileTypes.some(t => t === 'application/pdf');
const hasSpreadsheet = fileTypes.some(t => t.includes('spreadsheet') || t.includes('excel'));
const hasImage = fileTypes.some(t => t.startsWith('image/'));
const mixedFileTypes = [hasPdf, hasSpreadsheet, hasImage].filter(Boolean).length > 1;

console.log('🔍 Mixed file type detection test:');
console.log(`File types: ${fileTypes.join(', ')}`);
console.log(`Has PDF: ${hasPdf}`);
console.log(`Has Spreadsheet: ${hasSpreadsheet}`);
console.log(`Has Image: ${hasImage}`);
console.log(`Mixed file types detected: ${mixedFileTypes}`);
console.log(`Should use separate processing: ${mixedFileTypes}`);