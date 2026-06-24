export const SITE_NAME = "MyPDF Online";
export const SITE_TAGLINE =
  "Free PDF tools in your browser — merge, split, compress, remove pages & organize. Private, fast, no ads.";
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || "https://mypdf.online"
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

export const ALL_ROUTES = ["/", "/about", ...Object.values(TOOL_ROUTES)];

export const TOOL_LABELS: Record<ToolId, string> = {
  merge: "Merge PDF",
  split: "Split PDF",
  compress: "Compress PDF",
  remove: "Remove Pages",
  organize: "Organize PDF",
};

export const TOOL_SHORT_DESC: Record<ToolId, string> = {
  merge: "Combine multiple PDF files into one document. Drag to reorder, preview thumbnails, download instantly.",
  split: "Split PDF by page range, extract selected pages, or separate every page into individual files.",
  compress: "Reduce PDF file size with three compression levels while keeping text readable.",
  remove: "Delete unwanted pages from a PDF using visual thumbnails. Download a cleaned document instantly.",
  organize: "Reorder, rotate, and rearrange PDF pages with drag-and-drop in your browser.",
};
