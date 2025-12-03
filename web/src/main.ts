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

// Currently selected country layer
let selectedLayer: L.Layer | null = null;

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
 * Load and render the GeoJSON world map
 */
async function loadGeoJSON(): Promise<void> {
  try {
    const response = await fetch(GEOJSON_URL);
    const geojson: GeoJSON.FeatureCollection = await response.json();
    
    L.geoJSON(geojson, {
      style: defaultStyle,
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
            (layer as L.Path).setStyle(hoverStyle);
          }
        });

        layer.on('mouseout', () => {
          if (layer !== selectedLayer) {
            (layer as L.Path).setStyle(defaultStyle);
          }
        });

        // Add click handler
        layer.on('click', () => {
          // Reset previous selection
          if (selectedLayer && selectedLayer !== layer) {
            (selectedLayer as L.Path).setStyle(defaultStyle);
          }

          // Set new selection
          selectedLayer = layer;
          (layer as L.Path).setStyle(selectedStyle);

          // Show popup
          if (country) {
            showPopup(country);
          } else {
            showPopup(null, countryName, countryCode);
          }
        });
      },
    }).addTo(map);
  } catch (error) {
    console.error('Failed to load GeoJSON:', error);
  }
}

/**
 * Show the country popup panel
 */
function showPopup(
  country: Country | null,
  fallbackName?: string,
  fallbackCode?: string | null
): void {
  const popup = document.getElementById('popup');
  const content = popup?.querySelector('.popup-content');
  
  if (!popup || !content) return;

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

  popup.classList.remove('hidden');
}

/**
 * Hide the popup
 */
function hidePopup(): void {
  const popup = document.getElementById('popup');
  if (popup) {
    popup.classList.add('hidden');
  }

  // Deselect country
  if (selectedLayer) {
    (selectedLayer as L.Path).setStyle(defaultStyle);
    selectedLayer = null;
  }
}

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  // Initialize map
  map = initMap();

  // Set up popup close button
  const closeBtn = document.querySelector('.popup-close');
  closeBtn?.addEventListener('click', hidePopup);

  // Close popup on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hidePopup();
    }
  });

  // Load country data first, then GeoJSON (GeoJSON needs country data for matching)
  await loadCountryData();
  await loadGeoJSON();
}

// Start the app
init().catch(console.error);

