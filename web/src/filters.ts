/**
 * Filter management for GeoGrid Trainer
 */

import type { Country, Continent, OfficialLanguage } from './types/country';
import type { FilterState, BooleanFilter, RangeFilter, MultiSelectFilter, DisplayConfig } from './types/filters';

const FILTER_STORAGE_KEY = 'geogrid-filter-state-v2';

// Category labels for UI
export const CATEGORY_LABELS: Record<string, string> = {
  geography: 'Geography',
  flag: 'Flag',
  borders: 'Borders',
  political: 'Political',
  population: 'Population',
  area_km2: 'Size',
  economic: 'Economic',
  facts: 'Facts',
  sports: 'Sports',
};

// Filter labels for UI
export const FILTER_LABELS: Record<string, string> = {
  // Geography
  'geography.continents': 'Continent',
  'geography.is_island_nation': 'Island Nation',
  'geography.is_landlocked': 'Landlocked',
  'geography.coastline_km': 'Coastline Length (km)',
  // Flag
  'flag.has_star': 'Flag Has Star',
  'flag.has_coat_of_arms': 'Flag Has Coat of Arms',
  'flag.has_animal': 'Flag Has Animal',
  // Borders
  'borders.countries': 'Bordering Countries',
  // Political
  'political.is_eu_member': 'EU Member',
  'political.is_commonwealth_member': 'Commonwealth Member',
  'political.was_ussr': 'Former USSR',
  'political.is_monarchy': 'Monarchy',
  'political.is_dependency': 'Dependency/Territory',
  'political.official_languages': 'Official Language',
  'political.time_zones': 'Time Zones',
  // Population
  'population.count': 'Population',
  'population.density_per_km2': 'Pop. Density (per km²)',
  'population.capital_not_largest': 'Capital ≠ Largest City',
  // Area
  'area_km2': 'Area (km²)',
  // Economic
  'economic.gdp_per_capita': 'GDP per Capita ($)',
  'economic.hdi': 'Human Development Index',
  // Facts
  'facts.drives_on_left': 'Drives on Left',
  // Sports
  'sports.olympic_medals': 'Olympic Medals (Total)',
  'sports.has_hosted_olympics': 'Has Hosted Olympics',
};

// Continent options
export const CONTINENT_OPTIONS: Continent[] = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
];

// Language options
export const LANGUAGE_OPTIONS: OfficialLanguage[] = [
  'English',
  'Spanish',
  'French',
  'Arabic',
  'Portuguese',
];

/**
 * Create default filter state
 */
export function createDefaultFilterState(): FilterState {
  return {
    geography: {
      continents: {
        type: 'multiselect',
        enabled: false,
        selected: [],
        options: CONTINENT_OPTIONS,
      },
      is_island_nation: { type: 'boolean', enabled: false, value: true },
      is_landlocked: { type: 'boolean', enabled: false, value: true },
      coastline_km: {
        type: 'range',
        enabled: false,
        min: 0,
        max: 250000,
        minBound: 0,
        maxBound: 250000,
        step: 1000,
        format: 'compact',
      },
    },
    flag: {
      has_star: { type: 'boolean', enabled: false, value: true },
      has_coat_of_arms: { type: 'boolean', enabled: false, value: true },
      has_animal: { type: 'boolean', enabled: false, value: true },
    },
    borders: {
      countries: {
        type: 'range',
        enabled: false,
        min: 0,
        max: 14,
        minBound: 0,
        maxBound: 14,
        step: 1,
        format: 'number',
      },
    },
    political: {
      is_eu_member: { type: 'boolean', enabled: false, value: true },
      is_commonwealth_member: { type: 'boolean', enabled: false, value: true },
      was_ussr: { type: 'boolean', enabled: false, value: true },
      is_monarchy: { type: 'boolean', enabled: false, value: true },
      is_dependency: { type: 'boolean', enabled: false, value: true },
      official_languages: {
        type: 'multiselect',
        enabled: false,
        selected: [],
        options: LANGUAGE_OPTIONS,
      },
      time_zones: {
        type: 'range',
        enabled: false,
        min: 1,
        max: 12,
        minBound: 1,
        maxBound: 12,
        step: 1,
        format: 'number',
      },
    },
    population: {
      count: {
        type: 'range',
        enabled: false,
        min: 0,
        max: 1500000000,
        minBound: 0,
        maxBound: 1500000000,
        step: 1000000,
        format: 'compact',
      },
      density_per_km2: {
        type: 'range',
        enabled: false,
        min: 0,
        max: 25000,
        minBound: 0,
        maxBound: 25000,
        step: 100,
        format: 'compact',
      },
      capital_not_largest: { type: 'boolean', enabled: false, value: true },
    },
    area_km2: {
      type: 'range',
      enabled: false,
      min: 0,
      max: 20000000,
      minBound: 0,
      maxBound: 20000000,
      step: 10000,
      format: 'compact',
    },
    economic: {
      gdp_per_capita: {
        type: 'range',
        enabled: false,
        min: 0,
        max: 150000,
        minBound: 0,
        maxBound: 150000,
        step: 1000,
        format: 'compact',
      },
      hdi: {
        type: 'range',
        enabled: false,
        min: 0,
        max: 1,
        minBound: 0,
        maxBound: 1,
        step: 0.01,
        format: 'decimal',
      },
    },
    facts: {
      drives_on_left: { type: 'boolean', enabled: false, value: true },
    },
    sports: {
      olympic_medals: {
        type: 'range',
        enabled: false,
        min: 0,
        max: 3000,
        minBound: 0,
        maxBound: 3000,
        step: 10,
        format: 'compact',
      },
      has_hosted_olympics: { type: 'boolean', enabled: false, value: true },
    },
  };
}

