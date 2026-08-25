const DATA_BASE = 'data';

export async function loadData() {
  const [countries, cities, airports] = await Promise.all([
    fetch(`${DATA_BASE}/countries.json`).then((r) => {
      if (!r.ok) throw new Error(`countries.json: ${r.status}`);
      return r.json();
    }),
    fetch(`${DATA_BASE}/cities.json`).then((r) => {
      if (!r.ok) throw new Error(`cities.json: ${r.status}`);
      return r.json();
    }),
    fetch(`${DATA_BASE}/airports.json`).then((r) => {
      if (!r.ok) throw new Error(`airports.json: ${r.status}`);
      return r.json();
    }),
  ]);

  const countryById = new Map(countries.map((c) => [c.id, c]));

  return { countries, cities, airports, countryById };
}
