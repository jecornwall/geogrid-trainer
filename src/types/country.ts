/**
 * Country data schema for GeoGrid Trainer
 * 
 * This schema is designed to support all category queries from the GeoGrid game
 * while storing data in a normalized form that allows category membership to be
 * derived rather than stored redundantly.
 */

// === ENUM TYPES ===

export const FLAG_COLORS = [
  "black",
  "white", 
  "grey",
  "pink",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "light blue",
  "purple",
  "brown",
] as const;

export type FlagColor = (typeof FLAG_COLORS)[number];

export const CONTINENTS = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
] as const;

export type Continent = (typeof CONTINENTS)[number];

export const WATER_BODIES = [
  "Mediterranean Sea",
  "Indian Ocean",
  "Pacific Ocean",
  "Atlantic Ocean",
  "South Atlantic Ocean",
  "North Atlantic Ocean",
  "Caribbean Sea",
  "Black Sea",
  "Baltic Sea",
  "South or East China Seas",
] as const;

export type WaterBody = (typeof WATER_BODIES)[number];

export const RIVER_SYSTEMS = [
  "Nile",
  "Amazon",
  "Danube",
  "Congo",
  "Niger",
  "Rhine",
  "Mekong",
  "Zambezi",
] as const;

export type RiverSystem = (typeof RIVER_SYSTEMS)[number];

export const OFFICIAL_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "Arabic",
  "Portuguese",
] as const;

export type OfficialLanguage = (typeof OFFICIAL_LANGUAGES)[number];

export const OLYMPIC_TYPES = ["Summer", "Winter"] as const;

export type OlympicType = (typeof OLYMPIC_TYPES)[number];

// === NESTED TYPES ===

export interface FlagProperties {
  /** Colors present in the flag from the recognized color set */
  colors: FlagColor[];
  /** Flag contains a star or sun symbol */
  has_star: boolean;
  /** Flag contains a coat of arms, national emblem, or seal */
  has_coat_of_arms: boolean;
  /** Flag contains a depiction of an animal (including humans) */
  has_animal: boolean;
}

export interface GeographyProperties {
  /** Continent(s) the country is located in. Array for transcontinental countries. */
  continents: Continent[];
  /** Country is entirely surrounded by water (composed of islands) */
  is_island_nation: boolean;
  /** Country has no coastline */
  is_landlocked: boolean;
  /** Length of coastline in kilometers. Null if landlocked. */
  coastline_km: number | null;
  /** Water bodies the country has coastline on */
  coastlines: WaterBody[];
  /** Major river systems that flow through the country */
  river_systems: RiverSystem[];
  /** Country is crossed by or touches the equator */
  touches_equator: boolean;
  /** Country lies within or borders the Eurasian Steppe */
  touches_eurasian_steppe: boolean;
  /** Country lies within or borders the Sahara Desert */
  touches_sahara: boolean;
}

export interface BorderProperties {
  /** ISO codes of countries that share a land border */
  countries: string[];
}

export interface PoliticalProperties {
  /** Member of the European Union */
  is_eu_member: boolean;
  /** Member of the Commonwealth of Nations */
  is_commonwealth_member: boolean;
  /** Was a republic of the Soviet Union */
  was_ussr: boolean;
  /** Country is governed by a monarchy */
  is_monarchy: boolean;
  /** Country is a dependency or territory of another nation */
  is_dependency: boolean;
  /** Country possesses nuclear weapons */
  has_nuclear_weapons: boolean;
  /** Official languages from the tracked set */
  official_languages: OfficialLanguage[];
  /** Same-sex marriage is legally performed and recognized */
  same_sex_marriage_legal: boolean;
  /** Same-sex activities are classified as criminal offense */
  same_sex_activities_illegal: boolean;
  /** Corruption Perceptions Index score (0-100, higher = less corrupt) */
  corruption_perceptions_index: number;
  /** UTC time zone offsets observed (e.g., ["UTC+0", "UTC+1"]) */
  time_zones: string[];
  /** Country observes daylight saving time */
  observes_dst: boolean;
}

export interface Capital {
  /** Name of the capital city */
  name: string;
  /** Population of the capital city */
  population: number;
}

