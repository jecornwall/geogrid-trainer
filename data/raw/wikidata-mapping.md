# WikiData Property Mapping for GeoGrid Trainer

## Download Results (2024-12-03)

| Query | Records | Status |
|-------|---------|--------|
| basicInfo | 250 | ✅ Complete |
| continents | 207 | ✅ Complete |
| borders | 804 | ✅ Complete |
| languages | 144 | ✅ Complete |
| memberships | 82 | ✅ Complete |
| governmentTypes | 254 | ✅ Complete |
| timeZones | 454 | ✅ Complete |
| economic | 203 | ✅ Complete |
| drivingSide | 204 | ✅ Complete |
| landlockedCountries | 38 | ✅ Complete |
| formerUSSR | 15 | ✅ Complete |
| dependencies | 53 | ✅ Complete |
| largestCities | 34,257 | ✅ Complete |
| flagImages | 204 | ✅ Complete |
| olympicHosts | 19 | ✅ Complete |
| winterOlympicHosts | 44 | ✅ Complete |
| coastline | 0 | ❌ Use Wikipedia |
| islandCountries | 0 | ❌ Use Wikipedia |
| nuclearWeapons | 0 | ❌ Use Wikipedia |
| fifaHosts | 0 | ❌ Use Wikipedia |
| fifaWinners | 0 | ❌ Use Wikipedia |

---

## Schema Fields → WikiData Coverage

### ✅ Available from WikiData (Structured Data)

| Schema Field | WikiData Property | Notes |
|-------------|-------------------|-------|
| **Basic Info** | | |
| `id` (ISO alpha-2) | P297 | ISO 3166-1 alpha-2 |
| `name` | Label | Country label |
| `area_km2` | P2046 | Area in km² |
| **Population** | | |
| `population.count` | P1082 | Population |
| `population.density_per_km2` | Computed | area / population |
| `population.capitals` | P36 | Capital city (may have multiple) |
| `population.capitals[].population` | P1082 on capital | Population of capital |
| **Geography** | | |
| `geography.continents` | P30 | Continent |
| `geography.is_landlocked` | P610 | Landlocked (qualifier) or infer from coastline |
| `geography.coastline_km` | P2660 | Length of coastline |
| `borders.countries` | P47 | Shares border with |
| **Political** | | |
| `political.is_eu_member` | P463 = Q458 | Member of EU |
| `political.is_commonwealth_member` | P463 = Q7785 | Member of Commonwealth |
| `political.was_ussr` | P463 = Q15180 or check former USSR republics |
| `political.is_monarchy` | P122 contains monarchy | Government type |
| `political.official_languages` | P37 | Official language |
| `political.time_zones` | P421 | Time zone (UTC offset) |
| `political.observes_dst` | May need custom query | |
| **Economic** | | |
| `economic.gdp_per_capita` | P2132 | Nominal GDP per capita |
| `economic.hdi` | P1081 | Human Development Index |
| **Sports** | | |
| `sports.olympic_medals` | Various Olympic properties | |
| `sports.olympics_hosted` | P17 on Olympic event | Country hosted |
| `sports.fifa_world_cup.wins` | Check FIFA World Cup items | |

### ⚠️ Partial Coverage (May need supplementation)

| Schema Field | WikiData | Issue |
|-------------|----------|-------|
| `geography.is_island_nation` | P31 = Q23442 (island country) | May be incomplete |
| `geography.coastlines` (water bodies) | P206 | Bodies of water - needs mapping |
| `geography.river_systems` | P206 / P4552 | Rivers that flow through |
| `political.is_dependency` | P31 = Q161243 (dependent territory) | Different item types |
| `political.has_nuclear_weapons` | P3999 | Nuclear weapons inventory |
| `facts.drives_on_left` | P1622 | Driving side |

### ❌ Not Available (Still need Wikipedia HTML)

| Schema Field | Reason |
|-------------|--------|
| **Flag Properties** | |
| `flag.colors` | No structured color data |
| `flag.has_star` | No structured flag symbol data |
| `flag.has_coat_of_arms` | No structured flag content data |
| `flag.has_animal` | No structured flag content data |
| **Rankings (Top 20 lists)** | |
| `economic.wheat_production_rank` | No rank data |
| `economic.oil_production_rank` | Production data exists, but no rankings |
| `economic.renewable_energy_share_rank` | No ranking |
| `facts.obesity_rate_rank` | No ranking |
| `facts.alcohol_consumption_rank` | Consumption data may exist, no rank |
| `facts.chocolate_consumption_rank` | No data |
| `facts.rail_network_rank` | Rail length exists (P1907), no rank |
| `facts.tourist_arrivals_rank` | No ranking |
| `facts.world_heritage_sites_rank` | Count may exist, no rank |
| `facts.lakes_count_rank` | No data |
| **Other Facts** | |
| `facts.skyscraper_count` | No structured data |
| `facts.has_alcohol_prohibition` | No structured data |
| `facts.air_pollution_pm25` | No structured data |
| `facts.co2_emissions_per_capita` | May exist but inconsistent |
| **Sports Details** | |
| `sports.f1_hosted` | Need to check F1 circuit locations |
| **Political Details** | |
| `political.corruption_perceptions_index` | May exist but outdated |
| `political.same_sex_marriage_legal` | May exist (P2671) |
| `political.same_sex_activities_illegal` | May exist |
| **Geographic Details** | |
| `geography.touches_equator` | Need spatial query |
| `geography.touches_eurasian_steppe` | No structured data |
| `geography.touches_sahara` | No structured data |

## WikiData Entity IDs

### Organizations
- Q458 = European Union
- Q7785 = Commonwealth of Nations  
- Q15180 = Soviet Union (for "was part of")

### Continents
- Q15 = Africa
- Q48 = Asia
- Q46 = Europe
- Q49 = North America
- Q18 = South America
- Q538 = Oceania

### Government Types (for monarchy detection)
- Q41614 = constitutional monarchy
- Q30461 = absolute monarchy
- Q178702 = federal monarchy

### Languages (for filtering official languages)
- Q1860 = English
- Q1321 = Spanish
- Q150 = French
- Q13955 = Arabic
- Q5146 = Portuguese

## Recommended Strategy

### Phase 1: WikiData SPARQL (Fast, Structured)
Download all available structured data in a few queries:
- Basic country info (name, ISO, area, population, GDP, HDI)
- Capitals and their populations
- Borders (P47)
- Continents (P30)
- Official languages (P37)
- Organization memberships (EU, Commonwealth)
- Government types (for monarchy detection)
- Time zones (P421)

### Phase 2: Wikipedia HTML (Only where needed)
Use downloaded HTML only for:
- Flag properties (parse flag design page)
- Ranking data (top 20 lists)
- Specific facts (skyscrapers, alcohol prohibition, etc.)
- Geographic regions (equator, Sahara, steppe)

This approach reduces ~250 individual country page downloads to just a few SPARQL queries.

