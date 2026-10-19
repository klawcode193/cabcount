// CabCount build: data/seed-data.json -> public/data/*.json + city pages + sitemap
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public');
const SITE = 'https://cabcount.app';
const seed = JSON.parse(fs.readFileSync(path.join(root, 'data/seed-data.json'), 'utf8'));
const warnings = [];

const STATUS = {
  live_unsupervised: { label: 'Live – no monitor', color: '#22c55e' },
  live_safety_driver: { label: 'Live – safety driver', color: '#3b82f6' },
  preparing: { label: 'Preparing / Permitted', color: '#f59e0b' },
  testing_sightings: { label: 'Testing / Sightings', color: '#a855f7' },
  requested: { label: 'Requested', color: '#64748b' },
};
// Approximate centroids for reader-requested places (seed has no coords) — map placement only.
const REQ_COORDS = {
  'San Antonio, TX': [29.4241, -98.4936], 'Sydney, AU': [-33.8688, 151.2093],
  'Denver / Weld County, CO': [39.97, -104.9], 'Atlanta, GA': [33.749, -84.388],
  'Jacksonville, FL': [30.3322, -81.6557], 'North Houston metro, TX': [30.1, -95.42],
  'Canada / Toronto': [43.6532, -79.3832], 'South Korea': [37.5665, 126.978],
};
const slugify = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const cities = seed.cities.map(c => {
  if (!STATUS[c.status]) warnings.push(`${c.id}: unknown status ${c.status}`);
  if (c.launched && c.launched.length < 10) warnings.push(`${c.id}: launch date is month-only (${c.launched})`);
  if (c.status.startsWith('live') && !c.service_area_history) warnings.push(`${c.id}: no service-area history (single point only)`);
  const hist = c.service_area_history || (c.service_area_sq_mi ? [{ date: c.service_area_as_of || c.launched, sq_mi: c.service_area_sq_mi }] : []);
  return {
    slug: c.id, name: c.city, region: c.state, country: c.country, lat: c.lat, lng: c.lng,
    status: c.status, status_label: STATUS[c.status]?.label, launched: c.launched || null,
    unsupervised_since: c.unsupervised_since || null, vehicles: c.vehicles || [], cybercab: !!c.cybercab,
    cybercab_public_since: c.cybercab_public_since || null, cybercab_note: c.cybercab_note || null,
    service_area_sq_mi: c.service_area_sq_mi ?? null, service_area_as_of: c.service_area_as_of || null,
    service_area_history: hist, hours: c.hours || null, permit_date: c.permit_date || null,
    permitted_vehicles: c.permitted_vehicles || null, notes: c.notes || null, sources: c.sources || [],
    has_page: true,
  };
});
for (const r of seed.requested_cities_from_x) {
  const co = REQ_COORDS[r.city];
  if (!co) { warnings.push(`requested "${r.city}" has no coordinates – skipped on map`); continue; }
  cities.push({ slug: 'requested-' + slugify(r.city), name: r.city, status: 'requested', status_label: STATUS.requested.label,
    lat: co[0], lng: co[1], requested_on: r.date, sources: [r.url], approx_coords: true, has_page: false });
}
const fleet = seed.fleet_timeseries_texas_registry.map(f => ({ date: f.date, total: f.total ?? null, model_y: f.model_y ?? null, cybercab: f.cybercab ?? null, note: f.note || null }));
fleet.forEach(f => { if (f.total == null || f.cybercab == null || f.model_y == null) warnings.push(`fleet ${f.date}: incomplete breakdown`); });
const latestCyber = [...fleet].reverse().find(f => f.cybercab != null);
const live = cities.filter(c => c.status.startsWith('live'));
const summary = {
  updated: seed.meta.compiled, cities_live: live.length,
  service_sq_mi: live.reduce((a, c) => a + (c.service_area_sq_mi || 0), 0),
  cybercabs_registered: latestCyber?.cybercab ?? null, cybercabs_as_of: latestCyber?.date,
  fleet_total: [...fleet].reverse().find(f => f.total != null)?.total,
  other_metrics: seed.other_metrics,
};
fs.writeFileSync(path.join(out, 'data/cities.json'), JSON.stringify({ updated: seed.meta.compiled, statuses: STATUS, summary, cities }, null, 2));
fs.writeFileSync(path.join(out, 'data/fleet.json'), JSON.stringify({ updated: seed.meta.compiled, basis: 'Texas DMV registrations (not confirmed active vehicles)', sources: seed.fleet_sources, series: fleet }, null, 2));

