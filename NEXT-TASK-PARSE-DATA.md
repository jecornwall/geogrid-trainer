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
Located in `data/raw/wikipedia/`:
- `flags-design.html` - Parse for: flag colors, has_star, has_coat_of_arms, has_animal
- `island-countries.html` - Parse for: is_island_nation list
- Various ranking lists (top 20s) for: wheat, oil, renewable energy, obesity, alcohol, chocolate, rail networks, tourist arrivals, world heritage sites, lakes, population density
- `olympic-medals.html` - All-time medal counts
- `fifa-hosts.html`, `fifa-appearances.html`, `fifa-finals.html` - FIFA World Cup data
- `f1-grands-prix.html` - F1 host countries
- Geographic pages for: touches_equator, touches_eurasian_steppe, touches_sahara
- `same-sex-marriage.html`, `criminalization-homosexuality.html` - Same-sex laws
- `corruption-index.html` - CPI scores
- `daylight-saving.html` - DST observance
- `nuclear-power.html` - Nuclear power producers
- `nuclear-weapons.html` - Nuclear weapons states (if Wikidata failed)
- `skyscrapers.html` - Skyscraper counts
- `alcohol-prohibition.html` - Prohibition countries
- `air-pollution.html`, `co2-emissions.html` - Environmental data

## Schema Reference

The target schema is defined in:
- `src/types/country.ts` - TypeScript interfaces
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

## Existing Example

See `data/countries.jsonl` for 3 example records (GB, JP, BR) showing the expected format.

## Recommended Approach

1. **Create a parser script** (`scripts/parse-raw-data.js` or TypeScript)

2. **Start with Wikidata** - Process the structured JSON first:
   - Build a Map<ISO2, CountryData> from basicInfo.json
   - Merge in borders, continents, languages, memberships, etc.
   - Use largestCities.json to find most_populated_city per country

3. **Then parse Wikipedia HTML** - Use a DOM parser (like cheerio) for:
   - Flag properties from flags-design.html tables
   - Ranking data from list tables
   - Boolean fields from various list pages

4. **Handle edge cases**:
   - Countries with multiple capitals (e.g., South Africa, Bolivia)
   - Transcontinental countries (e.g., Russia, Turkey, Egypt)
   - Missing data (use null for nullable fields, reasonable defaults otherwise)
   - Country name variations between sources

5. **Validate output** using the Zod schema before writing

6. **Run existing tests** (`npm test`) to verify schema compliance

## Country List

Use `data/countries.json` as the master list of ~250 countries/territories with their ISO codes.

## Output

Generate `data/countries.jsonl` with one JSON object per line, sorted alphabetically by country name.

## Commands Available

```bash
npm test          # Run schema validation tests
npm run download:wikidata    # Re-download Wikidata if needed
npm run download:wikipedia   # Re-download Wikipedia HTML if needed
```

## Notes

- The Wikidata JSON uses SPARQL result format with `results.bindings[]` arrays
- Each binding has fields like `{ "value": "...", "type": "literal" }`
- Some Wikidata queries returned 0 results (coastline, nuclearWeapons, fifaHosts, fifaWinners) - use Wikipedia HTML for these
- Flag colors must match the enum: black, white, grey, pink, red, orange, yellow, green, blue, light blue, purple, brown
- Rankings are stored as positive integers (1-20) or null if not in top 20
- population_density_rank can be negative for bottom 20

