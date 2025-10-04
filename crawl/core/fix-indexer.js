/**
 * Script to fix the indexer.js file by replacing the problematic methods
 */

const fs = require('fs');
const path = require('path');

// Define paths
const indexerPath = path.join(__dirname, 'core', 'indexer.js');
const backupPath = path.join(__dirname, 'core', 'indexer.js.backup');
const fixPath = path.join(__dirname, 'core', 'indexer.js.new');

// Read the current indexer.js file
console.log('Reading current indexer.js file...');
const currentContent = fs.readFileSync(indexerPath, 'utf8');

// Create a backup
console.log('Creating backup at indexer.js.backup...');
fs.writeFileSync(backupPath, currentContent);

// Read the fixed methods
console.log('Reading fixed methods...');
const fixedMethods = fs.readFileSync(fixPath, 'utf8');

// Define regex patterns to find the methods to replace
const insertImagesPattern = /async\s+insertImages\s*\(\s*images\s*,\s*siteId\s*,\s*siteDataId\s*\)\s*\{[\s\S]*?(?=async\s+insertVideos|\}[\s\n]*async\s+insertVideos)/;
const insertVideosPattern = /async\s+insertVideos\s*\(\s*videos\s*,\s*siteId\s*,\s*siteDataId\s*\)\s*\{[\s\S]*?(?=async\s+insertDocuments|\}[\s\n]*async\s+insertDocuments)/;
const insertDocumentsPattern = /async\s+insertDocuments\s*\(\s*documents\s*,\s*siteId\s*,\s*siteDataId\s*\)\s*\{[\s\S]*?(?=async\s+insertDocumentsIndividually|\}[\s\n]*async\s+insertDocumentsIndividually)/;

// Extract the fixed methods
const fixedInsertImagesMatch = fixedMethods.match(/async\s+insertImages[\s\S]*?(?=async\s+insertVideos)/);
const fixedInsertVideosMatch = fixedMethods.match(/async\s+insertVideos[\s\S]*?(?=async\s+insertDocuments)/);
const fixedInsertDocumentsMatch = fixedMethods.match(/async\s+insertDocuments[\s\S]*$/);

if (!fixedInsertImagesMatch || !fixedInsertVideosMatch || !fixedInsertDocumentsMatch) {
    console.error('Failed to extract fixed methods');
    process.exit(1);
}

const fixedInsertImages = fixedInsertImagesMatch[0];
const fixedInsertVideos = fixedInsertVideosMatch[0];
const fixedInsertDocuments = fixedInsertDocumentsMatch[0];

// Replace the methods in the current content
console.log('Replacing insertImages method...');
let updatedContent = currentContent.replace(insertImagesPattern, fixedInsertImages);

console.log('Replacing insertVideos method...');
updatedContent = updatedContent.replace(insertVideosPattern, fixedInsertVideos);

// Fix the broken insertDocuments method
console.log('Fixing the broken insertDocuments method...');
// First, find the start of the method
const docMethodStartMatch = updatedContent.match(/async\s+insertDocuments\s*\(\s*documents\s*,\s*siteId\s*,\s*siteDataId\s*\)\s*\{/);
if (!docMethodStartMatch) {
    console.error('Failed to find the start of insertDocuments method');
    process.exit(1);
}

// Find the position of the method start
const docMethodStartPos = updatedContent.indexOf(docMethodStartMatch[0]);

// Find the insertDocumentsIndividually method
const nextMethodMatch = updatedContent.match(/async\s+insertDocumentsIndividually\s*\(\s*documents\s*,\s*siteId\s*,\s*siteDataId\s*\)\s*\{/);
if (!nextMethodMatch) {
    console.error('Failed to find the next method after insertDocuments');
    process.exit(1);
}

// Find the position of the next method
const nextMethodPos = updatedContent.indexOf(nextMethodMatch[0]);

// Replace everything between the start of insertDocuments and the start of insertDocumentsIndividually
updatedContent = 
    updatedContent.substring(0, docMethodStartPos) + 
    fixedInsertDocuments + 
    updatedContent.substring(nextMethodPos);

// Write the updated content back to the file
console.log('Writing updated content to indexer.js...');
fs.writeFileSync(indexerPath, updatedContent);

console.log('Fix completed successfully!');