/**
 * Load filter state from localStorage
 */
export function loadFilterState(): FilterState {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return mergeFilterState(createDefaultFilterState(), parsed);
    }
  } catch (e) {
    console.warn('Failed to load filter state:', e);
  }
  return createDefaultFilterState();
}

/**
 * Deep merge saved filter state with defaults
 */
function mergeFilterState(defaults: FilterState, saved: Partial<FilterState>): FilterState {
  const result = { ...defaults };
  
  for (const category of Object.keys(defaults) as (keyof FilterState)[]) {
    if (category in saved && saved[category] !== undefined) {
      const defaultCat = defaults[category];
      const savedCat = saved[category];
      
      if (defaultCat && typeof defaultCat === 'object' && 'type' in defaultCat) {
        // Top-level filter (area_km2)
        result[category] = { ...defaultCat, ...savedCat } as any;
      } else if (defaultCat && typeof defaultCat === 'object' && savedCat && typeof savedCat === 'object') {
        // Category with nested filters
        result[category] = { ...defaultCat } as any;
        for (const filterKey of Object.keys(defaultCat)) {
          if (filterKey in savedCat) {
            (result[category] as any)[filterKey] = {
              ...(defaultCat as any)[filterKey],
              ...(savedCat as any)[filterKey],
            };
          }
        }
      }
    }
  }
  
  return result;
}

/**
 * Save filter state to localStorage
 */
export function saveFilterState(state: FilterState): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save filter state:', e);
  }
}

/**
 * Clear all filters by resetting to default state
 */
export function clearAllFilters(): FilterState {
  const defaults = createDefaultFilterState();
  saveFilterState(defaults);
  return defaults;
}

/**
 * Count the number of active (enabled) filters
 */
export function countActiveFilters(state: FilterState): number {
  let count = 0;
  
  const checkFilter = (filter: any) => {
    if (filter && typeof filter === 'object' && 'enabled' in filter && filter.enabled) {
      count++;
    }
  };
  
  // Check all categories
  for (const category of Object.values(state)) {
    if (category && typeof category === 'object') {
      if ('enabled' in category) {
        // Top-level filter
        checkFilter(category);
      } else {
        // Category with nested filters
        for (const filter of Object.values(category)) {
          checkFilter(filter);
        }
      }
    }
  }
  
  return count;
}

/**
 * Check if a country matches the current filter state
 */
