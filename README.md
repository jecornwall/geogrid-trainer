# GeoGrid Trainer

A geography training app to help practice for [GeoGuessr](https://www.geoguessr.com/) and similar geography games. Features an interactive world map where clicking any country displays comprehensive facts and statistics.

<!-- Add a screenshot: ![GeoGrid Trainer Screenshot](docs/screenshot.png) -->

## Features

- 🗺️ Interactive world map powered by Leaflet
- 🏳️ Country fact panels with flags, geography, population, political info, and more
- 🔍 Filter panel to highlight countries matching specific criteria
- 📊 Data sourced from Wikidata and Wikipedia
- ⚡ Static deployment - no backend required
- 🎨 Dark theme with responsive design
- 💾 Filter settings persist across sessions

## Filter Panel

The left sidebar contains filters to highlight countries matching specific criteria. This is useful for practicing GeoGrid categories.

### Available Filters

- **Bordering Countries**: Filter by number of land borders (0-14 range slider)

### Using Filters

1. **Enable/Disable**: Each filter has a toggle switch to turn it on or off
2. **Adjust Range**: Use the dual-thumb slider to set min/max values
3. **Combine Filters**: Enable multiple filters to find countries matching ALL criteria
4. **View Results**: The summary shows how many countries match your active filters

Matching countries are highlighted on the map with a distinct cyan color.

### Persistence

Filter settings (ranges and toggle states) are saved to localStorage and restored when you return to the app.

### Responsive Layout

- **Desktop (>900px)**: Three-column layout with filter panel on the left, map in the center, and details panel on the right
- **Mobile (≤900px)**: Filter panel becomes a slide-out drawer (tap the ⚙ button), details panel slides up from the bottom when a country is selected

## Project Structure

```
geogrid-trainer/
├── data/
│   ├── countries.json          # Master country list with ISO codes
│   ├── countries.jsonl         # Full country data (one JSON per line)
│   ├── categories/             # GeoGrid category definitions
│   └── raw/
│       ├── wikidata/           # SPARQL query results (JSON)
│       └── wikipedia/          # Downloaded HTML pages
├── scripts/
│   ├── download-wikidata.js    # Fetch data from Wikidata SPARQL
│   ├── download-raw-data.js    # Download Wikipedia HTML pages
│   ├── parse-raw-data.js       # Parse Wikidata → countries.jsonl
│   └── parse-wikipedia-*.js    # Parse specific Wikipedia pages
├── src/
│   ├── schema/                 # Zod validation schemas
│   └── types/                  # TypeScript type definitions
├── web/                        # Frontend application
│   ├── src/
│   │   ├── main.ts             # Map initialization & filter logic
│   │   ├── popup.ts            # Country popup rendering
│   │   ├── style.css           # Styles including filter panel
│   │   └── data/
│   │       └── display-config.json  # Controls which fields are shown
│   ├── index.html              # Main HTML with filter panel structure
│   └── dist/                   # Production build output
└── NEXT-TASK-PARSE-DATA.md     # Parsing progress & instructions
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Install root dependencies (for data scripts)
npm install

# Install web dependencies
cd web && npm install
```

### Run the Web App

```bash
cd web

# Development server (hot reload)
npm run dev
# → Opens at http://localhost:5173

# Production build
npm run build
# → Output in web/dist/
```

### Deploy

The `web/dist/` folder contains static files ready for deployment to any static host:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront
- Any web server

## Data Pipeline

Country data flows through several stages:

```
Wikidata SPARQL → data/raw/wikidata/*.json
Wikipedia HTML  → data/raw/wikipedia/*.html
                      ↓
              parse-raw-data.js
              parse-wikipedia-*.js
                      ↓
              data/countries.jsonl
                      ↓
              web/public/countries.json (build step)
```

### Downloading Raw Data

```bash
# Download all raw data
npm run download

# Or download specific sources:
npm run download:wikidata      # Wikidata SPARQL queries
npm run download:wikipedia     # Wikipedia HTML pages
npm run download:countries     # Country list only
```

### Parsing Data

The main parser combines Wikidata sources:

```bash
node scripts/parse-raw-data.js
```

Individual Wikipedia parsers update specific fields:

```bash
node scripts/parse-wikipedia-flags.js
node scripts/parse-wikipedia-olympic-medals.js
node scripts/parse-wikipedia-island-countries.js
node scripts/parse-wikipedia-coastline-length.js
# ... see scripts/ for more
```

### Display Configuration

The web app uses `web/src/data/display-config.json` to control which fields are shown. After parsing new data:

1. Update the relevant field to `true` in `display-config.json`
2. Rebuild: `cd web && npm run build`

See `NEXT-TASK-PARSE-DATA.md` for detailed parsing instructions and progress.

## Testing

```bash
# Run schema validation tests
npm test

# Watch mode
npm run test:watch
```

## Data Schema

Country data follows the schema in `src/types/country.ts`:

```typescript
interface Country {
  id: string;                    // ISO 3166-1 alpha-2 code
  name: string;
  flag_image_url: string;
  flag: FlagProperties;
  geography: GeographyProperties;
  borders: BorderProperties;
  political: PoliticalProperties;
  population: PopulationProperties;
  area_km2: number;
  economic: EconomicProperties;
  facts: FactsProperties;
  sports: SportsProperties;
}
```

See `src/schema/country.schema.ts` for the full Zod validation schema.

## Tech Stack

**Data Processing:**
- Node.js with ES modules
- Playwright (for web scraping)
- Zod (schema validation)
- Vitest (testing)

**Web App:**
- Vite (build tool)
- TypeScript
- Leaflet (mapping)
- Vanilla JS (no framework)

## Contributing

1. Check `NEXT-TASK-PARSE-DATA.md` for unparsed data sources
2. Create a new parser in `scripts/parse-wikipedia-{topic}.js`
3. Update `web/src/data/display-config.json` to enable the new fields
4. Run tests: `npm test`
5. Rebuild web: `cd web && npm run build`

## License

MIT

