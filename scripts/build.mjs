import { mkdir, readdir, readFile, writeFile, copyFile, stat } from "node:fs/promises";
import { dirname, join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");
const distDir = join(root, "dist");
const pagesDir = join(srcDir, "pages");

const site = JSON.parse(await readFile(join(srcDir, "site.json"), "utf8"));
const affiliates = JSON.parse(await readFile(join(srcDir, "affiliates.json"), "utf8"));
const layout = await readFile(join(srcDir, "templates/layout.html"), "utf8");

const SILOS = [
  { id: "whole-house-generators", href: "/whole-house-generators/", label: "Whole-house generators" },
  { id: "home-batteries", href: "/home-batteries/", label: "Home batteries" },
  { id: "portable-power-stations", href: "/portable-power-stations/", label: "Power stations" },
  { id: "portable-solar-panels", href: "/portable-solar-panels/", label: "Portable solar panels" },
];

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
    return `<li><a href="${s.href}" ${current ? 'aria-current="page"' : ""}><span class="led" aria-hidden="true"></span>${esc(s.label)}</a></li>`;
  }).join("");
  return `
    <ul class="silo-nav">
      ${items}
    </ul>`;
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

function injectGoLinks(html) {
  return html.replace(/\{\{go:([a-z0-9-]+)\}\}/g, (_, id) => {
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

await mkdir(distDir, { recursive: true });

const internalHrefs = new Set();
const writtenPaths = new Set();

for (const page of pages) {
  const canonical = `${site.url}${page.path}`;
  const staged = page.path === "/" || page.shell === "stage";
  const body = staged ? page.body : `${breadcrumbs(page)}${page.body}`;
  const content = staged ? body : `<div class="desk-sheet">${body}</div>`;
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
    .replaceAll("{{site_name}}", esc(site.name))
    .replaceAll("{{site_url}}", esc(site.url));

  const rendered = injectGoLinks(html);
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

const sitemapUrls = pages
  .filter((p) => p.path !== "/404/")
  .map((p) => `  <url><loc>${esc(site.url + p.path)}</loc><lastmod>${esc(p.updated || site.updated)}</lastmod></url>`)
  .join("\n");
await writeFile(
  join(distDir, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}\n</urlset>\n`,
);

await writeFile(
  join(distDir, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /go/\nSitemap: ${site.url}/sitemap.xml\n`,
);

const skip = new Set([
  "/assets/styles.css",
  "/assets/nav.js",
  "/assets/desk.js",
  "/assets/favicon.svg",
  "/assets/og-default.svg",
  "/assets/noise.svg",
  "/404.html",
]);
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
console.log(`Affiliate hops: ${affiliates.programs.map((p) => p.path).join(", ")}`);
