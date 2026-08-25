import { loadData } from './data.js';
import { store } from './state.js';
import { renderMap } from './map.js';

const CONTINENT_ORDER = ['North America', 'South America', 'Europe', 'Africa', 'Asia', 'Oceania', 'Antarctica'];

let DATA = null;
let currentTab = 'countries';
let countriesView = 'list'; // 'list' | 'map'
let airportFilter = 'all'; // 'all' | 'commercial' | 'military'
let searchTerm = '';
let pendingCountryPrompt = null;

const els = {};

init();

async function init() {
  cacheEls();
  try {
    DATA = await loadData();
  } catch (err) {
    console.error('Wayfarer: failed to load data', err);
    document.querySelector('.app-main').innerHTML =
      '<div class="empty-state">Couldn’t load the country/city/airport data. Make sure this page is served from the project root (not opened directly as a file) and that the data/ folder exists.</div>';
    return;
  }
  populateCountrySelects();
  bindEvents();
  renderAll();
  registerServiceWorker();
}

function cacheEls() {
  els.panelTitle = document.getElementById('panel-title');
  els.panelCounter = document.getElementById('panel-counter');
  els.searchRow = document.querySelector('.search-row');
  els.searchInput = document.getElementById('search-input');
  els.countriesControls = document.getElementById('countries-controls');
  els.airportFilters = document.getElementById('airport-filters');
  els.countriesList = document.getElementById('countries-list');
  els.countriesMap = document.getElementById('countries-map');
  els.countriesMapResults = document.getElementById('countries-map-results');
  els.citiesList = document.getElementById('cities-list');
  els.airportsList = document.getElementById('airports-list');
  els.tabbar = document.querySelector('.tabbar');
  els.panels = document.querySelectorAll('.panel');
  els.cityToast = document.getElementById('city-country-toast');
  els.cityToastText = document.getElementById('city-country-toast-text');
  els.cityToastDismiss = document.getElementById('city-country-dismiss');
  els.cityToastMark = document.getElementById('city-country-mark');
}

function populateCountrySelects() {
  const options = DATA.countries
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
    .join('');
  document.getElementById('add-city-country').innerHTML = options;
  document.getElementById('add-airport-country').innerHTML = options;
}

