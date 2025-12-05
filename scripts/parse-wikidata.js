/**
 * Parse raw Wikidata JSON files to generate/update data/countries.jsonl
 * 
 * This script handles base country data from Wikidata:
 * - Basic info (name, area, population, capitals)
 * - Continents
 * - Languages
 * - Memberships (EU, Commonwealth)
 * - Government types (monarchy)
 * - Time zones
 * - Economic data (GDP, HDI)
 * - Driving side
 * - Landlocked status
 * - Former USSR membership
 * - Dependencies
 * - Largest cities
 * - Flag image URLs
 * - Olympic hosts
 * 
 * Fields managed by Wikipedia parsers are PRESERVED, not overwritten:
 * - borders.countries (parse-wikipedia-land-borders.js)
 * - flag.has_star, has_coat_of_arms, has_animal (parse-wikipedia-flags.js)
 * - flag.colors (update-flag-colors.js)
 * - geography.is_island_nation (parse-wikipedia-island-countries.js)
 * - geography.coastline_km (parse-wikipedia-coastline-length.js)
 * - sports.olympic_medals (parse-wikipedia-olympic-medals.js)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadCountries, saveCountries, loadMasterCountryList, paths } from './lib/countries-jsonl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIKIDATA_DIR = paths.rawWikidata;

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

// Manual time zone overrides for countries where Wikidata is incomplete
// These are countries with multiple time zones where Wikidata only stores one on the country entity
const TIME_ZONE_OVERRIDES = {
  'AU': ['UTC+8:00', 'UTC+9:30', 'UTC+10:00', 'UTC+10:30', 'UTC+11:00'],  // Western, Central, Eastern (with DST variants)
  'RU': ['UTC+2:00', 'UTC+3:00', 'UTC+4:00', 'UTC+5:00', 'UTC+6:00', 'UTC+7:00', 'UTC+8:00', 'UTC+9:00', 'UTC+10:00', 'UTC+11:00', 'UTC+12:00'],  // 11 time zones
  'CA': ['UTC-8:00', 'UTC-7:00', 'UTC-6:00', 'UTC-5:00', 'UTC-4:00', 'UTC-3:30'],  // Pacific to Newfoundland
  'CN': ['UTC+8:00'],  // China uses single time zone officially (Beijing Time)
  'ID': ['UTC+7:00', 'UTC+8:00', 'UTC+9:00'],  // Western, Central, Eastern Indonesia
  'MX': ['UTC-8:00', 'UTC-7:00', 'UTC-6:00', 'UTC-5:00'],  // Pacific to Eastern Mexico
  'KZ': ['UTC+5:00', 'UTC+6:00'],  // Western and Eastern Kazakhstan
  'MN': ['UTC+7:00', 'UTC+8:00'],  // Western and Eastern Mongolia
  'CL': ['UTC-6:00', 'UTC-4:00', 'UTC-3:00'],  // Easter Island, Continental, Magallanes
  'EC': ['UTC-6:00', 'UTC-5:00'],  // Galapagos and Continental
  'ES': ['UTC+0:00', 'UTC+1:00'],  // Canary Islands and Peninsula
  'PT': ['UTC-1:00', 'UTC+0:00'],  // Azores and Continental
  'CD': ['UTC+1:00', 'UTC+2:00'],  // Western and Eastern DRC
  'KI': ['UTC+12:00', 'UTC+13:00', 'UTC+14:00'],  // Gilbert, Phoenix, Line Islands
  'FM': ['UTC+10:00', 'UTC+11:00'],  // Chuuk/Yap and Kosrae/Pohnpei
  'PF': ['UTC-10:00', 'UTC-9:30', 'UTC-9:00'],  // Tahiti, Marquesas, Gambier
};

async function parseTimeZones() {
  const bindings = await loadWikidata('timeZones.json');
  const timezones = new Map();
  
  for (const b of bindings) {
    const iso2 = getValue(b, 'iso2');
    const tz = getValue(b, 'timezoneLabel');
    if (!iso2 || !tz) continue;
    
    const utcMatch = tz.match(/UTC[+−-]?\d{1,2}(:\d{2})?/i);
    if (utcMatch) {
      const tzValue = utcMatch[0].replace('−', '-');
      if (!timezones.has(iso2)) timezones.set(iso2, new Set());
      timezones.get(iso2).add(tzValue);
    }
  }
  
  // Apply manual overrides for countries with incomplete Wikidata
  for (const [iso2, zones] of Object.entries(TIME_ZONE_OVERRIDES)) {
    timezones.set(iso2, new Set(zones));
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
// DEFAULT COUNTRY STRUCTURE
// ============================================================

/**
 * Create a default country object with all required fields.
 * This ensures the schema is complete even for countries with missing Wikidata.
 */
