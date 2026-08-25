const STORAGE_KEY = 'wayfarer:v1';

function defaultState() {
  return {
    markedCountries: [],
    markedCities: [],
    markedAirports: [],
    customCities: [], // { id, name, countryId }
    customAirports: [], // { id, iata, icao, name, city, countryId, military }
  };
}

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch (err) {
    console.error('Wayfarer: failed to load saved data, starting fresh.', err);
    return defaultState();
  }
}

class Store {
  constructor() {
    const raw = loadRaw();
    this.markedCountries = new Set(raw.markedCountries);
    this.markedCities = new Set(raw.markedCities);
    this.markedAirports = new Set(raw.markedAirports);
    this.customCities = raw.customCities;
    this.customAirports = raw.customAirports;
    this._saveTimer = null;
  }

  _persist() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      const payload = {
        markedCountries: [...this.markedCountries],
        markedCities: [...this.markedCities],
        markedAirports: [...this.markedAirports],
        customCities: this.customCities,
        customAirports: this.customAirports,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }, 120);
  }

  isCountryMarked(id) { return this.markedCountries.has(id); }
  isCityMarked(id) { return this.markedCities.has(id); }
  isAirportMarked(id) { return this.markedAirports.has(id); }

  toggleCountry(id) {
    const willMark = !this.markedCountries.has(id);
    if (willMark) this.markedCountries.add(id); else this.markedCountries.delete(id);
    this._persist();
    return willMark;
  }

  toggleCity(id) {
    const willMark = !this.markedCities.has(id);
    if (willMark) this.markedCities.add(id); else this.markedCities.delete(id);
    this._persist();
    return willMark;
  }

  toggleAirport(id) {
    const willMark = !this.markedAirports.has(id);
    if (willMark) this.markedAirports.add(id); else this.markedAirports.delete(id);
    this._persist();
    return willMark;
  }

  addCustomCity(city) {
    this.customCities.push(city);
    this.markedCities.add(city.id);
    this._persist();
  }

  addCustomAirport(airport) {
    this.customAirports.push(airport);
    this.markedAirports.add(airport.id);
    this._persist();
  }

  exportBackup() {
    return {
      app: 'wayfarer',
      version: 1,
      exportedAt: new Date().toISOString(),
      markedCountries: [...this.markedCountries],
      markedCities: [...this.markedCities],
      markedAirports: [...this.markedAirports],
      customCities: this.customCities,
      customAirports: this.customAirports,
    };
  }

  importBackup(payload) {
    this.markedCountries = new Set(payload.markedCountries || []);
    this.markedCities = new Set(payload.markedCities || []);
    this.markedAirports = new Set(payload.markedAirports || []);
    this.customCities = payload.customCities || [];
    this.customAirports = payload.customAirports || [];
    this._persist();
  }
}

export const store = new Store();