function bindEvents() {
  els.tabbar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });

  els.searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderCurrentPanel();
  });

  els.countriesControls.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-view]');
    if (!btn) return;
    countriesView = btn.dataset.view;
    [...els.countriesControls.children].forEach((b) => b.classList.toggle('active', b === btn));
    renderCountriesPanel();
  });

  els.airportFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    airportFilter = btn.dataset.filter;
    [...els.airportFilters.children].forEach((b) => b.classList.toggle('active', b === btn));
    renderAirportsPanel();
  });

  els.countriesList.addEventListener('click', onCountryRowClick);
  els.countriesMapResults.addEventListener('click', onCountryRowClick);
  els.citiesList.addEventListener('click', onCityListClick);
  els.airportsList.addEventListener('click', onAirportListClick);

  els.cityToastDismiss.addEventListener('click', hideCityToast);
  els.cityToastMark.addEventListener('click', () => {
    if (pendingCountryPrompt) {
      store.toggleCountry(pendingCountryPrompt);
      renderCountriesPanel();
    }
    hideCityToast();
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.getElementById('add-city-save').addEventListener('click', saveCustomCity);
  document.getElementById('add-airport-save').addEventListener('click', saveCustomAirport);

  document.getElementById('export-btn').addEventListener('click', exportBackup);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', importBackup);
}

function switchTab(tab) {
  currentTab = tab;
  searchTerm = '';
  els.searchInput.value = '';
  [...els.tabbar.children].forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  els.panels.forEach((p) => p.classList.toggle('active', p.id === `panel-${tab}`));

  const isCountries = tab === 'countries';
  const isCities = tab === 'cities';
  const isAirports = tab === 'airports';
  const isBackup = tab === 'backup';

  els.searchRow.hidden = isBackup;
  els.countriesControls.hidden = !isCountries;
  els.airportFilters.hidden = !isAirports;

  els.searchInput.placeholder = isCountries ? 'Search countries…' : isCities ? 'Search cities…' : 'Search airports…';

  if (isCountries) { els.panelTitle.textContent = 'Countries'; renderCountriesPanel(); }
  else if (isCities) { els.panelTitle.textContent = 'Cities'; renderCitiesPanel(); }
  else if (isAirports) { els.panelTitle.textContent = 'Airports'; renderAirportsPanel(); }
  else { els.panelTitle.textContent = 'Backup'; els.panelCounter.textContent = ''; }
}

function renderCurrentPanel() {
  if (currentTab === 'countries') renderCountriesPanel();
  else if (currentTab === 'cities') renderCitiesPanel();
  else if (currentTab === 'airports') renderAirportsPanel();
}

function renderAll() {
  renderCountriesPanel();
  renderCitiesPanel();
  renderAirportsPanel();
}

/* ---------- Countries ---------- */

function renderCountriesPanel() {
  const total = DATA.countries.length;
  const marked = DATA.countries.filter((c) => store.isCountryMarked(c.id)).length;
  if (currentTab === 'countries') {
    els.panelCounter.textContent = `${marked} / ${total} · ${total ? Math.round((marked / total) * 100) : 0}%`;
  }

  const showMap = countriesView === 'map';
  els.countriesList.hidden = showMap;
  els.countriesMap.hidden = !showMap;

  const term = searchTerm;
  const filtered = term ? DATA.countries.filter((c) => c.name.toLowerCase().includes(term)) : DATA.countries;

  if (showMap) {
    renderMap(els.countriesMap, { countries: DATA.countries, store });
    renderMapSearchResults(term, filtered);
    return;
  }

  els.countriesMapResults.hidden = true;

  const byContinent = new Map();
  for (const c of filtered) {
    if (!byContinent.has(c.continent)) byContinent.set(c.continent, []);
    byContinent.get(c.continent).push(c);
  }

  const continents = CONTINENT_ORDER.filter((name) => byContinent.has(name));

  if (!continents.length) {
    els.countriesList.innerHTML = `<div class="empty-state">No countries match “${escapeHtml(term)}”.</div>`;
    return;
  }

  let html = '';
  for (const continent of continents) {
    const list = byContinent.get(continent).sort((a, b) => a.name.localeCompare(b.name));
    const allInContinent = DATA.countries.filter((c) => c.continent === continent);
    const markedInContinent = allInContinent.filter((c) => store.isCountryMarked(c.id)).length;
    html += `<div class="group-head">${escapeHtml(continent)}<span class="count">${markedInContinent}/${allInContinent.length}</span></div>`;
    for (const c of list) {
      const visited = store.isCountryMarked(c.id);
      const iconHtml = c.hasFlagEmoji
        ? `<span class="flag">${c.flagEmoji || ''}</span>`
        : '<span class="fallback-icon">\u{1F310}</span>';
      html += `<button type="button" class="row${visited ? ' visited' : ''}" data-country-id="${escapeHtml(c.id)}">
        <span class="checkbox">${visited ? '✓' : ''}</span>
        ${iconHtml}
        <span class="row-label">${escapeHtml(c.name)}</span>
      </button>`;
    }
  }
  els.countriesList.innerHTML = html;
}

function renderMapSearchResults(term, filtered) {
  if (!term) {
    els.countriesMapResults.hidden = true;
    els.countriesMapResults.innerHTML = '';
    return;
  }
  els.countriesMapResults.hidden = false;
  if (!filtered.length) {
    els.countriesMapResults.innerHTML = `<div class="empty-state">No countries match “${escapeHtml(term)}”.</div>`;
    return;
  }
  const list = filtered.slice().sort((a, b) => a.name.localeCompare(b.name));
  let html = '';
  for (const c of list) {
    const visited = store.isCountryMarked(c.id);
    const iconHtml = c.hasFlagEmoji
      ? `<span class="flag">${c.flagEmoji || ''}</span>`
      : '<span class="fallback-icon">\u{1F310}</span>';
    html += `<button type="button" class="row${visited ? ' visited' : ''}" data-country-id="${escapeHtml(c.id)}">
      <span class="checkbox">${visited ? '✓' : ''}</span>
      ${iconHtml}
      <span class="row-label">${escapeHtml(c.name)}</span>
    </button>`;
  }
  els.countriesMapResults.innerHTML = html;
}

function onCountryRowClick(e) {
  const row = e.target.closest('button[data-country-id]');
  if (!row) return;
  store.toggleCountry(row.dataset.countryId);
  renderCountriesPanel();
}

/* ---------- Cities ---------- */

function allCities() {
  return [...DATA.cities, ...store.customCities.map((c) => ({ ...c, custom: true }))];
}

function countryLabel(countryId) {
  const country = DATA.countryById.get(countryId);
  if (!country) return { flag: '\u{1F310}', name: countryId };
  return { flag: country.hasFlagEmoji ? (country.flagEmoji || '') : '\u{1F310}', name: country.name };
}

function renderCitiesPanel() {
  const cities = allCities();
  const marked = cities.filter((c) => store.isCityMarked(c.id)).length;
  if (currentTab === 'cities') els.panelCounter.textContent = `${marked} marked`;

  const term = searchTerm;
  const filtered = term ? cities.filter((c) => c.name.toLowerCase().includes(term)) : cities;

  const byCountry = new Map();
  for (const c of filtered) {
    if (!byCountry.has(c.countryId)) byCountry.set(c.countryId, []);
    byCountry.get(c.countryId).push(c);
  }

  const countryIds = [...byCountry.keys()].sort((a, b) => countryLabel(a).name.localeCompare(countryLabel(b).name));

  let html = '';
  for (const countryId of countryIds) {
    const { flag, name } = countryLabel(countryId);
    const list = byCountry.get(countryId).sort((a, b) => a.name.localeCompare(b.name));
    html += `<div class="group-head"><span class="flag">${flag}</span>${escapeHtml(name)}<span class="count">${list.length}</span></div>`;
    for (const c of list) {
      const visited = store.isCityMarked(c.id);
      html += `<button type="button" class="row${visited ? ' visited' : ''}" data-city-id="${escapeHtml(c.id)}" data-country-id="${escapeHtml(countryId)}">
        <span class="checkbox">${visited ? '✓' : ''}</span>
        <span class="row-label">${escapeHtml(c.name)}</span>
        ${c.custom ? '<span class="tag">custom</span>' : ''}
      </button>`;
    }
  }

  if (term && !filtered.length) {
    html += `<div class="empty-state">No matches found.</div>`;
    html += `<button type="button" class="add-custom-row" id="add-custom-city-trigger">+ Add “${escapeHtml(searchTerm)}” as a new city</button>`;
  } else if (!countryIds.length) {
    html = '<div class="empty-state">No cities yet. Search to find one, or add your own.</div>';
  }

  els.citiesList.innerHTML = html;
}

function onCityListClick(e) {
  const addBtn = e.target.closest('#add-custom-city-trigger');
  if (addBtn) {
    document.getElementById('add-city-name').value = els.searchInput.value.trim();
    openModal('modal-add-city');
    return;
  }
  const row = e.target.closest('button[data-city-id]');
  if (!row) return;
  const cityId = row.dataset.cityId;
  const countryId = row.dataset.countryId;
  const willMark = store.toggleCity(cityId);
  renderCitiesPanel();

  if (willMark && countryId && !store.isCountryMarked(countryId)) {
    showCityToast(countryId);
  } else {
    hideCityToast();
  }
}

function showCityToast(countryId) {
  pendingCountryPrompt = countryId;
  const { name } = countryLabel(countryId);
  els.cityToastText.innerHTML = `Mark <strong>${escapeHtml(name)}</strong> as visited too?`;
  els.cityToast.hidden = false;
}

function hideCityToast() {
  pendingCountryPrompt = null;
  els.cityToast.hidden = true;
}

function saveCustomCity() {
  const name = document.getElementById('add-city-name').value.trim();
  const countryId = document.getElementById('add-city-country').value;
  if (!name || !countryId) return;
  const id = `custom-${slug(name)}-${countryId}-${Date.now()}`;
  store.addCustomCity({ id, name, countryId });
  closeModal('modal-add-city');
  document.getElementById('add-city-name').value = '';
  searchTerm = '';
  els.searchInput.value = '';
  renderCitiesPanel();
  if (!store.isCountryMarked(countryId)) showCityToast(countryId);
}

/* ---------- Airports ---------- */

function allAirports() {
  return [...DATA.airports, ...store.customAirports.map((a) => ({ ...a, custom: true }))];
}

function renderAirportsPanel() {
  const airports = allAirports();
  const marked = airports.filter((a) => store.isAirportMarked(a.id)).length;
  if (currentTab === 'airports') els.panelCounter.textContent = `${marked} marked`;

  let list = airports;
  if (airportFilter === 'commercial') list = list.filter((a) => !a.military);
  if (airportFilter === 'military') list = list.filter((a) => a.military);

  const term = searchTerm;
  if (term) {
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        (a.city || '').toLowerCase().includes(term) ||
        (a.iata || '').toLowerCase().includes(term) ||
        (a.icao || '').toLowerCase().includes(term)
    );
  }

  const byCountry = new Map();
  for (const a of list) {
    if (!byCountry.has(a.countryId)) byCountry.set(a.countryId, []);
    byCountry.get(a.countryId).push(a);
  }

  const countryIds = [...byCountry.keys()].sort((a, b) => countryLabel(a).name.localeCompare(countryLabel(b).name));

  let html = '';
  for (const countryId of countryIds) {
    const { flag, name } = countryLabel(countryId);
    const rows = byCountry.get(countryId).sort((a, b) => a.name.localeCompare(b.name));
    html += `<div class="group-head"><span class="flag">${flag}</span>${escapeHtml(name)}<span class="count">${rows.length}</span></div>`;
    for (const a of rows) {
      const visited = store.isAirportMarked(a.id);
      const code = a.iata || a.icao || '—';
      html += `<button type="button" class="row${visited ? ' visited' : ''}" data-airport-id="${escapeHtml(a.id)}">
        <span class="checkbox">${visited ? '✓' : ''}</span>
        <span class="code">${escapeHtml(code)}</span>
        <span class="row-label">${escapeHtml(a.name)}${a.city ? `<span class="row-sub">${escapeHtml(a.city)}</span>` : ''}</span>
        ${a.military ? '<span class="tag">military</span>' : ''}
        ${a.custom ? '<span class="tag">custom</span>' : ''}
      </button>`;
    }
  }

  if (term && !list.length) {
    html += `<div class="empty-state">No matches found.</div>`;
    html += `<button type="button" class="add-custom-row" id="add-custom-airport-trigger">+ Add “${escapeHtml(searchTerm)}” as a new airport</button>`;
  } else if (!countryIds.length) {
    html = '<div class="empty-state">No airports yet. Search to find one, or add your own.</div>';
  }

  els.airportsList.innerHTML = html;
}

