import './filter-experiments.css';

type FilterType = 'toggle' | 'range' | 'chips';

type RepresentativeFilter = {
  id: string;
  label: string;
  value: string;
  type: FilterType;
  detail?: string;
  chips?: string[];
  active?: boolean;
};

type FilterCategory = {
  id: string;
  title: string;
  summary: string;
  filters: RepresentativeFilter[];
};

type DesignOption = {
  id: 'dock' | 'lane' | 'sheet';
  title: string;
  subtitle: string;
  summary: string;
  categories: string[];
  notes: string[];
};

const representativeFilters: FilterCategory[] = [
  {
    id: 'geography',
    title: 'Geography',
    summary: 'Continents · island nations · coastline length',
    filters: [
      {
        id: 'geography.continents',
        label: 'Continents',
        value: 'Western Africa + Southern Europe',
        type: 'chips',
        chips: ['Western Africa', 'Southern Europe'],
      },
      {
        id: 'geography.is_island_nation',
        label: 'Island nation only',
        value: 'Active',
        type: 'toggle',
        active: true,
      },
      {
        id: 'geography.coastline_km',
        label: 'Coastline (km)',
        value: '0 – 2,500 km',
        detail: 'Ports without archipelagos',
        type: 'range',
      },
    ],
  },
  {
    id: 'political',
    title: 'Political',
    summary: 'EU + Commonwealth + monarchies + languages',
    filters: [
      {
        id: 'political.is_eu_member',
        label: 'EU member',
        value: 'Required',
        type: 'toggle',
        active: true,
      },
      {
        id: 'political.is_commonwealth_member',
        label: 'Commonwealth',
        value: 'Optional',
        type: 'toggle',
        active: false,
      },
      {
        id: 'political.is_monarchy',
        label: 'Monarchy',
        value: 'Exclude',
        type: 'toggle',
        active: false,
      },
      {
        id: 'political.official_languages',
        label: 'Official languages',
        value: 'English + French + Arabic',
        type: 'chips',
        chips: ['English', 'French', 'Arabic'],
      },
    ],
  },
  {
    id: 'population',
    title: 'Population',
    summary: 'Population count · density · capital vs largest city',
    filters: [
      {
        id: 'population.count',
        label: 'Population (millions)',
        value: '5 – 40M',
        type: 'range',
      },
      {
        id: 'population.density_per_km2',
        label: 'Density per km²',
        value: '< 250',
        type: 'range',
      },
      {
        id: 'population.capital_not_largest',
        label: 'Capital ≠ largest city',
        value: 'Active',
        type: 'toggle',
        active: true,
      },
    ],
  },
  {
    id: 'economic',
    title: 'Economic',
    summary: 'GDP per capita and HDI bands',
    filters: [
      {
        id: 'economic.gdp_per_capita',
        label: 'GDP per capita',
        value: '$18k – $42k',
        type: 'range',
      },
      {
        id: 'economic.hdi',
        label: 'HDI',
        value: '0.70 – 0.85',
        type: 'range',
      },
    ],
  },
  {
    id: 'facts',
    title: 'Facts',
    summary: 'Driving side and other binary facts',
    filters: [
      {
        id: 'facts.drives_on_left',
        label: 'Drives on left',
        value: 'Off',
        type: 'toggle',
        active: false,
      },
    ],
  },
];

const designOptions: DesignOption[] = [
  {
    id: 'dock',
    title: 'Option A · Compact Dock',
    subtitle: '64px chrome · 3 cards visible',
    summary: 'Focuses on showing summary stats plus two filters per card.',
    categories: ['geography', 'political', 'population'],
    notes: [
      'Dock height is 176px including chrome, leaving 78% of a 734px viewport for content above/below.',
      'Cards emphasize first two filters, presenting toggles + chips without vertical stacking.',
      'Scroll rails keep tap targets ≥48px and encourage thumb-driven swipes.',
    ],
  },
  {
    id: 'lane',
    title: 'Option B · Category Lane',
    subtitle: '56px chrome · pill controls',
    summary: 'Cards become narrower swim lanes with inline toggles and range meters.',
    categories: ['geography', 'political', 'economic', 'population'],
    notes: [
      'Lane uses 148px cards so four categories stay partially in view for context.',
      'Inline toggles mimic segmented controls to show binary filters without extra rows.',
      'Meters compress range filters into 16px strips but keep labels readable.',
    ],
  },
  {
    id: 'sheet',
    title: 'Option C · Sliding Sheet',
    subtitle: 'Floating matte · stacked tags',
    summary: 'Represents a snap-to-height sheet but still relies on horizontal cards.',
    categories: ['geography', 'political', 'population', 'facts'],
    notes: [
      'Sheet sits on a blurred matte and reserves only 200px when collapsed.',
      'Cards carry dual-line summaries plus chip clusters for languages/regions.',
      'Floating grabber area stays clear of the scrollable cards for thumb access.',
    ],
  },
];

export function initFilterExperiments(): void {
  const root = document.getElementById('app');
  if (!root) {
    console.warn('Unable to find #app root for filter experiments');
    return;
  }

  document.documentElement.classList.add('filter-experiments-html');
  document.body.classList.add('filter-experiments-body');
  document.body.classList.remove('mobile-prototype-body');

  root.innerHTML = '';
  root.className = 'filter-experiments-app';

  const layout = document.createElement('div');
  layout.className = 'filter-experiments-layout';
  layout.innerHTML = `
    <section class="component-wall">
      ${designOptions.map(renderComponentPanel).join('')}
    </section>
  `;

  root.appendChild(layout);

  // Make filters interactive
  attachFilterInteractions();
}

