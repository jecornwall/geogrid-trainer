import type { Country } from './types/country';
import type { DisplayConfig } from './types/display-config';
import displayConfig from './data/display-config.json';

// Cast the imported JSON to our type
const config = displayConfig as unknown as DisplayConfig;

/**
 * Format a number with thousand separators
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Format area in km²
 */
function formatArea(km2: number): string {
  if (km2 >= 1_000_000) {
    return `${(km2 / 1_000_000).toFixed(2)}M km²`;
  }
  return `${formatNumber(Math.round(km2))} km²`;
}

/**
 * Format population
 */
function formatPopulation(pop: number): string {
  if (pop >= 1_000_000_000) {
    return `${(pop / 1_000_000_000).toFixed(2)}B`;
  }
  if (pop >= 1_000_000) {
    return `${(pop / 1_000_000).toFixed(2)}M`;
  }
  if (pop >= 1_000) {
    return `${(pop / 1_000).toFixed(1)}K`;
  }
  return formatNumber(pop);
}

/**
 * Render a boolean badge
 */
function boolBadge(value: boolean, yesText = 'Yes', noText = 'No'): string {
  const cls = value ? 'badge-yes' : 'badge-no';
  const icon = value ? '✓' : '—';
  const text = value ? yesText : noText;
  return `<span class="badge ${cls}">${icon} ${text}</span>`;
}

/**
 * Render a list of tags
 */
function tagList(items: string[]): string {
  if (items.length === 0) return '<span class="fact-value">—</span>';
  return `<div class="tag-list">${items.map((i) => `<span class="tag">${i}</span>`).join('')}</div>`;
}

/**
 * Render Olympic medals display
 */
function renderMedals(medals: Country['sports']['olympic_medals']): string {
  if (medals.total === 0) {
    return '<span class="fact-value">No medals</span>';
  }

  const gold = medals.gold ?? 0;
  const silver = medals.silver ?? 0;
  const bronze = medals.bronze ?? 0;

  // If we have the breakdown
  if (gold > 0 || silver > 0 || bronze > 0) {
    return `
      <div class="medals">
        <span class="medal medal-gold">
          <span class="medal-icon">🥇</span>
          ${gold}
        </span>
        <span class="medal medal-silver">
          <span class="medal-icon">🥈</span>
          ${silver}
        </span>
        <span class="medal medal-bronze">
          <span class="medal-icon">🥉</span>
          ${bronze}
        </span>
      </div>
    `;
  }

  // Just total
  return `<span class="fact-value">${medals.total} total</span>`;
}

/**
 * Helper to render a fact item only if the field is enabled in config
 */
function factItem(
  enabled: boolean,
  label: string,
  value: string,
  options: { fullWidth?: boolean; mono?: boolean; large?: boolean } = {}
): string {
  if (!enabled) return '';
  const classes = ['fact-item'];
  if (options.fullWidth) classes.push('full-width');
  
  const valueClasses = ['fact-value'];
  if (options.mono) valueClasses.push('mono');
  if (options.large) valueClasses.push('large');
  
  return `
    <div class="${classes.join(' ')}">
      <div class="fact-label">${label}</div>
      <div class="${valueClasses.join(' ')}">${value}</div>
    </div>
  `;
}

/**
 * Helper to render a boolean fact item only if the field is enabled
 */
function boolFactItem(
  enabled: boolean,
  label: string,
  value: boolean,
  yesText = 'Yes',
  noText = 'No'
): string {
  if (!enabled) return '';
  return `
    <div class="fact-item">
      <div class="fact-label">${label}</div>
      ${boolBadge(value, yesText, noText)}
    </div>
  `;
}

/**
 * Render the full country popup content
 */
