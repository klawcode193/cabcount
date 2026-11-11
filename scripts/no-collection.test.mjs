import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pub = path.join(root, 'public');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const htmlFiles = walk(pub).filter(p => p.endsWith('.html')).sort();
const siteJs = walk(path.join(pub, 'js')).filter(p => p.endsWith('.js')).sort();
const sources = [
  path.join(root, 'scripts/build.mjs'),
  path.join(pub, '_headers'),
  path.join(pub, 'css/style.css'),
  ...htmlFiles,
  ...siteJs,
];

const forbidden = [
  [/app\.kit\.com/i, 'Kit form endpoint'],
  [/kit\.com\/forms/i, 'Kit form endpoint'],
  [/convertkit/i, 'ConvertKit'],
  [/tally\.so/i, 'Tally embed'],
  [/buttondown/i, 'Buttondown'],
  [/email_address/i, 'email field'],
  [/fields\[city\]/i, 'city field posted to a list'],
  [/Get alerts/i, 'Get alerts call to action'],
  [/Get alerted/i, 'Get alerted call to action'],
  [/Notify me/i, 'notify-me submit button'],
  [/cloudflareinsights/i, 'Cloudflare analytics script'],
  [/data-cf-beacon/i, 'Cloudflare analytics beacon'],
  [/googletagmanager|google-analytics|gtag\(|plausible\.io|posthog|hotjar|facebook\.net|segment\.com|sentry\.io/i, 'third-party telemetry'],
  [/<form\b/i, 'form'],
  [/<iframe\b/i, 'iframe'],
  [/<input\b/i, 'input'],
  [/<textarea\b/i, 'textarea'],
  [/type=["']email["']/i, 'email input'],
  [/mailto:/i, 'mailto link'],
  [/sendBeacon\s*\(/, 'sendBeacon'],
  [/navigator\.geolocation/, 'geolocation'],
  [/\bDMCA\b/, 'DMCA page content'],
  [/Puyallup|106th Ave|kevinrey|98374/i, 'personal address or contact from parked work'],
  [/we (do not|don't) collect any/i, 'absolute no-collection claim'],
  [/collects? no (personal )?data/i, 'absolute no-collection claim'],
  [/zero data/i, 'absolute no-collection claim'],
  [/no data is (collected|stored|shared)/i, 'absolute no-collection claim'],
  [/does not collect data/i, 'absolute no-collection claim'],
  [/collect nothing/i, 'absolute no-collection claim'],
  [/never collect/i, 'absolute no-collection claim'],
];

test('built pages, site scripts, and the generator contain no submission or telemetry path', () => {
  assert.ok(htmlFiles.length >= 16, `expected generated pages, found ${htmlFiles.length}`);
  const hits = [];
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    for (const [re, label] of forbidden) {
      if (re.test(text)) hits.push(`${path.relative(root, file)}: ${label} (${re})`);
    }
  }
  assert.deepEqual(hits, []);
});

test('pages expose only local scripts and no executable inline scripts', () => {
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file);
    for (const src of html.matchAll(/<script\b[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi)) {
      assert.ok(src[1].startsWith('/'), `${rel} loads a remote script ${src[1]}`);
    }
    for (const href of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)) {
      const m = href[0].match(/href=["']([^"']+)["']/i);
      assert.ok(m && m[1].startsWith('/'), `${rel} loads a remote stylesheet`);
    }
    for (const src of html.matchAll(/<img\b[^>]*\ssrc=["']([^"']+)["']/gi)) {
      assert.ok(src[1].startsWith('/'), `${rel} loads a remote image ${src[1]}`);
    }
    for (const block of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const attrs = block[1];
      const body = block[2].trim();
      if (/type=["']application\/json["']/i.test(attrs)) {
        assert.equal(attrs.includes('src='), false, `${rel} json script should be inline data`);
        JSON.parse(body);
        continue;
      }
      assert.equal(body, '', `${rel} has an executable inline script`);
    }
    assert.match(html, /<a href="\/#map">Map<\/a><a href="\/sightings\.html">Sightings<\/a><a href="\/about\.html">About<\/a><a href="\/privacy\.html">Privacy<\/a>/);
    assert.match(html, /<a href="\/privacy\.html">Privacy<\/a>/);
  }
});

test('tracker scripts do not transmit visitor input', () => {
  const allowedRemote = new Set([
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://www.openstreetmap.org/copyright',
  ]);
  for (const file of siteJs) {
    const js = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file);
    for (const call of js.matchAll(/\bfetch\(\s*(['"])(.*?)\1/g)) {
      assert.ok(call[2].startsWith('/'), `${rel} fetches ${call[2]}`);
    }
    const urls = [...js.matchAll(/https?:\/\/[^\s'"`]+/g)].map(m => m[0]);
    for (const url of urls) assert.ok(allowedRemote.has(url), `${rel} unexpected remote URL ${url}`);
  }
  const home = fs.readFileSync(path.join(pub, 'js/home.js'), 'utf8');
  assert.match(home, /fetch\('\/data\/cities\.json'\)/);
  assert.match(home, /fetch\('\/data\/fleet\.json'\)/);
  assert.match(home, /L\.tileLayer\('https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png'/);
  assert.doesNotMatch(home, /#newsletter|Get alert/);
});

test('content security policy blocks remote scripts, forms, and frames', () => {
  const headers = fs.readFileSync(path.join(pub, '_headers'), 'utf8');
  assert.match(headers, /script-src 'self'/);
  assert.match(headers, /connect-src 'self'/);
  assert.match(headers, /form-action 'none'/);
  assert.match(headers, /frame-src 'none'/);
  assert.match(headers, /object-src 'none'/);
  assert.match(headers, /https:\/\/\*\.tile\.openstreetmap\.org/);
  assert.doesNotMatch(headers, /unsafe-eval|cloudflareinsights/);
});

test('mobile nav does not hide informational links', () => {
  const css = fs.readFileSync(path.join(pub, 'css/style.css'), 'utf8');
  assert.doesNotMatch(css, /display:\s*none/);
  assert.match(css, /\.nav nav\{[^}]*flex-wrap:\s*wrap/);
});

test('privacy copy names residual collection and does not invent a contact', () => {
  const privacy = fs.readFileSync(path.join(pub, 'privacy.html'), 'utf8');
  for (const phrase of ['Cloudflare', 'access and security logs', 'OpenStreetMap', 'tile.openstreetmap.org', 'Content Security Policy', 'IP address', 'does not ask visitors']) {
    assert.ok(privacy.includes(phrase), `privacy page missing: ${phrase}`);
  }
  assert.doesNotMatch(privacy, /<form\b|mailto:|Get alert/i);
});

test('sitemap lists every page and no collection endpoint is a page', () => {
  const xml = fs.readFileSync(path.join(pub, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.ok(locs.includes('https://cabcount.app/privacy.html'));
  assert.ok(locs.includes('https://cabcount.app/sightings.html'));
  assert.ok(locs.includes('https://cabcount.app/about.html'));
  assert.ok(locs.includes('https://cabcount.app/'));
  const fromFiles = htmlFiles.map(file => {
    const rel = path.relative(pub, file).split(path.sep).join('/');
    return rel === 'index.html' ? 'https://cabcount.app/' : `https://cabcount.app/${rel}`;
  });
  assert.deepEqual([...locs].sort(), [...fromFiles].sort());
  assert.equal(fs.existsSync(path.join(pub, 'newsletter')), false);
  const sightings = fs.readFileSync(path.join(pub, 'sightings.html'), 'utf8');
  assert.match(sightings, /does not accept photos, locations, or other submissions/);
  assert.doesNotMatch(sightings, /tally|Submit a sighting|reviewed by a human/i);
});
