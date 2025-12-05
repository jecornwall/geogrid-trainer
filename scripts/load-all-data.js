#!/usr/bin/env node
/**
 * Master script to load all country data from various sources.
 * 
 * This script runs all data parsers in the correct order:
 * 1. First, parse-wikidata.js creates the base country records with Wikidata
 * 2. Then, individual Wikipedia parsers update specific fields
 * 3. Finally, flag colors are extracted and updated
 * 
 * Each parser only updates the fields it is responsible for, preserving
 * all other data.
 * 
 * Usage:
 *   node scripts/load-all-data.js           # Run all parsers
 *   node scripts/load-all-data.js --wikidata-only  # Only Wikidata (base data)
 *   node scripts/load-all-data.js --wikipedia-only # Only Wikipedia parsers
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define parsers in execution order
// Each parser should only update its own fields
const PARSERS = {
  // Base data from Wikidata - creates/updates country records
  wikidata: [
    { name: 'Wikidata (base data)', script: 'parse-wikidata.js' },
  ],
  
  // Wikipedia HTML parsers - update specific fields
  wikipedia: [
    { name: 'Land Borders', script: 'parse-wikipedia-land-borders.js' },
    { name: 'Flag Properties', script: 'parse-wikipedia-flags.js' },
    { name: 'Island Countries', script: 'parse-wikipedia-island-countries.js' },
    { name: 'Coastline Length', script: 'parse-wikipedia-coastline-length.js' },
    { name: 'Olympic Medals', script: 'parse-wikipedia-olympic-medals.js' },
  ],
  
  // Derived data parsers
  derived: [
    { name: 'Flag Colors', script: 'update-flag-colors.js' },
  ],
  
  // Sync to web app
  sync: [
    { name: 'Sync to Web App', script: 'sync-web-data.js' },
  ],
};

/**
 * Run a script and return a promise that resolves when it completes
 */
function runScript(scriptPath, name) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${name}`);
    console.log(`Script: ${scriptPath}`);
    console.log('='.repeat(60));
    
    const proc = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${name} completed successfully`);
        resolve();
      } else {
        reject(new Error(`${name} failed with exit code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(new Error(`Failed to start ${name}: ${err.message}`));
    });
  });
}

/**
 * Run a group of parsers sequentially
 */
async function runParserGroup(parsers) {
  for (const parser of parsers) {
    const scriptPath = path.join(__dirname, parser.script);
    await runScript(scriptPath, parser.name);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const wikidataOnly = args.includes('--wikidata-only');
  const wikipediaOnly = args.includes('--wikipedia-only');
  
  console.log('\n🌍 GeoGrid Trainer - Data Loader');
  console.log('================================\n');
  
  const startTime = Date.now();
  
  try {
    if (!wikipediaOnly) {
      console.log('\n📊 Phase 1: Loading Wikidata (base country data)...');
      await runParserGroup(PARSERS.wikidata);
    }
    
    if (!wikidataOnly) {
      console.log('\n📖 Phase 2: Loading Wikipedia data...');
      await runParserGroup(PARSERS.wikipedia);
      
      console.log('\n🎨 Phase 3: Loading derived data...');
      await runParserGroup(PARSERS.derived);
    }
    
    console.log('\n🔄 Phase 4: Syncing to web app...');
    await runParserGroup(PARSERS.sync);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ All data loaded successfully in ${elapsed}s`);
    console.log('='.repeat(60));
    
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main();

