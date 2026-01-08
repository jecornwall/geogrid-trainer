import './style.css';
import L from 'leaflet';
import type { Country } from './types/country';
import type { FilterState, RangeFilter, BooleanFilter, MultiSelectFilter, DisplayConfig } from './types/filters';
import {
  createDefaultFilterState,
  loadFilterState,
  saveFilterState,
  countActiveFilters,
  countryMatchesFilters,
  getFiltersByCategory,
  formatFilterValue,
  clearAllFilters,
} from './filters';
import { renderCountryPopup, renderMobileDetails } from './details';
import {
  renderCompactBooleanFilter,
  renderCompactRangeFilter,
  renderCompactMultiSelectFilter,
} from './filter-renderers';

const FILTER_MODE_SUFFIX = '.mode';
const RANGE_SEPARATOR = '..';
const MOBILE_PROTOTYPE_PATH = '/mobile-prototype';
const FILTER_EXPERIMENTS_PATH = '/filter-experiments';
const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isMobilePrototypeRoute = normalizedPath === MOBILE_PROTOTYPE_PATH;
const isFilterExperimentsRoute = normalizedPath === FILTER_EXPERIMENTS_PATH;
const MOBILE_BREAKPOINT = 900;
const mobileLayoutQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
const mobilePanelIds = ['filters', 'details'] as const;
type MobilePanelId = (typeof mobilePanelIds)[number];
const mobilePanels: Record<MobilePanelId, HTMLElement | null> = {
  filters: null,
  details: null,
};
const mobilePanelToggles: Record<MobilePanelId, HTMLButtonElement | null> = {
  filters: null,
  details: null,
};
const mobilePanelHeaders: Record<MobilePanelId, HTMLElement | null> = {
  filters: null,
  details: null,
};
const mobileDetailsHeader = {
  title: document.querySelector<HTMLElement>('[data-mobile-panel-title="details"]') ?? null,
  subtitle: document.querySelector<HTMLElement>('[data-mobile-panel-subtitle="details"]') ?? null,
};
const defaultMobileDetailsTitle = mobileDetailsHeader.title?.textContent?.trim() ?? 'Country Details';
const defaultMobileDetailsSubtitle = mobileDetailsHeader.subtitle?.textContent?.trim() ?? '';
const DETAILS_EMPTY_TEMPLATE = `
      <div class="details-empty">
        <div class="empty-icon">🌍</div>
        <p>Select a country to view details</p>
      </div>
    `;
let lastDetailsContext: {
  country: Country | null;
  fallbackName?: string;
  fallbackCode?: string | null;
} = { country: null };

type HorizontalScrollable = HTMLElement & { dataset: DOMStringMap & { hScrollBound?: string } };

// GeoJSON URL for world countries (Natural Earth via GitHub)
const GEOJSON_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

// Store country data keyed by ISO code
let countriesMap: Map<string, Country> = new Map();

// Store country name to ISO code mapping for fallback lookups
let countryNameToCode: Map<string, string> = new Map();

// Display configuration
let displayConfig: DisplayConfig | null = null;

// Map instance
let map: L.Map;

// GeoJSON layer reference for updating styles
let geoJsonLayer: L.GeoJSON | null = null;

// Currently selected country layer
let selectedLayer: L.Layer | null = null;

// Filter state
let filterState: FilterState = getInitialFilterState();

// Track highlighted countries for filter
let highlightedCountries: Set<string> = new Set();

// Track collapsed categories
let collapsedCategories: Set<string> = new Set();

// Store GeoJSON layer mapping for country selection
let countryCodeToLayer: Map<string, L.Layer> = new Map();

// Country styles
const defaultStyle: L.PathOptions = {
  fillColor: '#1e3a5f',
  fillOpacity: 0.7,
  color: '#3b82f6',
  weight: 1,
  opacity: 0.8,
};

const hoverStyle: L.PathOptions = {
  fillColor: '#2563eb',
  fillOpacity: 0.85,
  color: '#60a5fa',
  weight: 2,
};

const selectedStyle: L.PathOptions = {
  fillColor: '#22d3ee',
  fillOpacity: 0.9,
  color: '#06b6d4',
  weight: 2,
};

/**
 * Load initial filter state from query parameters or localStorage.
 */
function getInitialFilterState(): FilterState {
  const queryState = loadFilterStateFromQuery();
  if (queryState) {
    saveFilterState(queryState);
    return queryState;
  }
  return loadFilterState();
}

/**
 * Read filter state from URL query parameters.
 */
function loadFilterStateFromQuery(): FilterState | null {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const nextState = createDefaultFilterState();
  const keys = new Set<string>();
  params.forEach((_value, key) => keys.add(key));
  if (keys.size === 0) return null;

  const hasFilters = applyQueryFilters(nextState, params, keys);
  return hasFilters ? nextState : null;
}

/**
 * Apply query filters to a filter state.
 */
function applyQueryFilters(state: FilterState, params: URLSearchParams, keys: Set<string>): boolean {
  let hasFilters = false;

  for (const key of keys) {
    if (key.endsWith(FILTER_MODE_SUFFIX)) {
      const filterId = key.slice(0, -FILTER_MODE_SUFFIX.length);
      const target = getFilterValueFromState(state, filterId) as MultiSelectFilter | undefined;
      if (!target || target.type !== 'multiselect') continue;
      const mode = params.get(key);
      if (mode === 'inclusive' || mode === 'exclusive') {
        target.mode = mode;
      }
      continue;
    }

    const target = getFilterValueFromState(state, key);
    if (!target || typeof target !== 'object' || !('type' in target)) continue;

    target.enabled = true;
    hasFilters = true;

    switch (target.type) {
      case 'boolean': {
        const raw = params.get(key);
        if (raw !== null) {
          const value = parseBooleanParam(raw);
          if (value !== null) {
            target.value = value;
          }
        }
        break;
      }
      case 'range': {
        const raw = params.get(key);
        if (raw !== null) {
          const { min, max } = parseRangeParam(raw);
          if (min !== null) {
            target.min = Math.max(target.minBound, Math.min(min, target.maxBound));
          }
          if (max !== null) {
            target.max = Math.max(target.minBound, Math.min(max, target.maxBound));
          }
        }
        break;
      }
      case 'multiselect': {
        const values = params.getAll(key);
        const selected = values.length > 1 ? values : splitListParam(values[0]);
        target.selected = selected.filter((option) => target.options.includes(option));
        break;
      }
    }
  }

  return hasFilters;
}

