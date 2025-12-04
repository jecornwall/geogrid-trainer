/**
 * Parse raw Wikidata JSON files to generate data/countries.jsonl
 * 
 * This script ONLY handles Wikidata. Wikipedia HTML parsing will be
 * added incrementally in separate passes.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const WIKIDATA_DIR = path.join(ROOT, 'data/raw/wikidata');
const COUNTRIES_JSON = path.join(ROOT, 'data/countries.json');
const COUNTRIES_JSONL = path.join(ROOT, 'data/countries.jsonl');
const OUTPUT_FILE = COUNTRIES_JSONL;

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

async function loadWikidata(filename) {
  const filepath = path.join(WIKIDATA_DIR, filename);
  const content = await fs.readFile(filepath, 'utf-8');
  const data = JSON.parse(content);
  return data.results?.bindings || [];
}

function getValue(binding, field) {
  return binding?.[field]?.value ?? null;
}

// ============================================================
// WIKIDATA PARSERS
// ============================================================

async function parseBasicInfo() {
  const bindings = await loadWikidata('basicInfo.json');
  const countries = new Map();
  
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    if (!iso2) continue;
    
    const existing = countries.get(iso2) || {
      name: getValue(b, 'countryLabel'),
      area_km2: parseFloat(getValue(b, 'area')) || 0,
      population_count: parseInt(getValue(b, 'population')) || 0,
      capitals: []
    };
    
    const capitalName = getValue(b, 'capitalLabel');
    const capitalPop = parseInt(getValue(b, 'capitalPopulation')) || 0;
    if (capitalName && !existing.capitals.find(c => c.name === capitalName)) {
      existing.capitals.push({ name: capitalName, population: capitalPop });
    }
    
    countries.set(iso2, existing);
  }
  
  return countries;
}

/**
 * Load existing data from countries.jsonl that was populated by Wikipedia parsers.
 * 
 * Several fields are sourced from Wikipedia HTML parsing rather than Wikidata:
 * - borders.countries: from land-borders.html (Wikidata P47 includes maritime borders)
 * - geography.is_island_nation: from island-countries.html
 * - geography.coastline_km: from coastline-length.html
 * - flag.*: from flags-design.html
 * - sports.olympic_medals: from olympic-medals.html
 * 
 * This function preserves those values when regenerating the JSONL.
 */
async function loadExistingData() {
  const existing = new Map();
  
  try {
    const content = await fs.readFile(COUNTRIES_JSONL, 'utf-8');
    const lines = content.trim().split('\n');
    
    for (const line of lines) {
      const country = JSON.parse(line);
      if (country.id) {
        existing.set(country.id, country);
      }
    }
    console.log(`  (loaded ${existing.size} existing records from countries.jsonl)`);
  } catch (err) {
    console.log('  (no existing countries.jsonl found)');
  }
  
  return existing;
}

/**
 * Get borders from existing data.
 * Border data is sourced from Wikipedia's "List of countries by land borders".
 * Run scripts/parse-wikipedia-land-borders.js to update.
 */
function getBorders(existingData) {
  const borders = new Map();
  for (const [id, country] of existingData) {
    if (country.borders?.countries) {
      borders.set(id, new Set(country.borders.countries));
    }
  }
  return borders;
}

async function parseContinents() {
  const bindings = await loadWikidata('continents.json');
  const continents = new Map();
  const validContinents = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
  
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    const continent = getValue(b, 'continentLabel');
    if (!iso2 || !continent) continue;
    if (!validContinents.includes(continent)) continue;
    
    if (!continents.has(iso2)) continents.set(iso2, new Set());
    continents.get(iso2).add(continent);
  }
  
  return continents;
}

async function parseLanguages() {
  const bindings = await loadWikidata('languages.json');
  const languages = new Map();
  const validLanguages = ['English', 'Spanish', 'French', 'Arabic', 'Portuguese'];
  
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    const language = getValue(b, 'languageLabel');
    if (!iso2 || !language) continue;
    if (!validLanguages.includes(language)) continue;
    
    if (!languages.has(iso2)) languages.set(iso2, new Set());
    languages.get(iso2).add(language);
  }
  
  return languages;
}

