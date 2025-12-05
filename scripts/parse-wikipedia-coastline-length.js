/**
 * Parse Wikipedia coastline-length.html to extract coastline lengths in km.
 * 
 * Updates ONLY geography.coastline_km in countries.jsonl.
 * All other fields are preserved.
 * 
 * Uses CIA World Factbook values (first coastline column).
 */

import fs from 'fs/promises';
import path from 'path';
import { updateCountries, buildNameToIsoLookup, paths } from './lib/countries-jsonl.js';

const COASTLINE_HTML = path.join(paths.rawWikipedia, 'coastline-length.html');

let nameToIso = new Map();

/**
 * Parse HTML and extract coastline lengths
 */
async function parseCoastlines() {
  const html = await fs.readFile(COASTLINE_HTML, 'utf-8');
  
  const coastlines = new Map();
  
  // Find the table - look for rows with country links
  const rows = html.split(/<tr[^>]*>/);
  
  for (const row of rows) {
    if (!row.includes('<td')) continue;
    
    // Find country link
    const countryMatch = row.match(/href="\.\/([^"]+)"[^>]*title="([^"]+)"[^>]*>([^<]+)<\/a>/);
    if (!countryMatch) continue;
    
    const countryTitle = countryMatch[2];
    const countryText = countryMatch[3];
    
    // Try to get ISO code
    const normalized = countryTitle.toLowerCase().trim();
    let iso = nameToIso.get(normalized);
    
    if (!iso) {
      const alphaOnly = normalized.replace(/[^a-z]/g, '');
      iso = nameToIso.get(alphaOnly);
    }
    
    if (!iso) {
      const textNormalized = countryText.toLowerCase().trim();
      iso = nameToIso.get(textNormalized);
    }
    
    if (!iso) continue;
    
    // Find coastline value - look for numbers in the first data column after the country name
    // The CIA World Factbook column is typically the first numeric column
    const cells = row.split(/<td[^>]*>/);
    
    for (let i = 1; i < cells.length; i++) {
      const cell = cells[i];
      // Look for a number (with optional commas) that's not in a link
      const numMatch = cell.match(/>\s*([\d,]+)\s*</);
      if (numMatch) {
        const value = parseInt(numMatch[1].replace(/,/g, ''));
        if (!isNaN(value) && value >= 0) {
          coastlines.set(iso, value);
          break;
        }
      }
    }
  }
  
  return coastlines;
}

async function main() {
  console.log('Building country name lookup...');
  nameToIso = await buildNameToIsoLookup();
  console.log(`  ${nameToIso.size} name mappings`);
  
  console.log('\nParsing coastline-length.html...');
  const coastlines = await parseCoastlines();
  console.log(`  Found coastline data for ${coastlines.size} countries`);
  
  console.log('\nUpdating countries.jsonl...');
  
  let withCoast = 0;
  let landlocked = 0;
  
  const { updated, total } = await updateCountries((country, iso) => {
    const coastlineKm = coastlines.get(iso);
    
    // Only update if we have data for this country
    if (coastlineKm !== undefined) {
      if (coastlineKm > 0) {
        withCoast++;
      } else {
        landlocked++;
      }
      
      // Return ONLY the fields we manage
      return {
        geography: {
          coastline_km: coastlineKm
        }
      };
    }
    
    // No data - don't update
    return null;
  });
  
  console.log(`  Updated ${updated} of ${total} countries`);
  console.log(`  Countries with coastline: ${withCoast}`);
  console.log(`  Landlocked (0 km): ${landlocked}`);
  
  console.log('\nDone!');
}

main().catch(console.error);