// ---------- templates ----------
const fmtDate = d => { if (!d) return '—'; const [y, m, dd] = d.split('-'); const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]; return dd ? `${M} ${+dd}, ${y}` : `${M} ${y}`; };
const head = ({ title, desc, url, img = "/assets/og.png", extraHead = "" }) => `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${url}"><meta name="theme-color" content="#0b0f17">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta property="og:type" content="website"><meta property="og:site_name" content="CabCount"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${url}"><meta property="og:image" content="${SITE}${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${SITE}${img}">
${extraHead}<link rel="stylesheet" href="/css/style.css"></head><body>
<header class="nav"><a class="brand" href="/"><img src="/favicon.svg" alt="" width="26" height="26"> CabCount</a>
<nav><a href="/#map">Map</a><a href="/sightings.html">Sightings</a><a href="/about.html">About</a><a class="btn sm" href="#newsletter">Get alerts</a></nav></header>`;
const newsletter = (city = '') => `<section class="card newsletter" id="newsletter"><h2>${city ? `Get alerted for ${esc(city)}` : 'Get the weekly CabCount'}</h2>
<p>New cities, geofence expansions and Cybercab counts. One email a week, no spam.</p>
<!-- KIT (ConvertKit) FORM PLACEHOLDER: replace this <form> with your Kit embed, or set action="https://app.kit.com/forms/<FORM_ID>/subscriptions" and keep field names email_address + fields[city] -->
<form class="signup" data-kit-placeholder action="#" onsubmit="event.preventDefault();this.querySelector('.msg').textContent='Signups open soon — form not connected yet.'">
<input type="email" name="email_address" placeholder="you@email.com" required aria-label="Email">
<input type="text" name="fields[city]" placeholder="Your city" value="${esc(city)}" aria-label="City">
<button class="btn" type="submit">Notify me</button><p class="msg small"></p></form></section>`;
const sponsor = `<aside class="card sponsor"><span class="small muted">SPONSOR</span><h3>Sponsor CabCount</h3><p>Reach Robotaxi-curious readers every week. <a href="/about.html#sponsor">Learn more</a></p><!-- SPONSOR SLOT PLACEHOLDER --></aside>`;
const foot = (scripts = '') => `<footer class="foot"><p>CabCount is an independent tracker. <strong>Not affiliated with Tesla, Inc.</strong> Fleet numbers are registrations; service areas are estimates.</p>
<p>Made by <a href="https://beam42.space" rel="noopener">Beam42</a> · <a href="https://www.youtube.com/@Beam42" rel="noopener">Beam42 on YouTube</a> · <a href="/about.html">About &amp; sources</a> · <a href="/sitemap.xml">Sitemap</a></p></footer>${scripts}</body></html>`;
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const srcList = s => `<ul class="sources">${s.map(u => `<li><a href="${esc(u)}" rel="noopener nofollow" target="_blank">${esc(host(u))}</a> <span class="muted small">${esc(u.length > 70 ? u.slice(0, 70) + '…' : u)}</span></li>`).join('')}</ul>`;

// ---------- home ----------
fs.writeFileSync(path.join(out, 'index.html'), head({ title: 'CabCount — Is Tesla Robotaxi coming to your city?', desc: `Live tracker of Tesla Robotaxi and Cybercab rollout: ${summary.cities_live} cities live, ${summary.service_sq_mi.toLocaleString()} sq mi of service, ${summary.cybercabs_registered} Cybercabs registered.`, url: "/", extraHead: "<link rel=\"stylesheet\" href=\"/vendor/leaflet.css\">" }) + `
<main>
<section class="hero"><h1>Is Robotaxi coming to <span class="accent">your city?</span></h1>
<p class="lede">Every Tesla Robotaxi city, geofence and Cybercab — tracked, sourced, and mapped.</p>
<p class="small muted">Last updated <time datetime="${summary.updated}">${fmtDate(summary.updated)}</time></p></section>
<section class="scoreboard">
<div class="stat"><b id="s-live">${summary.cities_live}</b><span>cities live</span></div>
<div class="stat"><b id="s-area">${summary.service_sq_mi.toLocaleString()}</b><span>sq mi of service*</span></div>
<div class="stat"><b id="s-cc">${summary.cybercabs_registered}</b><span>Cybercabs registered†</span></div></section>
<section id="map" class="card mapcard"><div id="leaflet" role="region" aria-label="Map of Robotaxi cities"></div><div id="legend" class="legend"></div></section>
<section class="card"><h2>City status</h2><div id="citylist" class="citylist"></div></section>
<section class="grid2">
<div class="card"><h2>Texas fleet registrations</h2><div class="chartbox"><canvas id="fleetChart" aria-label="Fleet over time"></canvas></div><p class="small muted">† Texas DMV registrations, not cars confirmed in service. As of ${fmtDate(summary.cybercabs_as_of)}.</p></div>
<div class="card"><h2>Service-area growth</h2><div class="chartbox"><canvas id="areaChart" aria-label="Service area over time"></canvas></div><p class="small muted">* Estimated from in-app maps; trackers differ by a few %.</p></div>
</section>
${newsletter()}
${sponsor}
</main>` + foot('<script src="/vendor/leaflet.js" defer></script><script src="/vendor/chart.umd.min.js" defer></script><script src="/js/home.js" defer></script>'));

