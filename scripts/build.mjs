// CabCount build: data/seed-data.json -> public/data/*.json + city pages + sitemap
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public');
const SITE = 'https://cabcount.app';
// Policy text date. Contact lines stay PLACEHOLDERs until a real address exists.
const LEGAL_UPDATED = '2026-11-04';
const LEGAL_UPDATED_LABEL = 'November 4, 2026';
const seed = JSON.parse(fs.readFileSync(path.join(root, 'data/seed-data.json'), 'utf8'));
const warnings = [];
const BUILT = new Date();
const checkedPT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(BUILT).replace(' at ', ', ') + ' PT';

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
fs.writeFileSync(path.join(out, 'data/cities.json'), JSON.stringify({ updated: seed.meta.compiled, last_checked: BUILT.toISOString(), last_checked_pt: checkedPT, numbers_last_changed: seed.meta.compiled, statuses: STATUS, summary, cities }, null, 2));
fs.writeFileSync(path.join(out, 'data/fleet.json'), JSON.stringify({ updated: seed.meta.compiled, last_checked: BUILT.toISOString(), last_checked_pt: checkedPT, numbers_last_changed: seed.meta.compiled, basis: 'Texas DMV registrations (not confirmed active vehicles)', sources: seed.fleet_sources, series: fleet }, null, 2));

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
<form class="signup kit-form" action="https://app.kit.com/forms/10069322/subscriptions" method="post" data-kit-form="10069322">
<input type="email" name="email_address" placeholder="you@email.com" required aria-label="Email">
<input type="text" name="fields[city]" placeholder="Your city" value="${esc(city)}" aria-label="City">
<button class="btn" type="submit">Notify me</button><p class="msg small" role="status" aria-live="polite"></p></form>
<p class="small consent">Unsubscribe anytime. Your email and city are sent to Kit so we can deliver these alerts. <a href="/privacy">Privacy</a>.</p>
<script>document.querySelectorAll('form.kit-form').forEach(function(f){f.addEventListener('submit',function(e){if(!window.fetch||!window.FormData)return;e.preventDefault();var m=f.querySelector('.msg'),b=f.querySelector('button');b.disabled=true;m.textContent='Sending…';fetch(f.action,{method:'POST',body:new FormData(f),headers:{Accept:'application/json'}}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok||j.status==='failed')throw j;if(j.status==='quarantined'&&j.url){window.location.href=j.url;return;}m.textContent='Check your inbox to confirm your subscription.';f.reset();var c=f.querySelector('[name="fields[city]"]');if(c)c.value=c.defaultValue;})}).catch(function(){m.textContent='Sorry, something went wrong. Please try again in a moment.';}).finally(function(){b.disabled=false;});});});</script></section>`;
const sponsor = `<aside class="card sponsor"><span class="small muted">SPONSOR</span><h3>Sponsor CabCount</h3><p>Reach Robotaxi-curious readers every week. <a href="/about.html#sponsor">Learn more</a></p><!-- SPONSOR SLOT PLACEHOLDER --></aside>`;
const foot = (scripts = '') => `<footer class="foot"><p>CabCount is an independent tracker. <strong>Not affiliated with Tesla, Inc.</strong> Fleet numbers are registrations; service areas are estimates.</p>
<p>Made by <a href="https://beam42.space" rel="noopener">Beam42</a> · <a href="https://www.youtube.com/@beam42space" rel="noopener">Beam42 on YouTube</a> · <a href="/about.html">About &amp; sources</a> · <a href="/privacy">Privacy</a> · <a href="/dmca">Copyright / DMCA</a> · <a href="/sitemap.xml">Sitemap</a></p></footer>${scripts}</body></html>`;
const freshness = () => `<div class="freshness"><p class="checked">Last checked: <time datetime="${BUILT.toISOString()}">${checkedPT}</time></p><p class="small muted">Numbers last changed: <time datetime="${seed.meta.compiled}">${fmtDate(seed.meta.compiled)}</time></p></div>`;
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const srcList = s => `<ul class="sources">${s.map(u => `<li><a href="${esc(u)}" rel="noopener nofollow" target="_blank">${esc(host(u))}</a> <span class="muted small">${esc(u.length > 70 ? u.slice(0, 70) + '…' : u)}</span></li>`).join('')}</ul>`;

// ---------- home ----------
fs.writeFileSync(path.join(out, 'index.html'), head({ title: 'CabCount — Is Tesla Robotaxi coming to your city?', desc: `Live tracker of Tesla Robotaxi and Cybercab rollout: ${summary.cities_live} cities live, ${summary.service_sq_mi.toLocaleString()} sq mi of service, ${summary.cybercabs_registered} Cybercabs registered.`, url: "/", extraHead: "<link rel=\"stylesheet\" href=\"/vendor/leaflet.css\">" }) + `
<main>
<section class="hero"><h1>Is Robotaxi coming to <span class="accent">your city?</span></h1>
<p class="lede">Every Tesla Robotaxi city, geofence and Cybercab — tracked, sourced, and mapped.</p>
${freshness()}</section>
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
<p class="lede">${esc(c.notes || '')}</p>${freshness()}</section>
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
<p id="submit-agree">By submitting you agree to the <a href="#submission-terms">Submission Terms</a>: you own or have the rights to the photo, video, or other media; you grant CabCount a license to display it; it is not illegal or infringing; and we may remove it.</p>
<div class="check-row"><input type="checkbox" id="sighting-agree" name="agree_terms"><label for="sighting-agree">I agree to the Submission Terms.</label> <a href="#submission-terms">Read the Submission Terms</a></div>
<!-- ===== TALLY EMBED PLACEHOLDER =====
  Replace the div below with your Tally embed, e.g.
  <iframe data-tally-src="https://tally.so/embed/YOUR_FORM_ID?alignLeft=1&hideTitle=1&transparentBackground=1" loading="lazy" width="100%" height="600" frameborder="0" title="CabCount sighting"></iframe>
  <script async src="https://tally.so/widgets/embed.js"></script>
  Suggested fields: city, date/time, location (cross streets), vehicle type (Model Y / Cybercab), driver seat occupied?, photo/video upload or link, email (optional).
