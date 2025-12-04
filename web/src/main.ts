import './style.css';
import L from 'leaflet';
import type { Country } from './types/country';
import { renderCountryPopup } from './popup';

// GeoJSON URL for world countries (Natural Earth via GitHub)
const GEOJSON_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

// Store country data keyed by ISO code
let countriesMap: Map<string, Country> = new Map();

// Map instance
let map: L.Map;

// GeoJSON layer reference for updating styles
let geoJsonLayer: L.GeoJSON | null = null;

// Currently selected country layer
let selectedLayer: L.Layer | null = null;

// Filter state
interface FilterState {
  borders: {
    enabled: boolean;
    min: number;
    max: number;
  };
}

const FILTER_STORAGE_KEY = 'geogrid-filter-state';

// Default filter state
const defaultFilterState: FilterState = {
  borders: {
    enabled: true,
    min: 0,
    max: 14,
  },
};

// Load saved state or use defaults
function loadFilterState(): FilterState {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to handle any missing properties
      return {
        borders: {
          ...defaultFilterState.borders,
          ...parsed.borders,
        },
      };
    }
  } catch (e) {
    console.warn('Failed to load filter state:', e);
  }
  return { ...defaultFilterState };
}

// Save state to localStorage
function saveFilterState(): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterState));
  } catch (e) {
    console.warn('Failed to save filter state:', e);
  }
}

let filterState: FilterState = loadFilterState();

// Track highlighted countries for filter
let highlightedCountries: Set<string> = new Set();

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

  // Add a subtle tile layer for context (optional - can be removed for pure SVG look)
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
 * Load country data from the JSONL file (bundled during build)
 */
async function loadCountryData(): Promise<void> {
  try {
    const response = await fetch('./countries.json');
    const countries: Country[] = await response.json();
    
    countriesMap = new Map(countries.map((c) => [c.id, c]));
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
  
  // The geo-countries dataset uses ISO3166-1-Alpha-2 for 2-letter codes
  const code =
    props['ISO3166-1-Alpha-2'] ||
    props.ISO_A2 ||
    props.iso_a2 ||
    props.ISO ||
    props.id ||
    null;
  
  return code;
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
 * Check if a country matches the current active filters
 * Returns true if the country matches ALL enabled filters
 */
function countryMatchesFilter(country: Country): boolean {
  // If no filters are enabled, nothing is highlighted
  const anyFilterEnabled = filterState.borders.enabled;
  if (!anyFilterEnabled) {
    return false;
  }

  // Check borders filter
  if (filterState.borders.enabled) {
    const borderCount = country.borders.countries.length;
    if (borderCount < filterState.borders.min || borderCount > filterState.borders.max) {
      return false;
    }
  }

  return true;
}

/**
 * Count active filters
 */
function countActiveFilters(): number {
  let count = 0;
  if (filterState.borders.enabled) count++;
  // Add more filter checks here as they're added
  return count;
}

/**
 * Update the highlighted countries based on filter state
 */
function updateHighlightedCountries(): void {
  highlightedCountries.clear();
  
  countriesMap.forEach((country, code) => {
    if (countryMatchesFilter(country)) {
      highlightedCountries.add(code);
    }
  });
  
  // Update the individual filter match count
  const matchedCount = document.getElementById('matched-count');
  if (matchedCount) {
    matchedCount.textContent = String(highlightedCountries.size);
  }
  
  // Update summary stats
  const totalHighlighted = document.getElementById('total-highlighted');
  const activeFilters = document.getElementById('active-filters');
  
  if (totalHighlighted) {
    totalHighlighted.textContent = String(highlightedCountries.size);
  }
  
  if (activeFilters) {
    activeFilters.textContent = String(countActiveFilters());
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
 * Handle filter changes
 */
function onFilterChange(): void {
  updateHighlightedCountries();
  updateMapStyles();
  saveFilterState();
}

/**
 * Load and render the GeoJSON world map
 */
async function loadGeoJSON(): Promise<void> {
  try {
    const response = await fetch(GEOJSON_URL);
    const geojson: GeoJSON.FeatureCollection = await response.json();
    
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
        });
      },
    }).addTo(map);
    
    // Initial filter update
    updateHighlightedCountries();
    updateMapStyles();
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
    // Show minimal info for countries not in our dataset
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
  
  clearDetails();
}

/**
 * Setup the dual range slider for border count filter
 */
