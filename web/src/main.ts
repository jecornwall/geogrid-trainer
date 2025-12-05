import './style.css';
import L from 'leaflet';
import type { Country } from './types/country';
import type { FilterState, RangeFilter, BooleanFilter, MultiSelectFilter, DisplayConfig } from './types/filters';
import {
  loadFilterState,
  saveFilterState,
  countActiveFilters,
  countryMatchesFilters,
  getFiltersByCategory,
  formatFilterValue,
  clearAllFilters,
} from './filters';
import { renderCountryPopup } from './popup';

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
let filterState: FilterState = loadFilterState();

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
 * Handle filter changes
 */
function onFilterChange(): void {
  updateHighlightedCountries();
  updateMapStyles();
  renderCountriesList();
  saveFilterState(filterState);
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
function renderFilters(): void {
  if (!displayConfig) return;
  
  const container = document.getElementById('filter-categories');
  if (!container) return;
  
  const categories = getFiltersByCategory(filterState, displayConfig);
  
  const html = categories.map(({ category, categoryLabel, filters }) => {
    const isCollapsed = collapsedCategories.has(category);
    const filtersHtml = filters.map(({ id, label, filter }) => {
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
    }).join('');
    
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
  }).join('');
  
  container.innerHTML = html;
  
  // Attach event listeners
  attachFilterEventListeners();
}

/**
 * Attach event listeners to dynamically created filter elements
 */
function attachFilterEventListeners(): void {
  const container = document.getElementById('filter-categories');
  if (!container) return;
  
  // Category collapse toggles
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
  const panel = document.getElementById('details-panel');
  const content = panel?.querySelector('.details-content');
  
  if (!panel || !content) return;

  if (country) {
    content.innerHTML = renderCountryPopup(country);
  } else {
    content.innerHTML = `
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

  // On mobile, open the details panel
  if (window.innerWidth <= 900) {
    panel.classList.add('open');
  }
}

/**
 * Clear the details panel
 */
function clearDetails(): void {
  const content = document.querySelector('.details-content');
  if (content) {
    content.innerHTML = `
      <div class="details-empty">
        <div class="empty-icon">🌍</div>
        <p>Select a country to view details</p>
      </div>
    `;
  }
}

/**
 * Hide the details panel (mobile only)
 */
function hideDetails(): void {
  const panel = document.getElementById('details-panel');
  if (panel) {
    panel.classList.remove('open');
  }

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
}

/**
 * Setup mobile filter panel toggle
 */
function setupFilterPanel(): void {
  const filterPanel = document.getElementById('filter-panel');
  const filterToggle = document.getElementById('filter-toggle');
  
  if (!filterPanel || !filterToggle) return;
  
  // Create overlay for mobile
  const overlay = document.createElement('div');
  overlay.className = 'filter-overlay';
  document.querySelector('.main-layout')?.appendChild(overlay);
  
  function toggleFilter(): void {
    const isOpen = filterPanel!.classList.toggle('open');
    if (isOpen) {
      overlay.classList.add('visible');
    } else {
      overlay.classList.remove('visible');
    }
  }
  
  filterToggle.addEventListener('click', toggleFilter);
  overlay.addEventListener('click', toggleFilter);
  
  // Also handle the mobile floating button
  const mobileToggle = document.querySelector('.mobile-filter-toggle');
  mobileToggle?.addEventListener('click', toggleFilter);
  
  // Clear filters button
  const clearBtn = document.getElementById('clear-filters');
  clearBtn?.addEventListener('click', () => {
    filterState = clearAllFilters();
    renderFilters();
    onFilterChange();
  });
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
      document.getElementById('filter-panel')?.classList.remove('open');
      document.querySelector('.filter-overlay')?.classList.remove('visible');
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
    
    // Load GeoJSON
    await loadGeoJSON();
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
}

// Start the app
init().catch(console.error);