async function parseMemberships() {
  const bindings = await loadWikidata('memberships.json');
  const eu = new Set();
  const commonwealth = new Set();
  
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    const orgLabel = getValue(b, 'orgLabel')?.toLowerCase() || '';
    if (!iso2) continue;
    
    if (orgLabel.includes('european union')) eu.add(iso2);
    if (orgLabel.includes('commonwealth')) commonwealth.add(iso2);
  }
  
  return { eu, commonwealth };
}

async function parseGovernmentTypes() {
  const bindings = await loadWikidata('governmentTypes.json');
  const monarchies = new Set();
  
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    const govType = getValue(b, 'govTypeLabel')?.toLowerCase() || '';
    if (!iso2) continue;
    
    if (govType.includes('monarchy') || govType.includes('kingdom')) {
      monarchies.add(iso2);
    }
  }
  
  return monarchies;
}

async function parseTimeZones() {
  const bindings = await loadWikidata('timeZones.json');
  const timezones = new Map();
  
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    const tz = getValue(b, 'timezoneLabel');
    if (!iso2 || !tz) continue;
    
    // Extract UTC offset if present
    const utcMatch = tz.match(/UTC[+−-]?\d{1,2}(:\d{2})?/i);
    if (utcMatch) {
      const tzValue = utcMatch[0].replace('−', '-');
      if (!timezones.has(iso2)) timezones.set(iso2, new Set());
      timezones.get(iso2).add(tzValue);
    }
  }
  
  return timezones;
}

async function parseEconomic() {
  const bindings = await loadWikidata('economic.json');
  const economic = new Map();
  
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    if (!iso2) continue;
    
    const gdp = parseFloat(getValue(b, 'gdpPerCapita')) || 0;
    const hdi = parseFloat(getValue(b, 'hdi')) || 0;
    
    economic.set(iso2, { gdp_per_capita: gdp, hdi: hdi });
  }
  
  return economic;
}

async function parseDrivingSide() {
  const bindings = await loadWikidata('drivingSide.json');
  const leftDriving = new Set();
  
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    const side = getValue(b, 'drivingSideLabel')?.toLowerCase() || '';
    if (!iso2) continue;
    
    if (side === 'left') leftDriving.add(iso2);
  }
  
  return leftDriving;
}

async function parseLandlocked() {
  const bindings = await loadWikidata('landlockedCountries.json');
  const landlocked = new Set();
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    if (iso2) landlocked.add(iso2);
  }
  return landlocked;
}

async function parseFormerUSSR() {
  const bindings = await loadWikidata('formerUSSR.json');
  const ussr = new Set();
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    if (iso2) ussr.add(iso2);
  }
  return ussr;
}

async function parseDependencies() {
  const bindings = await loadWikidata('dependencies.json');
  const dependencies = new Set();
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    if (iso2) dependencies.add(iso2);
  }
  return dependencies;
}

async function parseLargestCities() {
  const bindings = await loadWikidata('largestCities.json');
  const cities = new Map();
  
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    const cityName = getValue(b, 'cityLabel');
    const cityPop = parseInt(getValue(b, 'cityPopulation')) || 0;
    if (!iso2 || !cityName) continue;
    
    if (!cities.has(iso2)) cities.set(iso2, []);
    const existing = cities.get(iso2);
    if (!existing.find(c => c.name === cityName)) {
      existing.push({ name: cityName, population: cityPop });
    }
  }
  
  // Return largest city per country
  const largest = new Map();
  for (const [iso2, cityList] of cities) {
    cityList.sort((a, b) => b.population - a.population);
    if (cityList.length > 0) largest.set(iso2, cityList[0].name);
  }
  
  return largest;
}

async function parseFlagImages() {
  const bindings = await loadWikidata('flagImages.json');
  const flags = new Map();
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    const flagUrl = getValue(b, 'flag');
    if (iso2 && flagUrl) flags.set(iso2, flagUrl);
  }
  return flags;
}

