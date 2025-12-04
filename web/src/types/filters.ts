/**
 * Filter system types for GeoGrid Trainer
 */

import type { Continent, OfficialLanguage } from './country';

// Filter value types
export type BooleanFilterValue = boolean | null; // null = not filtering
export type RangeFilterValue = { min: number; max: number };
export type MultiSelectFilterValue<T> = T[];

// Individual filter configurations
export interface BooleanFilter {
  type: 'boolean';
  enabled: boolean;
  value: BooleanFilterValue;
}

export interface RangeFilter {
  type: 'range';
  enabled: boolean;
  min: number;
  max: number;
  // Bounds for the slider
  minBound: number;
  maxBound: number;
  step?: number;
  // For display formatting
  format?: 'number' | 'compact' | 'percent' | 'decimal';
}

export interface MultiSelectFilter<T = string> {
  type: 'multiselect';
  enabled: boolean;
  selected: T[];
  options: T[];
}

export type Filter = BooleanFilter | RangeFilter | MultiSelectFilter;

// Complete filter state structure matching display-config.json
export interface FilterState {
  geography: {
    continents: MultiSelectFilter<Continent>;
    is_island_nation: BooleanFilter;
    is_landlocked: BooleanFilter;
    coastline_km: RangeFilter;
  };
  flag: {
    has_star: BooleanFilter;
    has_coat_of_arms: BooleanFilter;
    has_animal: BooleanFilter;
  };
  borders: {
    countries: RangeFilter;
  };
  political: {
    is_eu_member: BooleanFilter;
    is_commonwealth_member: BooleanFilter;
    was_ussr: BooleanFilter;
    is_monarchy: BooleanFilter;
    is_dependency: BooleanFilter;
    official_languages: MultiSelectFilter<OfficialLanguage>;
    time_zones: RangeFilter; // Number of time zones
  };
  population: {
    count: RangeFilter;
    density_per_km2: RangeFilter;
    capital_not_largest: BooleanFilter;
  };
  area_km2: RangeFilter;
  economic: {
    gdp_per_capita: RangeFilter;
    hdi: RangeFilter;
  };
  facts: {
    drives_on_left: BooleanFilter;
  };
  sports: {
    olympic_medals: RangeFilter;
    has_hosted_olympics: BooleanFilter;
  };
}

// Display configuration structure
export interface DisplayConfig {
  geography: {
    continents: boolean;
    is_island_nation: boolean;
    is_landlocked: boolean;
    coastline_km: boolean;
    coastlines: boolean;
    river_systems: boolean;
    touches_equator: boolean;
    touches_eurasian_steppe: boolean;
    touches_sahara: boolean;
  };
  flag: {
    colors: boolean;
    has_star: boolean;
    has_coat_of_arms: boolean;
    has_animal: boolean;
  };
  borders: {
    countries: boolean;
  };
  political: {
    is_eu_member: boolean;
    is_commonwealth_member: boolean;
    was_ussr: boolean;
    is_monarchy: boolean;
    is_dependency: boolean;
    has_nuclear_weapons: boolean;
    official_languages: boolean;
    same_sex_marriage_legal: boolean;
    same_sex_activities_illegal: boolean;
    corruption_perceptions_index: boolean;
    time_zones: boolean;
    observes_dst: boolean;
  };
  population: {
    count: boolean;
    density_per_km2: boolean;
    capitals: boolean;
    most_populated_city: boolean;
  };
  area_km2: boolean;
  economic: {
    gdp_per_capita: boolean;
    hdi: boolean;
    produces_nuclear_power: boolean;
    wheat_production_rank: boolean;
    oil_production_rank: boolean;
    renewable_energy_share_rank: boolean;
  };
  facts: {
    drives_on_left: boolean;
    skyscraper_count: boolean;
    has_alcohol_prohibition: boolean;
    air_pollution_pm25: boolean;
    co2_emissions_per_capita: boolean;
    obesity_rate_rank: boolean;
    alcohol_consumption_rank: boolean;
    chocolate_consumption_rank: boolean;
    rail_network_rank: boolean;
    population_density_rank: boolean;
    tourist_arrivals_rank: boolean;
    world_heritage_sites_rank: boolean;
    lakes_count_rank: boolean;
  };
  sports: {
    olympic_medals: boolean;
    olympics_hosted: boolean;
    fifa_world_cup: {
      hosted: boolean;
      played: boolean;
      wins: boolean;
    };
    f1_hosted: boolean;
  };
}

// Filter metadata for UI generation
export interface FilterMetadata {
  id: string;
  label: string;
  category: string;
  categoryLabel: string;
}

