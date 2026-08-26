import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile, copyFile, stat, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");
const distDir = join(root, "dist");
const pagesDir = join(srcDir, "pages");

const site = JSON.parse(await readFile(join(srcDir, "site.json"), "utf8"));
const affiliates = JSON.parse(await readFile(join(srcDir, "affiliates.json"), "utf8"));
const catalog = JSON.parse(await readFile(join(srcDir, "products.json"), "utf8"));
const layout = await readFile(join(srcDir, "templates/layout.html"), "utf8");

const SILOS = [
  { id: "whole-house-generators", href: "/whole-house-generators/", label: "Generators" },
  { id: "home-batteries", href: "/home-batteries/", label: "Home batteries" },
  { id: "portable-power-stations", href: "/portable-power-stations/", label: "Power stations" },
  { id: "portable-solar-panels", href: "/portable-solar-panels/", label: "Solar panels" },
];

const hopById = Object.fromEntries(affiliates.programs.map((p) => [p.id, p.path]));

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function parsePage(raw, filePath) {
  if (!raw.startsWith("---")) {
    throw new Error(`Missing frontmatter: ${filePath}`);
  }
  const end = raw.indexOf("\n---", 3);
  if (end === -1) throw new Error(`Unclosed frontmatter: ${filePath}`);
  const fmRaw = raw.slice(4, end).trim();
  const body = raw.slice(end + 4).replace(/^\n/, "");
  const meta = {};
  for (const line of fmRaw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  const rel = relative(pagesDir, filePath).replaceAll("\\", "/");
  const urlPath = rel === "index.html" ? "/" : `/${rel.replace(/index\.html$/, "").replace(/\.html$/, "/")}`;
  return { ...meta, path: meta.path || urlPath, body, filePath };
}

function esc(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function nav(currentSilo, currentPath) {
  const items = SILOS.map((s) => {
    const current = s.id === currentSilo || currentPath.startsWith(s.href);
    return `<li><a href="${s.href}" ${current ? 'aria-current="page"' : ""}>${esc(s.label)}</a></li>`;
  }).join("");
  return `<ul class="silo-nav">${items}</ul>`;
}

function jsonLd(page) {
  const url = `${site.url}${page.path}`;
  const isHome = page.path === "/";
  const graph = [
    {
      "@type": "Organization",
      "@id": `${site.url}/#org`,
      name: site.name,
      url: site.url,
      description: site.description,
      logo: `${site.url}/assets/apple-touch-icon.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${site.url}/#site`,
      name: site.name,
      url: site.url,
      publisher: { "@id": `${site.url}/#org` },
    },
  ];
  if (!isHome) {
    graph.push({
      "@type": page.schema || "Article",
      headline: page.title,
      description: page.description,
      dateModified: page.updated || site.updated,
      mainEntityOfPage: url,
      author: { "@id": `${site.url}/#org` },
      publisher: { "@id": `${site.url}/#org` },
    });
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

function breadcrumbs(page) {
  if (page.path === "/") return "";
  const crumbs = [{ href: "/", label: "Home" }];
  const silo = SILOS.find((s) => s.id === page.silo);
  if (silo) crumbs.push({ href: silo.href, label: silo.label });
  if (page.crumb) crumbs.push({ href: page.path, label: page.crumb });
  const lis = crumbs
    .map((c, i) => {
      const last = i === crumbs.length - 1;
      return `<li>${last ? `<span aria-current="page">${esc(c.label)}</span>` : `<a href="${c.href}">${esc(c.label)}</a>`}</li>`;
    })
    .join("");
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${lis}</ol></nav>`;
}

function product(id) {
  const p = catalog.items[id];
  if (!p) throw new Error(`Unknown product id: ${id}`);
  return p;
}

function productsIn(group) {
  return Object.values(catalog.items).filter((p) => p.group === group);
}

function specRows(p) {
  if (p.group === "panels") {
    return [
      ["Nameplate", p.watts],
      ["Voc", p.voc],
      ["Weight", p.weight],
      ["Rating", p.ip],
    ];
  }
  return [
    ["Capacity", p.capacity],
    ["Output", p.output],
    ["Surge / peak", p.surge],
    ["Voltage", p.voltage],
    ["Weight", p.weight],
    ["Expandable", p.expandable],
  ];
}

function priceBlock(p) {
  if (p.price) {
    const was = p.compareAt ? ` <s>${esc(p.compareAt)}</s>` : "";
    return `<p class="product-price">${esc(p.price)}${was}</p>
      <p class="product-price-note">Street price on the manufacturer page, ${esc(formatDate(catalog.asOf))}. Sales move.</p>`;
  }
  return `<p class="product-price-note">No street price on the manufacturer page we checked ${esc(formatDate(catalog.asOf))}.</p>`;
}

function productCard(p) {
  const hop = hopById[p.affiliate];
  const specs = specRows(p)
    .filter(([, v]) => v)
    .slice(0, 4)
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join("");
  return `<article class="product-card">
    <a class="product-media" href="${hop}">
      <img src="${esc(p.image)}" width="800" height="800" alt="${esc(p.alt)}">
    </a>
    <div class="product-body">
      <p class="product-brand">${esc(p.brand)}</p>
      <h3>${esc(p.name)}</h3>
      ${p.job ? `<p class="product-job">${esc(p.job)}</p>` : ""}
      <dl class="product-specs">${specs}</dl>
      ${priceBlock(p)}
      <a class="cta" href="${hop}">${esc(p.cta)}</a>
    </div>
  </article>`;
}

function productGrid(group) {
  const items = productsIn(group);
  return `<div class="product-grid">${items.map(productCard).join("\n")}</div>
    <p class="source-note">Photos are official manufacturer product shots. Specs and street prices from the linked product pages, ${esc(formatDate(catalog.asOf))}. Blank cells were not stated clearly on those pages.</p>`;
}

function compareTable(group) {
  const items = productsIn(group);
  const isPanels = group === "panels";
  const cols = isPanels
    ? [
        ["Watts", "watts"],
        ["Voc", "voc"],
        ["Weight", "weight"],
        ["IP", "ip"],
        ["Street price", "price"],
      ]
    : [
        ["Capacity", "capacity"],
        ["Output", "output"],
        ["Surge / peak", "surge"],
        ["Voltage", "voltage"],
        ["Weight", "weight"],
        ["Street price", "price"],
      ];
  const head = `<tr><th scope="col">SKU</th>${cols.map(([label]) => `<th scope="col">${esc(label)}</th>`).join("")}<th scope="col">Buy</th></tr>`;
  const body = items
    .map((p) => {
      const hop = hopById[p.affiliate];
      const cells = cols
        .map(([, key]) => {
          const val = p[key] || "—";
          return `<td>${val === "—" ? "—" : esc(val)}</td>`;
        })
        .join("");
      return `<tr>
        <th scope="row">
          <a class="sku-cell" href="${hop}">
            <img src="${esc(p.image)}" width="72" height="72" alt="${esc(p.alt)}">
            <span>${esc(p.fullName)}</span>
          </a>
        </th>
        ${cells}
        <td><a class="cta cta-compact" href="${hop}">${esc(p.cta)}</a></td>
      </tr>`;
    })
    .join("\n");
  const caption = isPanels
    ? `Portable panels — manufacturer pages, ${formatDate(catalog.asOf)}. Em dash means the spec was not clearly listed.`
    : `Named stations — manufacturer pages, ${formatDate(catalog.asOf)}. Em dash means the spec was not clearly listed.`;
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="Comparison">
    <table class="compare">
      <caption>${esc(caption)}</caption>
      <thead>${head}</thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function skuFigure(p) {
  const hop = hopById[p.affiliate];
  return `<figure class="sku-figure">
    <a href="${hop}"><img src="${esc(p.image)}" width="800" height="800" alt="${esc(p.alt)}"></a>
    <figcaption>${esc(p.fullName)}. Official manufacturer photo. <a href="${hop}">${esc(p.cta)}</a></figcaption>
  </figure>`;
}

function stickyBar(kind) {
  if (!kind) return "";
  const map = {
    stations: ["jackery-explorer-2000-plus", "bluetti-ac200l", "anker-solix-c2000-gen2"],
    home: ["anker-solix-f3800", "bluetti-ac200l", "jackery-explorer-2000-plus"],
    panels: ["jackery-solarsaga-200w", "bluetti-sp200l", "anker-solix-ps400"],
  };
  const ids = map[kind];
  if (!ids) return "";
  const links = ids
    .map((id) => {
      const p = product(id);
      return `<a class="cta cta-compact" href="${hopById[p.affiliate]}">${esc(p.brand)}</a>`;
    })
    .join("");
  return `<div class="sticky-cta" hidden>
    <p>Shop featured ${kind === "panels" ? "panels" : "stations"}</p>
    <div class="sticky-cta-row">${links}</div>
  </div>`;
}

function injectTokens(html) {
  return html
    .replace(/\{\{product:([a-z0-9-]+)\}\}/g, (_, id) => productCard(product(id)))
    .replace(/\{\{sku:([a-z0-9-]+)\}\}/g, (_, id) => skuFigure(product(id)))
    .replace(/\{\{products:([a-z0-9-]+)\}\}/g, (_, group) => productGrid(group))
    .replace(/\{\{compare:([a-z0-9-]+)\}\}/g, (_, group) => compareTable(group))
    .replace(/\{\{go:([a-z0-9-]+)\}\}/g, (_, id) => {
      const program = affiliates.programs.find((p) => p.id === id);
      if (!program) throw new Error(`Unknown affiliate id: ${id}`);
      return program.path;
    });
}

const pageFiles = (await walk(pagesDir)).filter((f) => f.endsWith(".html"));
const pages = [];
for (const file of pageFiles) {
  pages.push(parsePage(await readFile(file, "utf8"), file));
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const internalHrefs = new Set();
const writtenPaths = new Set();

for (const page of pages) {
  const canonical = `${site.url}${page.path}`;
  const staged = page.path === "/" || page.shell === "stage";
  const body = staged ? page.body : `${breadcrumbs(page)}${page.body}`;
  const content = staged ? body : `<div class="page">${body}</div>`;
  const html = layout
    .replaceAll("{{title}}", esc(page.title))
    .replaceAll("{{description}}", esc(page.description))
    .replaceAll("{{canonical}}", esc(canonical))
    .replaceAll("{{path}}", esc(page.path))
    .replaceAll("{{silo}}", esc(page.silo || "home"))
    .replaceAll("{{nav}}", nav(page.silo, page.path))
    .replaceAll("{{jsonld}}", jsonLd(page))
    .replaceAll("{{updated}}", esc(formatDate(page.updated || site.updated)))
    .replaceAll("{{content}}", content)
    .replaceAll("{{sticky}}", stickyBar(page.sticky))
    .replaceAll("{{site_name}}", esc(site.name))
    .replaceAll("{{site_url}}", esc(site.url));

  const rendered = injectTokens(html);
  const outFile = page.path === "/" ? join(distDir, "index.html") : join(distDir, page.path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, rendered);
  writtenPaths.add(page.path);

  for (const match of rendered.matchAll(/href="(\/[^"]*)"/g)) {
    const href = match[1].split("#")[0].split("?")[0];
    if (href) internalHrefs.add(href);
  }
}

const assetDir = join(srcDir, "assets");
async function copyDir(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dest = join(to, entry.name);
    if (entry.isDirectory()) await copyDir(src, dest);
    else await copyFile(src, dest);
  }
}
await copyDir(assetDir, join(distDir, "assets"));

const notFound = pages.find((p) => p.path === "/404/");
if (notFound) {
  const src404 = join(distDir, "404", "index.html");
  await copyFile(src404, join(distDir, "404.html"));
}

for (const program of affiliates.programs) {
  const dest = program.destination;
  const hop = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Redirecting to ${esc(program.name)}</title>
  <meta http-equiv="refresh" content="0;url=${esc(dest)}">
  <link rel="canonical" href="${esc(site.url + program.path)}">
</head>
<body>
  <p>Redirecting to ${esc(program.name)}. This is a placeholder affiliate hop — replace the destination in <code>src/affiliates.json</code> and <code>netlify.toml</code>.</p>
  <p><a href="${esc(dest)}">Continue to ${esc(program.name)}</a></p>
</body>
</html>`;
  const hopFile = join(distDir, program.path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(hopFile), { recursive: true });
  await writeFile(hopFile, hop);
  writtenPaths.add(program.path);
}

function isPublicSitemapPage(page) {
  const path = page.path || "";
  if (path === "/404/" || path === "/404.html") return false;
  if (path.startsWith("/go/")) return false;
  if (path.includes("?") || path.includes("#")) return false;
  return true;
}

const sitemapPages = pages
  .filter(isPublicSitemapPage)
  .sort((a, b) => {
    if (a.path === "/") return -1;
    if (b.path === "/") return 1;
    return a.path.localeCompare(b.path);
  });

const sitemapEntries = sitemapPages.map((p) => {
  const loc = `${site.url}${p.path}`;
  if (!loc.startsWith("https://thehomebackup.com")) {
    throw new Error(`Sitemap loc must use https://thehomebackup.com, got ${loc}`);
  }
  if (loc.includes("netlify.app") || loc.includes("/go/") || loc.includes("?")) {
    throw new Error(`Sitemap loc is not a public page URL: ${loc}`);
  }
  return { loc, lastmod: p.updated || site.updated };
});

if (!sitemapEntries.some((e) => e.loc === `${site.url}/`)) {
  throw new Error("Sitemap is missing the homepage");
}

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
  .map(
    (e) => `  <url>
    <loc>${esc(e.loc)}</loc>
    <lastmod>${esc(e.lastmod)}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

if (!sitemapXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
  throw new Error("sitemap.xml missing XML declaration");
}
if (!sitemapXml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) {
  throw new Error("sitemap.xml missing urlset");
}
if (sitemapEntries.some((e) => e.loc.includes("/go/") || e.loc.includes("netlify.app") || e.loc.includes("?"))) {
  throw new Error("sitemap.xml includes a hop, preview host, or query string");
}
for (const entry of sitemapEntries) {
  if (!sitemapXml.includes(`<loc>${esc(entry.loc)}</loc>`)) {
    throw new Error(`sitemap.xml missing ${entry.loc}`);
  }
}

const sitemapTxt = join(distDir, "sitemap.txt");
await writeFile(sitemapTxt, sitemapXml);
await copyFile(join(srcDir, "robots.txt"), join(distDir, "robots.txt"));
await writeFile(
  join(distDir, "_redirects"),
  "/sitemap.xml   /sitemap.txt  200!\n/sitemap.xml/  /sitemap.txt  200!\n",
);
await writeFile(
  join(distDir, "_headers"),
  `/sitemap.xml
  Content-Type: application/xml; charset=UTF-8
  X-Content-Type-Options: nosniff

/sitemap.txt
  Content-Type: application/xml; charset=UTF-8
  X-Content-Type-Options: nosniff
`,
);

try {
  await execFileP("python3", [
    "-c",
    "import sys, xml.etree.ElementTree as ET\n" +
      "tree = ET.parse(sys.argv[1])\n" +
      "root = tree.getroot()\n" +
      "ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}\n" +
      "urls = root.findall('sm:url', ns)\n" +
      "if not urls: raise SystemExit('sitemap has no url entries')\n" +
      "for url in urls:\n" +
      "    loc = url.find('sm:loc', ns)\n" +
      "    lastmod = url.find('sm:lastmod', ns)\n" +
      "    if loc is None or not (loc.text or '').strip(): raise SystemExit('url missing loc')\n" +
      "    if lastmod is None or not (lastmod.text or '').strip(): raise SystemExit('url missing lastmod')\n",
    sitemapTxt,
  ]);
} catch (err) {
  if (err.code === "ENOENT") {
    console.warn("python3 not found; skipped XML parse check");
  } else {
    const detail = err.stderr || err.stdout || err.message;
    throw new Error(`sitemap.xml is not well-formed XML: ${detail}`);
  }
}

const skip = new Set(["/404.html"]);
const missing = [];
for (const href of internalHrefs) {
  if (skip.has(href) || href.startsWith("/assets/")) continue;
  const normalized = href.endsWith("/") || href === "/" ? href : `${href}/`;
  const file = normalized === "/" ? join(distDir, "index.html") : join(distDir, normalized.replace(/^\//, ""), "index.html");
  try {
    await stat(file);
  } catch {
    missing.push(href);
  }
}

if (missing.length) {
  console.error("Broken internal links:");
  for (const href of missing.sort()) console.error(`  ${href}`);
  process.exit(1);
}

console.log(`Built ${pages.length} pages → dist/`);
console.log(`Sitemap: ${sitemapEntries.length} public URLs → dist/sitemap.txt (served at /sitemap.xml)`);
console.log(`Robots: copied src/robots.txt → dist/robots.txt`);
console.log(`Products: ${Object.keys(catalog.items).join(", ")}`);
console.log(`Affiliate hops: ${affiliates.programs.map((p) => p.path).join(", ")}`);
