import type { Country } from './types/country';

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

    <!-- Geography -->
    <div class="fact-section">
      <h3 class="fact-section-title">Geography</h3>
      <div class="fact-grid">
        <div class="fact-item">
          <div class="fact-label">Continent</div>
          <div class="fact-value">${geography.continents.join(', ') || '—'}</div>
        </div>
        <div class="fact-item">
          <div class="fact-label">Area</div>
          <div class="fact-value mono">${formatArea(area_km2)}</div>
        </div>
        <div class="fact-item">
          <div class="fact-label">Island Nation</div>
          ${boolBadge(geography.is_island_nation)}
        </div>
        <div class="fact-item">
          <div class="fact-label">Landlocked</div>
          ${boolBadge(geography.is_landlocked)}
        </div>
        ${
          geography.coastline_km && geography.coastline_km > 0
            ? `
        <div class="fact-item full-width">
          <div class="fact-label">Coastline</div>
          <div class="fact-value mono">${formatNumber(geography.coastline_km)} km</div>
        </div>
        `
            : ''
        }
        ${
          geography.coastlines.length > 0
            ? `
        <div class="fact-item full-width">
          <div class="fact-label">Coastlines On</div>
          ${tagList(geography.coastlines)}
        </div>
        `
            : ''
        }
        ${
          geography.river_systems.length > 0
            ? `
        <div class="fact-item full-width">
          <div class="fact-label">River Systems</div>
          ${tagList(geography.river_systems)}
        </div>
        `
            : ''
        }
      </div>
    </div>

    <!-- Population -->
    <div class="fact-section">
      <h3 class="fact-section-title">Population</h3>
      <div class="fact-grid">
        <div class="fact-item">
          <div class="fact-label">Population</div>
          <div class="fact-value large">${formatPopulation(population.count)}</div>
        </div>
        <div class="fact-item">
          <div class="fact-label">Density</div>
          <div class="fact-value mono">${formatNumber(Math.round(population.density_per_km2))}/km²</div>
        </div>
        <div class="fact-item">
          <div class="fact-label">Capital</div>
          <div class="fact-value">${population.capitals.map((c) => c.name).join(', ') || '—'}</div>
        </div>
        <div class="fact-item">
          <div class="fact-label">Largest City</div>
          <div class="fact-value">${population.most_populated_city || '—'}</div>
        </div>
      </div>
    </div>

    <!-- Political -->
    <div class="fact-section">
      <h3 class="fact-section-title">Political</h3>
      <div class="fact-grid">
        <div class="fact-item">
          <div class="fact-label">EU Member</div>
          ${boolBadge(political.is_eu_member)}
        </div>
        <div class="fact-item">
          <div class="fact-label">Commonwealth</div>
          ${boolBadge(political.is_commonwealth_member)}
        </div>
        <div class="fact-item">
          <div class="fact-label">Monarchy</div>
          ${boolBadge(political.is_monarchy)}
        </div>
        <div class="fact-item">
          <div class="fact-label">Former USSR</div>
          ${boolBadge(political.was_ussr)}
        </div>
        <div class="fact-item">
          <div class="fact-label">Nuclear Weapons</div>
          ${boolBadge(political.has_nuclear_weapons)}
        </div>
        <div class="fact-item">
          <div class="fact-label">Dependency</div>
          ${boolBadge(political.is_dependency)}
        </div>
        ${
          political.official_languages.length > 0
            ? `
        <div class="fact-item full-width">
          <div class="fact-label">Official Languages</div>
          ${tagList(political.official_languages)}
        </div>
        `
            : ''
        }
        <div class="fact-item full-width">
          <div class="fact-label">Time Zones</div>
          ${tagList(political.time_zones)}
        </div>
      </div>
    </div>

    <!-- Economic -->
    <div class="fact-section">
      <h3 class="fact-section-title">Economic</h3>
      <div class="fact-grid">
        ${
          economic.gdp_per_capita > 0
            ? `
        <div class="fact-item">
          <div class="fact-label">GDP per Capita</div>
          <div class="fact-value mono">$${formatNumber(Math.round(economic.gdp_per_capita))}</div>
        </div>
        `
            : ''
        }
        ${
          economic.hdi > 0
            ? `
        <div class="fact-item">
          <div class="fact-label">HDI</div>
          <div class="fact-value mono">${economic.hdi.toFixed(3)}</div>
        </div>
        `
            : ''
        }
        <div class="fact-item">
          <div class="fact-label">Nuclear Power</div>
          ${boolBadge(economic.produces_nuclear_power)}
        </div>
      </div>
    </div>

    <!-- Borders -->
    ${
      borders.countries.length > 0
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
        : ''
    }

    <!-- Facts -->
    <div class="fact-section">
      <h3 class="fact-section-title">Facts</h3>
      <div class="fact-grid">
        <div class="fact-item">
          <div class="fact-label">Drives On</div>
          <div class="fact-value">${facts.drives_on_left ? 'Left' : 'Right'}</div>
        </div>
        <div class="fact-item">
          <div class="fact-label">Alcohol Ban</div>
          ${boolBadge(facts.has_alcohol_prohibition)}
        </div>
        <div class="fact-item">
          <div class="fact-label">Same-Sex Marriage</div>
          ${boolBadge(political.same_sex_marriage_legal, 'Legal', 'Not Legal')}
        </div>
        <div class="fact-item">
          <div class="fact-label">Observes DST</div>
          ${boolBadge(political.observes_dst)}
        </div>
      </div>
    </div>

    <!-- Sports -->
    <div class="fact-section">
      <h3 class="fact-section-title">Sports</h3>
      <div class="fact-grid">
        <div class="fact-item full-width">
          <div class="fact-label">Olympic Medals</div>
          ${renderMedals(sports.olympic_medals)}
        </div>
        ${
          sports.olympics_hosted.length > 0
            ? `
        <div class="fact-item full-width">
          <div class="fact-label">Olympics Hosted</div>
          ${tagList(sports.olympics_hosted.map((o) => `${o.city} ${o.year} (${o.type})`))}
        </div>
        `
            : ''
        }
        <div class="fact-item">
          <div class="fact-label">FIFA World Cup Wins</div>
          <div class="fact-value mono">${sports.fifa_world_cup.wins}</div>
        </div>
        <div class="fact-item">
          <div class="fact-label">Hosted F1</div>
          ${boolBadge(sports.f1_hosted)}
        </div>
      </div>
    </div>
  `;
}

