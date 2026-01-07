import './mobile-prototype.css';

type DetailCard = {
  title: string;
  value: string;
  meta: string;
};

type FilterCard = {
  title: string;
  summary: string;
  badges: string[];
};

type Match = {
  name: string;
  code: string;
  emoji: string;
};

const detailCards: DetailCard[] = [
  {
    title: 'Capital City',
    value: 'Aurelia',
    meta: 'Dense coastal capital · 4.2M residents',
  },
  {
    title: 'Population',
    value: '18.4M',
    meta: '67% urban / 33% rural split',
  },
  {
    title: 'Primary Region',
    value: 'Temperate Coast',
    meta: 'Similar daylight to Central Europe',
  },
  {
    title: 'Languages',
    value: 'Verdan + Coastline',
    meta: 'Two co-official languages',
  },
];

const filterCards: FilterCard[] = [
  {
    title: 'Region',
    summary: 'Western Africa · 2 matches',
    badges: ['Western Africa', 'Atlantic Basin', 'Small Islands'],
  },
  {
    title: 'Climate',
    summary: 'Subtropical band',
    badges: ['23° average', 'Wet + Dry seasons'],
  },
  {
    title: 'Economy',
    summary: 'Emerging · Service heavy',
    badges: ['Service 62%', 'Agriculture 18%', 'Industry 20%'],
  },
  {
    title: 'Attributes',
    summary: '3 active settings',
    badges: ['Island nations', 'Direct flights', 'Dual language'],
  },
];

const mockMatches: Match[] = [
  { name: 'Portugal', code: 'PRT', emoji: '🇵🇹' },
  { name: 'Uruguay', code: 'URY', emoji: '🇺🇾' },
  { name: 'Japan', code: 'JPN', emoji: '🇯🇵' },
  { name: 'Sri Lanka', code: 'LKA', emoji: '🇱🇰' },
  { name: 'Mauritius', code: 'MUS', emoji: '🇲🇺' },
];

export function initMobilePrototype(): void {
  const appRoot = document.getElementById('app');
  if (!appRoot) {
    console.warn('Unable to find #app root for mobile prototype');
    return;
  }

  document.body.classList.add('mobile-prototype-body');
  appRoot.innerHTML = '';
  appRoot.classList.add('mobile-prototype-app');

  const layout = document.createElement('div');
  layout.className = 'mobile-prototype-layout';
  layout.innerHTML = `
    ${renderHeader()}
    <main class="prototype-shell" role="main">
      ${renderMapSection()}
      ${renderDetailsPanel()}
      ${renderFiltersPanel()}
      ${renderMatchesPanel()}
    </main>
  `;

  appRoot.appendChild(layout);
  bindPanelToggles(layout);
}

function renderHeader(): string {
  return `
    <header class="prototype-header">
      <div>
        <p class="prototype-eyebrow">Mobile layout prototype</p>
        <h1>GeoGrid Trainer</h1>
      </div>
      <p class="prototype-note">
        Exploring how the map, details, filters, and matches coexist without scrolling.
      </p>
    </header>
  `;
}

function renderMapSection(): string {
  return `
    <section class="map-section" aria-label="Map">
      <div class="map-placeholder">
        <div class="map-grid"></div>
        <div class="map-legend">
          <strong>Map focus</strong>
          <p>Map keeps majority of the viewport by default.</p>
        </div>
        <div class="map-beacon">
          Tap on any callout to focus the panel. The map area never disappears entirely.
        </div>
      </div>
    </section>
  `;
}

function renderDetailsPanel(): string {
  return `
    <section class="prototype-panel" data-panel="details" data-state="collapsed">
      ${renderPanelHeader('Country Details', 'Collapsed by default · horizontal scroll', 'details-body')}
      <div class="panel-body horizontal-scroll" id="details-body">
        ${detailCards.map(renderDetailCard).join('')}
      </div>
    </section>
  `;
}

function renderFiltersPanel(): string {
  return `
    <section class="prototype-panel" data-panel="filters" data-state="collapsed">
      ${renderPanelHeader('Filters', 'Swipe cards to work through filter buckets', 'filters-body')}
      <div class="panel-body horizontal-scroll" id="filters-body">
        ${filterCards.map(renderFilterCard).join('')}
      </div>
    </section>
  `;
}

function renderMatchesPanel(): string {
  return `
    <section class="prototype-panel matches-panel" data-panel="matches" data-state="fixed" aria-live="polite">
      <div class="panel-header">
        <div>
          <p class="panel-eyebrow">Matching Countries</p>
          <p class="panel-subtitle">Always-on quick list</p>
        </div>
        <span class="panel-pill">${mockMatches.length} shown</span>
      </div>
      <div class="match-strip" role="list">
        ${mockMatches.map(renderMatchChip).join('')}
      </div>
    </section>
  `;
}

function renderPanelHeader(title: string, subtitle: string, controlsId: string): string {
  return `
    <div class="panel-header">
      <div>
        <p class="panel-eyebrow">${title}</p>
        <p class="panel-subtitle">${subtitle}</p>
      </div>
      <button
        class="panel-toggle"
        type="button"
        aria-expanded="false"
        aria-controls="${controlsId}"
      >
        <span class="panel-toggle-label">Expand</span>
        <span class="panel-toggle-icon" aria-hidden="true">▾</span>
      </button>
    </div>
  `;
}

function renderDetailCard(card: DetailCard): string {
  return `
    <article class="detail-card">
      <p class="detail-label">${card.title}</p>
      <h3 class="detail-value">${card.value}</h3>
      <p class="detail-meta">${card.meta}</p>
    </article>
  `;
}

function renderFilterCard(card: FilterCard): string {
  return `
    <article class="filter-card">
      <header>
        <p class="filter-label">${card.title}</p>
        <p class="filter-summary">${card.summary}</p>
      </header>
      <div class="filter-badges">
        ${card.badges.map((badge) => `<span class="filter-badge">${badge}</span>`).join('')}
      </div>
    </article>
  `;
}

function renderMatchChip(match: Match): string {
  return `
    <div class="match-chip" role="listitem">
      <span class="match-chip-emoji" aria-hidden="true">${match.emoji}</span>
      <span class="match-chip-name">${match.name}</span>
    </div>
  `;
}

function bindPanelToggles(layout: HTMLElement): void {
  const panels = Array.from(layout.querySelectorAll<HTMLElement>('.prototype-panel[data-panel]'));
  const collapsiblePanels = panels.filter((panel) => panel.dataset.panel === 'details' || panel.dataset.panel === 'filters');

  const syncPanelState = (panel: HTMLElement, expanded: boolean): void => {
    panel.dataset.state = expanded ? 'expanded' : 'collapsed';
    const toggle = panel.querySelector<HTMLButtonElement>('.panel-toggle');
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', String(expanded));

    const label = toggle.querySelector<HTMLElement>('.panel-toggle-label');
    if (label) {
      label.textContent = expanded ? 'Collapse' : 'Expand';
    }

    const icon = toggle.querySelector<HTMLElement>('.panel-toggle-icon');
    if (icon) {
      icon.textContent = expanded ? '▴' : '▾';
    }
  };

  collapsiblePanels.forEach((panel) => {
    const toggle = panel.querySelector<HTMLButtonElement>('.panel-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      const isExpanded = panel.dataset.state === 'expanded';
      syncPanelState(panel, !isExpanded);

      if (!isExpanded) {
        collapsiblePanels
          .filter((other) => other !== panel)
          .forEach((other) => syncPanelState(other, false));
      }
    });
  });
}