/**
 * Serialize active filters into query parameters.
 */
function updateFilterQueryParams(state: FilterState): void {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  for (const key of getFilterParamKeys(state)) {
    params.delete(key);
  }

  appendActiveFiltersToParams(params, state);

  window.history.replaceState({}, '', url);
}

/**
 * Collect active filters in a query-friendly structure.
 */
function appendActiveFiltersToParams(params: URLSearchParams, state: FilterState): void {
  forEachFilter(state, (id, filter) => {
    if (!filter.enabled) return;
    switch (filter.type) {
      case 'boolean':
        params.set(id, String(filter.value));
        break;
      case 'range':
        params.set(id, `${filter.min}${RANGE_SEPARATOR}${filter.max}`);
        break;
      case 'multiselect':
        params.set(id, filter.selected.join(','));
        if (filter.mode) {
          params.set(`${id}${FILTER_MODE_SUFFIX}`, filter.mode);
        }
        break;
    }
  });
}

function forEachFilter(
  state: FilterState,
  callback: (id: string, filter: BooleanFilter | RangeFilter | MultiSelectFilter) => void
): void {
  for (const [categoryKey, categoryValue] of Object.entries(state)) {
    if (!categoryValue || typeof categoryValue !== 'object') continue;
    if ('type' in categoryValue) {
      callback(categoryKey, categoryValue);
    } else {
      for (const [filterKey, filterValue] of Object.entries(categoryValue)) {
        callback(`${categoryKey}.${filterKey}`, filterValue as BooleanFilter | RangeFilter | MultiSelectFilter);
      }
    }
  }
}

function getFilterParamKeys(state: FilterState): string[] {
  const keys: string[] = [];
  forEachFilter(state, (id, filter) => {
    keys.push(id);
    if (filter.type === 'multiselect' && filter.mode !== undefined) {
      keys.push(`${id}${FILTER_MODE_SUFFIX}`);
    }
  });
  return keys;
}

function parseBooleanParam(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return null;
}

function parseRangeParam(value: string): { min: number | null; max: number | null } {
  const trimmed = value.trim();
  if (!trimmed) return { min: null, max: null };
  const separator = trimmed.includes(RANGE_SEPARATOR) ? RANGE_SEPARATOR : ',';
  const [rawMin, rawMax] = trimmed.split(separator);
  const min = rawMin !== undefined && rawMin !== '' ? Number(rawMin) : null;
  const max = rawMax !== undefined && rawMax !== '' ? Number(rawMax) : null;
  return {
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null,
  };
}

function splitListParam(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

/**
 * Convert a 2-letter country code to a Unicode flag emoji
 * Each letter is converted to a Regional Indicator Symbol
 */
function countryCodeToFlag(code: string): string {
  const codePoints = [...code.toUpperCase()].map(
    (char) => 0x1f1e6 - 65 + char.charCodeAt(0)
  );
  return String.fromCodePoint(...codePoints);
}

const highlightedStyle: L.PathOptions = {
  fillColor: '#0891b2',
  fillOpacity: 0.8,
  color: '#22d3ee',
  weight: 1.5,
  opacity: 1,
};

const highlightedHoverStyle: L.PathOptions = {
  fillColor: '#06b6d4',
  fillOpacity: 0.9,
  color: '#67e8f9',
  weight: 2,
};

/**
 * Initialize the Leaflet map
 */
function initMap(): L.Map {
  const mapInstance = L.map('map', {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 8,
    worldCopyJump: true,
    maxBounds: [
      [-90, -180],
      [90, 180],
    ],
    maxBoundsViscosity: 1.0,
  });

  // Add a subtle tile layer for context
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }
  ).addTo(mapInstance);

  return mapInstance;
}

/**
 * Load display configuration
 */
async function loadDisplayConfig(): Promise<DisplayConfig> {
  const response = await fetch('./display-config.json');
  return response.json();
}

/**
 * Load country data from the JSON file
 */
async function loadCountryData(): Promise<void> {
  try {
    const response = await fetch('./countries.json');
    const countries: Country[] = await response.json();
    countriesMap = new Map(countries.map((c) => [c.id, c]));
    
    // Build name-to-code map for fallback lookups (normalized to lowercase)
    countryNameToCode = new Map();
    for (const country of countries) {
      countryNameToCode.set(country.name.toLowerCase(), country.id);
    }
  } catch (error) {
    console.error('Failed to load country data:', error);
  }
}

/**
 * Get ISO 2-letter code from GeoJSON feature
 */
function getCountryCode(feature: GeoJSON.Feature): string | null {
  const props = feature.properties;
  if (!props) return null;
  
  const code =
    props['ISO3166-1-Alpha-2'] ||
    props.ISO_A2 ||
    props.iso_a2 ||
    props.ISO ||
    props.id ||
    null;
  
  // If code is valid and not a placeholder, return it
  if (code && code !== '-99') {
    return code;
  }
  
  // Fallback: try to match by country name
  const name = props.name || props.ADMIN || props.NAME;
  if (name && countryNameToCode.has(name.toLowerCase())) {
    return countryNameToCode.get(name.toLowerCase()) || null;
  }
  
  return null;
}

/**
 * Get the appropriate style for a layer based on filter state
 */
function getStyleForLayer(countryCode: string | null, isSelected: boolean, isHovered: boolean): L.PathOptions {
  if (isSelected) {
    return selectedStyle;
  }
  
  const isHighlighted = countryCode ? highlightedCountries.has(countryCode) : false;
  
  if (isHovered) {
    return isHighlighted ? highlightedHoverStyle : hoverStyle;
  }
  
  return isHighlighted ? highlightedStyle : defaultStyle;
}

/**
 * Update the highlighted countries based on filter state
 */
