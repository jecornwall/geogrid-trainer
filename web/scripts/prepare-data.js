/**
 * Prepare data for the web build
 * Converts countries.jsonl to countries.json and copies to public folder
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dataDir = join(rootDir, '..', 'data');
const publicDir = join(rootDir, 'public');

// Ensure public directory exists
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

// Read JSONL file
const jsonlPath = join(dataDir, 'countries.jsonl');
const jsonlContent = readFileSync(jsonlPath, 'utf-8');

// Parse each line as JSON
const countries = jsonlContent
  .trim()
  .split('\n')
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line));

// Write as JSON array
const outputPath = join(publicDir, 'countries.json');
writeFileSync(outputPath, JSON.stringify(countries, null, 0));

console.log(`✓ Converted ${countries.length} countries to ${outputPath}`);

