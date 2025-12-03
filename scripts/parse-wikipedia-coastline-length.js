/**
 * Parse Wikipedia coastline-length.html to extract coastline lengths in km.
 * 
 * Updates existing countries.jsonl with geography.coastline_km
 * Uses CIA World Factbook values (first coastline column).
 * Landlocked countries get coastline_km: 0 (already present as null).
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
    "côte d'ivoire": 'CI',
    'czech republic': 'CZ',
    'czechia': 'CZ',
    'north macedonia': 'MK',
    'burma': 'MM',
    'myanmar': 'MM',
    'east timor': 'TL',
    'timor-leste': 'TL',
    'vatican': 'VA',
    'vatican city': 'VA',
    'syria': 'SY',
    'iran': 'IR',
    'venezuela': 'VE',
    'vietnam': 'VN',
    'laos': 'LA',
    'brunei': 'BN',
    'bolivia': 'BO',
    'taiwan': 'TW',
    'eswatini': 'SZ',
    'swaziland': 'SZ',
    'the gambia': 'GM',
    'gambia': 'GM',
    'the bahamas': 'BS',
    'bahamas': 'BS',
    'china': 'CN',
    'türkiye': 'TR',
    'turkey': 'TR',
    'macau': 'MO',
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
  
  const coastlines = new Map(); // ISO code -> coastline_km
  
  // Match rows with country names and coastline values
  // Each row has: country name (in flag template param), then coastline value (in nts template)
  const rowPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowPattern) || [];
  
  for (const row of rows) {
    // Skip header rows and special entries (World, EU, Antarctica, Greenland)
    if (row.includes('<th') || row.includes('static-row-numbers-norank')) continue;
    if (row.includes('"wt":"European Union"') || 
        row.includes('"wt":"Antarctica"') || 
        row.includes('"wt":"Greenland"') ||
        row.includes('"wt":"World"')) continue;
    
    // Extract country name from flag template param
    // Pattern: "flag","href":"./Template:Flag"},"params":{"1":{"wt":"Country Name"}}
    const flagMatch = row.match(/"flag","href":"\.\/Template:Flag"\},"params":\{"1":\{"wt":"([^"]+)"\}/);
    if (!flagMatch) continue;
    
    let countryName = flagMatch[1].trim();
    
    const iso = lookupIso(countryName);
    if (!iso) continue;
    
    // Extract coastline value from nts template - the first one in the row is CIA value
    // Pattern: "wt":"nts","href":"./Template:Nts"},"params":{"1":{"wt":"NUMBER"}}
    const ntsMatch = row.match(/"wt":"nts","href":"\.\/Template:Nts"\},"params":\{"1":\{"wt":"(\d+)"\}/);
    if (!ntsMatch) continue;
    
    const coastlineKm = parseInt(ntsMatch[1].replace(/,/g, ''), 10);
    
    // Only store if we don't have this country yet (first occurrence wins)
    if (!coastlines.has(iso)) {
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
      const km = coastlines.get(iso);
      if (country.geography.coastline_km !== km) {
        updated++;
      }
      country.geography.coastline_km = km;
    } else if (country.geography.is_landlocked) {
      // Landlocked countries should have coastline_km = null
      country.geography.coastline_km = null;
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
  const samples = ['CA', 'NO', 'ID', 'JP', 'AU', 'US', 'GB', 'FR', 'BR', 'CN'];
  for (const iso of samples) {
    if (coastlines.has(iso)) {
      console.log(`  ${iso}: ${coastlines.get(iso).toLocaleString()} km`);
    }
  }
}

main().catch(console.error);

