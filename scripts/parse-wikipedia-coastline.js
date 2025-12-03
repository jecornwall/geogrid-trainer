/**
 * Parse Wikipedia coastline-length.html to extract coastline lengths.
 * 
 * Updates existing countries.jsonl with geography.coastline_km
 * Uses CIA World Factbook values.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const COASTLINE_HTML = path.join(ROOT, 'data/raw/wikipedia/coastline-length.html');
const COUNTRIES_JSON = path.join(ROOT, 'data/countries.json');
const COUNTRIES_JSONL = path.join(ROOT, 'data/countries.jsonl');

// Country name to ISO code mapping
let nameToIso = new Map();

/**
 * Build a name -> ISO lookup from countries.json
 */
async function buildNameLookup() {
  const countries = JSON.parse(await fs.readFile(COUNTRIES_JSON, 'utf-8'));
  
  for (const c of countries) {
    const code = c.code;
    const name = c.name;
    
    nameToIso.set(name.toLowerCase(), code);
    nameToIso.set(name.toLowerCase().replace(/[^a-z]/g, ''), code);
  }
  
  // Add manual mappings for common variations
  const manualMappings = {
    'united states': 'US',
    'united kingdom': 'GB',
    'great britain': 'GB',
    'russia': 'RU',
    'russian federation': 'RU',
    'south korea': 'KR',
    'north korea': 'KP',
    'republic of korea': 'KR',
    'democratic republic of the congo': 'CD',
    'dr congo': 'CD',
    'congo': 'CG',
    'republic of the congo': 'CG',
    'ivory coast': 'CI',
    "cote d'ivoire": 'CI',
    'czech republic': 'CZ',
    'czechia': 'CZ',
    'north macedonia': 'MK',
    'taiwan': 'TW',
    'china': 'CN',
    'vietnam': 'VN',
    'iran': 'IR',
    'syria': 'SY',
    'venezuela': 'VE',
    'bolivia': 'BO',
    'the bahamas': 'BS',
    'bahamas': 'BS',
    'the gambia': 'GM',
    'gambia': 'GM',
  };
  
  for (const [name, code] of Object.entries(manualMappings)) {
    nameToIso.set(name, code);
  }
}

/**
 * Look up ISO code for a country name
 */
function lookupIso(countryName) {
  if (!countryName) return null;
  
  const normalized = countryName.toLowerCase().trim();
  
  // Try exact match
  if (nameToIso.has(normalized)) return nameToIso.get(normalized);
  
  // Try without special chars
  const alphaOnly = normalized.replace(/[^a-z]/g, '');
  if (nameToIso.has(alphaOnly)) return nameToIso.get(alphaOnly);
  
  // Try removing "the"
  const withoutThe = normalized.replace(/^the /, '');
  if (nameToIso.has(withoutThe)) return nameToIso.get(withoutThe);
  
  return null;
}

/**
 * Parse HTML and extract coastline lengths
 */
async function parseCoastlines() {
  const html = await fs.readFile(COASTLINE_HTML, 'utf-8');
  
  const coastlines = new Map(); // ISO code -> coastline km
  
  // Find all table rows
  const rowPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowPattern) || [];
  
  for (const row of rows) {
    // Skip header rows, non-ranked rows (like World total, EU, Antarctica)
    if (row.includes('<th') || row.includes('static-row-numbers-norank')) continue;
    
    // Skip italicized entries (territories like Greenland)
    if (row.includes('<i id=')) continue;
    
    // Extract country name from flag template
    // Pattern: {"wt":"flag","href":"./Template:Flag"},"params":{"1":{"wt":"Canada"}}
    const flagMatch = row.match(/"wt":"flag"[^}]*\},"params":\{"1":\{"wt":"([^"]+)"\}/);
    if (!flagMatch) continue;
    
    const countryName = flagMatch[1];
    const iso = lookupIso(countryName);
    
    if (!iso) {
      // Skip countries we don't have
      continue;
    }
    
    // Extract CIA coastline value (comes after the country name td)
    // Pattern: nts template with coastline value: {"wt":"nts"...{"wt":"202080"}
    const ntsMatches = [...row.matchAll(/"wt":"nts"[^}]*\},"params":\{"1":\{"wt":"([\d,]+)"\}/g)];
    
    if (ntsMatches.length > 0) {
      // First nts value is CIA coastline
      const coastlineKm = parseInt(ntsMatches[0][1].replace(/,/g, ''), 10);
      coastlines.set(iso, coastlineKm);
    }
  }
  
  return coastlines;
}

/**
 * Load existing JSONL, update coastline data, and save
 */
async function updateJsonl(coastlines) {
  const content = await fs.readFile(COUNTRIES_JSONL, 'utf-8');
  const lines = content.trim().split('\n');
  
  let updated = 0;
  
  const result = lines.map(line => {
    const country = JSON.parse(line);
    const iso = country.id;
    
    if (coastlines.has(iso)) {
      country.geography.coastline_km = coastlines.get(iso);
      updated++;
    } else if (country.geography.is_landlocked) {
      // Landlocked countries have 0 coastline
      country.geography.coastline_km = 0;
    }
    
    return JSON.stringify(country);
  });
  
  await fs.writeFile(COUNTRIES_JSONL, result.join('\n') + '\n');
  return updated;
}

async function main() {
  console.log('Building country name lookup...');
  await buildNameLookup();
  console.log(`  ${nameToIso.size} name mappings`);
  
  console.log('\nParsing coastline-length.html...');
  const coastlines = await parseCoastlines();
  console.log(`  Found coastline data for ${coastlines.size} countries`);
  
  console.log('\nUpdating countries.jsonl...');
  const updated = await updateJsonl(coastlines);
  console.log(`  Updated ${updated} countries`);
  
  console.log('\nDone!');
  
  // Print some samples
  console.log('\nSample coastline lengths (km):');
  const samples = ['CA', 'NO', 'ID', 'RU', 'PH', 'JP', 'AU', 'US', 'NZ', 'GB', 'BR'];
  for (const iso of samples) {
    if (coastlines.has(iso)) {
      console.log(`  ${iso}: ${coastlines.get(iso).toLocaleString()} km`);
    }
  }
}

main().catch(console.error);