===================================== -->
<div id="tally-embed" class="gated"><p id="gate-note" class="small gate-note">Check “I agree to the Submission Terms” above to use this form.</p><iframe data-tally-src="https://tally.so/embed/7XlGB6?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1" loading="lazy" width="100%" height="700" frameborder="0" title="Report a Robotaxi sighting"></iframe><script async src="https://tally.so/widgets/embed.js"></script></div>
<p class="small">Form not loading? <a href="https://tally.so/r/7XlGB6" rel="noopener" target="_blank">Open it here</a>. That is the same form. By submitting you agree to the <a href="#submission-terms">Submission Terms</a>.</p>
<script>(function(){var box=document.getElementById('sighting-agree'),gate=document.getElementById('tally-embed');if(!box||!gate)return;function sync(){var on=!box.checked;gate.classList.toggle('is-locked',on);gate.setAttribute('aria-disabled',on?'true':'false');}box.addEventListener('change',sync);sync();})();</script>
<h3>What happens next</h3><ol><li>We verify the date, place and vehicle.</li><li>Confirmed sightings appear on the map as <em>Testing / Sightings</em>.</li><li>We never publish your email.</li><li>We may remove a submission. See the <a href="#submission-terms">Submission Terms</a>.</li></ol></section>
<section class="card" id="submission-terms"><h2>Submission Terms</h2>
<p>These terms apply when you send CabCount a sighting, including a photo, video, or link. By submitting you agree to them.</p>
<ol>
<li><strong>You own it or you have the rights.</strong> You confirm that you own the media you submit, or that you have the rights needed to submit it and to let us display it.</li>
<li><strong>License to display.</strong> You grant CabCount a non-exclusive, royalty-free license to display the submission on cabcount.app in connection with that sighting, including the hosting and reproduction needed to show it on the site, for as long as it stays on the site.</li>
<li><strong>No illegal or infringing content.</strong> You will not submit anything illegal, or anything that infringes someone else's copyright or other rights.</li>
<li><strong>We may remove anything.</strong> We may refuse, unpublish, or remove a submission for any reason, including these terms or a copyright complaint. Copyright notices go to the <a href="/dmca">Copyright / DMCA</a> page. Personal-information requests go to the <a href="/privacy">Privacy</a> page.</li>
</ol>
<p>A person reviews a submission before it goes on the map. We do not publish the email address included with a sighting.</p></section>
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
<p><a href="https://beam42.space">beam42.space</a> · <a href="https://www.youtube.com/@beam42space">Beam42 on YouTube</a></p></main>` + foot());

// ---------- privacy / DMCA / 404 ----------
// Flat privacy.html and dmca.html are what Cloudflare Pages serves at /privacy and /dmca
// (it redirects the .html URL to the extensionless one). A top-level 404.html is required:
// without it, Pages treats the project as a single-page app and serves index.html for any
// path that is not a real file, which is why /privacy used to be the homepage.
const contactPlaceholder = `<dl>
<dt>Email</dt><dd><a href="mailto:kevinrey24@gmail.com">kevinrey24@gmail.com</a></dd>
<dt>Mail</dt><dd>Kevin Rey, 14016 106th Ave Ct E, Puyallup, WA 98374</dd>
</dl>`;
fs.writeFileSync(path.join(out, 'privacy.html'), head({ title: 'Privacy | CabCount', desc: 'What CabCount collects: sighting submissions, Get alerts email via Kit, and cookieless Cloudflare Web Analytics. Processors, retention, deletion, and children under 13.', url: '/privacy' }) + `
<main class="legal"><section class="hero left"><h1>Privacy</h1>
<p class="lede">What CabCount collects, who processes it, how long it is kept, and how to ask for deletion.</p>
<p>Last updated: <time datetime="${LEGAL_UPDATED}">${LEGAL_UPDATED_LABEL}</time></p></section>
<section class="card"><h2>Who we are</h2>
<p>CabCount (<a href="https://cabcount.app">cabcount.app</a>) is an independent tracker of Tesla Robotaxi and Cybercab rollout, published by Beam42. CabCount is not affiliated with Tesla, Inc.</p>
<p>This page covers cabcount.app only.</p></section>
<section class="card"><h2>Information we collect</h2>
<h3>Sighting photo and video submissions</h3>
<p>The sightings page embeds a form hosted by Tally (<a href="https://tally.so/r/7XlGB6" rel="noopener" target="_blank">tally.so/r/7XlGB6</a>). If you submit a sighting, we collect the city, the date you saw the vehicle, what you saw (including whether a driver or safety monitor was present), any details you type, a photo or video link, and an optional email address if you want a follow-up. The details box is free text, so it can include other submitter information you choose to add. We do not publish the email address. A person reviews a submission before anything is added to the map.</p>
<h3>Get alerts email</h3>
<p>The “Get alerts” form posts to Kit at <a href="https://app.kit.com/forms/10069322" rel="noopener" target="_blank">https://app.kit.com/forms/10069322</a> (the subscription endpoint is <a href="https://app.kit.com/forms/10069322/subscriptions" rel="noopener" target="_blank">/subscriptions</a>). We collect the email address you enter and the city you type, if you type one. Kit sends a confirmation email. Unsubscribe anytime, from a link in those emails or by asking us.</p>
<h3>Cloudflare Web Analytics</h3>
<p>CabCount uses Cloudflare Web Analytics. It is cookieless and does no session recording. It does not use advertising cookies. We do not use it to build a profile of you.</p>
<h3>Hosting</h3>
<p>Cloudflare serves the site. Like other hosts, it processes the technical data needed to deliver the page and protect the site, including IP address and the page requested. That is separate from the cookieless analytics above.</p>
<p>We do not sell personal information. We do not run a CabCount account system.</p></section>
<section class="card"><h2>Processors and storage</h2>
<ul>
<li><strong>Kit</strong> (the form at app.kit.com/forms/10069322) stores alert subscriptions and sends the emails.</li>
<li><strong>Tally</strong> (tally.so) stores sighting submissions, including the photo or video link, the details you type, and the optional follow-up email, until they are deleted.</li>
<li><strong>Cloudflare</strong> hosts cabcount.app, serves the published pages, and provides Cloudflare Web Analytics. A sighting we choose to publish becomes part of the site stored with Cloudflare. We do not keep a separate copy of submissions in our own database; this project has none.</li>
</ul></section>
<section class="card"><h2>Retention</h2>
<ul>
<li><strong>Alerts.</strong> Kit keeps the subscription until you unsubscribe or we delete it after a request.</li>
<li><strong>Sightings.</strong> Tally keeps the submission, including any photo or video link, until we delete it or you ask us to. If we publish a description or media from it, we keep that published copy until we take it down or you ask us to delete it. We do not publish the email from a sighting.</li>
<li><strong>Analytics.</strong> We do not receive a file of identified visitors from Cloudflare Web Analytics, and we do not set our own retention period for it. There is no session recording to retain.</li>
<li><strong>Delivery logs.</strong> Cloudflare may keep connection logs for security and operations on its own schedule. We do not copy those logs into a CabCount database.</li>
</ul></section>
<section class="card"><h2>Deletion requests</h2>
<p>Email the privacy contact below and say what you want deleted: the email you used for alerts, the sighting you sent, or both. Include enough detail for us to find the record, such as the email address or the page URL. We will delete personal information we hold and ask Kit or Tally to delete the matching record. We may keep a short note that we received and completed the request. We may decline when the law requires us to keep the information, or when we cannot tell which record is yours.</p>
${contactPlaceholder}</section>
<section class="card"><h2>Not for children under 13</h2>
<p>CabCount is not for children under 13. Do not submit a sighting, an email address, or other personal information if you are under 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has given us personal information, email the privacy contact and we will delete it.</p></section>
<section class="card"><h2>Contact</h2>
<p>Privacy questions and deletion requests go to the contact below. Copyright notices go to the <a href="/dmca">Copyright / DMCA</a> page. The DMCA agent is still a placeholder.</p>
${contactPlaceholder}
<p>Last updated: <time datetime="${LEGAL_UPDATED}">${LEGAL_UPDATED_LABEL}</time></p></section>
</main>` + foot());

const agentPlaceholder = `<div class="placeholder-box"><h3>PLACEHOLDER — designated DMCA agent not registered yet</h3>
<p>The designated agent has not been registered with the U.S. Copyright Office. Every field below is a PLACEHOLDER. None of them is a working name, address, email, or phone. Do not send a notice to these placeholders. This page will be updated with the registered agent’s details after registration.</p>
<dl>
<dt>Name</dt><dd>[PLACEHOLDER: agent name]</dd>
<dt>Address</dt><dd>[PLACEHOLDER: street address, city, region, postal code, country]</dd>
<dt>Email</dt><dd>[PLACEHOLDER: agent email]</dd>
<dt>Phone</dt><dd>[PLACEHOLDER: agent phone]</dd>
</dl></div>`;
fs.writeFileSync(path.join(out, 'dmca.html'), head({ title: 'Copyright / DMCA | CabCount', desc: 'How to send a DMCA takedown notice or counter-notice to CabCount, the repeat-infringer policy, and the designated agent placeholder.', url: '/dmca' }) + `
<main class="legal"><section class="hero left"><h1>Copyright / DMCA</h1>
<p class="lede">How to ask CabCount to remove material you believe infringes a copyright, and how a submitter can send a counter-notice.</p>
<p>Last updated: <time datetime="${LEGAL_UPDATED}">${LEGAL_UPDATED_LABEL}</time></p></section>
<section class="card"><h2>Designated agent</h2>
<p>Under the Digital Millennium Copyright Act, a takedown notice for material on cabcount.app should be sent to the designated agent below. The agent is not registered yet.</p>
${agentPlaceholder}</section>
<section class="card"><h2>How to send a takedown notice</h2>
<p>Send a written notice that includes every element required by 17 U.S.C. § 512(c)(3). A notice that leaves one out may not be effective. We may still remove material that breaks the <a href="/sightings.html#submission-terms">Submission Terms</a>.</p>
<ol>
<li><strong>Signature.</strong> A physical or electronic signature of the person authorized to act for the owner of the exclusive right that is allegedly infringed.</li>
<li><strong>The copyrighted work.</strong> Identification of the copyrighted work you claim has been infringed. If the notice covers many works on this site, a representative list of those works is enough.</li>
<li><strong>The material on CabCount.</strong> Identification of the material you claim is infringing, and information reasonably sufficient for us to find it, such as the page URL.</li>
<li><strong>How to reach you.</strong> Information reasonably sufficient for us to contact you, such as your address, telephone number, and, if you have one, an email address.</li>
<li><strong>Good-faith belief.</strong> A statement that you have a good-faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.</li>
<li><strong>Accuracy and authority.</strong> A statement that the information in the notice is accurate, and under penalty of perjury, that you are authorized to act for the owner of an exclusive right that is allegedly infringed.</li>
</ol>
<p>Send the completed notice to the designated agent once that agent’s name, address, email, and phone replace the placeholders above. A notice that knowingly misrepresents that material is infringing can have legal consequences.</p>
<p>If a notice is complete, we will remove or disable access to the material it identifies and, when we can, tell the person who submitted it.</p></section>
<section class="card"><h2>Counter-notice</h2>
<p>If you submitted material that we removed because of a takedown notice, you may send a counter-notice to the same designated agent. A counter-notice must include the elements required by 17 U.S.C. § 512(g)(3):</p>
<ol>
<li>Your physical or electronic signature.</li>
<li>Identification of the material that was removed, and the location (URL) where it appeared before it was removed.</li>
<li>A statement under penalty of perjury that you have a good-faith belief that the material was removed or disabled as a result of mistake or misidentification.</li>
<li>Your name, address, and telephone number, and a statement that you consent to the jurisdiction of the Federal District Court for the judicial district of your address, or if your address is outside the United States, for any judicial district in which CabCount may be found, and that you will accept service of process from the person who sent the original notice or that person’s agent.</li>
</ol>
<p>If we receive a valid counter-notice, we will send a copy to the person who filed the original notice and tell them that we will restore the material in 10 to 14 business days unless they notify us that they have filed a court action seeking a court order to restrain the person who submitted the material.</p></section>
<section class="card"><h2>Repeat-infringer policy</h2>
<p>CabCount does not offer accounts. When we remove material because of a notice, we record the notice and the submitter details we have, such as an email address sent with the sighting. In appropriate circumstances, including when the same person repeatedly submits infringing material, we will refuse further submissions from that person and remove their material from the site.</p>
<p>We may also remove any submission under the <a href="/sightings.html#submission-terms">Submission Terms</a>, with or without a formal notice.</p>
<p>Last updated: <time datetime="${LEGAL_UPDATED}">${LEGAL_UPDATED_LABEL}</time></p></section>
</main>` + foot());

fs.writeFileSync(path.join(out, '404.html'), head({ title: 'Page not found | CabCount', desc: 'That CabCount page does not exist.', url: '/404' }) + `
<main class="legal"><section class="hero left"><h1>Page not found</h1>
<p class="lede">That address is not a page on CabCount. Unknown addresses are not the homepage.</p>
<p><a href="/">Back to the map</a> · <a href="/privacy">Privacy</a> · <a href="/dmca">Copyright / DMCA</a></p></section></main>` + foot());

pages.push('/privacy', '/dmca');

// ---------- sitemap / robots ----------
fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `  <url><loc>${SITE}${p}</loc><lastmod>${p === '/privacy' || p === '/dmca' ? LEGAL_UPDATED : seed.meta.compiled}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Built ${pages.length} pages, ${cities.length} map points.`);
if (warnings.length) console.log('Data warnings:\n - ' + warnings.join('\n - '));
