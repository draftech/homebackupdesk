# Home Backup Desk

Static affiliate site for **home backup power**. Four silos, buyer-intent pages, Netlify-ready. Working brand and domain: **homebackupdesk.com** (do not buy it from this repo).

Visual system: **night-outage / standby-power** — a dark house with one window lit, a transfer-switch as the silo map, and long copy on a lamp-lit worksheet. Custom motion (LED, handle throw, on-scroll reveals) is decorative. `prefers-reduced-motion` turns it off. Reading and buying are never behind a gate.

Out of scope: rooftop solar, Tesla Powerwall. Featured high-ticket offers: Jackery, Bluetti, Anker SOLIX (placeholder `/go/` hops — no invented click IDs). EcoFlow is not a featured partner (7-day cookie risk; we prefer ~30-day programs).

## Local run (Julio’s preview)

Requires Node 18+.

```bash
npm start
```

That builds and serves `dist/` at [http://localhost:8080](http://localhost:8080). Or:

```bash
npm run build
python3 -m http.server 8080 --directory dist
```

There are no npm dependencies. `scripts/build.mjs` wraps `src/pages` in `src/templates/layout.html`, copies `src/assets`, writes `sitemap.xml` / `robots.txt`, and fails the build if an internal `href` is broken.

Canonical URLs brand toward `https://homebackupdesk.com`. Until DNS exists, a Netlify default URL is the public host — update `src/site.json` `url` to the live origin after first deploy.

## Netlify deploy

1. Import this GitHub repo in Netlify.
2. Build command: `npm run build` (already in `netlify.toml`).
3. Publish directory: `dist`.
4. Deploy. Default `*.netlify.app` is fine until the .com is connected later.

`netlify.toml` sets 302 redirects for `/go/jackery`, `/go/bluetti`, and `/go/anker-solix`, plus a 404 fallback.

## Where to paste real affiliate IDs

Do **not** invent click IDs. When a program is approved:

1. Put the tracking URL in `src/affiliates.json` (`programs[].destination`).
2. Put the **same** URL in the matching `[[redirects]]` `to =` entries in `netlify.toml`.
3. Keep slugs stable (`/go/jackery/`, `/go/bluetti/`, `/go/anker-solix/`).
4. Never commit secrets or unpublished coupon codes.

Until then, hops point at manufacturer homepages.

## URL tree (silos)

```
/                                   Home (cinematic night stage)
/about/
/how-we-review/
/disclosure/
/privacy/

/whole-house-generators/            Silo 1 hub
/whole-house-generators/best-standby-generators/
/whole-house-generators/standby-vs-portable/
/whole-house-generators/buying-guide/
/whole-house-generators/cost/

/home-batteries/                    Silo 2 hub
/home-batteries/best-expandable-home-batteries/
/home-batteries/home-battery-vs-standby-generator/
/home-batteries/buying-guide/

/portable-power-stations/           Silo 3 hub
/portable-power-stations/best-portable-power-stations/
/portable-power-stations/jackery-vs-bluetti-vs-anker-solix/
/portable-power-stations/buying-guide/
/portable-power-stations/for-home-backup/

/portable-solar-panels/             Silo 4 hub
/portable-solar-panels/best-portable-solar-panels/
/portable-solar-panels/folding-vs-briefcase/
/portable-solar-panels/buying-guide/

/go/jackery/                        Placeholder affiliate hop
/go/bluetti/
/go/anker-solix/
```

Standby-generator pages are informational. Jackery / Bluetti / Anker SOLIX do not sell traditional pad plants; we do not fake a Generac (or similar) affiliate ID.

## License

Original copy in this repository is for Home Backup Desk. Manufacturer names are trademarks of their owners.
