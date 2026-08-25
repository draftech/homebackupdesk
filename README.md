# Home Backup Desk

Static affiliate site for **home backup power** only. Four silos, buyer-intent pages, Netlify-ready. Working brand: Home Backup Desk.

Out of scope: rooftop solar, Tesla Powerwall. Featured high-ticket offers: Jackery, Bluetti, Anker SOLIX (placeholder `/go/` hops — no invented click IDs). EcoFlow is not a featured partner (7-day cookie risk; we prefer ~30-day programs).

## Local run

Requires Node 18+.

```bash
npm run build
python3 -m http.server 8080 --directory dist
```

Open [http://localhost:8080](http://localhost:8080). `npm start` builds and serves in one step.

There are no npm dependencies. `scripts/build.mjs` wraps `src/pages` in `src/templates/layout.html`, copies `src/assets`, writes `sitemap.xml` / `robots.txt`, and fails the build if an internal `href` is broken.

## Netlify deploy

1. Fork or push this repo.
2. In Netlify: **Add new site → Import an existing project** → this GitHub repo.
3. Build command: `npm run build` (already in `netlify.toml`).
4. Publish directory: `dist`.
5. Deploy. The default `*.netlify.app` URL is fine until a custom domain exists. Do not buy a domain from this repo.

`netlify.toml` also sets 302 redirects for `/go/jackery`, `/go/bluetti`, and `/go/anker-solix`, plus a 404 fallback.

After the first deploy, set `url` in `src/site.json` to the live origin (Netlify URL or later custom domain) so canonical tags and `sitemap.xml` match production.

## Where to paste real affiliate IDs

Do **not** invent click IDs. When a program is approved:

1. Put the tracking URL in `src/affiliates.json` (`programs[].destination`) — used for local `/go/…/` HTML hops.
2. Put the **same** URL in the matching `[[redirects]]` `to =` entries in `netlify.toml` — used in production (302, `force = true`).
3. Keep the slugs stable (`/go/jackery/`, `/go/bluetti/`, `/go/anker-solix/`). In-article links use those paths, not raw network URLs.
4. Never commit secrets, network passwords, or unpublished coupon codes.

Until those destinations change, hops point at manufacturer homepages.

## URL tree (silos)

```
/                                   Home
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