function onAirportListClick(e) {
  const addBtn = e.target.closest('#add-custom-airport-trigger');
  if (addBtn) {
    document.getElementById('add-airport-name').value = els.searchInput.value.trim();
    openModal('modal-add-airport');
    return;
  }
  const row = e.target.closest('button[data-airport-id]');
  if (!row) return;
  store.toggleAirport(row.dataset.airportId);
  renderAirportsPanel();
}

function saveCustomAirport() {
  const code = document.getElementById('add-airport-code').value.trim().toUpperCase();
  const name = document.getElementById('add-airport-name').value.trim();
  const city = document.getElementById('add-airport-city').value.trim();
  const countryId = document.getElementById('add-airport-country').value;
  const military = document.querySelector('input[name="add-airport-type"]:checked').value === 'military';
  if (!name || !countryId) return;
  const id = `custom-${slug(code || name)}-${countryId}-${Date.now()}`;
  store.addCustomAirport({
    id,
    iata: code.length === 3 ? code : null,
    icao: code.length === 4 ? code : code || null,
    name,
    city,
    countryId,
    military,
  });
  closeModal('modal-add-airport');
  ['add-airport-code', 'add-airport-name', 'add-airport-city'].forEach((fieldId) => {
    document.getElementById(fieldId).value = '';
  });
  searchTerm = '';
  els.searchInput.value = '';
  renderAirportsPanel();
}

/* ---------- Modals ---------- */

function openModal(id) { document.getElementById(id).hidden = false; }
function closeModal(id) { document.getElementById(id).hidden = true; }

/* ---------- Backup ---------- */

function exportBackup() {
  const payload = store.exportBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `wayfarer-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      store.importBackup(payload);
      renderAll();
      window.alert('Backup imported.');
    } catch (err) {
      console.error(err);
      window.alert('That file could not be read as a Wayfarer backup.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ---------- Service worker ---------- */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.error('SW registration failed', err));
  });
}

/* ---------- Utils ---------- */

function slug(str) {
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
