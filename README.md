# CabCount (cabcount.app)

Static Tesla Robotaxi / Cybercab rollout tracker. Plain HTML/CSS/JS, Leaflet + OpenStreetMap, Chart.js (vendored in `public/vendor`). No framework or npm install needed. Node 18+ is enough.

## Layout
- `data/seed-data.json`: **the source of truth you edit**
- `scripts/build.mjs`: turns the seed into `public/data/cities.json` + `public/data/fleet.json`, then writes `public/index.html`, `public/city/<slug>.html`, `sightings.html`, `about.html`, `privacy.html` (served at `/privacy`), `dmca.html` (served at `/dmca`), `404.html`, `sitemap.xml`, `robots.txt`. It also prints data warnings. A top-level `404.html` is required. Without it, Cloudflare Pages treats the project as a single-page app and serves `index.html` for any path that is not a real file, which is why `/privacy` was the homepage.
- `npm test` checks the built pages and a local model of that Pages routing. Run `npm run build` first. Mailing lists are paused: the site has no signup form, and this repo does not send mail.
- `scripts/make_images.py`: regenerates `public/assets/og.png` (share card with live numbers), favicon.ico, and apple-touch-icon (needs Python + Pillow; run it locally, then commit the images).
- `public/`: the deployable output (css/, js/, vendor/, assets/, favicon.svg, _headers)

## Updating data
1. Edit `data/seed-data.json`:
   - City status changed: set `status` (`live_unsupervised`, `live_safety_driver`, `preparing`, `testing_sightings`, `requested`), plus `launched`, etc.
   - Geofence grew: append `{"date":"YYYY-MM-DD","sq_mi":N}` to `service_area_history` and update `service_area_sq_mi` / `service_area_as_of`.
   - New fleet count: append to `fleet_timeseries_texas_registry`.
   - New requested city: add it to `requested_cities_from_x` **and** add coordinates to `REQ_COORDS` in `scripts/build.mjs`. If you skip the coordinates, the city is left off the map and the build prints a warning.
   - Bump `meta.compiled`. It drives "Last updated" and sitemap lastmod.
2. `node scripts/build.mjs` (and `python3 scripts/make_images.py` to refresh the OG card)
3. Preview: `python3 -m http.server 8080 -d public` → http://localhost:8080
4. Commit and push. Cloudflare Pages rebuilds on its own.

## Placeholders to fill before launch
- **Mailing lists are paused.** Do not add a signup form or send the drafts in `newsletter/`.
- **Tally**: the sightings page embeds form `7XlGB6`. The privacy page describes the fields that form showed on November 6, 2026. If the form changes, update that description.
- **Sponsor**: the `sponsor` block, plus the contact line on the About page.
- **Privacy contact**: `kevinrey24@gmail.com` and Kevin Rey, 14016 106th Ave Ct E, Puyallup, WA 98374, carried from the existing privacy draft. The DMCA agent (name, address, email, and phone) is still PLACEHOLDER in `scripts/build.mjs`. The agent is not registered. Do not invent those fields.
- Check the YouTube URL (`https://www.youtube.com/@beam42space`) in `foot()`.

## Cloudflare Pages
Connect the GitHub repo in Cloudflare Pages:
- Framework preset: **None**
- Build command: `node scripts/build.mjs`
- Build output directory: `public`
- Env var: `NODE_VERSION=20`
Then add the custom domain `cabcount.app` under Pages → Custom domains.
