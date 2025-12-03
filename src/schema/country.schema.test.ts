import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  parseCountry,
  safeParseCountry,
  parseCountriesFromJsonl,
  CountrySchema,
} from "./country.schema.js";
import type { Country } from "../types/country.js";

// Path to the test data file
const COUNTRIES_JSONL_PATH = resolve(
  import.meta.dirname,
  "../../data/countries.jsonl"
);

describe("Country Schema Validation", () => {
  describe("parseCountriesFromJsonl", () => {
    it("should load and validate all countries from JSONL file", () => {
      const jsonlContent = readFileSync(COUNTRIES_JSONL_PATH, "utf-8");
      const countries = parseCountriesFromJsonl(jsonlContent);

      expect(countries).toBeInstanceOf(Array);
      expect(countries.length).toBe(3);

      // Verify each country has required fields
      for (const country of countries) {
        expect(country.id).toBeDefined();
        expect(country.name).toBeDefined();
        expect(country.flag).toBeDefined();
        expect(country.geography).toBeDefined();
        expect(country.borders).toBeDefined();
        expect(country.political).toBeDefined();
        expect(country.population).toBeDefined();
        expect(country.economic).toBeDefined();
        expect(country.facts).toBeDefined();
        expect(country.sports).toBeDefined();
      }
    });

    it("should correctly parse United Kingdom data", () => {
      const jsonlContent = readFileSync(COUNTRIES_JSONL_PATH, "utf-8");
      const countries = parseCountriesFromJsonl(jsonlContent);
      const uk = countries.find((c) => c.id === "GB");

      expect(uk).toBeDefined();
      expect(uk!.name).toBe("United Kingdom");
      expect(uk!.flag.colors).toEqual(["red", "white", "blue"]);
      expect(uk!.flag.has_star).toBe(false);
      expect(uk!.geography.is_island_nation).toBe(true);
      expect(uk!.geography.continents).toContain("Europe");
      expect(uk!.political.is_monarchy).toBe(true);
      expect(uk!.political.has_nuclear_weapons).toBe(true);
      expect(uk!.sports.fifa_world_cup.wins).toBe(1);
      expect(uk!.sports.olympics_hosted.length).toBe(3);
    });

    it("should correctly parse Japan data", () => {
      const jsonlContent = readFileSync(COUNTRIES_JSONL_PATH, "utf-8");
      const countries = parseCountriesFromJsonl(jsonlContent);
      const japan = countries.find((c) => c.id === "JP");

      expect(japan).toBeDefined();
      expect(japan!.name).toBe("Japan");
      expect(japan!.flag.colors).toEqual(["red", "white"]);
      expect(japan!.geography.is_island_nation).toBe(true);
      expect(japan!.borders.countries).toHaveLength(0);
      expect(japan!.political.official_languages).toHaveLength(0);
      expect(japan!.facts.drives_on_left).toBe(true);
      expect(japan!.sports.olympics_hosted.length).toBe(4);
    });

    it("should correctly parse Brazil data", () => {
      const jsonlContent = readFileSync(COUNTRIES_JSONL_PATH, "utf-8");
      const countries = parseCountriesFromJsonl(jsonlContent);
      const brazil = countries.find((c) => c.id === "BR");

      expect(brazil).toBeDefined();
      expect(brazil!.name).toBe("Brazil");
      expect(brazil!.flag.colors).toContain("green");
      expect(brazil!.flag.has_star).toBe(true);
      expect(brazil!.geography.touches_equator).toBe(true);
      expect(brazil!.geography.river_systems).toContain("Amazon");
      expect(brazil!.borders.countries.length).toBe(10);
      expect(brazil!.political.time_zones.length).toBe(4);
      expect(brazil!.sports.fifa_world_cup.wins).toBe(5);
      expect(brazil!.population.most_populated_city).toBe("São Paulo");
    });
  });

  describe("parseCountry", () => {
    it("should reject invalid country data", () => {
      const invalidData = {
        id: "XX",
        name: "Invalid Country",
        // Missing required fields
      };

      expect(() => parseCountry(invalidData)).toThrow();
    });

    it("should reject invalid flag colors", () => {
      const invalidData = createMinimalCountry({
        flag: {
          colors: ["red", "invalid_color" as any],
          has_star: false,
          has_coat_of_arms: false,
          has_animal: false,
        },
      });

      expect(() => parseCountry(invalidData)).toThrow();
    });

    it("should reject invalid continent", () => {
      const invalidData = createMinimalCountry({
        geography: {
          continents: ["Invalid Continent" as any],
          is_island_nation: false,
          is_landlocked: false,
          coastline_km: 100,
          coastlines: [],
          river_systems: [],
          touches_equator: false,
          touches_eurasian_steppe: false,
          touches_sahara: false,
        },
      });

      expect(() => parseCountry(invalidData)).toThrow();
    });

    it("should reject HDI values outside 0-1 range", () => {
      const invalidData = createMinimalCountry({
        economic: {
          gdp_per_capita: 10000,
          hdi: 1.5, // Invalid: > 1
          produces_nuclear_power: false,
          wheat_production_rank: null,
          oil_production_rank: null,
          renewable_energy_share_rank: null,
        },
      });

      expect(() => parseCountry(invalidData)).toThrow();
    });

    it("should reject CPI values outside 0-100 range", () => {
      const invalidData = createMinimalCountry({
        political: {
          is_eu_member: false,
          is_commonwealth_member: false,
          was_ussr: false,
          is_monarchy: false,
          is_dependency: false,
          has_nuclear_weapons: false,
          official_languages: [],
          same_sex_marriage_legal: false,
          same_sex_activities_illegal: false,
          corruption_perceptions_index: 150, // Invalid: > 100
          time_zones: ["UTC+0"],
          observes_dst: false,
        },
      });

      expect(() => parseCountry(invalidData)).toThrow();
    });

    it("should reject negative population", () => {
      const invalidData = createMinimalCountry({
        population: {
          count: -1000,
          density_per_km2: 100,
          capitals: [{ name: "Capital", population: 100000 }],
          most_populated_city: "Capital",
        },
      });

      expect(() => parseCountry(invalidData)).toThrow();
    });

    it("should reject Olympic years before 1896", () => {
      const invalidData = createMinimalCountry({
        sports: {
          olympic_medals: { total: 0 },
          olympics_hosted: [{ year: 1800, type: "Summer", city: "Ancient" }],
          fifa_world_cup: { hosted: [], played: false, wins: 0 },
          f1_hosted: false,
        },
      });

      expect(() => parseCountry(invalidData)).toThrow();
    });

    it("should reject FIFA World Cup years before 1930", () => {
      const invalidData = createMinimalCountry({
        sports: {
          olympic_medals: { total: 0 },
          olympics_hosted: [],
          fifa_world_cup: { hosted: [1920], played: false, wins: 0 },
          f1_hosted: false,
        },
      });

      expect(() => parseCountry(invalidData)).toThrow();
    });
  });

  describe("safeParseCountry", () => {
    it("should return success for valid data", () => {
      const validCountry = createMinimalCountry();
      const result = safeParseCountry(validCountry);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("XX");
      }
    });

    it("should return error details for invalid data", () => {
      const invalidData = { id: "X" }; // Missing fields
      const result = safeParseCountry(invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });
  });
});

