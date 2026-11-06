// Compliance and Cloudflare Pages routing checks.
// Run `npm run build` first. This file does not modify newsletter drafts or send mail.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { once } from 'node:events';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pub = path.join(root, 'public');
const read = (rel) => fs.readFileSync(path.join(pub, rel), 'utf8');
let failed = 0;
function check(name, cond) {
  if (!cond) { console.error('FAIL ' + name); failed++; }
  else console.log('ok ' + name);
}

/**
 * Resolver modeled on Cloudflare Pages "Serving Pages" (docs updated Oct 10, 2026):
 * a matching HTML file is served; /page.html redirects to /page; with no top-level
 * 404.html, an unmatched path is served as / (index.html) with status 200.
 * With 404.html, an unmatched path is that file. Status 404 is the usual Pages
 * response; the docs name the file, and the regression we care about is the body.
 */
export function resolvePages(siteRoot, urlPath) {
  let pathname = decodeURIComponent(urlPath.split('?')[0]);
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  const has404 = fs.existsSync(path.join(siteRoot, '404.html'));
  const indexFile = path.join(siteRoot, 'index.html');

  if (pathname.endsWith('.html')) {
    const file = path.join(siteRoot, pathname.slice(1));
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      const extless = pathname.slice(0, -'.html'.length) || '/';
      return { status: 308, location: extless, file: null, spaFallback: false };
    }
  }

  const candidates = [];
  if (pathname === '/' || pathname === '') candidates.push(indexFile);
  else {
    const rel = pathname.replace(/^\//, '');
    candidates.push(path.join(siteRoot, rel));
    candidates.push(path.join(siteRoot, rel + '.html'));
    candidates.push(path.join(siteRoot, rel, 'index.html'));
  }
  for (const file of candidates) {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      return { status: 200, location: null, file, spaFallback: false };
    }
  }
  if (!has404) return { status: 200, location: null, file: indexFile, spaFallback: true };
  return { status: 404, location: null, file: path.join(siteRoot, '404.html'), spaFallback: false };
}