function createDefaultCountry(iso2, name) {
  return {
    id: iso2,
    name: name,
    flag_image_url: `/flags/${iso2.toLowerCase()}.svg`,
    flag: {
      colors: [],
      has_star: false,
      has_coat_of_arms: false,
      has_animal: false
    },
    geography: {
      continents: ['Africa'],  // Placeholder
      is_island_nation: false,
      is_landlocked: false,
      coastline_km: 0,
      coastlines: [],
      river_systems: [],
      touches_equator: false,
      touches_eurasian_steppe: false,
      touches_sahara: false
    },
    borders: {
      countries: []
    },
    political: {
      is_eu_member: false,
      is_commonwealth_member: false,
      was_ussr: false,
      is_monarchy: false,
      is_dependency: false,
      has_nuclear_weapons: false,
      official_languages: [],
      same_sex_marriage_legal: false,
      same_sex_activities_illegal: false,
      corruption_perceptions_index: 50,
      time_zones: ['UTC+0'],
      observes_dst: false
    },
    population: {
      count: 0,
      density_per_km2: 0,
      capitals: [{ name: 'Unknown', population: 0 }],
      most_populated_city: 'Unknown'
    },
    area_km2: 1,
    economic: {
      gdp_per_capita: 0,
      hdi: 0,
      produces_nuclear_power: false,
      wheat_production_rank: null,
      oil_production_rank: null,
      renewable_energy_share_rank: null
    },
    facts: {
      drives_on_left: false,
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
      olympic_medals: { total: 0 },
      olympics_hosted: [],
      fifa_world_cup: { hosted: [], played: false, wins: 0 },
      f1_hosted: false
    }
  };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('Loading master country list...');
  const masterList = await loadMasterCountryList();
  console.log(`  Loaded ${masterList.length} countries from countries.json\n`);
  
  console.log('Loading existing data (preserving Wikipedia-sourced fields)...');
  const existingCountries = await loadCountries();
  console.log(`  Loaded ${existingCountries.size} existing records\n`);
  
  console.log('Parsing Wikidata files...');
  const basicInfo = await parseBasicInfo();
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
  const outputCountries = new Map();
  
  for (const master of masterList) {
    const iso2 = master.code;
    const info = basicInfo.get(iso2) || {};
    const econ = economic.get(iso2) || {};
    const conts = continents.get(iso2);
    const tz = timezones.get(iso2);
    const langs = languages.get(iso2);
    const hosted = olympicHosts.get(iso2);
    
    // Start with existing data or create default
    const existing = existingCountries.get(iso2) || createDefaultCountry(iso2, master.name);
    
    // Build capitals array from Wikidata
    let capitals = info.capitals || [];
    if (capitals.length === 0) {
      capitals = existing.population?.capitals || [{ name: 'Unknown', population: 0 }];
    }
    
    // Get most populated city
    const mostPopulated = largestCities.get(iso2) || existing.population?.most_populated_city || capitals[0]?.name || 'Unknown';
    
    // Ensure valid area
    const area = info.area_km2 > 0 ? info.area_km2 : (existing.area_km2 || 1);
    const popCount = info.population_count || existing.population?.count || 0;
    
    // Build the updated country object
    // IMPORTANT: Preserve Wikipedia-sourced fields from existing data
    const country = {
      id: iso2,
      name: info.name || master.name,
      flag_image_url: flagImages.get(iso2) || existing.flag_image_url || `/flags/${iso2.toLowerCase()}.svg`,
      
      // PRESERVE existing flag data (managed by parse-wikipedia-flags.js and update-flag-colors.js)
      flag: {
        colors: existing.flag?.colors || [],
        has_star: existing.flag?.has_star ?? false,
        has_coat_of_arms: existing.flag?.has_coat_of_arms ?? false,
        has_animal: existing.flag?.has_animal ?? false
      },
      
      geography: {
        continents: conts ? Array.from(conts) : (existing.geography?.continents || ['Africa']),
        // PRESERVE existing island nation status (managed by parse-wikipedia-island-countries.js)
        is_island_nation: existing.geography?.is_island_nation ?? false,
        is_landlocked: landlocked.has(iso2),
        // PRESERVE existing coastline_km (managed by parse-wikipedia-coastline-length.js)
        coastline_km: existing.geography?.coastline_km ?? 0,
        coastlines: existing.geography?.coastlines || [],
        river_systems: existing.geography?.river_systems || [],
        touches_equator: existing.geography?.touches_equator ?? false,
        touches_eurasian_steppe: existing.geography?.touches_eurasian_steppe ?? false,
        touches_sahara: existing.geography?.touches_sahara ?? false
      },
      
      // PRESERVE existing borders (managed by parse-wikipedia-land-borders.js)
      borders: {
        countries: existing.borders?.countries || []
      },
      
      political: {
        is_eu_member: eu.has(iso2),
        is_commonwealth_member: commonwealth.has(iso2),
        was_ussr: formerUSSR.has(iso2),
        is_monarchy: monarchies.has(iso2),
        is_dependency: dependencies.has(iso2),
        has_nuclear_weapons: existing.political?.has_nuclear_weapons ?? false,
        official_languages: langs ? Array.from(langs) : (existing.political?.official_languages || []),
        same_sex_marriage_legal: existing.political?.same_sex_marriage_legal ?? false,
        same_sex_activities_illegal: existing.political?.same_sex_activities_illegal ?? false,
        corruption_perceptions_index: existing.political?.corruption_perceptions_index ?? 50,
        time_zones: tz ? Array.from(tz) : (existing.political?.time_zones || ['UTC+0']),
        observes_dst: existing.political?.observes_dst ?? false
      },
      
      population: {
        count: popCount,
        density_per_km2: Math.round(popCount / area),
        capitals: capitals,
        most_populated_city: mostPopulated
      },
      
      area_km2: area,
      
      economic: {
        gdp_per_capita: econ.gdp_per_capita || existing.economic?.gdp_per_capita || 0,
        hdi: econ.hdi || existing.economic?.hdi || 0,
        produces_nuclear_power: existing.economic?.produces_nuclear_power ?? false,
        wheat_production_rank: existing.economic?.wheat_production_rank ?? null,
        oil_production_rank: existing.economic?.oil_production_rank ?? null,
        renewable_energy_share_rank: existing.economic?.renewable_energy_share_rank ?? null
      },
      
      facts: {
        drives_on_left: leftDriving.has(iso2),
        skyscraper_count: existing.facts?.skyscraper_count ?? 0,
        has_alcohol_prohibition: existing.facts?.has_alcohol_prohibition ?? false,
        air_pollution_pm25: existing.facts?.air_pollution_pm25 ?? 0,
        co2_emissions_per_capita: existing.facts?.co2_emissions_per_capita ?? 0,
        obesity_rate_rank: existing.facts?.obesity_rate_rank ?? null,
        alcohol_consumption_rank: existing.facts?.alcohol_consumption_rank ?? null,
        chocolate_consumption_rank: existing.facts?.chocolate_consumption_rank ?? null,
        rail_network_rank: existing.facts?.rail_network_rank ?? null,
        population_density_rank: existing.facts?.population_density_rank ?? null,
        tourist_arrivals_rank: existing.facts?.tourist_arrivals_rank ?? null,
        world_heritage_sites_rank: existing.facts?.world_heritage_sites_rank ?? null,
        lakes_count_rank: existing.facts?.lakes_count_rank ?? null
      },
      
      sports: {
        // PRESERVE existing olympic_medals (managed by parse-wikipedia-olympic-medals.js)
        olympic_medals: existing.sports?.olympic_medals || { total: 0 },
        olympics_hosted: hosted || existing.sports?.olympics_hosted || [],
        fifa_world_cup: existing.sports?.fifa_world_cup || { hosted: [], played: false, wins: 0 },
        f1_hosted: existing.sports?.f1_hosted ?? false
      }
    };
    
    outputCountries.set(iso2, country);
  }
  
  console.log(`\nSaving ${outputCountries.size} countries...`);
  await saveCountries(outputCountries);
  
  console.log('Done! Wikidata parsing complete.');
}

main().catch(console.error);

