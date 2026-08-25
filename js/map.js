import { geoOrthographic, geoPath, geoGraticule10 } from './vendor/d3-geo.min.js';
import { feature } from './vendor/topojson-client.min.js';

const TOPOLOGY_URL = 'data/countries-topo.json';

// ISO 3166-1 numeric -> our own alpha-2 country id (matches data/countries.json's
// `id` field). Derived from GeoNames' countryInfo.txt, restricted to the numeric
// codes actually present in the vendored world-atlas countries-50m.json topology.
// A handful of the topology's geometries (Somaliland, N. Cyprus, Indian Ocean Ter.,
// Siachen Glacier) have no ISO numeric id at all and are rendered but never
// markable — they aren't part of our 252-country/territory list either. Kosovo is
// special-cased below since its geometry also lacks a numeric id, but we do track
// it (id "XK").
const NUMERIC_TO_ALPHA2 = {"004":"AF","008":"AL","010":"AQ","012":"DZ","016":"AS","020":"AD","024":"AO","028":"AG","031":"AZ","032":"AR","036":"AU","040":"AT","044":"BS","048":"BH","050":"BD","051":"AM","052":"BB","056":"BE","060":"BM","064":"BT","068":"BO","070":"BA","072":"BW","076":"BR","084":"BZ","086":"IO","090":"SB","092":"VG","096":"BN","100":"BG","104":"MM","108":"BI","112":"BY","116":"KH","120":"CM","124":"CA","132":"CV","136":"KY","140":"CF","144":"LK","148":"TD","152":"CL","156":"CN","158":"TW","170":"CO","174":"KM","178":"CG","180":"CD","184":"CK","188":"CR","191":"HR","192":"CU","196":"CY","203":"CZ","204":"BJ","208":"DK","212":"DM","214":"DO","218":"EC","222":"SV","226":"GQ","231":"ET","232":"ER","233":"EE","234":"FO","238":"FK","239":"GS","242":"FJ","246":"FI","248":"AX","250":"FR","258":"PF","260":"TF","262":"DJ","266":"GA","268":"GE","270":"GM","275":"PS","276":"DE","288":"GH","296":"KI","300":"GR","304":"GL","308":"GD","316":"GU","320":"GT","324":"GN","328":"GY","332":"HT","334":"HM","336":"VA","340":"HN","344":"HK","348":"HU","352":"IS","356":"IN","360":"ID","364":"IR","368":"IQ","372":"IE","376":"IL","380":"IT","384":"CI","388":"JM","392":"JP","398":"KZ","400":"JO","404":"KE","408":"KP","410":"KR","414":"KW","417":"KG","418":"LA","422":"LB","426":"LS","428":"LV","430":"LR","434":"LY","438":"LI","440":"LT","442":"LU","446":"MO","450":"MG","454":"MW","458":"MY","462":"MV","466":"ML","470":"MT","478":"MR","480":"MU","484":"MX","492":"MC","496":"MN","498":"MD","499":"ME","500":"MS","504":"MA","508":"MZ","512":"OM","516":"NA","520":"NR","524":"NP","528":"NL","531":"CW","533":"AW","534":"SX","540":"NC","548":"VU","554":"NZ","558":"NI","562":"NE","566":"NG","570":"NU","574":"NF","578":"NO","580":"MP","583":"FM","584":"MH","585":"PW","586":"PK","591":"PA","598":"PG","600":"PY","604":"PE","608":"PH","612":"PN","616":"PL","620":"PT","624":"GW","626":"TL","630":"PR","634":"QA","642":"RO","643":"RU","646":"RW","652":"BL","654":"SH","659":"KN","660":"AI","662":"LC","663":"MF","666":"PM","670":"VC","674":"SM","678":"ST","682":"SA","686":"SN","688":"RS","690":"SC","694":"SL","702":"SG","703":"SK","704":"VN","705":"SI","706":"SO","710":"ZA","716":"ZW","724":"ES","728":"SS","729":"SD","732":"EH","740":"SR","748":"SZ","752":"SE","756":"CH","760":"SY","762":"TJ","764":"TH","768":"TG","776":"TO","780":"TT","784":"AE","788":"TN","792":"TR","795":"TM","796":"TC","800":"UG","804":"UA","807":"MK","818":"EG","826":"GB","831":"GG","832":"JE","833":"IM","834":"TZ","840":"US","850":"VI","854":"BF","858":"UY","860":"UZ","862":"VE","876":"WF","882":"WS","887":"YE","894":"ZM"};

let topologyPromise = null;
let countryFeatures = null;
const sphereFeature = { type: 'Sphere' };
const graticule = geoGraticule10();