async function parseOlympicHosts() {
  const summerBindings = await loadWikidata('olympicHosts.json');
  const winterBindings = await loadWikidata('winterOlympicHosts.json');
  const hosts = new Map();
  
  const processBindings = (bindings, type) => {
    for (const b of bindings) {
      const iso2 = getValue(b, 'iso2');
      const year = parseInt(getValue(b, 'year')) || 0;
      const cityLabel = getValue(b, 'cityLabel') || '';
      if (!iso2 || !year) continue;
      
      // Skip venue names, only actual cities
      const lowerCity = cityLabel.toLowerCase();
      if (lowerCity.includes('stadium') || lowerCity.includes('arena') || 
          lowerCity.includes('rink') || lowerCity.includes('center') ||
          lowerCity.includes('hall') || lowerCity.includes('oval')) continue;
      
      if (!hosts.has(iso2)) hosts.set(iso2, []);
      const existing = hosts.get(iso2);
      if (!existing.find(e => e.year === year && e.type === type)) {
        existing.push({ year, type, city: cityLabel });
      }
    }
  };
  
  processBindings(summerBindings, 'Summer');
  processBindings(winterBindings, 'Winter');
  
  return hosts;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('Loading master country list...');
  const countriesJson = JSON.parse(await fs.readFile(COUNTRIES_JSON, 'utf-8'));
  console.log(`Loaded ${countriesJson.length} countries\n`);
  
  console.log('Loading existing data (Wikipedia-sourced fields)...');
  const existingData = await loadExistingData();
  
  console.log('\nParsing Wikidata files...');
  const basicInfo = await parseBasicInfo();
  const borders = getBorders(existingData);  // Use existing Wikipedia-sourced borders
  const continents = await parseContinents();
  const languages = await parseLanguages();
  const { eu, commonwealth } = await parseMemberships();
  const monarchies = await parseGovernmentTypes();
  const timezones = await parseTimeZones();
  const economic = await parseEconomic();
  const leftDriving = await parseDrivingSide();
  const landlocked = await parseLandlocked();
  const formerUSSR = await parseFormerUSSR();
  const dependencies = await parseDependencies();
  const largestCities = await parseLargestCities();
  const flagImages = await parseFlagImages();
  const olympicHosts = await parseOlympicHosts();
  
  console.log(`  basicInfo: ${basicInfo.size}`);
  console.log(`  borders: ${borders.size}`);
  console.log(`  continents: ${continents.size}`);
  console.log(`  languages: ${languages.size}`);
  console.log(`  EU: ${eu.size}, Commonwealth: ${commonwealth.size}`);
  console.log(`  monarchies: ${monarchies.size}`);
  console.log(`  timezones: ${timezones.size}`);
  console.log(`  economic: ${economic.size}`);
  console.log(`  leftDriving: ${leftDriving.size}`);
  console.log(`  landlocked: ${landlocked.size}`);
  console.log(`  formerUSSR: ${formerUSSR.size}`);
  console.log(`  dependencies: ${dependencies.size}`);
  console.log(`  largestCities: ${largestCities.size}`);
  console.log(`  flagImages: ${flagImages.size}`);
  console.log(`  olympicHosts: ${olympicHosts.size}`);
  
  console.log('\nBuilding country records...');
  const output = [];
  
  for (const master of countriesJson) {
    const iso2 = master.code;
    const info = basicInfo.get(iso2) || {};
    const econ = economic.get(iso2) || {};
    const conts = continents.get(iso2);
    const tz = timezones.get(iso2);
    const langs = languages.get(iso2);
    const bord = borders.get(iso2);
    const hosted = olympicHosts.get(iso2);
    
    // Build capitals array
    let capitals = info.capitals || [];
    if (capitals.length === 0) {
      capitals = [{ name: 'Unknown', population: 0 }];
    }
    
    // Get most populated city
    const mostPopulated = largestCities.get(iso2) || capitals[0]?.name || 'Unknown';
    
    // Ensure valid area
    const area = info.area_km2 > 0 ? info.area_km2 : 1;
    const popCount = info.population_count || 0;
    
    // Get existing Wikipedia-sourced data for this country
    const existing = existingData.get(iso2) || {};
    const existingFlag = existing.flag || {};
    const existingGeo = existing.geography || {};
    const existingSports = existing.sports || {};
    
    const country = {
      id: iso2,
      name: info.name || master.name,
      flag_image_url: flagImages.get(iso2) || `/flags/${iso2.toLowerCase()}.svg`,
      flag: {
        colors: existingFlag.colors || [],  // Wikipedia parsing
        has_star: existingFlag.has_star || false,  // Wikipedia parsing
        has_coat_of_arms: existingFlag.has_coat_of_arms || false,  // Wikipedia parsing
        has_animal: existingFlag.has_animal || false  // Wikipedia parsing
      },
      geography: {
        continents: conts ? Array.from(conts) : (existingGeo.continents || ['Africa']),
        is_island_nation: existingGeo.is_island_nation || false,  // Wikipedia parsing
        is_landlocked: landlocked.has(iso2),
        coastline_km: existingGeo.coastline_km ?? (landlocked.has(iso2) ? 0 : 0),  // Wikipedia parsing
        coastlines: existingGeo.coastlines || [],  // Wikipedia parsing
        river_systems: existingGeo.river_systems || [],  // Wikipedia parsing
        touches_equator: existingGeo.touches_equator || false,  // Wikipedia parsing
        touches_eurasian_steppe: existingGeo.touches_eurasian_steppe || false,
        touches_sahara: existingGeo.touches_sahara || false
      },
      borders: {
        countries: bord ? Array.from(bord) : []
      },
      political: {
        is_eu_member: eu.has(iso2),
        is_commonwealth_member: commonwealth.has(iso2),
        was_ussr: formerUSSR.has(iso2),
        is_monarchy: monarchies.has(iso2),
        is_dependency: dependencies.has(iso2),
        has_nuclear_weapons: false,  // TODO: Wikipedia parsing
        official_languages: langs ? Array.from(langs) : [],
        same_sex_marriage_legal: false,  // TODO: Wikipedia parsing
        same_sex_activities_illegal: false,
        corruption_perceptions_index: 50,  // TODO: Wikipedia parsing
        time_zones: tz ? Array.from(tz) : ['UTC+0'],
        observes_dst: false  // TODO: Wikipedia parsing
      },
      population: {
        count: popCount,
        density_per_km2: Math.round(popCount / area),
        capitals: capitals,
        most_populated_city: mostPopulated
      },
      area_km2: area,
      economic: {
        gdp_per_capita: econ.gdp_per_capita || 0,
        hdi: econ.hdi || 0,
        produces_nuclear_power: false,  // TODO: Wikipedia parsing
        wheat_production_rank: null,
        oil_production_rank: null,
        renewable_energy_share_rank: null
      },
      facts: {
        drives_on_left: leftDriving.has(iso2),
        skyscraper_count: 0,
        has_alcohol_prohibition: false,
        air_pollution_pm25: 0,
        co2_emissions_per_capita: 0,
        obesity_rate_rank: null,
        alcohol_consumption_rank: null,
        chocolate_consumption_rank: null,
        rail_network_rank: null,
        population_density_rank: null,
        tourist_arrivals_rank: null,
        world_heritage_sites_rank: null,
        lakes_count_rank: null
      },
      sports: {
        olympic_medals: existingSports.olympic_medals || { total: 0 },  // Wikipedia parsing
        olympics_hosted: hosted || existingSports.olympics_hosted || [],
        fifa_world_cup: existingSports.fifa_world_cup || { hosted: [], played: false, wins: 0 },
        f1_hosted: existingSports.f1_hosted || false
      }
    };
    
    output.push(country);
  }
  
  output.sort((a, b) => a.name.localeCompare(b.name));
  
  console.log(`\nWriting ${output.length} countries to ${OUTPUT_FILE}...`);
  const jsonl = output.map(c => JSON.stringify(c)).join('\n') + '\n';
  await fs.writeFile(OUTPUT_FILE, jsonl);
  
  console.log('Done! Wikidata parsing complete.');
  console.log('\nNext steps: Add Wikipedia HTML parsing for:');
  console.log('  - Flag colors/properties (flags-design.html)');
  console.log('  - Island nations (island-countries.html)');
  console.log('  - Olympic medals (olympic-medals.html)');
  console.log('  - Various rankings (wheat, oil, etc.)');
  console.log('  - And more...');
}

main().catch(console.error);