function startPagesServer(siteRoot) {
  const server = http.createServer((req, res) => {
    const resolved = resolvePages(siteRoot, req.url || '/');
    if (resolved.location) {
      res.writeHead(resolved.status, { Location: resolved.location, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('redirect');
      return;
    }
    const body = fs.readFileSync(resolved.file);
    res.writeHead(resolved.status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
  });
  server.listen(0, '127.0.0.1');
  return server;
}

async function fetchFollow(base, urlPath) {
  const res = await fetch(base + urlPath, { redirect: 'manual' });
  if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
    const location = res.headers.get('location');
    const next = await fetch(base + location, { redirect: 'manual' });
    return { status: next.status, location, body: await next.text(), redirected: true };
  }
  return { status: res.status, location: null, body: await res.text(), redirected: false };
}

const buildSource = fs.readFileSync(path.join(root, 'scripts/build.mjs'), 'utf8');
const homeJs = fs.readFileSync(path.join(pub, 'js/home.js'), 'utf8');
check('build source has no Kit signup', !/app\.kit\.com|kit-form|Get alerts|Get alerted/.test(buildSource));
check('map popup has no alert link', !/Get alerted|#newsletter/.test(homeJs));
check('build source writes privacy, dmca, and 404', /privacy\.html/.test(buildSource) && /dmca\.html/.test(buildSource) && /404\.html/.test(buildSource));

const privacy = read('privacy.html');
const dmca = read('dmca.html');
const sight = read('sightings.html');
const home = read('index.html');
const missing = read('404.html');
const sitemap = read('sitemap.xml');
const detroit = read('city/detroit-mi.html');
const fleet = read('data/fleet.json');
const cities = read('data/cities.json');

check('privacy is not the homepage', privacy !== home && !privacy.includes('Is Robotaxi coming to'));
check('privacy heading', privacy.includes('<h1>Privacy</h1>'));
check('privacy canonical', privacy.includes('href="https://cabcount.app/privacy"'));
check('privacy date', privacy.includes('datetime="2026-11-06"') && privacy.includes('November 6, 2026'));
check('privacy tally form', privacy.includes('https://tally.so/r/7XlGB6'));
check('privacy observed tally fields', ['City', 'Date seen', 'What did you see?', 'Photo or video link', 'Your email'].every((label) => privacy.includes(label)));
check('privacy link not upload', /photo or video link/i.test(privacy) && /not a file upload/i.test(privacy));
check('privacy optional email', /optional/i.test(privacy) && /email/i.test(privacy));
check('privacy map tiles', privacy.includes('tile.openstreetmap.org'));
check('privacy analytics beacon host', privacy.includes('static.cloudflareinsights.com/beacon.min.js'));
check('privacy beacon is not in the repo', /not stored in this repository|not included in this repository|not in this repository/i.test(privacy));
check('privacy attributes cookie claim to Cloudflare docs', /Cloudflare.s documentation/i.test(privacy) && /cookies/i.test(privacy));
check('privacy does not audit the beacon', /cannot confirm|not audited|have not audited/i.test(privacy));
check('privacy no session recorder in repo', /session-recording script/i.test(privacy) && /does not include a session-recording script/i.test(privacy));
check('privacy paused lists', /mailing lists are paused/i.test(privacy));
check('privacy prior Kit form', privacy.includes('10069322') && /Kit/.test(privacy));
check('privacy unknown Kit retention', /cannot (say|confirm|tell)|not something this (site|repository) can confirm|unknown/i.test(privacy));
check('privacy no live kit form', !/kit-form|app\.kit\.com|Get alerts|Get alerted/.test(privacy));
check('privacy no absolute no-collection promise', !/do not collect any|collects nothing|no collection/i.test(privacy));
check('privacy no legal-compliance claim', !/GDPR|CCPA|compliant with/i.test(privacy));
check('privacy contact from existing draft', privacy.includes('mailto:kevinrey24@gmail.com') && privacy.includes('Kevin Rey, 14016 106th Ave Ct E, Puyallup, WA 98374'));
check('privacy children', privacy.includes('<h2>Not for children under 13</h2>'));
check('privacy deletion path', privacy.includes('<h2>Deletion requests</h2>'));
check('privacy has no other email', !/@[a-z0-9.-]+\.[a-z]{2,}/i.test(privacy.replaceAll('kevinrey24@gmail.com', '')));

check('dmca heading', dmca.includes('<h1>Copyright / DMCA</h1>'));
check('dmca agent not registered', /not registered/i.test(dmca));
check('dmca name placeholder', dmca.includes('[PLACEHOLDER: agent name]'));
check('dmca address placeholder', dmca.includes('[PLACEHOLDER: street address, city, region, postal code, country]'));
check('dmca email placeholder', dmca.includes('[PLACEHOLDER: agent email]'));
check('dmca phone placeholder', dmca.includes('[PLACEHOLDER: agent phone]'));
check('dmca 512(c)(3)', dmca.includes('512(c)(3)'));
check('dmca signature', /physical or electronic signature/i.test(dmca));
check('dmca good-faith belief', /good-faith belief/i.test(dmca));
check('dmca penalty of perjury', /penalty of perjury/i.test(dmca));
check('dmca counter-notice', /<h2>Counter-notice<\/h2>/.test(dmca));
check('dmca counter jurisdiction', /Federal District Court/.test(dmca));
check('dmca repeat infringer', /<h2>Repeat-infringer policy<\/h2>/.test(dmca));
check('dmca canonical', dmca.includes('href="https://cabcount.app/dmca"'));
check('dmca has no invented email', !/@[a-z0-9.-]+\.[a-z]{2,}/i.test(dmca));

check('sightings rights', /own or have the rights/i.test(sight));
check('sightings license to display', /license to display/i.test(sight));
check('sightings no infringing', /not illegal or infringing|No illegal or infringing content/i.test(sight));
check('sightings may remove', /we may remove/i.test(sight));
check('sightings checkbox', sight.includes('type="checkbox"') && sight.includes('id="sighting-agree"'));
check('sightings terms link', sight.includes('href="#submission-terms"'));
check('sightings terms section', sight.includes('id="submission-terms"'));

check('home has no signup', !/kit-form|Get alerts|Get alerted|app\.kit\.com|id="newsletter"/i.test(home));
check('footer privacy', home.includes('href="/privacy">Privacy'));
check('footer dmca', home.includes('href="/dmca">Copyright / DMCA'));
check('404 is not the homepage', missing.includes('<h1>Page not found</h1>') && !missing.includes('Is Robotaxi coming to') && missing !== home);
check('sitemap lists privacy and dmca', sitemap.includes('<loc>https://cabcount.app/privacy</loc>') && sitemap.includes('<loc>https://cabcount.app/dmca</loc>'));
check('latest main city data kept', detroit.includes('Southfield') && cities.includes('"slug": "detroit-mi"'));
check('latest fleet total kept', fleet.includes('1244'));

const redirectsPath = path.join(pub, '_redirects');
if (fs.existsSync(redirectsPath)) {
  const rules = fs.readFileSync(redirectsPath, 'utf8');
  check('no homepage catch-all', !/\/\*\s+\S*index\.html/.test(rules) && !/\/privacy\s+\S*index\.html/.test(rules));
} else {
  check('no homepage catch-all', true);
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}
for (const file of walk(pub)) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(pub, file);
  check('footer ' + rel, html.includes('href="/privacy"') && html.includes('href="/dmca"'));
  check('no email signup ' + rel, !/kit-form|app\.kit\.com|Get alerts|Get alerted|id="newsletter"|10069322/i.test(html) || rel === 'privacy.html');
}

const spaDir = fs.mkdtempSync(path.join('/tmp', 'cabcount-spa-'));
fs.writeFileSync(path.join(spaDir, 'index.html'), '<h1>Is Robotaxi coming to your city?</h1>');
const spaHit = resolvePages(spaDir, '/privacy');
check('missing 404.html makes /privacy the homepage', spaHit.spaFallback === true && spaHit.status === 200 && spaHit.file.endsWith('index.html'));
fs.rmSync(spaDir, { recursive: true, force: true });

const direct = resolvePages(pub, '/privacy');
check('built /privacy file is privacy.html', direct.spaFallback === false && direct.status === 200 && direct.file.endsWith(`${path.sep}privacy.html`));
const unknown = resolvePages(pub, '/this-page-does-not-exist-xyz');
check('built unknown path is 404.html', unknown.spaFallback === false && unknown.file.endsWith(`${path.sep}404.html`));

const server = startPagesServer(pub);
await once(server, 'listening');
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
try {
  const privacyRoute = await fetchFollow(base, '/privacy');
  check('served /privacy is not the homepage', privacyRoute.status === 200 && privacyRoute.body.includes('<h1>Privacy</h1>') && !privacyRoute.body.includes('Is Robotaxi coming to'));
  const privacyHtml = await fetchFollow(base, '/privacy.html');
  check('served /privacy.html ends on the privacy page', privacyHtml.redirected && privacyHtml.location === '/privacy' && privacyHtml.body.includes('<h1>Privacy</h1>') && !privacyHtml.body.includes('Is Robotaxi coming to'));
  const dmcaRoute = await fetchFollow(base, '/dmca');
  check('served /dmca is the DMCA page', dmcaRoute.status === 200 && dmcaRoute.body.includes('<h1>Copyright / DMCA</h1>') && dmcaRoute.body.includes('[PLACEHOLDER: agent name]'));
  const missingRoute = await fetchFollow(base, '/this-page-does-not-exist-xyz');
  check('served unknown path is not the homepage', missingRoute.status === 404 && missingRoute.body.includes('<h1>Page not found</h1>') && !missingRoute.body.includes('Is Robotaxi coming to'));
  const aboutRoute = await fetchFollow(base, '/about');
  check('served /about still resolves', aboutRoute.status === 200 && aboutRoute.body.includes('<h1>About CabCount</h1>'));
} finally {
  server.close();
}

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all checks passed');
