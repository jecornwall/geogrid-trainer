# Task: Parse Raw Data into countries.jsonl

## Goal

Parse the downloaded raw data (Wikidata JSON + Wikipedia HTML) and generate a complete `data/countries.jsonl` file that conforms to the schema defined in `src/schema/country.schema.ts`.

## Context

This project is building a GeoGrid Trainer app that needs comprehensive data about countries. The data has been downloaded from two sources:

### 1. Wikidata SPARQL Results (Structured JSON)
Located in `data/raw/wikidata/`:
- `basicInfo.json` - Country names, ISO codes, area, population, capitals
- `borders.json` - Land border relationships (804 records)
- `continents.json` - Continent mappings
- `languages.json` - Official languages (filtered to English, Spanish, French, Arabic, Portuguese)
- `memberships.json` - EU and Commonwealth membership
- `governmentTypes.json` - Government types (for monarchy detection)
- `timeZones.json` - UTC offsets
- `economic.json` - GDP per capita, HDI
- `drivingSide.json` - Left/right-hand traffic
- `landlockedCountries.json` - Landlocked country list
- `formerUSSR.json` - Former Soviet states
- `dependencies.json` - Dependent territories
- `largestCities.json` - 34,257 cities with populations (for finding most populated city)
- `flagImages.json` - Flag image URLs
- `olympicHosts.json` + `winterOlympicHosts.json` - Olympic host data

### 2. Wikipedia HTML Pages (Need Parsing)
Located in `data/raw/wikipedia/` - see parsing status below.

## Schema Reference

The target schema is defined in:
- `src/types/country.ts` - TypeScript interfaces and enums
- `src/schema/country.schema.ts` - Zod validation schema

Key structure:
```typescript
interface Country {
  id: string;                    // ISO alpha-2 code
  name: string;
  flag_image_url: string;
  flag: FlagProperties;          // colors[], has_star, has_coat_of_arms, has_animal
  geography: GeographyProperties; // continents[], is_island_nation, is_landlocked, coastline_km, coastlines[], river_systems[], touches_*
  borders: BorderProperties;      // countries[] (ISO codes)
  political: PoliticalProperties; // EU, Commonwealth, USSR, monarchy, dependency, nuclear, languages[], same_sex_*, corruption, time_zones[], DST
  population: PopulationProperties; // count, density, capitals[], most_populated_city
  area_km2: number;
  economic: EconomicProperties;   // gdp_per_capita, hdi, nuclear_power, *_rank
  facts: FactsProperties;         // drives_on_left, skyscrapers, prohibition, pollution, co2, various *_rank fields
  sports: SportsProperties;       // olympic_medals, olympics_hosted[], fifa_world_cup, f1_hosted
}
```

---

## Parsing Progress

### ✅ Completed Parsers

| Script | Source | Schema Fields |
|--------|--------|---------------|
| `scripts/parse-raw-data.js` | Wikidata JSON files | Basic country info, borders, continents, languages, memberships, time zones, economic data, driving side, landlocked status, former USSR, dependencies, capitals, flag images, olympic hosts |
| `scripts/parse-wikipedia-flags.js` | `flags-design.html` | `flag.has_star`, `flag.has_coat_of_arms`, `flag.has_animal` |
| `scripts/parse-wikipedia-olympic-medals.js` | `olympic-medals.html` | `sports.olympic_medals` (gold, silver, bronze, total) |
| `scripts/parse-wikipedia-island-countries.js` | `island-countries.html` | `geography.is_island_nation` |
| `scripts/parse-wikipedia-coastline-length.js` | `coastline-length.html` | `geography.coastline_km` |

### 🔲 Remaining Wikipedia Parsers

Pick the next file from this list and create a parser:

