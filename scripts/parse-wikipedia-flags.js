/**
 * Parse Wikipedia flags-design.html to extract flag properties:
 * - has_coat_of_arms
 * - has_star (includes sun/moon as "star" per schema)
 * - has_animal (includes humans)
 * - colors (TODO: would need different source)
 * 
 * Updates existing countries.jsonl with flag properties.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FLAGS_HTML = path.join(ROOT, 'data/raw/wikipedia/flags-design.html');
const COUNTRIES_JSON = path.join(ROOT, 'data/countries.json');
const COUNTRIES_JSONL = path.join(ROOT, 'data/countries.jsonl');

// Country name to ISO code mapping will be built from countries.json
let nameToIso = new Map();

/**
 * Build a fuzzy name -> ISO lookup from countries.json
 */
async function buildNameLookup() {
  const countries = JSON.parse(await fs.readFile(COUNTRIES_JSON, 'utf-8'));
  
  for (const c of countries) {
    const code = c.code;
    const name = c.name;
    
    // Add various forms of the name
    nameToIso.set(name.toLowerCase(), code);
    nameToIso.set(name.toLowerCase().replace(/[^a-z]/g, ''), code);
    
    // Handle common variations
    if (name.includes(' and ')) {
      nameToIso.set(name.toLowerCase().replace(' and ', ' & '), code);
    }
  }
  
  // Add manual mappings for common mismatches
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
    'macedonia': 'MK',
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
    'great britain': 'GB',
  };
  
  for (const [name, code] of Object.entries(manualMappings)) {
    nameToIso.set(name, code);
  }
}

/**
 * Extract country name from a "Flag of X" reference
 */
function extractCountryFromFlagRef(text) {
  // Match "Flag_of_X" or "Flag of X" patterns (including "Flag_of_the_X")
  const match = text.match(/Flag[_ ]of[_ ](?:the[_ ])?([A-Za-z_\-' ]+?)(?:#|"|$|\s*\(|\.svg)/i);
  if (!match) return null;
  
  let country = match[1]
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove trailing "the" if present
  country = country.replace(/^the\s+/i, '');
  
  // Skip non-country flags (regions, provinces, etc.)
  const skipPatterns = [
    /province/i,
    /state of/i,
    /british columbia/i,
    /brittany/i,
    /corsica/i,
    /^england$/i,
    /^scotland$/i,
    /^wales$/i,
    /northern ireland/i,
    /catalonia/i,
    /basque/i,
    /galicia/i,
    /andalusia/i,
    /flanders/i,
    /wallonia/i,
    /quebec/i,
    /^texas$/i,
    /^california$/i,
    /^hawaii$/i,
    /crimea/i,
    /^tibet$/i,
    /kurdistan/i,
    /^europe$/i,
    /virgin islands/i,
    /gagauzia/i,
    /transnistria/i,
    /abkhazia/i,
    /^valencia$/i,
    /west papua/i,
  ];
  
  for (const pattern of skipPatterns) {
    if (pattern.test(country)) return null;
  }
  
  return country;
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
 * Parse HTML and extract flags by section
 */
async function parseFlags() {
  const html = await fs.readFile(FLAGS_HTML, 'utf-8');
  
  const coatOfArmsFlags = new Set();
  const starFlags = new Set();  // includes sun, moon, stars
  const animalFlags = new Set();  // includes humans
  
  // Split by sections
  const sections = html.split(/<section[^>]*>/);
  
  let currentSection = '';
  
  for (const section of sections) {
    // Check for section headers to determine type
    // Coat of arms sections (15-17)
    if (section.includes('id="Mobile_charge_—_National_coat_of_arms') || 
        section.includes('id="National_coat_of_arms')) {
      currentSection = 'coat_of_arms';
    }
    // Emblem section (18) - also counts as coat of arms
    else if (section.includes('id="Mobile_charge_—_National_emblem') ||
             section.includes('id="National_emblem')) {
      currentSection = 'emblem';
    }
    // Astronomical sections (26-29): Sun, Moon, Star
    else if (section.includes('id="Mobile_charge_—_Astronomical') ||
             section.includes('id="Sun"') || 
             section.includes('id="Moon"') || 
             section.includes('id="Star"')) {
      currentSection = 'star';
    }
    // Living organisms sections (30-33): Human, Animals, Plants
    else if (section.includes('id="Mobile_charge_—_Living_organisms') ||
             section.includes('id="Human_and_body_parts"') ||
             section.includes('id="Animals"')) {
      currentSection = 'animal';
    }
    // Reset when we hit Cross section or other non-target sections
    else if (section.includes('id="Ordinary_/_mobile_charge_—_Cross') ||
             section.includes('id="Mobile_charge_—_Other_objects') ||
             section.includes('id="Mobile_charge_—_Text') ||
             section.includes('id="Ordinary_charge') ||
             section.includes('id="See_also"') ||
             section.includes('id="Plants"')) {
      currentSection = '';
    }
    
    if (!currentSection) continue;
    
    // Find all flag references in this section  
    const flagRefs = section.matchAll(/Flag[_ ]of[_ ](?:the[_ ])?([A-Za-z_\-' ]+?)(?:#|"|<|\.svg)/gi);
    
    for (const match of flagRefs) {
      const fullMatch = match[0];
      const country = extractCountryFromFlagRef(fullMatch);
      const iso = lookupIso(country);
      
      if (iso) {
        if (currentSection === 'coat_of_arms' || currentSection === 'emblem') {
          coatOfArmsFlags.add(iso);
        } else if (currentSection === 'star') {
          starFlags.add(iso);
        } else if (currentSection === 'animal') {
          animalFlags.add(iso);
        }
      }
    }
  }
  
  return { coatOfArmsFlags, starFlags, animalFlags };
}

/**
 * Load existing JSONL, update flags, and save
 */
async function updateJsonl(coatOfArmsFlags, starFlags, animalFlags) {
  const content = await fs.readFile(COUNTRIES_JSONL, 'utf-8');
  const lines = content.trim().split('\n');
  
  const updated = lines.map(line => {
    const country = JSON.parse(line);
    const iso = country.id;
    
    country.flag.has_coat_of_arms = coatOfArmsFlags.has(iso);
    country.flag.has_star = starFlags.has(iso);
    country.flag.has_animal = animalFlags.has(iso);
    
    return JSON.stringify(country);
  });
  
  await fs.writeFile(COUNTRIES_JSONL, updated.join('\n') + '\n');
}

async function main() {
  console.log('Building country name lookup...');
  await buildNameLookup();
  console.log(`  ${nameToIso.size} name mappings`);
  
  console.log('\nParsing flags-design.html...');
  const { coatOfArmsFlags, starFlags, animalFlags } = await parseFlags();
  
  console.log(`  Coat of arms: ${coatOfArmsFlags.size} countries`);
  console.log(`  Stars/Sun/Moon: ${starFlags.size} countries`);
  console.log(`  Animals/Humans: ${animalFlags.size} countries`);
  
  console.log('\nUpdating countries.jsonl...');
  await updateJsonl(coatOfArmsFlags, starFlags, animalFlags);
  
  console.log('Done!');
  
  // Print some samples
  console.log('\nSample coat of arms:', Array.from(coatOfArmsFlags).slice(0, 10).join(', '));
  console.log('Sample stars:', Array.from(starFlags).slice(0, 10).join(', '));
  console.log('Sample animals:', Array.from(animalFlags).slice(0, 10).join(', '));
}

main().catch(console.error);