// ---------- city pages ----------
const pages = ['/', '/sightings.html', '/about.html'];
for (const c of cities.filter(c => c.has_page)) {
  const st = STATUS[c.status];
  const tl = [];
  if (c.permit_date) tl.push([c.permit_date, `Permit approved${c.permitted_vehicles ? ` for up to ${c.permitted_vehicles.toLocaleString()} vehicles` : ''}`]);
  if (c.launched) tl.push([c.launched, 'Public Robotaxi service launched']);
  if (c.unsupervised_since) tl.push([c.unsupervised_since, 'Rides with no safety monitor begin']);
  if (c.cybercab_public_since) tl.push([c.cybercab_public_since, 'Cybercab enters public service']);
  (c.service_area_history || []).forEach(h => { if (h.date !== c.launched) tl.push([h.date, `Service area ≈ ${h.sq_mi} sq mi${h.note ? ` (${h.note})` : ''}`]); });
  tl.sort((a, b) => a[0].localeCompare(b[0]));
  const place = [c.name, c.region].filter(Boolean).join(', ');
  const desc = `Tesla Robotaxi in ${place}: ${st.label}${c.launched ? `, launched ${fmtDate(c.launched)}` : ''}${c.service_area_sq_mi ? `, ~${c.service_area_sq_mi} sq mi` : ''}.`;
  const html = head({ title: `Tesla Robotaxi in ${place} — status & timeline | CabCount`, desc, url: `/city/${c.slug}.html` }) + `
<main><p class="small"><a href="/">← All cities</a></p>
<section class="hero left"><span class="pill" style="--c:${st.color}">${st.label}</span><h1>Tesla Robotaxi in ${esc(place)}</h1>
<p class="lede">${esc(c.notes || '')}</p></section>
<section class="scoreboard">
<div class="stat"><b>${c.launched ? fmtDate(c.launched) : '—'}</b><span>launched</span></div>
<div class="stat"><b>${c.service_area_sq_mi ? '~' + c.service_area_sq_mi : '—'}</b><span>sq mi (est.)${c.service_area_as_of ? ', ' + fmtDate(c.service_area_as_of) : ''}</span></div>
<div class="stat"><b>${c.vehicles.length ? esc(c.vehicles.join(' + ')) : '—'}</b><span>vehicles</span></div></section>
${c.cybercab_note ? `<div class="card note"><strong>Cybercab watch:</strong> ${esc(c.cybercab_note)}</div>` : ''}
${c.hours ? `<p class="muted">Hours: ${esc(c.hours)}</p>` : ''}
<section class="grid2"><div class="card"><h2>Timeline</h2>${tl.length ? `<ol class="timeline">${tl.map(([d, t]) => `<li><time>${fmtDate(d)}</time><span>${esc(t)}</span></li>`).join('')}</ol>` : '<p class="muted">No dated milestones yet.</p>'}</div>
<div class="card"><h2>Service area</h2>${c.service_area_history.length ? `<div class="chartbox"><canvas id="cityArea"></canvas></div><p class="small muted">Estimates traced from the Robotaxi app map.</p>` : '<p class="muted">No public service area yet.</p>'}</div></section>
${newsletter(c.name)}
<section class="card"><h2>Sources</h2>${srcList(c.sources)}<p class="small muted">See something new? <a href="/sightings.html">Report a sighting</a>.</p></section>
${sponsor}</main>
<script>window.CITY=${JSON.stringify({ name: c.name, history: c.service_area_history }).replace(/</g, '\\u003c')};</script>` + foot('<script src="/vendor/chart.umd.min.js" defer></script><script src="/js/city.js" defer></script>');
  fs.writeFileSync(path.join(out, 'city', c.slug + '.html'), html);
  pages.push(`/city/${c.slug}.html`);
}