| File | Schema Fields | Notes |
|------|---------------|-------|
| **Ocean/sea files** | `geography.coastlines[]` | Array of `WaterBody` enum values |
| ├─ `atlantic-ocean.html` | | |
| ├─ `pacific-ocean.html` | | |
| ├─ `indian-ocean.html` | | |
| ├─ `mediterranean-sea.html` | | |
| ├─ `caribbean-sea.html` | | |
| ├─ `black-sea.html` | | |
| ├─ `baltic-sea.html` | | |
| └─ `south-china-sea.html`, `east-china-sea.html` | | Combined as "South or East China Seas" |
| `country-areas.html` | `area_km2` | May already have from Wikidata |
| `population-density.html` | `population.density_per_km2`, `facts.population_density_rank` | Rank can be negative for bottom 20 |
| `wheat-production.html` | `economic.wheat_production_rank` | Top 20 only |
| `oil-production.html` | `economic.oil_production_rank` | Top 20 only |
| `renewable-energy.html` | `economic.renewable_energy_share_rank` | Top 20 only |
| `tourist-arrivals.html` | `facts.tourist_arrivals_rank` | Top 20 only |
| `world-heritage-sites.html` | `facts.world_heritage_sites_rank` | Top 20 only |
| `rail-networks.html` | `facts.rail_network_rank` | Top 20 only |
| `alcohol-consumption.html` | `facts.alcohol_consumption_rank` | Top 20 only |
| `corruption-index.html` | `political.corruption_perceptions_index` | Score 0-100 |
| `equator.html` | `geography.touches_equator` | Boolean |
| `eurasian-steppe.html` | `geography.touches_eurasian_steppe` | Boolean |
| `sahara-desert.html` | `geography.touches_sahara` | Boolean |
| `river-systems.html` | `geography.river_systems[]` | Array of `RiverSystem` enum |
| `same-sex-marriage.html` | `political.same_sex_marriage_legal` | Boolean |
| `criminalization-homosexuality.html` | `political.same_sex_activities_illegal` | Boolean |
| `daylight-saving.html` | `political.observes_dst` | Boolean |
| `nuclear-power.html` | `economic.produces_nuclear_power` | Boolean |
| `skyscrapers.html` | `facts.skyscraper_count` | Number of 150m+ buildings |
| `alcohol-prohibition.html` | `facts.has_alcohol_prohibition` | Boolean |
| `f1-grands-prix.html` | `sports.f1_hosted` | Boolean |
| `fifa-appearances.html` | `sports.fifa_world_cup.played` | Boolean |
| `fifa-hosts.html` | `sports.fifa_world_cup.hosted[]` | Array of years |
| `fifa-finals.html` | `sports.fifa_world_cup.wins` | Number of wins |
| `olympic-hosts.html` | `sports.olympics_hosted[]` | Array of {year, type, city} |

---

## How to Create a New Parser

### 1. Examine the HTML Structure

```bash
# Look at the file structure
head -100 data/raw/wikipedia/{filename}.html

# Find tables
grep -n "<table" data/raw/wikipedia/{filename}.html

# Look for country name patterns
grep -o '"wt":"[^"]*"' data/raw/wikipedia/{filename}.html | head -20
```

### 2. Create the Parser Script

Use `scripts/parse-wikipedia-coastline-length.js` as the template. Key patterns:

```javascript
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const HTML_FILE = path.join(ROOT, 'data/raw/wikipedia/{filename}.html');
const COUNTRIES_JSON = path.join(ROOT, 'data/countries.json');
const COUNTRIES_JSONL = path.join(ROOT, 'data/countries.jsonl');

// Build name -> ISO lookup
let nameToIso = new Map();

async function buildNameLookup() {
  const countries = JSON.parse(await fs.readFile(COUNTRIES_JSON, 'utf-8'));
  for (const c of countries) {
    nameToIso.set(c.name.toLowerCase(), c.code);
    // Add variations...
  }
  // Add manual mappings for common variations
  const manualMappings = {
    'united states': 'US',
    'united kingdom': 'GB',
    // ... etc
  };
}

async function parseHtml() {
  const html = await fs.readFile(HTML_FILE, 'utf-8');
  const data = new Map();
  
  // Extract data using regex patterns on data-mw JSON attributes
  // Country names: "flag","href":"./Template:Flag"},"params":{"1":{"wt":"Country Name"}}
  // Numbers: "wt":"nts","href":"./Template:Nts"},"params":{"1":{"wt":"12345"}}
  
  return data;
}

async function updateJsonl(data) {
  const content = await fs.readFile(COUNTRIES_JSONL, 'utf-8');
  const lines = content.trim().split('\n');
  
  const result = lines.map(line => {
    const country = JSON.parse(line);
    if (data.has(country.id)) {
      // Update the relevant field(s)
      country.field.subfield = data.get(country.id);
    }
    return JSON.stringify(country);
  });
  
  await fs.writeFile(COUNTRIES_JSONL, result.join('\n') + '\n');
}
```

