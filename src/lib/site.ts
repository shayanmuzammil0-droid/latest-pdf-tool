export const SITE_NAME = "PDF Tools Online";
export const SITE_TAGLINE =
  "Free PDF tools in your browser — merge, split, compress, remove pages & organize. Private, fast, no ads.";
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || "https://latest-pdf-tool.vercel.app"
).replace(/\/$/, "");

export type ToolId = "merge" | "split" | "compress" | "remove" | "organize";

export const TOOL_ROUTES: Record<ToolId, string> = {
  merge: "/merge-pdf",
  split: "/split-pdf",
  compress: "/compress-pdf",
  remove: "/remove-pages",
  organize: "/organize-pdf",
};

export const ROUTE_TO_TOOL: Record<string, ToolId> = {
  "/merge-pdf": "merge",
  "/split-pdf": "split",
  "/compress-pdf": "compress",
  "/remove-pages": "remove",
  "/organize-pdf": "organize",
};

export const ALL_ROUTES = ["/", ...Object.values(TOOL_ROUTES)];

export const TOOL_LABELS: Record<ToolId, string> = {
  merge: "Merge PDF",
  split: "Split PDF",
  compress: "Compress PDF",
  remove: "Remove Pages",
  organize: "Organize PDF",
};