export interface PopulationProperties {
  /** Total country population */
  count: number;
  /** Population density (people per km²) */
  density_per_km2: number;
  /** Capital city or cities (some countries have multiple) */
  capitals: Capital[];
  /** Name of the most populated city */
  most_populated_city: string;
}

export interface EconomicProperties {
  /** GDP per capita in USD */
  gdp_per_capita: number;
  /** Human Development Index (0-1 scale) */
  hdi: number;
  /** Country generates electricity using nuclear reactors */
  produces_nuclear_power: boolean;
  /** Rank in wheat production (null if not in top producers) */
  wheat_production_rank: number | null;
  /** Rank in oil production (null if not in top producers) */
  oil_production_rank: number | null;
  /** Rank in renewable energy share (null if not in top producers) */
  renewable_energy_share_rank: number | null;
}

export interface FactsProperties {
  /** Country follows left-hand traffic rules */
  drives_on_left: boolean;
  /** Number of skyscrapers in the country */
  skyscraper_count: number;
  /** Country enforces alcohol prohibition */
  has_alcohol_prohibition: boolean;
  /** PM2.5 concentration in μg/m³ */
  air_pollution_pm25: number;
  /** CO₂ emissions in metric tons per capita per year */
  co2_emissions_per_capita: number;
  /** Rank in obesity rate (null if not in top 20) */
  obesity_rate_rank: number | null;
  /** Rank in alcohol consumption (null if not in top 20) */
  alcohol_consumption_rank: number | null;
  /** Rank in chocolate consumption (null if not in top 20) */
  chocolate_consumption_rank: number | null;
  /** Rank in rail network size (null if not in top 20) */
  rail_network_rank: number | null;
  /** Rank in population density - positive for top, negative for bottom (null if not ranked) */
  population_density_rank: number | null;
  /** Rank in annual tourist arrivals (null if not in top 20) */
  tourist_arrivals_rank: number | null;
  /** Rank in number of World Heritage sites (null if not in top 20) */
  world_heritage_sites_rank: number | null;
  /** Rank in number of lakes (null if not in top 10) */
  lakes_count_rank: number | null;
}

export interface OlympicEvent {
  /** Year the Olympics were held */
  year: number;
  /** Type of Olympics (Summer or Winter) */
  type: OlympicType;
  /** Host city */
  city: string;
}

export interface OlympicMedals {
  /** Total medal count across all Olympic games */
  total: number;
  /** Gold medals (optional breakdown) */
  gold?: number;
  /** Silver medals (optional breakdown) */
  silver?: number;
  /** Bronze medals (optional breakdown) */
  bronze?: number;
}

export interface FifaWorldCupProperties {
  /** Years the country hosted the FIFA World Cup */
  hosted: number[];
  /** Country has played in the FIFA World Cup */
  played: boolean;
  /** Number of FIFA World Cup wins */
  wins: number;
}

export interface SportsProperties {
  /** Olympic medal statistics */
  olympic_medals: OlympicMedals;
  /** Olympic Games hosted by this country */
  olympics_hosted: OlympicEvent[];
  /** FIFA World Cup statistics */
  fifa_world_cup: FifaWorldCupProperties;
  /** Country has hosted a Formula 1 Grand Prix */
  f1_hosted: boolean;
}

// === MAIN COUNTRY TYPE ===

export interface Country {
  /** ISO 3166-1 alpha-2 code (e.g., "US", "GB", "JP") */
  id: string;
  /** Official short name of the country */
  name: string;
  /** URL or path to the flag image */
  flag_image_url: string;
  /** Flag visual properties */
  flag: FlagProperties;
  /** Geographic properties */
  geography: GeographyProperties;
  /** Land border relationships */
  borders: BorderProperties;
  /** Political properties and memberships */
  political: PoliticalProperties;
  /** Population statistics */
  population: PopulationProperties;
  /** Land area in square kilometers */
  area_km2: number;
  /** Economic indicators */
  economic: EconomicProperties;
  /** Miscellaneous facts and rankings */
  facts: FactsProperties;
  /** Sports statistics and hosting history */
  sports: SportsProperties;
}

