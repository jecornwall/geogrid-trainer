/**
 * Shared filter rendering functions for compact mobile layouts
 */

import type { BooleanFilter, RangeFilter, MultiSelectFilter } from './types/filters';
import { formatFilterValue } from './filters';

/**
 * Render a boolean filter as a compact pill toggle button
 */
export function renderCompactBooleanFilter(
  filter: BooleanFilter,
  id: string,
  label: string
): string {
  const isActive = filter.enabled && filter.value === true;
  const stateClass = isActive ? 'is-active' : 'is-inactive';
  const stateText = isActive ? 'Active' : 'Off';

  return `
    <div class="filter-compact-line filter-compact-boolean" data-filter-id="${id}">
      <span class="filter-compact-label">${label}</span>
      <span class="filter-compact-pill ${stateClass}" data-filter-type="boolean">${stateText}</span>
    </div>
  `;
}

/**
 * Render a range filter with simplified tap-to-set interaction
 */
export function renderCompactRangeFilter(
  filter: RangeFilter,
  id: string,
  label: string
): string {
  const format = filter.format || 'number';
  const minDisplay = formatFilterValue(filter.min, format);
  const maxDisplay = formatFilterValue(filter.max, format);

  // Calculate fill percentage
  const range = filter.maxBound - filter.minBound;
  const currentRange = filter.max - filter.min;
  const fillPercent = range > 0 ? (currentRange / range) * 100 : 0;

  return `
    <div class="filter-compact-line filter-compact-range" data-filter-id="${id}">
      <div class="range-compact-header">
        <span class="filter-compact-label">${label}</span>
        <strong class="range-compact-value">${minDisplay} – ${maxDisplay}</strong>
      </div>
      <div class="range-track" data-filter-type="range">
        <span style="width: ${fillPercent}%"></span>
      </div>
    </div>
  `;
}

/**
 * Render a multiselect filter as a compact chip row
 */
export function renderCompactMultiSelectFilter(
  filter: MultiSelectFilter,
  id: string,
  label: string
): string {
  const chipsHtml = filter.options
    .map((option) => {
      const isSelected = filter.enabled && filter.selected.includes(option);
      const selectedClass = isSelected ? 'selected' : '';
      return `<span class="chip ${selectedClass}" data-value="${option}" data-filter-type="chip">${option}</span>`;
    })
    .join('');

  return `
    <div class="filter-compact-line filter-compact-chips" data-filter-id="${id}">
      <span class="filter-compact-label">${label}</span>
      <div class="chip-row">
        ${chipsHtml}
      </div>
    </div>
  `;
}