function setupRangeSlider(): void {
  const minSlider = document.getElementById('border-min') as HTMLInputElement;
  const maxSlider = document.getElementById('border-max') as HTMLInputElement;
  const minDisplay = document.getElementById('border-min-display');
  const maxDisplay = document.getElementById('border-max-display');
  const rangeFill = document.getElementById('range-fill');
  const sliderContainer = document.querySelector('.dual-range-slider') as HTMLElement;
  
  if (!minSlider || !maxSlider || !minDisplay || !maxDisplay || !rangeFill || !sliderContainer) return;
  
  const sliderMax = 14;
  
  function updateDisplay(): void {
    const minVal = parseInt(minSlider.value);
    const maxVal = parseInt(maxSlider.value);
    
    // Update display
    minDisplay!.textContent = String(minVal);
    maxDisplay!.textContent = String(maxVal);
    
    // Update range fill position
    const percent1 = (minVal / sliderMax) * 100;
    const percent2 = (maxVal / sliderMax) * 100;
    rangeFill!.style.left = `${percent1}%`;
    rangeFill!.style.width = `${percent2 - percent1}%`;
    
    // Update filter state
    filterState.borders.min = minVal;
    filterState.borders.max = maxVal;
    
    // Trigger filter update
    onFilterChange();
  }
  
  function handleMinChange(): void {
    const minVal = parseInt(minSlider.value);
    const maxVal = parseInt(maxSlider.value);
    
    // Prevent min from exceeding max
    if (minVal > maxVal) {
      minSlider.value = String(maxVal);
    }
    
    updateDisplay();
  }
  
  function handleMaxChange(): void {
    const minVal = parseInt(minSlider.value);
    const maxVal = parseInt(maxSlider.value);
    
    // Prevent max from going below min
    if (maxVal < minVal) {
      maxSlider.value = String(minVal);
    }
    
    updateDisplay();
  }
  
  // Dynamic z-index based on mouse position
  function updateZIndex(e: MouseEvent): void {
    const rect = sliderContainer.getBoundingClientRect();
    const mousePercent = (e.clientX - rect.left) / rect.width;
    
    const minVal = parseInt(minSlider.value);
    const maxVal = parseInt(maxSlider.value);
    const minPercent = minVal / sliderMax;
    const maxPercent = maxVal / sliderMax;
    
    // Calculate distance to each thumb
    const distToMin = Math.abs(mousePercent - minPercent);
    const distToMax = Math.abs(mousePercent - maxPercent);
    
    // Bring closer thumb to top
    if (distToMin < distToMax) {
      minSlider.style.zIndex = '3';
      maxSlider.style.zIndex = '2';
    } else {
      minSlider.style.zIndex = '2';
      maxSlider.style.zIndex = '3';
    }
  }
  
  sliderContainer.addEventListener('mousemove', updateZIndex);
  sliderContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      updateZIndex({ clientX: touch.clientX } as MouseEvent);
    }
  });
  
  minSlider.addEventListener('input', handleMinChange);
  maxSlider.addEventListener('input', handleMaxChange);
  
  // Set initial values from saved state
  minSlider.value = String(filterState.borders.min);
  maxSlider.value = String(filterState.borders.max);
  
  // Initial display update
  updateDisplay();
}

/**
 * Setup filter enable/disable toggles
 */
function setupFilterToggles(): void {
  const bordersToggle = document.getElementById('filter-borders-enabled') as HTMLInputElement;
  const bordersSection = document.querySelector('[data-filter="borders"]');
  
  if (!bordersToggle || !bordersSection) return;
  
  function applyToggleState(): void {
    // Toggle visual disabled state
    if (filterState.borders.enabled) {
      bordersSection!.classList.remove('disabled');
    } else {
      bordersSection!.classList.add('disabled');
    }
  }
  
  bordersToggle.addEventListener('change', () => {
    filterState.borders.enabled = bordersToggle.checked;
    applyToggleState();
    onFilterChange();
  });
  
  // Initialize checkbox from saved state
  bordersToggle.checked = filterState.borders.enabled;
  applyToggleState();
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
  
  // Also handle the mobile floating button if we add one
  const mobileToggle = document.querySelector('.mobile-filter-toggle');
  mobileToggle?.addEventListener('click', toggleFilter);
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
  setupRangeSlider();
  setupFilterToggles();
  setupDetailsPanel();

  // Close details on Escape key (mobile)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideDetails();
      // Also close filter panel
      document.getElementById('filter-panel')?.classList.remove('open');
      document.querySelector('.filter-overlay')?.classList.remove('visible');
    }
  });

  // Load country data first, then GeoJSON (GeoJSON needs country data for matching)
  await loadCountryData();
  await loadGeoJSON();
}

// Start the app
init().catch(console.error);