function attachFilterInteractions(): void {
  // Reset buttons
  document.querySelectorAll('.component-reset').forEach(button => {
    button.addEventListener('click', (e) => {
      const component = (e.target as HTMLElement).closest('.filter-component');
      if (!component) return;

      // Reset all toggles to inactive
      component.querySelectorAll('.toggle-state').forEach(toggle => {
        toggle.classList.remove('is-active');
        toggle.classList.add('is-inactive');
        toggle.textContent = 'Off';
      });

      // Reset all chips
      component.querySelectorAll('.chip').forEach(chip => {
        chip.classList.remove('selected');
      });

      // Reset all range fills
      component.querySelectorAll('.range-track span').forEach(fill => {
        (fill as HTMLElement).style.width = '0%';
      });

      console.log('Filters reset');
    });
  });

  // Toggle filter states
  document.querySelectorAll('.toggle-state').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const isActive = target.classList.contains('is-active');

      if (isActive) {
        target.classList.remove('is-active');
        target.classList.add('is-inactive');
        target.textContent = 'Off';
      } else {
        target.classList.remove('is-inactive');
        target.classList.add('is-active');
        target.textContent = 'Active';
      }

      console.log('Toggle changed:', target.textContent);
    });
  });

  // Chip selection
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      target.classList.toggle('selected');

      console.log('Chip toggled:', target.textContent, target.classList.contains('selected'));
    });
  });

  // Range sliders (simplified interaction - tap to set percentage)
  document.querySelectorAll('.range-track').forEach(track => {
    const handleInteraction = (e: MouseEvent | TouchEvent) => {
      const target = track as HTMLElement;
      const fill = target.querySelector('span') as HTMLElement;
      if (!fill) return;

      const rect = target.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));

      fill.style.width = `${percent}%`;

      const line = target.closest('.filter-line-range');
      const valueDisplay = line?.querySelector('.range-value-display[data-display="max"]');
      if (valueDisplay) {
        const label = line?.querySelector('.range-copy span')?.textContent || '';
        valueDisplay.textContent = `${Math.round(percent)}%`;
      }

      console.log('Range adjusted:', Math.round(percent) + '%');
    };

    track.addEventListener('click', handleInteraction as EventListener);
    track.addEventListener('touchstart', handleInteraction as EventListener);
  });
}

function renderIntro(): string {
  return `
    <header class="experiments-intro">
      <p class="intro-eyebrow">Mobile filters prototype</p>
      <h1>Horizontal filter experiments</h1>
      <p class="intro-summary">
        Three compact takes on the GeoGrid filter component. Each rail keeps chrome tight, ensures the cards scroll
        horizontally, and shows real filters such as continents, EU status, languages, and GDP ranges.
      </p>
    </header>
  `;
}

function renderComponentPanel(option: DesignOption): string {
  const categories = option.categories
    .map((id) => representativeFilters.find((category) => category.id === id))
    .filter((category): category is FilterCategory => Boolean(category));

  return `
    <article class="component-panel" data-option="${option.id}">
      ${renderFilterComponent(option, categories)}
    </article>
  `;
}

function renderFilterComponent(option: DesignOption, categories: FilterCategory[]): string {
  return `
    <div class="filter-component" data-variant="${option.id}">
      <div class="component-bar">
        <div>
          <p class="component-eyebrow">${categories.length} categories active</p>
          <p class="component-context">${categories.map((category) => category.title).join(' · ')}</p>
        </div>
        <button class="component-reset" type="button">Reset</button>
      </div>
      <div class="component-track" role="list">
        ${categories.map((category) => renderCategoryCard(option.id, category)).join('')}
      </div>
    </div>
  `;
}

function renderCategoryCard(variant: DesignOption['id'], category: FilterCategory): string {
  const visibleFilters = category.filters.slice(0, variant === 'dock' ? 2 : 3);
  return `
    <section class="filter-card" data-variant="${variant}" role="listitem">
      <header>
        <p class="filter-card-title">${category.title}</p>
        <p class="filter-card-meta">${category.summary}</p>
      </header>
      <div class="filter-card-lines">
        ${visibleFilters.map((filter) => renderFilterLine(filter)).join('')}
      </div>
    </section>
  `;
}

function renderFilterLine(filter: RepresentativeFilter): string {
  if (filter.type === 'toggle') {
    return `
      <div class="filter-line filter-line-toggle" aria-label="${filter.label}">
        <span>${filter.label}</span>
        <span class="toggle-state ${filter.active ? 'is-active' : 'is-inactive'}">${filter.value}</span>
      </div>
    `;
  }

  if (filter.type === 'range') {
    const width = filter.id.includes('density') ? 45 : 68;
    return `
      <div class="filter-line filter-line-range" aria-label="${filter.label}">
        <div class="range-copy">
          <span>${filter.label}</span>
          <strong>${filter.value}</strong>
        </div>
        <div class="range-track"><span style="width:${width}%"></span></div>
      </div>
    `;
  }

  return `
    <div class="filter-line filter-line-chips" aria-label="${filter.label}">
      <span>${filter.label}</span>
      <div class="chip-row">
        ${(filter.chips ?? []).map((chip) => `<span class="chip">${chip}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderNotesPanel(option: DesignOption): string {
  return `
    <article>
      <h3>${option.title}</h3>
      <ul>
        ${option.notes.map((note) => `<li>${note}</li>`).join('')}
      </ul>
    </article>
  `;
}