export function renderCountryPopup(country: Country): string {
  const {
    name,
    id,
    flag_image_url,
    geography,
    political,
    population,
    area_km2,
    economic,
    facts,
    sports,
    borders,
  } = country;

  // Determine flag URL - handle relative paths
  const flagUrl = flag_image_url.startsWith('http')
    ? flag_image_url
    : flag_image_url.replace('/flags/', './flags/');

  // Build geography section items
  const geographyItems = [
    factItem(config.geography.continents, 'Continent', geography.continents.join(', ') || '—'),
    factItem(config.area_km2, 'Area', formatArea(area_km2), { mono: true }),
    boolFactItem(config.geography.is_island_nation, 'Island Nation', geography.is_island_nation),
    boolFactItem(config.geography.is_landlocked, 'Landlocked', geography.is_landlocked),
    config.geography.coastline_km && geography.coastline_km && geography.coastline_km > 0
      ? factItem(true, 'Coastline', `${formatNumber(geography.coastline_km)} km`, { fullWidth: true, mono: true })
      : '',
    config.geography.coastlines && geography.coastlines.length > 0
      ? `<div class="fact-item full-width"><div class="fact-label">Coastlines On</div>${tagList(geography.coastlines)}</div>`
      : '',
    config.geography.river_systems && geography.river_systems.length > 0
      ? `<div class="fact-item full-width"><div class="fact-label">River Systems</div>${tagList(geography.river_systems)}</div>`
      : '',
  ].filter(Boolean).join('');

  // Build population section items
  const populationItems = [
    factItem(config.population.count, 'Population', formatPopulation(population.count), { large: true }),
    factItem(config.population.density_per_km2, 'Density', `${formatNumber(Math.round(population.density_per_km2))}/km²`, { mono: true }),
    factItem(config.population.capitals, 'Capital', population.capitals.map((c) => c.name).join(', ') || '—'),
    factItem(config.population.most_populated_city, 'Largest City', population.most_populated_city || '—'),
  ].filter(Boolean).join('');

  // Build political section items
  const politicalItems = [
    boolFactItem(config.political.is_eu_member, 'EU Member', political.is_eu_member),
    boolFactItem(config.political.is_commonwealth_member, 'Commonwealth', political.is_commonwealth_member),
    boolFactItem(config.political.is_monarchy, 'Monarchy', political.is_monarchy),
    boolFactItem(config.political.was_ussr, 'Former USSR', political.was_ussr),
    boolFactItem(config.political.has_nuclear_weapons, 'Nuclear Weapons', political.has_nuclear_weapons),
    boolFactItem(config.political.is_dependency, 'Dependency', political.is_dependency),
    config.political.official_languages && political.official_languages.length > 0
      ? `<div class="fact-item full-width"><div class="fact-label">Official Languages</div>${tagList(political.official_languages)}</div>`
      : '',
    config.political.time_zones
      ? `<div class="fact-item full-width"><div class="fact-label">Time Zones</div>${tagList(political.time_zones)}</div>`
      : '',
  ].filter(Boolean).join('');

  // Build economic section items
  const economicItems = [
    config.economic.gdp_per_capita && economic.gdp_per_capita > 0
      ? factItem(true, 'GDP per Capita', `$${formatNumber(Math.round(economic.gdp_per_capita))}`, { mono: true })
      : '',
    config.economic.hdi && economic.hdi > 0
      ? factItem(true, 'HDI', economic.hdi.toFixed(3), { mono: true })
      : '',
    boolFactItem(config.economic.produces_nuclear_power, 'Nuclear Power', economic.produces_nuclear_power),
  ].filter(Boolean).join('');

  // Build borders section
  const bordersSection = config.borders.countries && borders.countries.length > 0
    ? `
    <div class="fact-section">
      <h3 class="fact-section-title">Borders</h3>
      <div class="fact-grid">
        <div class="fact-item full-width">
          <div class="fact-label">${borders.countries.length} Neighboring Countries</div>
          ${tagList(borders.countries)}
        </div>
      </div>
    </div>
    `
    : '';

  // Build facts section items
  const factsItems = [
    factItem(config.facts.drives_on_left, 'Drives On', facts.drives_on_left ? 'Left' : 'Right'),
    boolFactItem(config.facts.has_alcohol_prohibition, 'Alcohol Ban', facts.has_alcohol_prohibition),
    boolFactItem(config.political.same_sex_marriage_legal, 'Same-Sex Marriage', political.same_sex_marriage_legal, 'Legal', 'Not Legal'),
    boolFactItem(config.political.observes_dst, 'Observes DST', political.observes_dst),
  ].filter(Boolean).join('');

  // Build sports section items
  const sportsItems = [
    config.sports.olympic_medals
      ? `<div class="fact-item full-width"><div class="fact-label">Olympic Medals</div>${renderMedals(sports.olympic_medals)}</div>`
      : '',
    config.sports.olympics_hosted && sports.olympics_hosted.length > 0
      ? `<div class="fact-item full-width"><div class="fact-label">Olympics Hosted</div>${tagList(sports.olympics_hosted.map((o) => `${o.city} ${o.year} (${o.type})`))}</div>`
      : '',
    factItem(config.sports.fifa_world_cup.wins, 'FIFA World Cup Wins', String(sports.fifa_world_cup.wins), { mono: true }),
    boolFactItem(config.sports.f1_hosted, 'Hosted F1', sports.f1_hosted),
  ].filter(Boolean).join('');

  // Only show sections that have content
  const geographySection = geographyItems ? `
    <div class="fact-section">
      <h3 class="fact-section-title">Geography</h3>
      <div class="fact-grid">${geographyItems}</div>
    </div>
  ` : '';

  const populationSection = populationItems ? `
    <div class="fact-section">
      <h3 class="fact-section-title">Population</h3>
      <div class="fact-grid">${populationItems}</div>
    </div>
  ` : '';

  const politicalSection = politicalItems ? `
    <div class="fact-section">
      <h3 class="fact-section-title">Political</h3>
      <div class="fact-grid">${politicalItems}</div>
    </div>
  ` : '';

  const economicSection = economicItems ? `
    <div class="fact-section">
      <h3 class="fact-section-title">Economic</h3>
      <div class="fact-grid">${economicItems}</div>
    </div>
  ` : '';

  const factsSection = factsItems ? `
    <div class="fact-section">
      <h3 class="fact-section-title">Facts</h3>
      <div class="fact-grid">${factsItems}</div>
    </div>
  ` : '';

  const sportsSection = sportsItems ? `
    <div class="fact-section">
      <h3 class="fact-section-title">Sports</h3>
      <div class="fact-grid">${sportsItems}</div>
    </div>
  ` : '';

  return `
    <div class="country-header">
      <img 
        src="${flagUrl}" 
        alt="Flag of ${name}" 
        class="country-flag"
        onerror="this.style.display='none'"
      />
      <div>
        <h2 class="country-name">${name}</h2>
        <div class="country-id">${id}</div>
      </div>
    </div>
    ${geographySection}
    ${populationSection}
    ${politicalSection}
    ${economicSection}
    ${bordersSection}
    ${factsSection}
    ${sportsSection}
  `;
}
