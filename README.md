# CabCount (cabcount.app)

Static Tesla Robotaxi / Cybercab rollout tracker. Plain HTML/CSS/JS, Leaflet + OpenStreetMap, Chart.js (vendored in `public/vendor`). No framework or npm install needed. Node 18+ is enough.

## Layout
- `data/seed-data.json`: **the source of truth you edit**
- `scripts/build.mjs`: turns the seed into `public/data/cities.json` + `public/data/fleet.json`, then writes `public/index.html`, `public/city/<slug>.html`, `sightings.html`, `about.html`, `sitemap.xml`, `robots.txt`. It also prints data warnings.
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

## Visitor information
The public site does not include email signup, alerts, accounts, contact forms, or sighting submissions. Do not add those back. Drafts in `newsletter/` are unpublished files in the repo; they are not served and they are not a send path. This repo does not cancel mailing-list accounts or delete subscriber data.

Cloudflare may still keep access and security logs, add network-error reporting headers, and insert a Web Analytics script on the live site. `public/_headers` sets a Content Security Policy that allows scripts and connections only from this site, and map images only from this site or OpenStreetMap. That policy does not turn off Cloudflare's own logs. The homepage map loads tiles from `tile.openstreetmap.org`.

## Cloudflare Pages
Connect the GitHub repo in Cloudflare Pages:
- Framework preset: **None**
- Build command: `node scripts/build.mjs`
- Build output directory: `public`
- Env var: `NODE_VERSION=20`
Then add the custom domain `cabcount.app` under Pages → Custom domains.