export function countryMatchesFilters(country: Country, state: FilterState): boolean {
  // Check each enabled filter - ALL must match (AND logic)
  
  // Geography filters
  if (state.geography.continents.enabled && state.geography.continents.selected.length > 0) {
    const hasMatchingContinent = country.geography.continents.some(c => 
      state.geography.continents.selected.includes(c)
    );
    if (!hasMatchingContinent) return false;
  }
  
  if (state.geography.is_island_nation.enabled) {
    if (country.geography.is_island_nation !== state.geography.is_island_nation.value) return false;
  }
  
  if (state.geography.is_landlocked.enabled) {
    if (country.geography.is_landlocked !== state.geography.is_landlocked.value) return false;
  }
  
  if (state.geography.coastline_km.enabled) {
    const coastline = country.geography.coastline_km ?? 0;
    if (coastline < state.geography.coastline_km.min || coastline > state.geography.coastline_km.max) {
      return false;
    }
  }
  
  // Flag filters
  if (state.flag.has_star.enabled) {
    if (country.flag.has_star !== state.flag.has_star.value) return false;
  }
  
  if (state.flag.has_coat_of_arms.enabled) {
    if (country.flag.has_coat_of_arms !== state.flag.has_coat_of_arms.value) return false;
  }
  
  if (state.flag.has_animal.enabled) {
    if (country.flag.has_animal !== state.flag.has_animal.value) return false;
  }
  
  // Borders filter
  if (state.borders.countries.enabled) {
    const borderCount = country.borders.countries.length;
    if (borderCount < state.borders.countries.min || borderCount > state.borders.countries.max) {
      return false;
    }
  }
  
  // Political filters
  if (state.political.is_eu_member.enabled) {
    if (country.political.is_eu_member !== state.political.is_eu_member.value) return false;
  }
  
  if (state.political.is_commonwealth_member.enabled) {
    if (country.political.is_commonwealth_member !== state.political.is_commonwealth_member.value) return false;
  }
  
  if (state.political.was_ussr.enabled) {
    if (country.political.was_ussr !== state.political.was_ussr.value) return false;
  }
  
  if (state.political.is_monarchy.enabled) {
    if (country.political.is_monarchy !== state.political.is_monarchy.value) return false;
  }
  
  if (state.political.is_dependency.enabled) {
    if (country.political.is_dependency !== state.political.is_dependency.value) return false;
  }
  
  if (state.political.official_languages.enabled && state.political.official_languages.selected.length > 0) {
    const hasMatchingLanguage = country.political.official_languages.some(l =>
      state.political.official_languages.selected.includes(l)
    );
    if (!hasMatchingLanguage) return false;
  }
  
  if (state.political.time_zones.enabled) {
    const tzCount = country.political.time_zones.length;
    if (tzCount < state.political.time_zones.min || tzCount > state.political.time_zones.max) {
      return false;
    }
  }
  
  // Population filters
  if (state.population.count.enabled) {
    const pop = country.population.count;
    if (pop < state.population.count.min || pop > state.population.count.max) {
      return false;
    }
  }
  
  if (state.population.density_per_km2.enabled) {
    const density = country.population.density_per_km2;
    if (density < state.population.density_per_km2.min || density > state.population.density_per_km2.max) {
      return false;
    }
  }
  
  if (state.population.capital_not_largest.enabled) {
    const capitalName = country.population.capitals[0]?.name;
    const largestCity = country.population.most_populated_city;
    const isCapitalNotLargest = capitalName !== largestCity;
    if (isCapitalNotLargest !== state.population.capital_not_largest.value) return false;
  }
  
  // Area filter
  if (state.area_km2.enabled) {
    const area = country.area_km2;
    if (area < state.area_km2.min || area > state.area_km2.max) {
      return false;
    }
  }
  
  // Economic filters
  if (state.economic.gdp_per_capita.enabled) {
    const gdp = country.economic.gdp_per_capita;
    if (gdp < state.economic.gdp_per_capita.min || gdp > state.economic.gdp_per_capita.max) {
      return false;
    }
  }
  
  if (state.economic.hdi.enabled) {
    const hdi = country.economic.hdi;
    if (hdi < state.economic.hdi.min || hdi > state.economic.hdi.max) {
      return false;
    }
  }
  
  // Facts filters
  if (state.facts.drives_on_left.enabled) {
    if (country.facts.drives_on_left !== state.facts.drives_on_left.value) return false;
  }
  
  // Sports filters
  if (state.sports.olympic_medals.enabled) {
    const medals = country.sports.olympic_medals.total;
    if (medals < state.sports.olympic_medals.min || medals > state.sports.olympic_medals.max) {
      return false;
    }
  }
  
  if (state.sports.has_hosted_olympics.enabled) {
    const hasHosted = country.sports.olympics_hosted.length > 0;
    if (hasHosted !== state.sports.has_hosted_olympics.value) return false;
  }
  
  return true;
}

