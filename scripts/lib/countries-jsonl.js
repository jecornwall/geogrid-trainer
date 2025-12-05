/**
 * Shared utilities for reading/writing countries.jsonl
 * 
 * All data parsers should use these utilities to ensure they only
 * update the specific fields they are responsible for, preserving
 * all other data.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const COUNTRIES_JSONL = path.join(ROOT, 'data/countries.jsonl');
const COUNTRIES_JSON = path.join(ROOT, 'data/countries.json');

/**
 * Load all countries from countries.jsonl
 * @returns {Promise<Map<string, object>>} Map of ISO code to country object
 */
export async function loadCountries() {
  const countries = new Map();
  
  try {
    const content = await fs.readFile(COUNTRIES_JSONL, 'utf-8');
    const lines = content.trim().split('\n');
    
    for (const line of lines) {
      if (!line.trim()) continue;
      const country = JSON.parse(line);
      if (country.id) {
        countries.set(country.id, country);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // File doesn't exist - return empty map
  }
  
  return countries;
}

/**
 * Save countries to countries.jsonl
 * @param {Map<string, object>} countries Map of ISO code to country object
 */
export async function saveCountries(countries) {
  // Sort by name for consistent ordering
  const sorted = Array.from(countries.values())
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const jsonl = sorted.map(c => JSON.stringify(c)).join('\n') + '\n';
  await fs.writeFile(COUNTRIES_JSONL, jsonl);
}

/**
 * Update specific fields in countries.jsonl
 * 
 * @param {function} updater - Function that receives (country, iso) and returns
 *                             an object with fields to merge into the country.
 *                             Return null/undefined to skip updating a country.
 * @param {object} options - Options
 * @param {boolean} options.log - Whether to log updates (default: false)
 * @returns {Promise<{updated: number, total: number}>}
 */
export async function updateCountries(updater, options = {}) {
  const { log = false } = options;
  const countries = await loadCountries();
  
  let updated = 0;
  const total = countries.size;
  
  for (const [iso, country] of countries) {
    const updates = await updater(country, iso);
    
    if (updates && typeof updates === 'object') {
      // Deep merge the updates into the country
      deepMerge(country, updates);
      updated++;
      
      if (log) {
        console.log(`  Updated: ${country.name} (${iso})`);
      }
    }
  }
  
  await saveCountries(countries);
  
  return { updated, total };
}

/**
 * Deep merge source into target, modifying target in place.
 * Only updates existing paths - doesn't add new top-level keys.
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];
    
    if (sourceVal !== null && typeof sourceVal === 'object' && !Array.isArray(sourceVal)) {
      // Nested object - recurse
      if (targetVal && typeof targetVal === 'object' && !Array.isArray(targetVal)) {
        deepMerge(targetVal, sourceVal);
      } else {
        // Target doesn't have this nested object, create it
        target[key] = sourceVal;
      }
    } else {
      // Primitive or array - replace
      target[key] = sourceVal;
    }
  }
}

/**
 * Load the master country list from countries.json
 * @returns {Promise<Array<{code: string, name: string}>>}
 */
export async function loadMasterCountryList() {
  const content = await fs.readFile(COUNTRIES_JSON, 'utf-8');
  return JSON.parse(content);
}

/**
 * Build a name -> ISO code lookup map from countries.json
 * Includes common variations and aliases.
 * @returns {Promise<Map<string, string>>}
 */
export async function buildNameToIsoLookup() {
  const nameToIso = new Map();
  const countries = await loadMasterCountryList();
  
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
    "côte d'ivoire": 'CI',
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
    'china': 'CN',
    'türkiye': 'TR',
    'turkey': 'TR',
    'macau': 'MO',
  };
  
  for (const [name, code] of Object.entries(manualMappings)) {
    nameToIso.set(name, code);
  }
  
  return nameToIso;
}

/**
 * Get paths for common data files
 */
export const paths = {
  root: ROOT,
  countriesJsonl: COUNTRIES_JSONL,
  countriesJson: COUNTRIES_JSON,
  rawWikipedia: path.join(ROOT, 'data/raw/wikipedia'),
  rawWikidata: path.join(ROOT, 'data/raw/wikidata'),
  flags: path.join(ROOT, 'data/flags'),
};

