/**
 * Parse Wikipedia ocean/sea HTML files to extract coastline data.
 * 
 * Updates existing countries.jsonl with geography.coastlines[]
 * containing all water bodies that each country borders.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const WIKIPEDIA_DIR = path.join(ROOT, 'data/raw/wikipedia');
const COUNTRIES_JSON = path.join(ROOT, 'data/countries.json');
const COUNTRIES_JSONL = path.join(ROOT, 'data/countries.jsonl');

// Water body HTML files and their schema values
const WATER_BODY_FILES = {
  'mediterranean-sea.html': 'Mediterranean Sea',
  'indian-ocean.html': 'Indian Ocean',
  'pacific-ocean.html': 'Pacific Ocean',
  'atlantic-ocean.html': 'Atlantic Ocean',
  'caribbean-sea.html': 'Caribbean Sea',
  'black-sea.html': 'Black Sea',
  'baltic-sea.html': 'Baltic Sea',
  'south-china-sea.html': 'South or East China Seas',
  'east-china-sea.html': 'South or East China Seas',
};

// Country name to ISO code mapping
let nameToIso = new Map();

async function buildNameLookup() {
  const countries = JSON.parse(await fs.readFile(COUNTRIES_JSON, 'utf-8'));
  
  for (const c of countries) {
    nameToIso.set(c.name.toLowerCase(), c.code);
    nameToIso.set(c.name.toLowerCase().replace(/[^a-z]/g, ''), c.code);
  }
  
  const manualMappings = {
    'united states': 'US', 'united kingdom': 'GB', 'russia': 'RU',
    'south korea': 'KR', 'north korea': 'KP', 'taiwan': 'TW',
    'china': 'CN', 'vietnam': 'VN', 'iran': 'IR', 'syria': 'SY',
    'venezuela': 'VE', 'bolivia': 'BO', 'bahamas': 'BS', 'gambia': 'GM',
    'bosnia and herzegovina': 'BA', 'brunei': 'BN',
  };
  
  for (const [name, code] of Object.entries(manualMappings)) {
    nameToIso.set(name, code);
  }
}

function lookupIso(countryName) {
  if (!countryName) return null;
  const n = countryName.toLowerCase().trim();
  if (nameToIso.has(n)) return nameToIso.get(n);
  const alphaOnly = n.replace(/[^a-z]/g, '');
  if (nameToIso.has(alphaOnly)) return nameToIso.get(alphaOnly);
  const noThe = n.replace(/^the /, '');
  if (nameToIso.has(noThe)) return nameToIso.get(noThe);
  return null;
}

async function extractCountriesFromFile(filepath) {
  const html = await fs.readFile(filepath, 'utf-8');
  const countries = new Set();
  
  // Look for basin_countries section in infobox
  const infoboxMatch = html.match(/basin_countries[\s\S]{0,8000}?<\/td>/i);
  if (infoboxMatch) {
    const section = infoboxMatch[0];
    const linkPattern = /title="([A-Z][a-zA-Z\s]+)"/g;
    let match;
    while ((match = linkPattern.exec(section)) !== null) {
      const title = match[1];
      if (!title.includes('Sea') && !title.includes('Ocean') && 
          !title.includes('problem') && !title.includes('Strait') &&
          !title.includes('List') && !title.includes('Geography')) {
        countries.add(title);
      }
    }
  }
  
  return countries;
}

async function parseWaterBodies() {
  const countryCoastlines = new Map();
  
  for (const [filename, waterBody] of Object.entries(WATER_BODY_FILES)) {
    const filepath = path.join(WIKIPEDIA_DIR, filename);
    
    try { await fs.access(filepath); } catch { continue; }
    
    console.log(`  Processing ${filename}...`);
    const countryNames = await extractCountriesFromFile(filepath);
    
    for (const name of countryNames) {
      const iso = lookupIso(name);
      if (iso) {
        if (!countryCoastlines.has(iso)) countryCoastlines.set(iso, new Set());
        countryCoastlines.get(iso).add(waterBody);
      }
    }
    console.log(`    Found ${countryNames.size} countries for ${waterBody}`);
  }
  
  return countryCoastlines;
}

async function updateJsonl(countryCoastlines) {
  const content = await fs.readFile(COUNTRIES_JSONL, 'utf-8');
  const lines = content.trim().split('\n');
  let updated = 0;
  
  const result = lines.map(line => {
    const country = JSON.parse(line);
    if (countryCoastlines.has(country.id)) {
      country.geography.coastlines = Array.from(countryCoastlines.get(country.id)).sort();
      updated++;
    } else if (!country.geography.coastlines) {
      country.geography.coastlines = [];
    }
    return JSON.stringify(country);
  });
  
  await fs.writeFile(COUNTRIES_JSONL, result.join('\n') + '\n');
  return updated;
}

async function main() {
  console.log('Building country name lookup...');
  await buildNameLookup();
  
  console.log('\nParsing water body files...');
  const countryCoastlines = await parseWaterBodies();
  console.log(`\n  Total: ${countryCoastlines.size} countries`);
  
  console.log('\nUpdating countries.jsonl...');
  const updated = await updateJsonl(countryCoastlines);
  console.log(`  Updated ${updated} countries`);
  
  console.log('\nSamples:');
  for (const iso of ['IT', 'ES', 'FR', 'EG', 'TR', 'US', 'JP']) {
    if (countryCoastlines.has(iso)) {
      console.log(`  ${iso}: ${[...countryCoastlines.get(iso)].join(', ')}`);
    }
  }
}

main().catch(console.error);

