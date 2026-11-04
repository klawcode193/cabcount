// Checks the built public/ pages. Run `npm run build` first.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pub = path.join(root, 'public');
const read = (rel) => fs.readFileSync(path.join(pub, rel), 'utf8');
let failed = 0;
function check(name, cond) {
  if (!cond) { console.error('FAIL ' + name); failed++; }
  else console.log('ok ' + name);
}

const privacy = read('privacy.html');
const dmca = read('dmca.html');
const sight = read('sightings.html');
const home = read('index.html');
const missing = read('404.html');
const sitemap = read('sitemap.xml');

check('privacy is not the homepage', !privacy.includes('Is Robotaxi coming to'));
check('privacy heading', privacy.includes('<h1>Privacy</h1>'));
check('privacy sighting media', /photo/i.test(privacy) && /video/i.test(privacy));
check('privacy submitter info', /submitter information/i.test(privacy) && /email address/i.test(privacy));
check('privacy kit form', privacy.includes('https://app.kit.com/forms/10069322'));
check('privacy analytics cookieless', /Cloudflare Web Analytics/.test(privacy) && /cookieless/i.test(privacy));
check('privacy no session recording', /no session recording/i.test(privacy));
check('privacy processors', /<strong>Kit<\/strong>/.test(privacy) && /<strong>Cloudflare<\/strong>/.test(privacy) && /<strong>Tally<\/strong>/.test(privacy));
check('privacy retention', privacy.includes('<h2>Retention</h2>'));
check('privacy deletion', privacy.includes('<h2>Deletion requests</h2>'));
check('privacy children', privacy.includes('<h2>Not for children under 13</h2>'));
check('privacy contact email', privacy.includes('<a href="mailto:kevinrey24@gmail.com">kevinrey24@gmail.com</a>'));
check('privacy mailing address', privacy.includes('Kevin Rey, 14016 106th Ave Ct E, Puyallup, WA 98374') && !privacy.includes('[PLACEHOLDER: mailing address]'));
check('privacy date', privacy.includes('datetime="2026-11-04"') && privacy.includes('November 4, 2026'));
check('privacy canonical', privacy.includes('href="https://cabcount.app/privacy"'));
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
check('sightings by submitting you agree', /By submitting you agree/.test(sight));
check('sightings terms link', sight.includes('href="#submission-terms"'));
check('sightings terms section', sight.includes('id="submission-terms"'));

check('alerts consent', /Unsubscribe anytime/.test(home) && /<a href="\/privacy">Privacy<\/a>/.test(home));
check('footer privacy', home.includes('href="/privacy">Privacy'));
check('footer dmca', home.includes('href="/dmca">Copyright / DMCA'));

check('404 is not the homepage', missing.includes('<h1>Page not found</h1>') && !missing.includes('Is Robotaxi coming to'));
check('404 links privacy and dmca', missing.includes('href="/privacy"') && missing.includes('href="/dmca"'));
check('sitemap lists privacy and dmca', sitemap.includes('<loc>https://cabcount.app/privacy</loc>') && sitemap.includes('<loc>https://cabcount.app/dmca</loc>'));

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
const htmlFiles = walk(pub);
check('built html pages', htmlFiles.length > 5);
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(pub, file);
  check('footer ' + rel, html.includes('href="/privacy"') && html.includes('href="/dmca"'));
  if (html.includes('class="signup kit-form"')) {
    check('consent ' + rel, /Unsubscribe anytime/.test(html) && /href="\/privacy"/.test(html));
  }
}

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all checks passed');
