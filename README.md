# The Home Backup

Static affiliate site for **home backup power**. Four silos, buyer-intent pages, Netlify-ready. Working brand and domain: **thehomebackup.com** (do not buy it from this repo). GitHub repo remains `draftech/homebackupdesk`.

Named Jackery, BLUETTI, and Anker SOLIX SKUs use **official manufacturer product photographs** committed in `src/assets/products/` (sources in `src/products.json`). Lifestyle photos in `src/assets/photos/` are documentary scenes only — they never stand in for a product shot.

Out of scope: rooftop solar, Tesla Powerwall. Featured high-ticket offers: Jackery, BLUETTI, Anker SOLIX (placeholder `/go/` hops — no invented click IDs). EcoFlow is not a featured partner (7-day cookie risk; we prefer ~30-day programs).

## Local run

Requires Node 18+.

```bash
npm start
```

That builds and serves `dist/` at [http://localhost:8080](http://localhost:8080). Or:

```bash
npm run build
python3 -m http.server 8080 --directory dist
```

There are no npm dependencies. `scripts/build.mjs` wraps `src/pages` in `src/templates/layout.html`, expands product cards from `src/products.json`, copies `src/assets`, writes `sitemap.xml` / `robots.txt`, and fails the build if an internal `href` is broken.

Canonical URLs brand toward `https://thehomebackup.com`. Until DNS exists, a Netlify default URL is the public host — update `src/site.json` `url` to the live origin after first deploy.

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
/                                   Home
/about/
/contact/
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
/home-batteries/anker-solix-f3800/

/portable-power-stations/           Silo 3 hub
/portable-power-stations/best-portable-power-stations/
/portable-power-stations/jackery-vs-bluetti-vs-anker-solix/
/portable-power-stations/buying-guide/
/portable-power-stations/for-home-backup/
/portable-power-stations/jackery-explorer-2000-plus/
/portable-power-stations/bluetti-ac200l/
/portable-power-stations/anker-solix-c2000-gen2/

/portable-solar-panels/             Silo 4 hub
/portable-solar-panels/best-portable-solar-panels/
/portable-solar-panels/folding-vs-briefcase/
/portable-solar-panels/buying-guide/
/portable-solar-panels/jackery-solarsaga-200w/
/portable-solar-panels/bluetti-sp200l/
/portable-solar-panels/anker-solix-ps400/

/go/jackery/                        Placeholder affiliate hop
/go/bluetti/
/go/anker-solix/
```

Standby-generator pages are informational. Jackery / BLUETTI / Anker SOLIX do not sell traditional pad plants; we do not fake a Generac (or similar) affiliate ID.

## License

Original copy in this repository is for The Home Backup. Manufacturer names are trademarks of their owners. Product photographs are downloaded from manufacturer sites for identification; rights remain with those manufacturers.
