# Mobile Layout Approach

## Overview
- On load we detect the `/mobile-prototype` path in `web/src/main.ts` and either boot the prototype or the main experience. For the main app we normalize `window.location.pathname` and record `isMobilePrototypeRoute`.
- The desktop layout remains a 3-column grid (filters, map, details). For viewports ≤900px we swap to a stacked grid (`map → details → filters → matches`) controlled purely with CSS (`web/src/style.css`).
- The map keeps ≥55vh on mobile; details/filters become collapsible cards with compact headers and horizontal carousels. Matching Countries is a sticky bottom strip that never scrolls away.
- `setupMobilePanels()` in `web/src/main.ts` binds the headers + toggle buttons, enforces accordion behavior (only one of filters/details expanded), and syncs header labels/icons across breakpoint changes.
- Details content renders differently on mobile vs desktop. We store the selected country (`lastDetailsContext`) and `renderDetailsContentForCurrentLayout()` outputs either the full sidebar (desktop) or a horizontal card deck (mobile). Cards cover capital, population, region, languages, largest city, area, GDP/HDI, time zones, and travel hints.
- Matching Countries, details cards, and other horizontal strips use `addHorizontalWheelScroll()` so mouse wheels pan horizontally without vertical scrolling. CSS adds `scroll-snap-type` and hides overflow to prevent viewport stretching.

## Key Files
- `web/src/main.ts`: routing switch, mobile accordion logic, details rendering, horizontal scroll helpers.
- `web/src/style.css`: grid layout, mobile card styling, sticky matches strip.
- `web/index.html`: markup tweaks (mobile headers, matching countries relocated under map, toggle buttons).
- `web/src/mobile-prototype.*`: prototype reference kept at `/mobile-prototype`.

## Behavioural Notes
- Filters panel collapses by default on mobile but clicking either the header or the button toggles it, matching Country Details behavior.
- Matching countries counts/statistics still update; when no filters are active we show the placeholder message.
- Scroll wheel/touch gestures pan horizontally in both the details card deck and chip strip; this is key to keeping a no-vertical-scroll layout.

## Next Steps / Open Items
1. **Scroll affordances**: consider adding subtle gradient overlays or arrows on the horizontal strips to hint at scrollability.
2. **Data richness**: card set can be expanded or customized per user feedback; hook into future metadata (e.g., climate, travel requirements).
3. **Performance**: monitor `setMobilePanelState` for memory leaks when resizing frequently; detach event listeners if we add more toggles.
4. **Accessibility**: ensure keyboard focus indicators remain visible on chips and toggles; revisit ARIA roles for collapsed panels.