/**
 * Format a number based on format type
 */
export function formatFilterValue(value: number, format: string = 'number'): string {
  switch (format) {
    case 'compact':
      if (value >= 1000000000) return (value / 1000000000).toFixed(1) + 'B';
      if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
      if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
      return String(value);
    case 'percent':
      return (value * 100).toFixed(0) + '%';
    case 'decimal':
      return value.toFixed(2);
    default:
      return String(value);
  }
}

/**
 * Get filters grouped by category for UI rendering
 */
export function getFiltersByCategory(state: FilterState, displayConfig: DisplayConfig): Array<{
  category: string;
  categoryLabel: string;
  filters: Array<{
    id: string;
    label: string;
    filter: BooleanFilter | RangeFilter | MultiSelectFilter;
  }>;
}> {
  const categories: Array<{
    category: string;
    categoryLabel: string;
    filters: Array<{
      id: string;
      label: string;
      filter: BooleanFilter | RangeFilter | MultiSelectFilter;
    }>;
  }> = [];
  
  // Geography
  if (displayConfig.geography) {
    const filters: Array<{ id: string; label: string; filter: any }> = [];
    if (displayConfig.geography.continents) {
      filters.push({ id: 'geography.continents', label: FILTER_LABELS['geography.continents'], filter: state.geography.continents });
    }
    if (displayConfig.geography.is_island_nation) {
      filters.push({ id: 'geography.is_island_nation', label: FILTER_LABELS['geography.is_island_nation'], filter: state.geography.is_island_nation });
    }
    if (displayConfig.geography.is_landlocked) {
      filters.push({ id: 'geography.is_landlocked', label: FILTER_LABELS['geography.is_landlocked'], filter: state.geography.is_landlocked });
    }
    if (displayConfig.geography.coastline_km) {
      filters.push({ id: 'geography.coastline_km', label: FILTER_LABELS['geography.coastline_km'], filter: state.geography.coastline_km });
    }
    if (filters.length > 0) {
      categories.push({ category: 'geography', categoryLabel: CATEGORY_LABELS.geography, filters });
    }
  }
  
  // Flag
  if (displayConfig.flag) {
    const filters: Array<{ id: string; label: string; filter: any }> = [];
    if (displayConfig.flag.has_star) {
      filters.push({ id: 'flag.has_star', label: FILTER_LABELS['flag.has_star'], filter: state.flag.has_star });
    }
    if (displayConfig.flag.has_coat_of_arms) {
      filters.push({ id: 'flag.has_coat_of_arms', label: FILTER_LABELS['flag.has_coat_of_arms'], filter: state.flag.has_coat_of_arms });
    }
    if (displayConfig.flag.has_animal) {
      filters.push({ id: 'flag.has_animal', label: FILTER_LABELS['flag.has_animal'], filter: state.flag.has_animal });
    }
    if (filters.length > 0) {
      categories.push({ category: 'flag', categoryLabel: CATEGORY_LABELS.flag, filters });
    }
  }
  
  // Borders
  if (displayConfig.borders?.countries) {
    categories.push({
      category: 'borders',
      categoryLabel: CATEGORY_LABELS.borders,
      filters: [
        { id: 'borders.countries', label: FILTER_LABELS['borders.countries'], filter: state.borders.countries },
      ],
    });
  }
  
  // Political
  if (displayConfig.political) {
    const filters: Array<{ id: string; label: string; filter: any }> = [];
    if (displayConfig.political.is_eu_member) {
      filters.push({ id: 'political.is_eu_member', label: FILTER_LABELS['political.is_eu_member'], filter: state.political.is_eu_member });
    }
    if (displayConfig.political.is_commonwealth_member) {
      filters.push({ id: 'political.is_commonwealth_member', label: FILTER_LABELS['political.is_commonwealth_member'], filter: state.political.is_commonwealth_member });
    }
    if (displayConfig.political.was_ussr) {
      filters.push({ id: 'political.was_ussr', label: FILTER_LABELS['political.was_ussr'], filter: state.political.was_ussr });
    }
    if (displayConfig.political.is_monarchy) {
      filters.push({ id: 'political.is_monarchy', label: FILTER_LABELS['political.is_monarchy'], filter: state.political.is_monarchy });
    }
    if (displayConfig.political.is_dependency) {
      filters.push({ id: 'political.is_dependency', label: FILTER_LABELS['political.is_dependency'], filter: state.political.is_dependency });
    }
    if (displayConfig.political.official_languages) {
      filters.push({ id: 'political.official_languages', label: FILTER_LABELS['political.official_languages'], filter: state.political.official_languages });
    }
    if (displayConfig.political.time_zones) {
      filters.push({ id: 'political.time_zones', label: FILTER_LABELS['political.time_zones'], filter: state.political.time_zones });
    }
    if (filters.length > 0) {
      categories.push({ category: 'political', categoryLabel: CATEGORY_LABELS.political, filters });
    }
  }
  
  // Population
  if (displayConfig.population) {
    const filters: Array<{ id: string; label: string; filter: any }> = [];
    if (displayConfig.population.count) {
      filters.push({ id: 'population.count', label: FILTER_LABELS['population.count'], filter: state.population.count });
    }
    if (displayConfig.population.density_per_km2) {
      filters.push({ id: 'population.density_per_km2', label: FILTER_LABELS['population.density_per_km2'], filter: state.population.density_per_km2 });
    }
    // Special filter: capital is not largest city
    if (displayConfig.population.capitals && displayConfig.population.most_populated_city) {
      filters.push({ id: 'population.capital_not_largest', label: FILTER_LABELS['population.capital_not_largest'], filter: state.population.capital_not_largest });
    }
    if (filters.length > 0) {
      categories.push({ category: 'population', categoryLabel: CATEGORY_LABELS.population, filters });
    }
  }
  
  // Area
  if (displayConfig.area_km2) {
    categories.push({
      category: 'area',
      categoryLabel: CATEGORY_LABELS.area_km2,
      filters: [
        { id: 'area_km2', label: FILTER_LABELS['area_km2'], filter: state.area_km2 },
      ],
    });
  }
  
  // Economic
  if (displayConfig.economic) {
    const filters: Array<{ id: string; label: string; filter: any }> = [];
    if (displayConfig.economic.gdp_per_capita) {
      filters.push({ id: 'economic.gdp_per_capita', label: FILTER_LABELS['economic.gdp_per_capita'], filter: state.economic.gdp_per_capita });
    }
    if (displayConfig.economic.hdi) {
      filters.push({ id: 'economic.hdi', label: FILTER_LABELS['economic.hdi'], filter: state.economic.hdi });
    }
    if (filters.length > 0) {
      categories.push({ category: 'economic', categoryLabel: CATEGORY_LABELS.economic, filters });
    }
  }
  
  // Facts
  if (displayConfig.facts) {
    const filters: Array<{ id: string; label: string; filter: any }> = [];
    if (displayConfig.facts.drives_on_left) {
      filters.push({ id: 'facts.drives_on_left', label: FILTER_LABELS['facts.drives_on_left'], filter: state.facts.drives_on_left });
    }
    if (filters.length > 0) {
      categories.push({ category: 'facts', categoryLabel: CATEGORY_LABELS.facts, filters });
    }
  }
  
  // Sports
  if (displayConfig.sports) {
    const filters: Array<{ id: string; label: string; filter: any }> = [];
    if (displayConfig.sports.olympic_medals) {
      filters.push({ id: 'sports.olympic_medals', label: FILTER_LABELS['sports.olympic_medals'], filter: state.sports.olympic_medals });
    }
    if (displayConfig.sports.olympics_hosted) {
      filters.push({ id: 'sports.has_hosted_olympics', label: FILTER_LABELS['sports.has_hosted_olympics'], filter: state.sports.has_hosted_olympics });
    }
    if (filters.length > 0) {
      categories.push({ category: 'sports', categoryLabel: CATEGORY_LABELS.sports, filters });
    }
  }
  
  return categories;
}

