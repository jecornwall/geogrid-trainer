/**
 * Zod schema for runtime validation of Country data
 * 
 * This schema mirrors the TypeScript types in types/country.ts but provides
 * runtime validation for loading data from JSONL files.
 */

import { z } from "zod";
import {
  FLAG_COLORS,
  CONTINENTS,
  WATER_BODIES,
  RIVER_SYSTEMS,
  OFFICIAL_LANGUAGES,
  OLYMPIC_TYPES,
} from "../types/country.js";

// === ENUM SCHEMAS ===

export const FlagColorSchema = z.enum(FLAG_COLORS);
export const ContinentSchema = z.enum(CONTINENTS);
export const WaterBodySchema = z.enum(WATER_BODIES);
export const RiverSystemSchema = z.enum(RIVER_SYSTEMS);
export const OfficialLanguageSchema = z.enum(OFFICIAL_LANGUAGES);
export const OlympicTypeSchema = z.enum(OLYMPIC_TYPES);

// === NESTED SCHEMAS ===

export const FlagPropertiesSchema = z.object({
  colors: z.array(FlagColorSchema),
  has_star: z.boolean(),
  has_coat_of_arms: z.boolean(),
  has_animal: z.boolean(),
});

export const GeographyPropertiesSchema = z.object({
  continents: z.array(ContinentSchema).min(1),
  is_island_nation: z.boolean(),
  is_landlocked: z.boolean(),
  coastline_km: z.number().nonnegative().nullable(),
  coastlines: z.array(WaterBodySchema),
  river_systems: z.array(RiverSystemSchema),
  touches_equator: z.boolean(),
  touches_eurasian_steppe: z.boolean(),
  touches_sahara: z.boolean(),
});

export const BorderPropertiesSchema = z.object({
  countries: z.array(z.string()),
});

export const PoliticalPropertiesSchema = z.object({
  is_eu_member: z.boolean(),
  is_commonwealth_member: z.boolean(),
  was_ussr: z.boolean(),
  is_monarchy: z.boolean(),
  is_dependency: z.boolean(),
  has_nuclear_weapons: z.boolean(),
  official_languages: z.array(OfficialLanguageSchema),
  same_sex_marriage_legal: z.boolean(),
  same_sex_activities_illegal: z.boolean(),
  corruption_perceptions_index: z.number().min(0).max(100),
  time_zones: z.array(z.string()),
  observes_dst: z.boolean(),
});

export const CapitalSchema = z.object({
  name: z.string().min(1),
  population: z.number().nonnegative(),
});

export const PopulationPropertiesSchema = z.object({
  count: z.number().nonnegative(),
  density_per_km2: z.number().nonnegative(),
  capitals: z.array(CapitalSchema).min(1),
  most_populated_city: z.string().min(1),
});

export const EconomicPropertiesSchema = z.object({
  gdp_per_capita: z.number().nonnegative(),
  hdi: z.number().min(0).max(1),
  produces_nuclear_power: z.boolean(),
  wheat_production_rank: z.number().positive().nullable(),
  oil_production_rank: z.number().positive().nullable(),
  renewable_energy_share_rank: z.number().positive().nullable(),
});

export const FactsPropertiesSchema = z.object({
  drives_on_left: z.boolean(),
  skyscraper_count: z.number().nonnegative(),
  has_alcohol_prohibition: z.boolean(),
  air_pollution_pm25: z.number().nonnegative(),
  co2_emissions_per_capita: z.number().nonnegative(),
  obesity_rate_rank: z.number().positive().nullable(),
  alcohol_consumption_rank: z.number().positive().nullable(),
  chocolate_consumption_rank: z.number().positive().nullable(),
  rail_network_rank: z.number().positive().nullable(),
  population_density_rank: z.number().int().nullable(),
  tourist_arrivals_rank: z.number().positive().nullable(),
  world_heritage_sites_rank: z.number().positive().nullable(),
  lakes_count_rank: z.number().positive().nullable(),
});

export const OlympicEventSchema = z.object({
  year: z.number().int().min(1896),
  type: OlympicTypeSchema,
  city: z.string().min(1),
});

export const OlympicMedalsSchema = z.object({
  total: z.number().nonnegative(),
  gold: z.number().nonnegative().optional(),
  silver: z.number().nonnegative().optional(),
  bronze: z.number().nonnegative().optional(),
});

export const FifaWorldCupPropertiesSchema = z.object({
  hosted: z.array(z.number().int().min(1930)),
  played: z.boolean(),
  wins: z.number().nonnegative(),
});

export const SportsPropertiesSchema = z.object({
  olympic_medals: OlympicMedalsSchema,
  olympics_hosted: z.array(OlympicEventSchema),
  fifa_world_cup: FifaWorldCupPropertiesSchema,
  f1_hosted: z.boolean(),
});

// === MAIN COUNTRY SCHEMA ===

export const CountrySchema = z.object({
  id: z.string().min(2).max(3),
  name: z.string().min(1),
  flag_image_url: z.string().min(1),
  flag: FlagPropertiesSchema,
  geography: GeographyPropertiesSchema,
  borders: BorderPropertiesSchema,
  political: PoliticalPropertiesSchema,
  population: PopulationPropertiesSchema,
  area_km2: z.number().positive(),
  economic: EconomicPropertiesSchema,
  facts: FactsPropertiesSchema,
  sports: SportsPropertiesSchema,
});

// === VALIDATION HELPERS ===

/**
 * Parse and validate a single country record
 */
export function parseCountry(data: unknown) {
  return CountrySchema.parse(data);
}

/**
 * Safely parse a country record, returning success/error result
 */
export function safeParseCountry(data: unknown) {
  return CountrySchema.safeParse(data);
}

/**
 * Parse multiple country records from an array
 */
export function parseCountries(data: unknown[]) {
  return z.array(CountrySchema).parse(data);
}

/**
 * Parse a JSONL string into an array of validated Country records
 */
export function parseCountriesFromJsonl(jsonlContent: string) {
  const lines = jsonlContent.trim().split("\n").filter(line => line.trim());
  const countries = lines.map((line, index) => {
    try {
      const parsed = JSON.parse(line);
      return parseCountry(parsed);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Validation error on line ${index + 1}: ${error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ")}`
        );
      }
      throw new Error(`JSON parse error on line ${index + 1}: ${error}`);
    }
  });
  return countries;
}