function updateHighlightedCountries(): void {
  highlightedCountries.clear();
  
  // Only highlight if at least one filter is enabled
  const activeCount = countActiveFilters(filterState);
  if (activeCount === 0) {
    // No filters active - clear highlights
  } else {
    countriesMap.forEach((country, code) => {
      if (countryMatchesFilters(country, filterState)) {
        highlightedCountries.add(code);
      }
    });
  }
  
  // Update summary stats
  const totalHighlighted = document.getElementById('total-highlighted');
  const activeFilters = document.getElementById('active-filters');
  
  if (totalHighlighted) {
    totalHighlighted.textContent = String(highlightedCountries.size);
  }
  
  if (activeFilters) {
    activeFilters.textContent = String(activeCount);
  }
}

/**
 * Update all country styles on the map based on filter state
 */
function updateMapStyles(): void {
  if (!geoJsonLayer) return;
  
  geoJsonLayer.eachLayer((layer) => {
    const feature = (layer as L.GeoJSON).feature as GeoJSON.Feature;
    const countryCode = getCountryCode(feature);
    const isSelected = layer === selectedLayer;
    const style = getStyleForLayer(countryCode, isSelected, false);
    (layer as L.Path).setStyle(style);
  });
}

/**
 * Render the countries list in the bottom panel
 */
function renderCountriesList(): void {
  const listContainer = document.getElementById('countries-list');
  const countDisplay = document.getElementById('countries-count');
  
  if (!listContainer) return;
  
  // Get countries matching current filters
  const activeCount = countActiveFilters(filterState);
  const matchingCountries: Country[] = [];
  
  if (activeCount > 0) {
    countriesMap.forEach((country) => {
      if (countryMatchesFilters(country, filterState)) {
        matchingCountries.push(country);
      }
    });
    // Sort alphabetically by name
    matchingCountries.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  // Update count display
  if (countDisplay) {
    countDisplay.textContent = String(matchingCountries.length);
  }
  
  // Render the list
  if (matchingCountries.length === 0) {
    listContainer.innerHTML = activeCount === 0
      ? '<div class="countries-empty">Enable filters to see matching countries</div>'
      : '<div class="countries-empty">No countries match the current filters</div>';
    addHorizontalWheelScroll(listContainer);
    return;
  }
  
  // Get currently selected country code
  let selectedCode: string | null = null;
  if (selectedLayer) {
    const feature = (selectedLayer as L.GeoJSON).feature as GeoJSON.Feature;
    selectedCode = getCountryCode(feature);
  }
  
  listContainer.innerHTML = matchingCountries.map((country) => {
    const flag = countryCodeToFlag(country.id);
    const isSelected = country.id === selectedCode;
    return `
      <button 
        class="country-chip${isSelected ? ' selected' : ''}" 
        data-country-id="${country.id}"
        title="${country.name}"
      >
        <span class="country-chip-flag">${flag}</span>
        <span class="country-chip-name">${country.name}</span>
      </button>
    `;
  }).join('');
  addHorizontalWheelScroll(listContainer);
  
  // Attach click handlers
  listContainer.querySelectorAll('.country-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const countryId = chip.getAttribute('data-country-id');
      if (countryId) {
        selectCountryById(countryId);
      }
    });
  });
}

/**
 * Select a country by its ISO code
 */
function selectCountryById(countryId: string): void {
  const country = countriesMap.get(countryId);
  const layer = countryCodeToLayer.get(countryId);
  
  if (!layer) {
    // Country exists in data but not in GeoJSON
    if (country) {
      showDetails(country);
    }
    return;
  }
  
  // Reset previous selection
  if (selectedLayer && selectedLayer !== layer) {
    const prevFeature = (selectedLayer as L.GeoJSON).feature as GeoJSON.Feature;
    const prevCode = getCountryCode(prevFeature);
    const prevStyle = getStyleForLayer(prevCode, false, false);
    (selectedLayer as L.Path).setStyle(prevStyle);
  }
  
  // Set new selection
  selectedLayer = layer;
  (layer as L.Path).setStyle(selectedStyle);
  
  // Pan to the country
  const bounds = (layer as L.GeoJSON).getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 5 });
  }
  
  // Show details
  if (country) {
    showDetails(country);
  } else {
    const feature = (layer as L.GeoJSON).feature as GeoJSON.Feature;
    const countryName = feature.properties?.name || feature.properties?.ADMIN || 'Unknown';
    showDetails(null, countryName, countryId);
  }
  
  // Update the countries list to show selection
  updateCountriesListSelection(countryId);
}

/**
 * Update the selected state in the countries list
 */
function updateCountriesListSelection(selectedId: string | null): void {
  const listContainer = document.getElementById('countries-list');
  if (!listContainer) return;
  
  listContainer.querySelectorAll('.country-chip').forEach((chip) => {
    const countryId = chip.getAttribute('data-country-id');
    if (countryId === selectedId) {
      chip.classList.add('selected');
    } else {
      chip.classList.remove('selected');
    }
  });
}

/**
 * Update mobile filter summary in header
 */
function updateMobileFilterSummary(): void {
  if (!displayConfig || !isMobileLayout()) return;

  const summaryEl = document.getElementById('mobile-filter-summary');
  if (!summaryEl) return;

  const categories = getFiltersByCategory(filterState, displayConfig);
  const activeCategories = categories.filter(cat =>
    cat.filters.some(f => f.filter.enabled)
  );

  if (activeCategories.length > 0) {
    const summary = activeCategories.slice(0, 2).map(c => c.categoryLabel).join(' · ') +
      (activeCategories.length > 2 ? ` +${activeCategories.length - 2}` : '');
    summaryEl.textContent = summary;
  } else {
    summaryEl.textContent = 'No filters active';
  }
}

/**
 * Handle filter changes
 */
function onFilterChange(): void {
  updateHighlightedCountries();
  updateMapStyles();
  renderCountriesList();
  updateFilterQueryParams(filterState);
  saveFilterState(filterState);
  updateMobileFilterSummary();
}

/**
 * Get a nested value from filter state using dot notation
 */
