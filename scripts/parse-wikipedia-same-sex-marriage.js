/**
 * Parse Wikipedia same-sex-marriage.html to extract countries
 * where same-sex marriage is legal.
 * 
 * Updates existing countries.jsonl with political.same_sex_marriage_legal = true/false
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const HTML_FILE = path.join(ROOT, 'data/raw/wikipedia/same-sex-marriage.html');
const COUNTRIES_JSON = path.join(ROOT, 'data/countries.json');
const COUNTRIES_JSONL = path.join(ROOT, 'data/countries.jsonl');

let nameToIso = new Map();

async function buildNameLookup() {
  const countries = JSON.parse(await fs.readFile(COUNTRIES_JSON, 'utf-8'));
  
  for (const c of countries) {
    nameToIso.set(c.name.toLowerCase(), c.code);
    nameToIso.set(c.name.toLowerCase().replace(/[^a-z]/g, ''), c.code);
  }
  
  const manualMappings = {
    'united states': 'US', 'united kingdom': 'GB', 'taiwan': 'TW',
    'netherlands': 'NL', 'ireland': 'IE', 'south africa': 'ZA',
    'new zealand': 'NZ', 'czech republic': 'CZ', 'costa rica': 'CR',
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

async function parseCountriesWithLegalSameSexMarriage() {
  const html = await fs.readFile(HTML_FILE, 'utf-8');
  const countries = new Set();
  
  // Find the "Marriage" section in the sidebar (first collapsible div)
  // The countries are listed as links like:
  // <a rel="mw:WikiLink" href="./Same-sex_marriage_in_Andorra" title="Same-sex marriage in Andorra">Andorra</a>
  
  // Extract the marriage section
  const marriageSection = html.match(/Marriage<\/a><\/div>[\s\S]*?<p><b>Recognized<\/b>/);
  
  if (marriageSection) {
    // Find all country links in this section
    // Pattern: >CountryName</a></li>
    const countryPattern = />([A-Z][a-zA-Z\s]+)<\/a>(?:<sup|<\/li>)/g;
    let match;
    while ((match = countryPattern.exec(marriageSection[0])) !== null) {
      const name = match[1].trim();
      // Skip footnotes and non-country text
      if (name.length > 1 && !name.match(/^[ivx]+$/i)) {
        countries.add(name);
      }
    }
  }
  
  return countries;
}

async function updateJsonl(legalCountries) {
  const content = await fs.readFile(COUNTRIES_JSONL, 'utf-8');
  const lines = content.trim().split('\n');
  
  let trueCount = 0;
  let falseCount = 0;
  
  const result = lines.map(line => {
    const country = JSON.parse(line);
    const iso = country.id;
    
    // Check if this country is in our set of legal countries
    let isLegal = false;
    for (const name of legalCountries) {
      if (lookupIso(name) === iso) {
        isLegal = true;
        break;
      }
    }
    
    country.political.same_sex_marriage_legal = isLegal;
    
    if (isLegal) {
      trueCount++;
    } else {
      falseCount++;
    }
    
    return JSON.stringify(country);
  });
  
  await fs.writeFile(COUNTRIES_JSONL, result.join('\n') + '\n');
  return { trueCount, falseCount };
}

async function main() {
  console.log('Building country name lookup...');
  await buildNameLookup();
  
  console.log('\nParsing same-sex-marriage.html...');
  const legalCountries = await parseCountriesWithLegalSameSexMarriage();
  console.log(`  Found ${legalCountries.size} countries with legal same-sex marriage`);
  console.log('  Countries:', Array.from(legalCountries).sort().join(', '));
  
  console.log('\nUpdating countries.jsonl...');
  const { trueCount, falseCount } = await updateJsonl(legalCountries);
  console.log(`  Legal: ${trueCount}, Not legal: ${falseCount}`);
  
  console.log('\nDone!');
}

main().catch(console.error);

