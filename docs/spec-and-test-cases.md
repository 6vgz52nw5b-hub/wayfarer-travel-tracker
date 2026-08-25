# Travel Tracker — Spec & Test Cases

Consolidated from the planning conversation. Source plan: `~/.claude/plans/my-dad-wants-to-declarative-rocket.md`.

## Overview

A free, offline-first PWA for tracking countries/territories, cities, and airports visited. Single user (Dad), installed to an iPad (and possibly iPhone) home screen via Safari, no accounts, no subscription, no App Store fee. Hosted on GitHub Pages.

## Feature Spec

### Countries & territories (~250)
- Extended list including territories/dependencies (Puerto Rico, Hong Kong, Greenland, etc.), not just the ~195 UN-recognized set
- Searchable, grouped by continent, with a running "X of 250 (Y%)" counter and per-continent subtotals
- Tap a row to toggle visited on/off — instant, no confirmation dialog
- **Row styling**: flag shown desaturated/dimmed when unmarked, full color when marked. Entries with no real flag emoji (disputed/non-ISO territories like Kosovo, or grouped territories like Bonaire/Sint Eustatius/Saba sharing one ISO code) fall back to a generic pin/globe icon in place of a broken glyph.

### Cities
- Preset list of a few thousand major world cities, grouped by country, searchable
- "Add custom city" when search finds nothing — asks for the country, then files the new city under that group, pre-marked as visited
- **Row styling**: checkbox + tinted row background when marked (no per-row icon; the country flag appears once, statically, on the group header for context only)
- **City → country link**: marking a city prompts a dismissible one-tap suggestion, "Mark [Country] as visited too?" — never auto-marks silently

### Airports flown into
- Preset list (code, name, city, country), sourced from a broad open dataset (not just commercial/IATA-code airports) so known military airfields are included where possible, using **ICAO code as a fallback identifier** when there's no IATA code
- Every airport (preset or custom) carries a **Commercial / Military** tag; a filter chip ("All / Commercial / Military") sits above the list for browsing, in addition to search
- Search matches IATA code, ICAO code, airport name, or city name
- "Add custom airport" asks for code, name, city, country, and Commercial/Military type
- **No linking to city/country**: marking an airport never prompts to mark its city or country, and never affects the map — landing somewhere (especially a layover) isn't the same signal as visiting it
- Same instant-toggle, checkbox + highlight row styling as Cities

### Visual map
- Read-only SVG world map, auto-shaded from the Countries checklist — not tappable itself
- **Country-status only**: marking a city or airport never changes the map, even if the underlying place isn't shaded yet. (City pins on the map were considered and ruled out — custom-added cities won't reliably have coordinates unless entry is forced to be more complex, which fights the simplicity goal.)
- **Search-to-mark from Map view**: while viewing the globe, typing in the search bar shows a small matching-countries dropdown right over the map; tapping a result toggles it and the globe updates instantly without leaving Map view — added so marking and seeing the visual payoff can happen in the same screen, not just from List view.

### Data & backup
- Everything stored locally in the browser (localStorage/IndexedDB) — fully offline, no account, no server
- **Export backup** — downloads a JSON file of everything marked, including custom entries
- **Import backup** — loads a previously exported file (used when setting up a new/replacement device)
- This export/import is the *only* sync mechanism, by design — Dad uses one device at a time and just needs a way to carry data to a new device on upgrade, not live multi-device sync

### Platform & hosting
- Plain static PWA (HTML/CSS/JS), no backend
- `manifest.json` + service worker for installability and offline caching
- Hosted on GitHub Pages (free); Dad opens the URL once in Safari, taps Share → "Add to Home Screen"

## Open Assumptions to Confirm Before Build

These weren't explicitly nailed down in planning and default to the simplest sensible behavior — flag if a different behavior is wanted:
- **City→country prompt frequency**: assumed to fire only on the unmarked→marked transition for a given city, not on every app load. Dismissing it doesn't ask again unless that city is unmarked and re-marked.
- **Import backup behavior**: assumed to be a full overwrite of current local data, not a merge. Since export/import is only expected to be used for device migration (not regular two-way sync), overwrite should be safe, but worth confirming before build.

### Country pickers (Add City / Add Airport modals)
- The country `<select>` in both "Add custom" modals is grouped into a "Common" group (US, Canada, UK, France, Germany, Italy, Japan — the G7, US first) followed by "All countries" alphabetically, so the most-likely picks don't require scrolling through the full list.
- [x] "Common" optgroup lists exactly the G7 with the US first; "All countries" optgroup lists the full alphabetical list starting with United States (name sort, not a duplicate-removal step)

## Test Cases

All items below were run against the real app in headless Chromium (Playwright), not just reasoned about from the code — see the note at the end for the handful that genuinely can't be automated this way.

### Countries
- [x] List loads with ~250 entries grouped by continent, all unmarked by default on first install
- [x] Tapping an unmarked row marks it instantly: checkbox fills, flag goes full color, row tint applied — no confirmation dialog
- [x] Tapping a marked row unmarks it instantly, reversing all visual state
- [x] Global counter ("X of 250, Y%") updates immediately on every toggle
- [x] Continent subtotal (e.g. "Europe (18/44)") updates immediately for toggles within that continent
- [x] Search filters the list in real time by country name, preserving marked state
- [x] A country with no real flag emoji (e.g. Kosovo) shows the fallback icon correctly in both marked and unmarked states
- [x] Marked/unmarked state survives closing and reopening the app with no network connection

