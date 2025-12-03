/**
 * Country data types for GeoGrid Trainer
 * Simplified version for the web UI
 */

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

export interface FlagProperties {
  colors: FlagColor[];
  has_star: boolean;
  has_coat_of_arms: boolean;
  has_animal: boolean;
}

export interface GeographyProperties {
  continents: Continent[];
  is_island_nation: boolean;
  is_landlocked: boolean;
  coastline_km: number | null;
  coastlines: WaterBody[];
  river_systems: RiverSystem[];
  touches_equator: boolean;
  touches_eurasian_steppe: boolean;
  touches_sahara: boolean;
}

export interface BorderProperties {
  countries: string[];
}

export interface PoliticalProperties {
  is_eu_member: boolean;
  is_commonwealth_member: boolean;
  was_ussr: boolean;
  is_monarchy: boolean;
  is_dependency: boolean;
  has_nuclear_weapons: boolean;
  official_languages: OfficialLanguage[];
  same_sex_marriage_legal: boolean;
  same_sex_activities_illegal: boolean;
  corruption_perceptions_index: number;
  time_zones: string[];
  observes_dst: boolean;
}

export interface Capital {
  name: string;
  population: number;
}

export interface PopulationProperties {
  count: number;
  density_per_km2: number;
  capitals: Capital[];
  most_populated_city: string;
}

export interface EconomicProperties {
  gdp_per_capita: number;
  hdi: number;
  produces_nuclear_power: boolean;
  wheat_production_rank: number | null;
  oil_production_rank: number | null;
  renewable_energy_share_rank: number | null;
}

export interface FactsProperties {
  drives_on_left: boolean;
  skyscraper_count: number;
  has_alcohol_prohibition: boolean;
  air_pollution_pm25: number;
  co2_emissions_per_capita: number;
  obesity_rate_rank: number | null;
  alcohol_consumption_rank: number | null;
  chocolate_consumption_rank: number | null;
  rail_network_rank: number | null;
  population_density_rank: number | null;
  tourist_arrivals_rank: number | null;
  world_heritage_sites_rank: number | null;
  lakes_count_rank: number | null;
}

export interface OlympicEvent {
  year: number;
  type: "Summer" | "Winter";
  city: string;
}

export interface OlympicMedals {
  total: number;
  gold?: number;
  silver?: number;
  bronze?: number;
}

export interface FifaWorldCupProperties {
  hosted: number[];
  played: boolean;
  wins: number;
}

export interface SportsProperties {
  olympic_medals: OlympicMedals;
  olympics_hosted: OlympicEvent[];
  fifa_world_cup: FifaWorldCupProperties;
  f1_hosted: boolean;
}

export interface Country {
  id: string;
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