function getFilterValue(path: string): any {
  const parts = path.split('.');
  let current: any = filterState;
  for (const part of parts) {
    if (current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Get a nested value from filter state using dot notation.
 */
function getFilterValueFromState(state: FilterState, path: string): any {
  const parts = path.split('.');
  let current: any = state;
  for (const part of parts) {
    if (current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Set a nested value in filter state using dot notation
 */
function setFilterValue(path: string, key: string, value: any): void {
  const parts = path.split('.');
  let current: any = filterState;
  for (let i = 0; i < parts.length; i++) {
    if (i === parts.length - 1) {
      current[parts[i]][key] = value;
    } else {
      current = current[parts[i]];
    }
  }
}

/**
 * Render a boolean filter
 */
function renderBooleanFilter(id: string, label: string, filter: BooleanFilter): string {
  const safeId = id.replace(/\./g, '-');
  return `
    <div class="filter-item filter-boolean" data-filter-id="${id}">
      <div class="filter-item-header">
        <label class="filter-item-label" for="${safeId}-enabled">${label}</label>
        <label class="filter-toggle-switch">
          <input type="checkbox" id="${safeId}-enabled" ${filter.enabled ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="filter-item-control ${filter.enabled ? '' : 'disabled'}">
        <div class="boolean-toggle-group">
          <button class="boolean-btn ${filter.value === true ? 'active' : ''}" data-value="true">Yes</button>
          <button class="boolean-btn ${filter.value === false ? 'active' : ''}" data-value="false">No</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a range filter
 */
function renderRangeFilter(id: string, label: string, filter: RangeFilter): string {
  const safeId = id.replace(/\./g, '-');
  const format = filter.format || 'number';
  const minDisplay = formatFilterValue(filter.min, format);
  const maxDisplay = formatFilterValue(filter.max, format);
  const minBoundDisplay = formatFilterValue(filter.minBound, format);
  const maxBoundDisplay = formatFilterValue(filter.maxBound, format);
  
  return `
    <div class="filter-item filter-range" data-filter-id="${id}">
      <div class="filter-item-header">
        <label class="filter-item-label" for="${safeId}-enabled">${label}</label>
        <label class="filter-toggle-switch">
          <input type="checkbox" id="${safeId}-enabled" ${filter.enabled ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="filter-item-control ${filter.enabled ? '' : 'disabled'}">
        <div class="range-display">
          <span class="range-value-display" data-display="min">${minDisplay}</span>
          <span class="range-separator">–</span>
          <span class="range-value-display" data-display="max">${maxDisplay}</span>
        </div>
        <div class="dual-range-slider" data-min-bound="${filter.minBound}" data-max-bound="${filter.maxBound}" data-step="${filter.step || 1}" data-format="${format}">
          <input 
            type="range" 
            class="range-input range-input-min"
            min="${filter.minBound}" 
            max="${filter.maxBound}" 
            value="${filter.min}" 
            step="${filter.step || 1}"
          />
          <input 
            type="range" 
            class="range-input range-input-max"
            min="${filter.minBound}" 
            max="${filter.maxBound}" 
            value="${filter.max}" 
            step="${filter.step || 1}"
          />
          <div class="range-track"></div>
          <div class="range-fill"></div>
        </div>
        <div class="range-labels">
          <span>${minBoundDisplay}</span>
          <span>${maxBoundDisplay}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a multi-select filter
 */
function renderMultiSelectFilter(id: string, label: string, filter: MultiSelectFilter): string {
  const safeId = id.replace(/\./g, '-');
  const optionsHtml = filter.options.map(option => `
    <label class="multiselect-option">
      <input type="checkbox" value="${option}" ${filter.selected.includes(option) ? 'checked' : ''} />
      <span class="multiselect-label">${option}</span>
    </label>
  `).join('');
  
  // Add mode toggle if this filter supports it
  const hasModeToggle = filter.mode !== undefined;
  const modeToggleHtml = hasModeToggle ? `
    <div class="multiselect-mode-toggle">
      <button class="mode-btn ${filter.mode === 'inclusive' ? 'active' : ''}" data-mode="inclusive" title="Show countries that have these colors (may have others)">
        Has colors
      </button>
      <button class="mode-btn ${filter.mode === 'exclusive' ? 'active' : ''}" data-mode="exclusive" title="Show countries that only have these colors (no others)">
        Only colors
      </button>
    </div>
  ` : '';
  
  return `
    <div class="filter-item filter-multiselect ${hasModeToggle ? 'has-mode-toggle' : ''}" data-filter-id="${id}">
      <div class="filter-item-header">
        <label class="filter-item-label" for="${safeId}-enabled">${label}</label>
        <label class="filter-toggle-switch">
          <input type="checkbox" id="${safeId}-enabled" ${filter.enabled ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="filter-item-control ${filter.enabled ? '' : 'disabled'}">
        ${modeToggleHtml}
        <div class="multiselect-options">
          ${optionsHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render all filters based on display config
 */
type FilterCategoryGroup = ReturnType<typeof getFiltersByCategory>;

function renderFilters(): void {
  if (!displayConfig) return;

  const container = document.getElementById('filter-categories');
  if (!container) return;

  const categories = getFiltersByCategory(filterState, displayConfig);

  const mobileLayout = isMobileLayout();
  container.classList.toggle('is-mobile-layout', mobileLayout);

  // Also add to filter panel so header buttons can be styled
  const filterPanel = document.getElementById('filter-panel');
  if (filterPanel) {
    filterPanel.classList.toggle('is-mobile-layout', mobileLayout);
  }

  container.innerHTML = mobileLayout
    ? renderCompactDockCategories(categories)
    : renderDesktopFilterCategories(categories);

  if (mobileLayout) {
    addHorizontalWheelScroll(container.querySelector('.filter-dock-track'));
  }

  attachFilterEventListeners();
}

function renderDesktopFilterCategories(categories: FilterCategoryGroup): string {
  return categories
    .map(({ category, categoryLabel, filters }) => {
      const isCollapsed = collapsedCategories.has(category);
      const filtersHtml = renderFilterGroup(filters);
      return `
        <div class="filter-category ${isCollapsed ? 'collapsed' : ''}" data-category="${category}">
          <button class="filter-category-header" type="button">
            <span class="filter-category-title">${categoryLabel}</span>
            <span class="filter-category-toggle">▼</span>
          </button>
          <div class="filter-category-content">
            ${filtersHtml}
          </div>
        </div>
      `;
    })
    .join('');
}

function renderCompactDockCategories(categories: FilterCategoryGroup): string {
  // Show all categories in compact dock
  const dockCategories = categories;

  // Count active categories and update header summary
  const activeCategories = dockCategories.filter(cat =>
    cat.filters.some(f => f.filter.enabled)
  );

  // Update mobile filter summary in header
  const summaryEl = document.getElementById('mobile-filter-summary');
  if (summaryEl) {
    if (activeCategories.length > 0) {
      const summary = activeCategories.slice(0, 2).map(c => c.categoryLabel).join(' · ') +
        (activeCategories.length > 2 ? ` +${activeCategories.length - 2}` : '');
      summaryEl.textContent = summary;
    } else {
      summaryEl.textContent = 'No filters active';
    }
  }

  // Build card track (horizontal scroll, show 2 filters per card for compact height)
  const cards = dockCategories.map(({ category, categoryLabel, filters }) => {
    // Show only 2 filters per card to fit without vertical scrolling
    const visibleFilters = filters.slice(0, 2);

    const filtersHtml = visibleFilters.map(({ id, label, filter }) => {
      // Use compact renderers based on filter type
      switch (filter.type) {
        case 'boolean':
          return renderCompactBooleanFilter(filter, id, label);
        case 'range':
          return renderCompactRangeFilter(filter, id, label);
        case 'multiselect':
          return renderCompactMultiSelectFilter(filter, id, label);
        default:
          return '';
      }
    }).join('');

    return `
      <section class="filter-dock-card" data-category="${category}">
        <p class="dock-card-title">${categoryLabel}</p>
        <div class="dock-card-body">
          ${filtersHtml}
        </div>
      </section>
    `;
  }).join('');

  return `<div class="filter-dock-track">${cards}</div>`;
}

function renderFilterGroup(
  filters: FilterCategoryGroup[number]['filters']
): string {
  return filters
    .map(({ id, label, filter }) => {
      switch (filter.type) {
        case 'boolean':
          return renderBooleanFilter(id, label, filter);
        case 'range':
          return renderRangeFilter(id, label, filter);
        case 'multiselect':
          return renderMultiSelectFilter(id, label, filter);
        default:
          return '';
      }
    })
    .join('');
}

/**
 * Attach event listeners to dynamically created filter elements
 */
function attachFilterEventListeners(): void {
  const container = document.getElementById('filter-categories');
  if (!container) return;
  
  // Category collapse toggles (desktop only - compact dock has no collapse)
  if (!isMobileLayout()) {
    container.querySelectorAll('.filter-category-header').forEach(header => {
      header.addEventListener('click', () => {
        const category = header.closest('.filter-category');
        const categoryId = category?.getAttribute('data-category');
        if (categoryId) {
          if (collapsedCategories.has(categoryId)) {
            collapsedCategories.delete(categoryId);
            category?.classList.remove('collapsed');
          } else {
            collapsedCategories.add(categoryId);
            category?.classList.add('collapsed');
          }
        }
      });
    });
  }
  
  // Enable/disable toggles
  container.querySelectorAll('.filter-toggle-switch input').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const filterItem = target.closest('.filter-item');
      const filterId = filterItem?.getAttribute('data-filter-id');
      if (!filterId) return;
      
      const control = filterItem?.querySelector('.filter-item-control');
      if (target.checked) {
        control?.classList.remove('disabled');
      } else {
        control?.classList.add('disabled');
      }
      
      setFilterValue(filterId, 'enabled', target.checked);
      onFilterChange();
    });
  });
  
  // Boolean filter buttons
  container.querySelectorAll('.filter-boolean .boolean-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLButtonElement;
      const filterItem = target.closest('.filter-item');
      const filterId = filterItem?.getAttribute('data-filter-id');
      if (!filterId) return;
      
      const value = target.getAttribute('data-value') === 'true';
      
      // Update UI
      filterItem?.querySelectorAll('.boolean-btn').forEach(b => b.classList.remove('active'));
      target.classList.add('active');
      
      setFilterValue(filterId, 'value', value);
      onFilterChange();
    });
  });
  
  // Range filter sliders
  container.querySelectorAll('.filter-range .dual-range-slider').forEach(slider => {
    const filterItem = slider.closest('.filter-item');
    const filterId = filterItem?.getAttribute('data-filter-id');
    if (!filterId) return;
    
    const minSlider = slider.querySelector('.range-input-min') as HTMLInputElement;
    const maxSlider = slider.querySelector('.range-input-max') as HTMLInputElement;
    const rangeFill = slider.querySelector('.range-fill') as HTMLElement;
    const minDisplay = filterItem?.querySelector('[data-display="min"]');
    const maxDisplay = filterItem?.querySelector('[data-display="max"]');
    
    const minBound = parseFloat(slider.getAttribute('data-min-bound') || '0');
    const maxBound = parseFloat(slider.getAttribute('data-max-bound') || '100');
    const format = slider.getAttribute('data-format') || 'number';
    
    const updateSlider = () => {
      const minVal = parseFloat(minSlider.value);
      const maxVal = parseFloat(maxSlider.value);
      
      // Update display
      if (minDisplay) minDisplay.textContent = formatFilterValue(minVal, format);
      if (maxDisplay) maxDisplay.textContent = formatFilterValue(maxVal, format);
      
      // Update range fill
      const percent1 = ((minVal - minBound) / (maxBound - minBound)) * 100;
      const percent2 = ((maxVal - minBound) / (maxBound - minBound)) * 100;
      rangeFill.style.left = `${percent1}%`;
      rangeFill.style.width = `${percent2 - percent1}%`;
      
      // Update filter state
      setFilterValue(filterId, 'min', minVal);
      setFilterValue(filterId, 'max', maxVal);
      onFilterChange();
    };
    
    const handleMinChange = () => {
      const minVal = parseFloat(minSlider.value);
      const maxVal = parseFloat(maxSlider.value);
      if (minVal > maxVal) {
        minSlider.value = String(maxVal);
      }
      updateSlider();
    };
    
    const handleMaxChange = () => {
      const minVal = parseFloat(minSlider.value);
      const maxVal = parseFloat(maxSlider.value);
      if (maxVal < minVal) {
        maxSlider.value = String(minVal);
      }
      updateSlider();
    };
    
    // Dynamic z-index for thumb selection
    const updateZIndex = (e: MouseEvent) => {
      const rect = slider.getBoundingClientRect();
      const mousePercent = (e.clientX - rect.left) / rect.width;
      
      const minVal = parseFloat(minSlider.value);
      const maxVal = parseFloat(maxSlider.value);
      const minPercent = (minVal - minBound) / (maxBound - minBound);
      const maxPercent = (maxVal - minBound) / (maxBound - minBound);
      
      const distToMin = Math.abs(mousePercent - minPercent);
      const distToMax = Math.abs(mousePercent - maxPercent);
      
      if (distToMin < distToMax) {
        minSlider.style.zIndex = '3';
        maxSlider.style.zIndex = '2';
      } else {
        minSlider.style.zIndex = '2';
        maxSlider.style.zIndex = '3';
      }
    };
    
    slider.addEventListener('mousemove', updateZIndex as EventListener);
    slider.addEventListener('touchstart', (e: Event) => {
      const te = e as TouchEvent;
      if (te.touches.length > 0) {
        updateZIndex({ clientX: te.touches[0].clientX } as MouseEvent);
      }
    });
    
    minSlider.addEventListener('input', handleMinChange);
    maxSlider.addEventListener('input', handleMaxChange);
    
    // Initial fill update
    const minVal = parseFloat(minSlider.value);
    const maxVal = parseFloat(maxSlider.value);
    const percent1 = ((minVal - minBound) / (maxBound - minBound)) * 100;
    const percent2 = ((maxVal - minBound) / (maxBound - minBound)) * 100;
    rangeFill.style.left = `${percent1}%`;
    rangeFill.style.width = `${percent2 - percent1}%`;
  });
  
  // Multi-select checkboxes
  container.querySelectorAll('.filter-multiselect .multiselect-option input').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const filterItem = target.closest('.filter-item');
      const filterId = filterItem?.getAttribute('data-filter-id');
      if (!filterId) return;
      
      const value = target.value;
      const filter = getFilterValue(filterId) as MultiSelectFilter;
      
      if (target.checked) {
        if (!filter.selected.includes(value)) {
          filter.selected.push(value);
        }
      } else {
        filter.selected = filter.selected.filter(v => v !== value);
      }
      
      onFilterChange();
    });
  });
  
  // Multi-select mode toggle buttons
  container.querySelectorAll('.filter-multiselect .multiselect-mode-toggle .mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLButtonElement;
      const filterItem = target.closest('.filter-item');
      const filterId = filterItem?.getAttribute('data-filter-id');
      if (!filterId) return;
      
      const mode = target.getAttribute('data-mode') as 'inclusive' | 'exclusive';
      const filter = getFilterValue(filterId) as MultiSelectFilter;
      filter.mode = mode;
      
      // Update UI
      filterItem?.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      target.classList.add('active');
      
      onFilterChange();
    });
  });

  // Compact boolean pills (mobile dock)
  container.querySelectorAll('.filter-compact-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const filterLine = target.closest('[data-filter-id]');
      const filterId = filterLine?.getAttribute('data-filter-id');
      if (!filterId) return;

      // Toggle active state
      const isActive = target.classList.contains('is-active');
      target.classList.toggle('is-active');
      target.classList.toggle('is-inactive');
      target.textContent = isActive ? 'Off' : 'Active';

      // Update filter state
      const filter = getFilterValue(filterId) as BooleanFilter;
      if (!filter) return;

      filter.enabled = true;
      filter.value = !isActive;

      onFilterChange();
    });
  });

  // Compact chips (mobile dock)
  container.querySelectorAll('.filter-compact-chips .chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const filterLine = target.closest('[data-filter-id]');
      const filterId = filterLine?.getAttribute('data-filter-id');
      const value = target.getAttribute('data-value');
      if (!filterId || !value) return;

      const filter = getFilterValue(filterId) as MultiSelectFilter;
      filter.enabled = true;

      // Toggle selected state
      target.classList.toggle('selected');

      if (target.classList.contains('selected')) {
        if (!filter.selected.includes(value)) {
          filter.selected.push(value);
        }
      } else {
        filter.selected = filter.selected.filter(v => v !== value);
      }

      onFilterChange();
    });
  });

  // Compact range sliders (mobile dock, tap-to-set)
  container.querySelectorAll('.filter-compact-range .range-track').forEach(track => {
    const handleInteraction = (e: MouseEvent | TouchEvent) => {
      const filterLine = (track as HTMLElement).closest('[data-filter-id]');
      const filterId = filterLine?.getAttribute('data-filter-id');
      if (!filterId) return;

      const rect = (track as HTMLElement).getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));

      // Update visual fill
      const fill = track.querySelector('span') as HTMLElement;
      if (fill) {
        fill.style.width = `${percent}%`;
      }

      // Update filter value
      const filter = getFilterValue(filterId) as RangeFilter;
      filter.enabled = true;

      const range = filter.maxBound - filter.minBound;
      const newMax = filter.minBound + (range * percent / 100);

      filter.max = newMax;

      // Update display value
      const format = filter.format || 'number';
      const valueDisplay = filterLine?.querySelector('.range-compact-value');
      if (valueDisplay) {
        const minDisplay = formatFilterValue(filter.min, format);
        const maxDisplay = formatFilterValue(newMax, format);
        valueDisplay.textContent = `${minDisplay} – ${maxDisplay}`;
      }

      onFilterChange();
    };

    track.addEventListener('click', handleInteraction as EventListener);
    track.addEventListener('touchstart', handleInteraction as EventListener);
  });

  // Mobile Clear button in header (attach once on first render)
  const mobileClearBtn = document.getElementById('mobile-clear-filters');
  if (mobileClearBtn && !mobileClearBtn.dataset.listenerAttached) {
    mobileClearBtn.dataset.listenerAttached = 'true';
    mobileClearBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent triggering panel toggle
      filterState = clearAllFilters();
      renderFilters();
      updateFilterQueryParams(filterState);
      updateMapHighlighting();
      updateMatchingCountries();
    });
  }
}

/**
 * Load and render the GeoJSON world map
 */
async function loadGeoJSON(): Promise<void> {
  try {
    const response = await fetch(GEOJSON_URL);
    const geojson: GeoJSON.FeatureCollection = await response.json();
    
    // Clear and rebuild the country code to layer mapping
    countryCodeToLayer.clear();
    
    geoJsonLayer = L.geoJSON(geojson, {
      style: (feature) => {
        const countryCode = feature ? getCountryCode(feature) : null;
        return getStyleForLayer(countryCode, false, false);
      },
      onEachFeature: (feature, layer) => {
        const countryCode = getCountryCode(feature);
        const country = countryCode ? countriesMap.get(countryCode) : null;
        const countryName =
          country?.name || feature.properties?.name || feature.properties?.ADMIN || 'Unknown';
        
        // Store the layer for country code lookup
        if (countryCode) {
          countryCodeToLayer.set(countryCode, layer);
        }

        // Add tooltip
        layer.bindTooltip(countryName, {
          sticky: true,
          className: 'country-tooltip',
          direction: 'top',
          offset: [0, -10],
        });

        // Add hover effects
        layer.on('mouseover', () => {
          if (layer !== selectedLayer) {
            const style = getStyleForLayer(countryCode, false, true);
            (layer as L.Path).setStyle(style);
          }
        });

        layer.on('mouseout', () => {
          if (layer !== selectedLayer) {
            const style = getStyleForLayer(countryCode, false, false);
            (layer as L.Path).setStyle(style);
          }
        });

        // Add click handler
        layer.on('click', () => {
          // Reset previous selection
          if (selectedLayer && selectedLayer !== layer) {
            const prevFeature = (selectedLayer as L.GeoJSON).feature as GeoJSON.Feature;
            const prevCode = getCountryCode(prevFeature);
            const prevStyle = getStyleForLayer(prevCode, false, false);
            (selectedLayer as L.Path).setStyle(prevStyle);
          }

          // Set new selection
          selectedLayer = layer;
          (layer as L.Path).setStyle(selectedStyle);

          // Show details panel
          if (country) {
            showDetails(country);
          } else {
            showDetails(null, countryName, countryCode);
          }
          
          // Update the countries list selection
          updateCountriesListSelection(countryCode);
        });
      },
    }).addTo(map);
    
    // Initial filter update
    updateHighlightedCountries();
    updateMapStyles();
    renderCountriesList();
  } catch (error) {
    console.error('Failed to load GeoJSON:', error);
  }
}

/**
 * Show the country details in the panel
 */
function showDetails(
  country: Country | null,
  fallbackName?: string,
  fallbackCode?: string | null
): void {
  lastDetailsContext = {
    country,
    fallbackName,
    fallbackCode: fallbackCode ?? null,
  };
  renderDetailsContentForCurrentLayout();

  if (isMobileLayout()) {
    setMobilePanelState('details', true);
  }
}

/**
 * Clear the details panel
 */
function clearDetails(): void {
  lastDetailsContext = { country: null };
  renderDetailsContentForCurrentLayout();
}

/**
 * Hide the details panel (mobile only)
 */
function hideDetails(): void {
  // Deselect country
  if (selectedLayer) {
    const feature = (selectedLayer as L.GeoJSON).feature as GeoJSON.Feature;
    const countryCode = getCountryCode(feature);
    const style = getStyleForLayer(countryCode, false, false);
    (selectedLayer as L.Path).setStyle(style);
    selectedLayer = null;
  }
  
  // Clear countries list selection
  updateCountriesListSelection(null);
  
  clearDetails();
  
  setMobilePanelState('details', false, false);
}

function isMobileLayout(): boolean {
  return mobileLayoutQuery.matches;
}

function getFlagEmojiFromCode(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '🌍';
  return code
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('');
}

function addHorizontalWheelScroll(element: HTMLElement | null): void {
  if (!element) return;
  const target = element as HorizontalScrollable;
  if (target.dataset.hScrollBound === 'true') return;
  target.addEventListener(
    'wheel',
    (event) => {
      if (!event.deltaY || element.scrollWidth <= element.clientWidth) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX || 0)) return;
      event.preventDefault();
      element.scrollLeft += event.deltaY;
    },
    { passive: false }
  );
  target.dataset.hScrollBound = 'true';
}

function renderFallbackDetails(fallbackName?: string, fallbackCode?: string | null): string {
  return `
      <div class="country-header">
        <div>
          <h2 class="country-name">${fallbackName || 'Unknown Country'}</h2>
          ${fallbackCode ? `<div class="country-id">${fallbackCode}</div>` : ''}
        </div>
      </div>
      <div class="fact-section">
        <p style="color: var(--text-secondary);">
          No detailed data available for this country/territory.
        </p>
      </div>
    `;
}

function updateMobileDetailsHeader(
  country: Country | null,
  fallbackName?: string,
  fallbackCode?: string | null
): void {
  if (!mobileDetailsHeader.title) return;

  if (!isMobileLayout()) {
    mobileDetailsHeader.title.textContent = defaultMobileDetailsTitle;
    if (mobileDetailsHeader.subtitle) {
      mobileDetailsHeader.subtitle.textContent = defaultMobileDetailsSubtitle;
      mobileDetailsHeader.subtitle.classList.remove('is-hidden');
    }
    return;
  }

  if (country || fallbackName) {
    const name = country?.name || fallbackName || defaultMobileDetailsTitle;
    const code = country?.id || fallbackCode || null;
    const emoji = getFlagEmojiFromCode(code);
    mobileDetailsHeader.title.textContent = `${emoji} ${name}`;
    if (mobileDetailsHeader.subtitle) {
      mobileDetailsHeader.subtitle.textContent = '';
      mobileDetailsHeader.subtitle.classList.add('is-hidden');
    }
  } else {
    mobileDetailsHeader.title.textContent = defaultMobileDetailsTitle;
    if (mobileDetailsHeader.subtitle) {
      mobileDetailsHeader.subtitle.textContent = defaultMobileDetailsSubtitle;
      mobileDetailsHeader.subtitle.classList.remove('is-hidden');
    }
  }
}

function renderDetailsContentForCurrentLayout(): void {
  const panel = document.getElementById('details-panel');
  const content = panel?.querySelector('.details-content');
  if (!panel || !content) return;
  const { country, fallbackName, fallbackCode } = lastDetailsContext;

  if (!country && !fallbackName) {
    if (isMobileLayout()) {
      content.innerHTML = '';
    } else {
      content.innerHTML = DETAILS_EMPTY_TEMPLATE;
    }
    updateMobileDetailsHeader(null);
    return;
  }

  if (isMobileLayout()) {
    content.innerHTML = renderMobileDetails(country, fallbackName);
    updateMobileDetailsHeader(country, fallbackName, fallbackCode ?? null);
    addHorizontalWheelScroll(content.querySelector('.mobile-details-cards'));
    return;
  }

  content.innerHTML = country
    ? renderCountryPopup(country)
    : renderFallbackDetails(fallbackName, fallbackCode ?? null);
  updateMobileDetailsHeader(country, fallbackName, fallbackCode ?? null);
}

function setMobilePanelState(id: MobilePanelId, expanded: boolean, collapseOthers = true): void {
  if (!isMobileLayout()) return;
  const panel = mobilePanels[id];
  const toggle = mobilePanelToggles[id];
  if (!panel || !toggle) return;

  panel.dataset.mobileState = expanded ? 'expanded' : 'collapsed';
  toggle.setAttribute('aria-expanded', String(expanded));

  const label = toggle.querySelector<HTMLElement>('.mobile-panel-toggle-label');
  if (label) {
    label.textContent = expanded ? 'Collapse' : 'Expand';
  }

  const icon = toggle.querySelector<HTMLElement>('.mobile-panel-toggle-icon');
  if (icon) {
    icon.textContent = expanded ? '▴' : '▾';
  }

  if (expanded && collapseOthers) {
    mobilePanelIds
      .filter((panelId) => panelId !== id)
      .forEach((panelId) => setMobilePanelState(panelId, false, false));
  }
}

function setupMobilePanels(): void {
  mobilePanels.filters = document.getElementById('filter-panel');
  mobilePanels.details = document.getElementById('details-panel');
  mobilePanelToggles.filters = document.querySelector<HTMLButtonElement>('[data-panel-toggle="filters"]');
  mobilePanelToggles.details = document.querySelector<HTMLButtonElement>('[data-panel-toggle="details"]');
  mobilePanelHeaders.filters = document.querySelector<HTMLElement>('#filter-panel .filter-panel-header');
  mobilePanelHeaders.details = document.querySelector<HTMLElement>('#details-panel .mobile-panel-header');

  const ready = mobilePanelIds.every((panelId) => mobilePanels[panelId] && mobilePanelToggles[panelId]);
  if (!ready) return;

  const applyLayoutState = (isMobile: boolean): void => {
    if (!isMobile) {
      mobilePanelIds.forEach((panelId) => {
        mobilePanels[panelId]?.removeAttribute('data-mobile-state');
        const toggle = mobilePanelToggles[panelId];
        const header = mobilePanelHeaders[panelId];
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'false');
          const label = toggle.querySelector<HTMLElement>('.mobile-panel-toggle-label');
          if (label) label.textContent = 'Expand';
          const icon = toggle.querySelector<HTMLElement>('.mobile-panel-toggle-icon');
          if (icon) icon.textContent = '▾';
        }
        if (header) {
          header.classList.remove('is-collapsible');
        }
      });
      return;
    }

    mobilePanelIds.forEach((panelId) => setMobilePanelState(panelId, false, false));
    mobilePanelIds.forEach((panelId) => mobilePanelHeaders[panelId]?.classList.add('is-collapsible'));
  };

  applyLayoutState(isMobileLayout());
  renderDetailsContentForCurrentLayout();

  const handleChange = (matches: boolean): void => {
    applyLayoutState(matches);
    renderDetailsContentForCurrentLayout();
    renderFilters();
  };

  if (typeof mobileLayoutQuery.addEventListener === 'function') {
    mobileLayoutQuery.addEventListener('change', (event) => handleChange(event.matches));
  } else {
    mobileLayoutQuery.addListener((event) => handleChange(event.matches));
  }

  mobilePanelIds.forEach((panelId) => {
    const toggle = mobilePanelToggles[panelId];
    const header = mobilePanelHeaders[panelId];
    const handler = () => {
      if (!isMobileLayout()) return;
      const panel = mobilePanels[panelId];
      if (!panel) return;
      const shouldExpand = panel.dataset.mobileState !== 'expanded';
      setMobilePanelState(panelId, shouldExpand);
    };
    toggle?.addEventListener('click', handler);
    if (header && header !== toggle) {
      header.addEventListener('click', handler);
    }
  });
}

/**
 * Setup filter controls and responsive panel toggles
 */
function setupFilterPanel(): void {
  const clearBtn = document.getElementById('clear-filters');
  clearBtn?.addEventListener('click', () => {
    filterState = clearAllFilters();
    renderFilters();
    onFilterChange();
  });

  setupMobilePanels();
}

/**
 * Setup the details panel close button (mobile)
 */
function setupDetailsPanel(): void {
  const closeBtn = document.querySelector('.details-panel .panel-close');
  closeBtn?.addEventListener('click', hideDetails);
}

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  // Initialize map
  map = initMap();

  // Setup UI components
  setupFilterPanel();
  setupDetailsPanel();

  // Close panels on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideDetails();
      if (isMobileLayout()) {
        setMobilePanelState('filters', false, false);
        setMobilePanelState('details', false, false);
      }
    }
  });

  // Load data
  try {
    const [, config] = await Promise.all([
      loadCountryData(),
      loadDisplayConfig(),
    ]);
    displayConfig = config;
    
    // Render filters based on display config
    renderFilters();
    updateFilterQueryParams(filterState);
    
    // Load GeoJSON
    await loadGeoJSON();
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
}

// Start the appropriate experience
if (isMobilePrototypeRoute) {
  import('./mobile-prototype')
    .then(({ initMobilePrototype }) => initMobilePrototype())
    .catch((error) => console.error('Failed to load mobile prototype:', error));
} else if (isFilterExperimentsRoute) {
  import('./filter-experiments')
    .then(({ initFilterExperiments }) => initFilterExperiments())
    .catch((error) => console.error('Failed to load filter experiments:', error));
} else {
  init().catch(console.error);
}
