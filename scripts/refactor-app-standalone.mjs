import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "App.tsx");
let s = readFileSync(file, "utf8");

function removeBlock(start, end) {
  const startIdx = s.indexOf(start);
  if (startIdx === -1) {
    console.warn("Start not found:", start.slice(0, 60));
    return;
  }
  const endIdx = s.indexOf(end, startIdx);
  if (endIdx === -1) {
    console.warn("End not found for:", start.slice(0, 60));
    return;
  }
  s = s.slice(0, startIdx) + s.slice(endIdx + end.length);
  console.log("Removed block starting:", start.slice(0, 50));
}

// Replace header
const headerStart = "      {/* ── Header ── */}";
const headerEnd = "      </header>\r\n\r\n";
const headerEndLf = "      </header>\n\n";
let hEnd = s.includes(headerEnd) ? headerEnd : headerEndLf;
const hStart = s.indexOf(headerStart);
const hEndIdx = s.indexOf(hEnd, hStart);
if (hStart !== -1 && hEndIdx !== -1) {
  s =
    s.slice(0, hStart) +
    "      <ToolPageHeader tool={activeTool} />\r\n      <ToolHero tool={activeTool} />\r\n\r\n" +
    s.slice(hEndIdx + hEnd.length);
  console.log("Replaced header");
}

removeBlock(
  "        {isSplitUploadScreen && <section className=\"max-w-5xl mx-auto px-4 sm:px-6 mt-8 pb-6\">",
  "        </section>}\r\n      </>"
);
removeBlock(
  "        {isSplitUploadScreen && <section className=\"max-w-5xl mx-auto px-4 sm:px-6 mt-8 pb-6\">",
  "        </section>}\n      </>"
);

s = s.replace(/\r?\n        \{isCompressUploadScreen && <CompressPDFLanding onSelectTool=\{navigateToTool\} \/>\}/g, "");

removeBlock(
  "        {isRemoveUploadScreen && <section className=\"max-w-5xl mx-auto px-4 sm:px-6 mt-8 pb-6\">",
  "        </section>}\r\n      </>"
);
removeBlock(
  "        {isRemoveUploadScreen && <section className=\"max-w-5xl mx-auto px-4 sm:px-6 mt-8 pb-6\">",
  "        </section>}\n      </>"
);

removeBlock(
  "        {isOrganizeUploadScreen && <section className=\"max-w-5xl mx-auto px-4 sm:px-6 mt-8 pb-6\">",
  "        </section>}\r\n      </>"
);
removeBlock(
  "        {isOrganizeUploadScreen && <section className=\"max-w-5xl mx-auto px-4 sm:px-6 mt-8 pb-6\">",
  "        </section>}\n      </>"
);

removeBlock("      {/* ── SEO CONTENT SECTIONS ── */}", "      </section>\r\n\r\n      </>");
removeBlock("      {/* ── SEO CONTENT SECTIONS ── */}", "      </section>\n\n      </>");

removeBlock("        {/* Hero subtitle — above upload */}", "        {/* Upload Zone */}");

s = s.replace(/\r?\n  const navigateToTool = \(_tool: ToolId\) => \{[\s\S]*?\};\r?\n/g, "\n");
s = s.replace(/\r?\n  const \[isMobileToolMenuOpen, setIsMobileToolMenuOpen\] = useState\(false\);\r?\n/g, "\n");
s = s.replace(/\r?\n  useEffect\(\(\) => \{\r?\n    if \(!isMobile\) setIsMobileToolMenuOpen\(false\);\r?\n  \}, \[isMobile\]\);\r?\n/g, "\n");

if (!s.includes("<ToolSEOContent")) {
  s = s.replace(
    /(\r?\n      \{\/\* ── Footer ── \*\/\})/,
    "\r\n\r\n      <ToolSEOContent tool={activeTool} />$1"
  );
  console.log("Added ToolSEOContent");
}

writeFileSync(file, s);
console.log("Done. Lines:", s.split(/\r?\n/).length);