### 3. Common HTML Patterns

Wikipedia tables use `data-mw` JSON attributes:

```javascript
// Country name in flag template
const flagMatch = row.match(/"flag","href":"\.\/Template:Flag"\},"params":\{"1":\{"wt":"([^"]+)"\}/);

// Numeric value in nts template
const ntsMatch = row.match(/"wt":"nts","href":"\.\/Template:Nts"\},"params":\{"1":\{"wt":"(\d+)"\}/);

// ISO code from link
const isoMatch = html.match(/ISO_3166-2:([A-Z]{2})/g);
```

### 4. Run and Verify

```bash
node scripts/parse-wikipedia-{topic}.js

# Verify sample countries
grep -E '"id":"(US|GB|JP|AU|FR)"' data/countries.jsonl | node -e '
const rl = require("readline").createInterface({ input: process.stdin });
rl.on("line", line => {
  const c = JSON.parse(line);
  console.log(`${c.id}: ${JSON.stringify(c.{field})}`);
});
'
```

---

## Reference Files

| File | Purpose |
|------|---------|
| `src/schema/country.schema.ts` | Zod validation schema with all field definitions |
| `src/types/country.ts` | TypeScript types and enum values (`WATER_BODIES`, `RIVER_SYSTEMS`, etc.) |
| `data/countries.json` | Master country list with ISO codes and name variations |
| `data/countries.jsonl` | Output file - one JSON object per line |
| `scripts/parse-wikipedia-coastline-length.js` | Best example of the parser pattern |

---

## Key Enums

From `src/types/country.ts`:

```typescript
export const WATER_BODIES = [
  "Mediterranean Sea", "Indian Ocean", "Pacific Ocean", "Atlantic Ocean",
  "South Atlantic Ocean", "Caribbean Sea", "Black Sea", "Baltic Sea",
  "South or East China Seas"
] as const;

export const RIVER_SYSTEMS = [
  "Nile", "Amazon", "Danube", "Mekong", "Ganges", "Yangtze",
  "Mississippi", "Congo", "Rhine", "Volga"
] as const;

export const FLAG_COLORS = [
  "black", "white", "grey", "pink", "red", "orange",
  "yellow", "green", "blue", "light blue", "purple", "brown"
] as const;
```

---

## Tips & Edge Cases

1. **Country name variations** - Build comprehensive mappings:
   - USA / United States / United States of America
   - UK / United Kingdom / Great Britain
   - DR Congo / Democratic Republic of the Congo
   - Côte d'Ivoire / Ivory Coast
   - Türkiye / Turkey

2. **Territories vs sovereign states** - Some pages list territories under parent country ISO codes. Be careful to only include sovereign countries in the main list.

3. **Null vs 0 vs missing** - Use appropriate defaults:
   - Rankings: `null` if not in top 20
   - Coastline: `null` for landlocked, number for coastal
   - Booleans: `false` if not in list

4. **Run tests** - After updates, run `npm test` to verify schema compliance (note: there's a pre-existing failure on line 110 for Japan's olympics_hosted empty city field).

---

## Commands

```bash
npm test                      # Run schema validation tests
npm run download:wikidata     # Re-download Wikidata if needed
npm run download:wikipedia    # Re-download Wikipedia HTML if needed
node scripts/parse-wikipedia-{topic}.js  # Run a specific parser
```
