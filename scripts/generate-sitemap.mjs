const SITE_URL = (process.env.VITE_SITE_URL || "https://latest-pdf-tool.vercel.app").replace(/\/$/, "");

const routes = [
  "/",
  "/merge-pdf",
  "/split-pdf",
  "/compress-pdf",
  "/remove-pages",
  "/organize-pdf",
];

const today = new Date().toISOString().slice(0, 10);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (path) => `  <url>
    <loc>${SITE_URL}${path === "/" ? "/" : path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${path === "/" ? "1.0" : "0.9"}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const publicDir = join(root, "public");

if (existsSync(distDir)) {
  writeFileSync(join(distDir, "sitemap.xml"), sitemap);
  writeFileSync(join(distDir, "robots.txt"), robots);
  console.log("Generated sitemap.xml and robots.txt in dist/");
}

writeFileSync(join(publicDir, "sitemap.xml"), sitemap);
writeFileSync(join(publicDir, "robots.txt"), robots);
console.log("Generated sitemap.xml and robots.txt in public/");
