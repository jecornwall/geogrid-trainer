/**
 * Configuration for which country properties to display in the UI.
 * Only fields that have been parsed and contain real data should be set to true.
 */

export interface FifaWorldCupDisplayConfig {
  hosted: boolean;
  played: boolean;
  wins: boolean;
}

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
    fifa_world_cup: FifaWorldCupDisplayConfig;
    f1_hosted: boolean;
  };
}

