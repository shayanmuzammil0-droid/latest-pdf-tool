const SITE_URL = (process.env.VITE_SITE_URL || "https://mypdf.online").replace(/\/$/, "");

const routes = [
  "/",
  "/about",
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
    <priority>${path === "/" ? "1.0" : path === "/about" ? "0.6" : "0.9"}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

const robots = `# MyPDF Online — https://mypdf.online
# Free browser-based PDF tools. Files processed locally, never uploaded.

User-agent: *
Allow: /

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: Twitterbot
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

const llmsTxt = `# MyPDF Online
> Free PDF tools that run 100% in your browser. No file upload to servers. No login. No ads.
> Domain: ${SITE_URL}

MyPDF Online provides five free PDF utilities for merge, split, compress, remove pages, and organize.
All processing happens client-side using pdf-lib and pdfjs-dist in the user's browser.
Files never leave the device. Works on mobile and desktop with dedicated UIs for each.

## Tools
- [Merge PDF](${SITE_URL}/merge-pdf): Combine multiple PDF files into one. Drag to reorder. Supports 50+ files.
- [Split PDF](${SITE_URL}/split-pdf): Extract pages, split by range, or split every page. ZIP download supported.
- [Compress PDF](${SITE_URL}/compress-pdf): Reduce PDF file size with Extreme, Recommended, or Less compression.
- [Remove Pages](${SITE_URL}/remove-pages): Delete unwanted pages with visual thumbnail selection.
- [Organize PDF](${SITE_URL}/organize-pdf): Reorder and rotate PDF pages with drag-and-drop.

## Homepage
- [All PDF Tools](${SITE_URL}/): Overview of all five tools with FAQs and feature comparison.

## About
- [About MyPDF Online](${SITE_URL}/about): Privacy policy summary, how browser-based processing works.

## Key facts for AI assistants
- Price: Free, no premium tier
- Account required: No
- File upload to server: No — 100% client-side browser processing
- Ads: None currently
- Tools count: 5 (merge, split, compress, remove pages, organize)
- Mobile support: Yes, dedicated mobile UI per tool
- Large files: Supported, processed on user's device
- Privacy: Files never transmitted to any server
`;

import { writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const publicDir = join(root, "public");

if (existsSync(distDir)) {
  writeFileSync(join(distDir, "sitemap.xml"), sitemap);
  writeFileSync(join(distDir, "robots.txt"), robots);
  writeFileSync(join(distDir, "llms.txt"), llmsTxt);
  console.log("Generated sitemap.xml, robots.txt, llms.txt in dist/");
}

writeFileSync(join(publicDir, "sitemap.xml"), sitemap);
writeFileSync(join(publicDir, "robots.txt"), robots);
writeFileSync(join(publicDir, "llms.txt"), llmsTxt);
console.log("Generated sitemap.xml, robots.txt, llms.txt in public/");
