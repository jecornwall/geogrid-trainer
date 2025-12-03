/**
 * Parse Wikipedia island-countries.html to extract island nation status.
 * 
 * Updates existing countries.jsonl with geography.is_island_nation = true
 * for all countries listed in the Wikipedia list of island countries.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ISLANDS_HTML = path.join(ROOT, 'data/raw/wikipedia/island-countries.html');
const COUNTRIES_JSONL = path.join(ROOT, 'data/countries.jsonl');

/**
 * Parse HTML and extract ISO codes of island countries
 * Only includes sovereign states (UN members and states with limited recognition)
 * and associated states (Cook Islands, Niue).
 * Excludes dependencies and territories section.
 */
async function parseIslandCountries() {
  const html = await fs.readFile(ISLANDS_HTML, 'utf-8');
  
  const islandCountries = new Set();
  
  // Find the section boundary - stop before "Dependencies and territories"
  // The Dependencies section starts with <h2 id="Dependencies_and_territories">
  const dependenciesStart = html.indexOf('id="Dependencies_and_territories"');
  const relevantHtml = dependenciesStart > 0 ? html.substring(0, dependenciesStart) : html;
  
  // Match ISO codes from links like href="./ISO_3166-2:AG"
  // These appear in the sovereign states and associated states tables
  const isoPattern = /ISO_3166-2:([A-Z]{2})/g;
  const matches = relevantHtml.matchAll(isoPattern);
  
  for (const match of matches) {
    islandCountries.add(match[1]);
  }
  
  return islandCountries;
}

/**
 * Load existing JSONL, update island nation status, and save
 */
async function updateJsonl(islandCountries) {
  const content = await fs.readFile(COUNTRIES_JSONL, 'utf-8');
  const lines = content.trim().split('\n');
  
  let updated = 0;
  let total = 0;
  
  const result = lines.map(line => {
    const country = JSON.parse(line);
    const iso = country.id;
    
    const isIsland = islandCountries.has(iso);
    if (isIsland && !country.geography.is_island_nation) {
      updated++;
    }
    country.geography.is_island_nation = isIsland;
    if (isIsland) total++;
    
    return JSON.stringify(country);
  });
  
  await fs.writeFile(COUNTRIES_JSONL, result.join('\n') + '\n');
  return { updated, total };
}

async function main() {
  console.log('Parsing island-countries.html...');
  const islandCountries = await parseIslandCountries();
  console.log(`  Found ${islandCountries.size} island country codes`);
  
  console.log('\nUpdating countries.jsonl...');
  const { updated, total } = await updateJsonl(islandCountries);
  console.log(`  Marked ${total} countries as island nations (${updated} newly updated)`);
  
  console.log('\nDone!');
  
  // Print the list
  console.log('\nIsland countries:', Array.from(islandCountries).sort().join(', '));
}

main().catch(console.error);
