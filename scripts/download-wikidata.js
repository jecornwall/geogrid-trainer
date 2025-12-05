/**
 * Wikidata SPARQL Downloader for GeoGrid Trainer
 * 
 * Downloads structured country data from Wikidata using SPARQL queries.
 * Much faster than parsing Wikipedia HTML for available data.
 * 
 * Run with: node scripts/download-wikidata.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  outputDir: path.join(__dirname, '..', 'data', 'raw', 'wikidata'),
  sparqlEndpoint: 'https://query.wikidata.org/sparql',
  userAgent: 'GeoGridTrainer/1.0 (Educational project)',
};

// Ensure output directory exists
function ensureDirectory() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    console.log(`📁 Created directory: ${CONFIG.outputDir}`);
  }
}

// Execute a SPARQL query against Wikidata
async function executeSparql(query, name) {
  console.log(`\n🔍 Querying: ${name}...`);
  
  const url = `${CONFIG.sparqlEndpoint}?query=${encodeURIComponent(query)}`;
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/sparql-results+json',
      'User-Agent': CONFIG.userAgent,
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`   ✅ Got ${data.results.bindings.length} results`);
  return data;
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// SPARQL QUERIES
// ============================================

const QUERIES = {
  // Basic country info: ISO codes, names, area, population, capitals
  basicInfo: `
SELECT DISTINCT ?country ?countryLabel ?iso2 ?iso3 ?area ?population ?capital ?capitalLabel ?capitalPopulation
WHERE {
  ?country wdt:P31 wd:Q6256 .  # Instance of country
  
  OPTIONAL { ?country wdt:P297 ?iso2 . }  # ISO 3166-1 alpha-2
  OPTIONAL { ?country wdt:P298 ?iso3 . }  # ISO 3166-1 alpha-3
  OPTIONAL { ?country wdt:P2046 ?area . }  # Area
  OPTIONAL { ?country wdt:P1082 ?population . }  # Population
  OPTIONAL { 
    ?country wdt:P36 ?capital .  # Capital
    OPTIONAL { ?capital wdt:P1082 ?capitalPopulation . }
  }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY ?countryLabel
`,

  // Continents
  continents: `
SELECT DISTINCT ?country ?iso2 ?continent ?continentLabel
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  ?country wdt:P30 ?continent .
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
`,

  // Land borders
  borders: `
SELECT DISTINCT ?country ?iso2 ?neighbor ?neighborIso2
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  ?country wdt:P47 ?neighbor .
  ?neighbor wdt:P297 ?neighborIso2 .
  
  # Only countries (not bodies of water, etc.)
  ?neighbor wdt:P31 wd:Q6256 .
}
`,

  // Official languages (filtered to our 5)
  languages: `
SELECT DISTINCT ?country ?iso2 ?language ?languageLabel
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  ?country wdt:P37 ?language .
  
  # Filter to our tracked languages
  VALUES ?language { wd:Q1860 wd:Q1321 wd:Q150 wd:Q13955 wd:Q5146 }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
`,

  // Organization memberships (EU, Commonwealth)
  memberships: `
SELECT DISTINCT ?country ?iso2 ?org ?orgLabel
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  ?country wdt:P463 ?org .
  
  # EU or Commonwealth
  VALUES ?org { wd:Q458 wd:Q7785 }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
`,

  // Government type (for monarchy detection)
  governmentTypes: `
SELECT DISTINCT ?country ?iso2 ?govType ?govTypeLabel
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  ?country wdt:P122 ?govType .
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
`,

  // Time zones directly on countries
  timeZones: `
SELECT DISTINCT ?country ?iso2 ?timezone ?timezoneLabel
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  ?country wdt:P421 ?timezone .
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
`,

  // Economic data: GDP per capita and HDI
  economic: `
SELECT DISTINCT ?country ?iso2 ?gdpPerCapita ?hdi
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  
  OPTIONAL { ?country wdt:P2132 ?gdpPerCapita . }  # GDP per capita
  OPTIONAL { ?country wdt:P1081 ?hdi . }  # HDI
}
`,

  // Driving side
  drivingSide: `
SELECT DISTINCT ?country ?iso2 ?drivingSide ?drivingSideLabel
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  ?country wdt:P1622 ?drivingSide .
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
`,

  // Coastline length
  coastline: `
SELECT DISTINCT ?country ?iso2 ?coastline
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  ?country wdt:P2660 ?coastline .  # Length of coastline
}
`,

  // Island countries
  islandCountries: `
SELECT DISTINCT ?country ?iso2
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  ?country wdt:P31 wd:Q23442 .  # Also instance of island country
}
`,

  // Landlocked countries
  landlockedCountries: `
SELECT DISTINCT ?country ?iso2
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  ?country wdt:P31 wd:Q123480 .  # Also instance of landlocked country
}
`,

  // Dependencies/territories  
  dependencies: `
SELECT DISTINCT ?territory ?iso2 ?territoryLabel ?sovereign ?sovereignLabel
WHERE {
  ?territory wdt:P297 ?iso2 .
  ?territory wdt:P31/wdt:P279* wd:Q161243 .  # Instance of dependent territory (or subclass)
  OPTIONAL { ?territory wdt:P17 ?sovereign . }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
`,

  // Nuclear weapons states
  nuclearWeapons: `
SELECT DISTINCT ?country ?iso2
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  ?country wdt:P31 wd:Q4994 .  # Nuclear weapons state
}
`,

  // Former USSR republics
  formerUSSR: `
SELECT DISTINCT ?country ?iso2
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  {
    ?country wdt:P17 wd:Q15180 .  # Country was USSR
  } UNION {
    ?country wdt:P463 wd:Q15180 .  # Member of USSR
  } UNION {
    # Former Soviet republics by their specific item
    VALUES ?country {
      wd:Q159 wd:Q212 wd:Q184 wd:Q211 wd:Q227 wd:Q230 
      wd:Q232 wd:Q817 wd:Q813 wd:Q262 wd:Q265 wd:Q235
      wd:Q228 wd:Q37 wd:Q189
    }
  }
}
`,

  // Most populated city (for "capital is not most populated" check)
  largestCities: `
SELECT ?country ?iso2 ?city ?cityLabel ?cityPopulation
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  ?city wdt:P17 ?country .
  ?city wdt:P31/wdt:P279* wd:Q515 .  # City or subclass
  ?city wdt:P1082 ?cityPopulation .
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY ?iso2 DESC(?cityPopulation)
`,

  // Flag images
  flagImages: `
SELECT DISTINCT ?country ?iso2 ?flag
WHERE {
  ?country wdt:P31 wd:Q6256 .
  ?country wdt:P297 ?iso2 .
  ?country wdt:P41 ?flag .  # Flag image
}
`,

  // Olympic hosts
  olympicHosts: `
SELECT DISTINCT ?country ?iso2 ?olympics ?olympicsLabel ?year ?city ?cityLabel
WHERE {
  ?olympics wdt:P31 wd:Q159821 .  # Summer Olympics
  ?olympics wdt:P17 ?country .
  ?country wdt:P297 ?iso2 .
  ?olympics wdt:P585 ?date .
  BIND(YEAR(?date) AS ?year)
  OPTIONAL { ?olympics wdt:P276 ?city . }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
`,

  // Winter Olympic hosts
  winterOlympicHosts: `
SELECT DISTINCT ?country ?iso2 ?olympics ?olympicsLabel ?year ?city ?cityLabel
WHERE {
  ?olympics wdt:P31 wd:Q82414 .  # Winter Olympics
  ?olympics wdt:P17 ?country .
  ?country wdt:P297 ?iso2 .
  ?olympics wdt:P585 ?date .
  BIND(YEAR(?date) AS ?year)
  OPTIONAL { ?olympics wdt:P276 ?city . }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
`,

  // FIFA World Cup hosts
  fifaHosts: `
SELECT DISTINCT ?country ?iso2 ?worldcup ?worldcupLabel ?year
WHERE {
  ?worldcup wdt:P31 wd:Q47514 .  # FIFA World Cup edition
  ?worldcup wdt:P17 ?country .
  ?country wdt:P297 ?iso2 .
  ?worldcup wdt:P585 ?date .
  BIND(YEAR(?date) AS ?year)
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
`,

  // FIFA World Cup winners
  fifaWinners: `
SELECT DISTINCT ?country ?iso2 (COUNT(?worldcup) AS ?wins)
WHERE {
  ?worldcup wdt:P31 wd:Q47514 .  # FIFA World Cup edition
  ?worldcup wdt:P1346 ?team .  # Winner
  ?team wdt:P17 ?country .
  ?country wdt:P297 ?iso2 .
}
GROUP BY ?country ?iso2
`,

};

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('🌍 GeoGrid Trainer - Wikidata SPARQL Downloader\n');
  console.log('=' .repeat(50));
  
  ensureDirectory();
  
  const results = {};
  const queryNames = Object.keys(QUERIES);
  
  console.log(`\n📋 Running ${queryNames.length} SPARQL queries...`);
  
  for (const name of queryNames) {
    try {
      const data = await executeSparql(QUERIES[name], name);
      results[name] = data;
      
      // Save individual query result
      const outputPath = path.join(CONFIG.outputDir, `${name}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
      
      // Rate limiting - be nice to Wikidata
      await sleep(1000);
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      results[name] = { error: error.message };
    }
  }
  
  // Save combined results
  const combinedPath = path.join(CONFIG.outputDir, '_all-queries.json');
  fs.writeFileSync(combinedPath, JSON.stringify({
    downloadedAt: new Date().toISOString(),
    queries: queryNames,
    results,
  }, null, 2));
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('✨ Wikidata download complete!');
  console.log(`📁 Data saved to: ${CONFIG.outputDir}`);
  
  const successful = queryNames.filter(n => !results[n].error).length;
  const failed = queryNames.length - successful;
  console.log(`📊 ${successful} queries succeeded, ${failed} failed`);
}

main().catch(console.error);

