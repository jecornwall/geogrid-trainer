/**
 * Parse Wikipedia island-countries.html to extract island nation status.
 * 
 * Updates ONLY geography.is_island_nation in countries.jsonl.
 * All other fields are preserved.
 */

import fs from 'fs/promises';
import path from 'path';
import { updateCountries, paths } from './lib/countries-jsonl.js';

const ISLANDS_HTML = path.join(paths.rawWikipedia, 'island-countries.html');

/**
 * Parse HTML and extract ISO codes of island countries
 */
async function parseIslandCountries() {
  const html = await fs.readFile(ISLANDS_HTML, 'utf-8');
  
  const islandCountries = new Set();
  
  // Stop before "Dependencies and territories" section
  const dependenciesStart = html.indexOf('id="Dependencies_and_territories"');
  const relevantHtml = dependenciesStart > 0 ? html.substring(0, dependenciesStart) : html;
  
  // Match ISO codes from links like href="./ISO_3166-2:AG"
  const isoPattern = /ISO_3166-2:([A-Z]{2})/g;
  const matches = relevantHtml.matchAll(isoPattern);
  
  for (const match of matches) {
    islandCountries.add(match[1]);
  }
  
  return islandCountries;
}

async function main() {
  console.log('Parsing island-countries.html...');
  const islandCountries = await parseIslandCountries();
  console.log(`  Found ${islandCountries.size} island country codes`);
  
  console.log('\nUpdating countries.jsonl...');
  
  let islandCount = 0;
  
  const { updated, total } = await updateCountries((country, iso) => {
    const isIsland = islandCountries.has(iso);
    if (isIsland) islandCount++;
    
    // Return ONLY the fields we manage
    return {
      geography: {
        is_island_nation: isIsland
      }
    };
  });
  
  console.log(`  Updated ${updated} of ${total} countries`);
  console.log(`  Marked ${islandCount} countries as island nations`);
  
  console.log('\nDone!');
  console.log('\nIsland countries:', Array.from(islandCountries).sort().join(', '));
}

main().catch(console.error);