// Helper function to create a minimal valid country for testing
function createMinimalCountry(overrides: Partial<Country> = {}): Country {
  return {
    id: "XX",
    name: "Test Country",
    flag_image_url: "/flags/xx.svg",
    flag: {
      colors: ["red"],
      has_star: false,
      has_coat_of_arms: false,
      has_animal: false,
    },
    geography: {
      continents: ["Europe"],
      is_island_nation: false,
      is_landlocked: false,
      coastline_km: 100,
      coastlines: [],
      river_systems: [],
      touches_equator: false,
      touches_eurasian_steppe: false,
      touches_sahara: false,
    },
    borders: {
      countries: [],
    },
    political: {
      is_eu_member: false,
      is_commonwealth_member: false,
      was_ussr: false,
      is_monarchy: false,
      is_dependency: false,
      has_nuclear_weapons: false,
      official_languages: [],
      same_sex_marriage_legal: false,
      same_sex_activities_illegal: false,
      corruption_perceptions_index: 50,
      time_zones: ["UTC+0"],
      observes_dst: false,
    },
    population: {
      count: 1000000,
      density_per_km2: 100,
      capitals: [{ name: "Test Capital", population: 100000 }],
      most_populated_city: "Test Capital",
    },
    area_km2: 10000,
    economic: {
      gdp_per_capita: 10000,
      hdi: 0.8,
      produces_nuclear_power: false,
      wheat_production_rank: null,
      oil_production_rank: null,
      renewable_energy_share_rank: null,
    },
    facts: {
      drives_on_left: false,
      skyscraper_count: 0,
      has_alcohol_prohibition: false,
      air_pollution_pm25: 10,
      co2_emissions_per_capita: 5,
      obesity_rate_rank: null,
      alcohol_consumption_rank: null,
      chocolate_consumption_rank: null,
      rail_network_rank: null,
      population_density_rank: null,
      tourist_arrivals_rank: null,
      world_heritage_sites_rank: null,
      lakes_count_rank: null,
    },
    sports: {
      olympic_medals: { total: 0 },
      olympics_hosted: [],
      fifa_world_cup: { hosted: [], played: false, wins: 0 },
      f1_hosted: false,
    },
    ...overrides,
  };
}