### Cities
- [x] List loads grouped by country (sort-by-name is in the render code and structurally confirmed; exact alphabetical ordering wasn't asserted letter-by-letter in the automated test)
- [x] Tap to mark/unmark works identically to countries (instant, no dialog) — including unmark, which earlier passes had skipped
- [x] Searching a preset city surfaces it and allows toggling
- [x] Searching a city not on the preset list shows "No matches found" + "Add '[term]' as a new city" — **this was actually broken** (only the add-button rendered, no "No matches found" text) until this test pass caught it; fixed in `js/app.js` and re-verified
- [x] "Add '[term]' as a new city" appears at the bottom of the list as soon as there's a search term, even when there are partial matches above it — no longer requires typing until zero results show
- [x] Adding a custom city requires picking its country, then it appears filed under that country's group, pre-marked
- [x] Marking a previously-unmarked city, whose country is not yet marked, triggers the "Mark [Country] too?" prompt
- [x] Accepting the prompt marks the country and updates country counters + map shading
- [x] Dismissing the prompt leaves the country unmarked and doesn't affect the city's own marked state
- [x] Marking a city whose country is *already* marked does not show the prompt
- [x] Marking/unmarking a city never changes the world map on its own
- [x] Custom (self-added) cities show a delete (✕) button next to their row; preset cities never show one — verified a preset row (Paris) has zero delete buttons while a custom row has exactly one
- [x] Tapping delete asks for confirmation; canceling leaves the city untouched, confirming removes it entirely (from the list and from marked state) with no page errors

### Airports
- [x] List loads grouped by country; each row shows code (IATA, or ICAO fallback), name, and city
- [~] Preset entries are correctly pre-tagged Commercial or Military from source data — spot-checked against real known bases during data-build (e.g. Al Dhafra Air Base, Al Minhad Air Base all correctly tagged); the tagging itself is a name-matching heuristic with no ground-truth source to exhaustively verify against, so this can be spot-checked but not proven 100% correct
- [x] Filter chip narrows the visible list by type without altering any marked state
- [x] Search matches by IATA code, ICAO code, airport name, or city name (e.g. "ORD", "O'Hare", "Chicago" all resolve to the same result)
- [x] Tap to mark/unmark works identically to cities (instant, checkbox + highlight) — including unmark
- [x] Marking an airport never prompts about, or changes, the state of its city or country
- [x] Marking an airport never changes the world map
- [x] Adding a custom airport (code optional, name/city/country/type required) files it under the right country and is immediately searchable/toggleable
- [x] "Add '[term]' as a new airport" appears at the bottom of the list as soon as there's a search term, even when there are partial matches above it
- [x] An airport with only an ICAO code (common for military bases) displays and searches correctly with no IATA code present — verified against a real example (Abu Dhabi Northeast Airport - Suweihan Air Base, ICAO `OMAW`, no IATA)
- [x] Custom (self-added) airports show a delete (✕) button next to their row; preset airports never show one
- [x] Tapping delete asks for confirmation; canceling leaves the airport untouched, confirming removes it entirely (from the list and from marked state) with no page errors

### Visual map
Note: the map shipped as a touch-rotatable globe (real per-country borders via D3 + world-atlas topojson), not the flat SVG map originally spec'd here — same rules apply, just rendered differently.
- [x] Switching to Map view shades every currently-marked country in the visited color; all others stay in the default/unmarked color — verified with an exact-count check (marked countries == accent-colored paths, no more, no less), not just "at least one changed"
- [x] A country toggled in List view reflects correctly the next time Map view is shown
- [x] Tapping the globe does nothing on its own — read-only (a plain tap with no drag leaves the marked-country count unchanged; only dragging rotates the view, nothing marks/unmarks from the map)
- [x] No amount of city/airport marking changes the map's appearance

### Data & backup
- [x] All marked state (countries, cities, airports, custom entries) persists across app restarts with no network connection at all
- [x] "Export backup" produces a JSON file containing every marked item and every custom-added entry
- [x] "Import backup" on a fresh install restores the exact state from a previously exported file, including custom entries
- [x] Re-importing a backup overwrites current local state as expected (see assumption above)

### Platform / install
These three can't be driven by a headless browser — they require an actual iPad/iPhone in Safari, so they're still open:
- [x] Opening the hosted URL in Safari loads correctly on first visit (requires internet once) — verified live at https://6vgz52nw5b-hub.github.io/wayfarer-travel-tracker/ (headless Chromium check: all 252 country rows render, zero console/network errors); still worth a quick real-Safari glance, but the deployment itself is confirmed working
- [ ] "Add to Home Screen" creates a working icon that launches the app in standalone mode (no Safari address bar/chrome) — needs a real device
- [ ] With the app already installed, enabling airplane mode and launching from the home-screen icon still opens and works fully — the underlying mechanism (service worker cache) is verified via headless offline tests, but the literal installed-icon + airplane-mode flow needs a real-device check