// ---------- sightings ----------
fs.writeFileSync(path.join(out, 'sightings.html'), head({ title: 'Report a Robotaxi or Cybercab sighting | CabCount', desc: 'Spotted a Tesla Robotaxi or Cybercab testing in your city? Send it to CabCount. Submissions are reviewed before they go on the map.', url: '/sightings.html' }) + `
<main><section class="hero left"><h1>Spotted a Robotaxi or Cybercab?</h1>
<p class="lede">Send us a photo, video or link. Every submission is <strong>reviewed by a human before it goes on the map</strong> — we check location, date and that it's really a Tesla test vehicle.</p></section>
<section class="card"><h2>Submit a sighting</h2>
<!-- ===== TALLY EMBED PLACEHOLDER =====
  Replace the div below with your Tally embed, e.g.
  <iframe data-tally-src="https://tally.so/embed/YOUR_FORM_ID?alignLeft=1&hideTitle=1&transparentBackground=1" loading="lazy" width="100%" height="600" frameborder="0" title="CabCount sighting"></iframe>
  <script async src="https://tally.so/widgets/embed.js"></script>
  Suggested fields: city, date/time, location (cross streets), vehicle type (Model Y / Cybercab), driver seat occupied?, photo/video upload or link, email (optional).
===================================== -->
<div class="placeholder" id="tally-embed">Tally form goes here<br><span class="small">TALLY_EMBED_URL not set yet</span></div>
<h3>What happens next</h3><ol><li>We verify the date, place and vehicle.</li><li>Confirmed sightings appear on the map as <em>Testing / Sightings</em>.</li><li>We never publish your email; photo credit is optional.</li></ol></section>
${newsletter()}</main>` + foot());

// ---------- about ----------
fs.writeFileSync(path.join(out, 'about.html'), head({ title: 'About CabCount & sources', desc: 'How CabCount tracks Tesla Robotaxi and Cybercab: methodology, sources and disclaimers. Not affiliated with Tesla.', url: '/about.html' }) + `
<main><section class="hero left"><h1>About CabCount</h1><p class="lede">CabCount is an independent, source-linked tracker of Tesla's Robotaxi and Cybercab rollout.</p></section>
<section class="card disclaimer"><h2>Not affiliated with Tesla</h2><p>CabCount is not affiliated with, endorsed by, or sponsored by Tesla, Inc. "Tesla", "Robotaxi" and "Cybercab" are trademarks of their owners.</p></section>
<section class="card"><h2>Methodology</h2><ul>
<li><strong>Fleet numbers are registrations.</strong> Counts come from Texas DMV registration records as summarized by public trackers and news — they are not cars confirmed driving riders.</li>
<li><strong>Service areas are estimates.</strong> Tesla doesn't publish geofence sizes; figures are traced from the in-app map and differ by a few percent between trackers.</li>
<li><strong>Statuses:</strong> ${Object.entries(seed.meta.status_values).map(([k, v]) => `<br><span class="dot" style="--c:${STATUS[k].color}"></span><b>${STATUS[k].label}</b> — ${esc(v)}`).join('')}</li>
<li>Requested cities are reader demand only — they're placed approximately and imply no Tesla activity.</li></ul></section>
<section class="card"><h2>Other metrics</h2><ul><li>Cumulative unsupervised miles: ${esc(seed.other_metrics.unsupervised_miles_cumulative.value)} (as of ${fmtDate(seed.other_metrics.unsupervised_miles_cumulative.date)})</li><li>NHTSA Cybercab review: ${esc(seed.other_metrics.nhtsa_cybercab_review.status)}</li></ul></section>
<section class="card"><h2>Sources</h2><h3>Fleet</h3>${srcList(seed.fleet_sources)}<h3>Cities</h3>${srcList([...new Set(seed.cities.flatMap(c => c.sources))])}<h3>Other trackers worth reading</h3>${srcList(seed.existing_trackers_competitors)}</section>
<section class="card" id="sponsor"><h2>Sponsor CabCount</h2><p>Sponsorship slots on the homepage, city pages and weekly email. <!-- SPONSOR CONTACT PLACEHOLDER: add contact email/form before launch --> Contact details coming soon.</p></section>
<p><a href="https://beam42.space">beam42.space</a> · <a href="https://www.youtube.com/@Beam42">Beam42 on YouTube</a></p></main>` + foot());

// ---------- sitemap / robots ----------
fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `  <url><loc>${SITE}${p}</loc><lastmod>${seed.meta.compiled}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Built ${pages.length} pages, ${cities.length} map points.`);
if (warnings.length) console.log('Data warnings:\n - ' + warnings.join('\n - '));
