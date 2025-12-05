/**
 * Sync data from data/countries.jsonl to web/public/countries.json
 * 
 * The web app loads countries from web/public/countries.json, so we need
 * to convert the JSONL format to JSON array after any data updates.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SOURCE = path.join(ROOT, 'data/countries.jsonl');
const DEST = path.join(ROOT, 'web/public/countries.json');

async function main() {
  console.log('Syncing data to web app...');
  
  // Read JSONL
  const jsonlContent = await fs.readFile(SOURCE, 'utf-8');
  const lines = jsonlContent.trim().split('\n').filter(l => l.trim());
  
  // Parse each line
  const countries = lines.map(line => JSON.parse(line));
  
  console.log(`  Read ${countries.length} countries from ${SOURCE}`);
  
  // Write as JSON array
  const jsonContent = JSON.stringify(countries, null, 2);
  await fs.writeFile(DEST, jsonContent);
  
  console.log(`  Wrote ${countries.length} countries to ${DEST}`);
  console.log('Done!');
}

main().catch(console.error);