function loadTopology() {
  if (!topologyPromise) {
    topologyPromise = fetch(TOPOLOGY_URL)
      .then((r) => r.json())
      .then((topology) => {
        const geo = feature(topology, topology.objects.countries);
        countryFeatures = geo.features.map((f) => {
          const key = f.id != null ? String(f.id) : null;
          let alpha2 = key && NUMERIC_TO_ALPHA2[key] ? NUMERIC_TO_ALPHA2[key] : null;
          if (!alpha2 && f.properties && f.properties.name === 'Kosovo') alpha2 = 'XK';
          f.__alpha2 = alpha2;
          return f;
        });
      })
      .catch((err) => {
        topologyPromise = null; // allow retry on next renderMap call
        throw err;
      });
  }
  return topologyPromise;
}

// Rotation persists across re-renders / view toggles within a session, so
// spinning the globe then switching to List and back doesn't reset the view.
let rotation = [10, -20];
let built = null; // { container, size, svg, pathEls, sphereEl, graticuleEl, projection, pathGen }

const SVG_NS = 'http://www.w3.org/2000/svg';

function buildGlobe(container) {
  container.innerHTML = '';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Rotatable globe. Drag to spin. Countries you have marked visited are shaded.');
  svg.style.width = '100%';
  svg.style.maxWidth = '420px';
  svg.style.aspectRatio = '1 / 1';
  svg.style.display = 'block';
  svg.style.touchAction = 'none';
  svg.style.cursor = 'grab';
  container.appendChild(svg);

  const hint = document.createElement('p');
  hint.className = 'map-hint';
  hint.textContent = 'Drag to spin the globe';
  container.appendChild(hint);

  // Measure the SVG's actual rendered size (after CSS sizing is applied) so the
  // viewBox's internal units line up 1:1 with real CSS pixels — otherwise drag
  // sensitivity math below would be off by whatever ratio CSS scaled it by.
  const size = Math.max(160, Math.round(svg.getBoundingClientRect().width) || 320);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

  const projection = geoOrthographic()
    .scale(size / 2 - 3)
    .translate([size / 2, size / 2])
    .rotate(rotation)
    .clipAngle(90);
  const pathGen = geoPath(projection);

  const sphereEl = document.createElementNS(SVG_NS, 'path');
  sphereEl.setAttribute('fill', 'var(--surface-sunken)');
  svg.appendChild(sphereEl);

  const graticuleEl = document.createElementNS(SVG_NS, 'path');
  graticuleEl.setAttribute('fill', 'none');
  graticuleEl.setAttribute('stroke', 'var(--line)');
  graticuleEl.setAttribute('stroke-width', '0.6');
  graticuleEl.setAttribute('opacity', '0.55');
  svg.appendChild(graticuleEl);

  const pathEls = [];
  for (const f of countryFeatures) {
    const el = document.createElementNS(SVG_NS, 'path');
    el.setAttribute('stroke', 'var(--surface)');
    el.setAttribute('stroke-width', '0.6');
    el.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(el);
    pathEls.push({ feature: f, el });
  }

  const state = { container, size, svg, pathEls, sphereEl, graticuleEl, projection, pathGen };
  projectAll(state);
  attachDrag(state);
  return state;
}

function projectAll(state) {
  state.sphereEl.setAttribute('d', state.pathGen(sphereFeature) || '');
  state.graticuleEl.setAttribute('d', state.pathGen(graticule) || '');
  for (const { feature: f, el } of state.pathEls) {
    el.setAttribute('d', state.pathGen(f) || '');
  }
}

function attachDrag(state) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let frameRequested = false;

  function scheduleProject() {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(() => {
      frameRequested = false;
      projectAll(state);
    });
  }

  function onPointerDown(e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    state.svg.style.cursor = 'grabbing';
    state.svg.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    const sensitivity = 230 / state.projection.scale(); // degrees per pixel
    const [lambda, phi] = state.projection.rotate();
    const nextLambda = lambda + dx * sensitivity;
    const nextPhi = Math.max(-90, Math.min(90, phi - dy * sensitivity));
    state.projection.rotate([nextLambda, nextPhi]);
    rotation = [nextLambda, nextPhi];
    scheduleProject();
  }

  function onPointerUp(e) {
    dragging = false;
    state.svg.style.cursor = 'grab';
    try { state.svg.releasePointerCapture(e.pointerId); } catch (err) { /* not captured, ignore */ }
  }

  state.svg.addEventListener('pointerdown', onPointerDown);
  state.svg.addEventListener('pointermove', onPointerMove);
  state.svg.addEventListener('pointerup', onPointerUp);
  state.svg.addEventListener('pointercancel', onPointerUp);
}

function applyMarkedFills(store) {
  for (const { feature: f, el } of built.pathEls) {
    const marked = f.__alpha2 ? store.isCountryMarked(f.__alpha2) : false;
    el.setAttribute('fill', marked ? 'var(--accent)' : 'var(--land)');
  }
}

export async function renderMap(container, { countries, store }) {
  try {
    await loadTopology();
  } catch (err) {
    console.error('Wayfarer: failed to load globe data', err);
    container.innerHTML = '<div class="empty-state">Couldn’t load the globe. Check your connection and try again.</div>';
    built = null;
    return;
  }

  if (!built || built.container !== container) {
    built = buildGlobe(container);
  }

  applyMarkedFills(store);
}
