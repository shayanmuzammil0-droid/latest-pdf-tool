import type { ToolId } from "@/lib/site";

export interface SeoStep {
  n: string;
  title: string;
  desc: string;
}

export interface SeoFeature {
  title: string;
  desc: string;
  color: string;
}

export interface SeoFaq {
  q: string;
  a: string;
}

export interface ToolSeoPageData {
  heroSubtitle: string;
  stepsTitle: string;
  stepsSubtitle: string;
  steps: SeoStep[];
  featuresTitle: string;
  features: SeoFeature[];
  benefitsTitle: string;
  benefitsSubtitle: string;
  benefits: string[];
  faqs: SeoFaq[];
  articleTitle: string;
  articleParagraphs: string[];
  keywordTags: string[];
  accentColor: string;
}

export const TOOL_SEO_DATA: Record<ToolId, ToolSeoPageData> = {
  merge: {
    heroSubtitle:
      "Combine multiple PDFs into one file in seconds. 100% in your browser — no upload, no login, no ads. Drag to reorder with live thumbnails.",
    stepsTitle: "How to Merge PDF Files Online",
    stepsSubtitle: "4 simple steps — under 10 seconds",
    steps: [
      { n: "01", title: "Upload PDFs", desc: "Click Select PDF Files or drag & drop multiple PDF documents." },
      { n: "02", title: "Set the Order", desc: "Drag file cards to arrange them in the exact merge order." },
      { n: "03", title: "Click Merge", desc: "Processing happens instantly in your browser — zero server upload." },
      { n: "04", title: "Download", desc: "Your merged PDF downloads immediately. No email or account needed." },
    ],
    featuresTitle: "Why MyPDF Online Merge Tool Wins",
    features: [
      { title: "No Upload — Ever", desc: "Unlike iLovePDF and Smallpdf, files never leave your device. Maximum privacy for contracts and sensitive docs.", color: "#eff6ff" },
      { title: "PDF Thumbnails", desc: "See the first page of every PDF before merging so you always combine the right files.", color: "#f5f3ff" },
      { title: "50+ Files at Once", desc: "Merge large batches without slowdown — your device does the work, not a remote server.", color: "#ecfeff" },
      { title: "Drag & Drop Reorder", desc: "Visual file cards make setting merge order effortless on desktop and mobile.", color: "#eef2ff" },
      { title: "Dedicated Mobile UI", desc: "Not a shrunk desktop site — a touch-optimized merge experience built for phones.", color: "#f0fdf4" },
      { title: "100% Free, No Ads", desc: "No watermarks, no premium tier, no pop-ups. Merge unlimited PDFs forever.", color: "#fefce8" },
    ],
    benefitsTitle: "Benefits of Browser-Based PDF Merging",
    benefitsSubtitle: "No software. No server. No stress.",
    benefits: [
      "Merge PDFs in under 10 seconds — no upload wait time",
      "No software download or installation required",
      "Files never leave your device — maximum privacy",
      "Works on Windows, Mac, iOS, Android, and Linux",
      "No ads, no pop-ups, no distractions",
      "Works offline once the page has loaded",
    ],
    faqs: [
      { q: "Is this PDF merge tool completely free?", a: "Yes — 100% free with no hidden fees, premium tiers, or usage limits on MyPDF Online." },
      { q: "Are my PDFs uploaded to a server?", a: "No. All merging happens in your browser. Files never leave your device." },
      { q: "How many PDFs can I merge at once?", a: "50+ PDFs in a single operation with no performance issues." },
      { q: "Can I merge PDF without uploading?", a: "Yes. MyPDF Online is 100% browser-based — the privacy-first way to combine PDF files." },
      { q: "Does it work on iPhone and Android?", a: "Yes. A dedicated mobile UI makes merging PDFs easy on any phone." },
      { q: "Is this better than iLovePDF for privacy?", a: "Yes. iLovePDF uploads files to their servers. MyPDF Online processes everything locally on your device." },
    ],
    articleTitle: "Merge PDF Online Free — No Upload, No Login, No Ads",
    articleParagraphs: [
      "Need to merge PDF files online free without uploading to a cloud server? MyPDF Online combines multiple PDF documents into one seamless file — instantly, securely, and without any login.",
      "Searching for combine pdf free, pdf combiner online, or join pdf files? Our tool handles all of these tasks with visual thumbnails, drag-and-drop ordering, and support for 50+ files per merge.",
      "Most popular PDF websites upload your documents to their cloud, creating privacy risks and slow wait times for large files. MyPDF Online uses modern browser technology to process PDFs locally — faster, safer, and completely free with no ads.",
      "Whether you're combining invoices, contracts, assignment submissions, or scanned documents, this is the most private free PDF merger available at mypdf.online.",
    ],
    keywordTags: ["merge pdf online free", "combine pdf no upload", "pdf combiner free", "join pdf files", "merge pdf without uploading", "merge pdf browser"],
    accentColor: "#4f46e5",
  },
  split: {
    heroSubtitle:
      "Split PDF by page range, extract selected pages, or separate every page — all in your browser. No upload, thumbnails included, ZIP download supported.",
    stepsTitle: "How to Split PDF Files Online",
    stepsSubtitle: "4 steps — quick and easy",
    steps: [
      { n: "01", title: "Upload PDF", desc: "Select your PDF or drag and drop it into the upload area." },
      { n: "02", title: "Pick Split Mode", desc: "Choose Extract, Split All, or By Range depending on your need." },
      { n: "03", title: "Select Pages", desc: "Drag thumbnails to reorder and select pages or type custom ranges." },
      { n: "04", title: "Download", desc: "Download split PDFs as individual files or a ZIP archive." },
    ],
    featuresTitle: "Why Our PDF Split Tool Is Different",
    features: [
      { title: "No Server Upload", desc: "Split sensitive documents without sending them to any cloud service.", color: "#eff6ff" },
      { title: "Visual Page Thumbnails", desc: "Preview every page before splitting so you extract exactly what you need.", color: "#f5f3ff" },
      { title: "Flexible Split Modes", desc: "Split all pages, extract selected pages, or split by custom ranges like 1-3, 5, 8-10.", color: "#ecfeff" },
      { title: "ZIP Download", desc: "Download multiple split files as a single ZIP for easy organization.", color: "#eef2ff" },
      { title: "Mobile Split Editor", desc: "Touch-friendly page controls designed specifically for phones and tablets.", color: "#f0fdf4" },
      { title: "Free & Unlimited", desc: "Split as many PDFs as you need with no account or subscription.", color: "#fefce8" },
    ],
    benefitsTitle: "Benefits of Browser-Based PDF Splitting",
    benefitsSubtitle: "No software. No server. No friction.",
    benefits: [
      "Split large PDFs in seconds with no upload queue",
      "Extract only the pages you need from any document",
      "No installation or app download required",
      "Works on desktop, tablet, and mobile browsers",
      "Reorder pages before split operations",
      "Your files remain private on your device",
    ],
    faqs: [
      { q: "Can I split PDF by page range?", a: "Yes. Enter ranges like 1-3, 6, 9-12 to extract exactly those pages." },
      { q: "Are files uploaded to a server?", a: "No. All splitting runs locally in your browser on MyPDF Online." },
      { q: "Can I split every page into separate PDFs?", a: "Yes. Use Split All mode to create one PDF per page." },
      { q: "Does it work on mobile?", a: "Yes. Dedicated mobile UI with touch-friendly page selection." },
      { q: "Is split PDF online free?", a: "Completely free with unlimited splits and no watermarks." },
      { q: "Can I extract pages without uploading?", a: "Yes. MyPDF Online never uploads your PDF — 100% browser processing." },
    ],
    articleTitle: "Split PDF Online Free — Extract Pages Without Uploading",
    articleParagraphs: [
      "Need to split a PDF online or extract pages from a PDF free? MyPDF Online lets you separate documents by page range, extract selected pages, or split every page — all without uploading to a server.",
      "Visual page thumbnails let you see exactly what you're extracting before download. No account, no watermarks, no waiting in an upload queue.",
      "Perfect for separating chapters, extracting forms, splitting scanned batches, or pulling specific pages from contracts. Everything runs client-side for maximum privacy.",
    ],
    keywordTags: ["split pdf online free", "extract pdf pages", "split pdf by range", "pdf splitter no upload", "separate pdf pages", "divide pdf online"],
    accentColor: "#6366f1",
  },
  compress: {
    heroSubtitle:
      "Reduce PDF file size while keeping text readable. Three compression levels, full page previews, 100% browser-based — no upload required.",
    stepsTitle: "How to Compress PDF Files Online",
    stepsSubtitle: "3 steps with full page previews",
    steps: [
      { n: "01", title: "Upload PDF", desc: "Load your document and preview all pages before choosing compression." },
      { n: "02", title: "Choose Level", desc: "Pick Extreme, Recommended, or Less compression from the settings panel." },
      { n: "03", title: "Download", desc: "Save the smallest quality-safe result your browser can produce." },
    ],
    featuresTitle: "Why This PDF Compressor Is Different",
    features: [
      { title: "Private Compression", desc: "All processing stays in the browser. Your PDF never leaves your device.", color: "#eff6ff" },
      { title: "Readable Output", desc: "Optimizes PDF structure without turning pages into blurry images.", color: "#f0fdf4" },
      { title: "Three Compression Levels", desc: "Extreme, Recommended, and Less let you tune how aggressive optimization is.", color: "#fefce8" },
      { title: "Full Page Preview", desc: "See every page thumbnail before you start compression.", color: "#f5f3ff" },
      { title: "No Upload Wait", desc: "Large PDFs compress on your device instantly — no server queue.", color: "#ecfeff" },
      { title: "Free & No Login", desc: "Compress, download, and go. No account, email, or watermark.", color: "#eef2ff" },
    ],
    benefitsTitle: "Benefits of Browser-Based PDF Compression",
    benefitsSubtitle: "Lower size with a clean, modern editor",
    benefits: [
      "Reduce PDF size before sharing or emailing",
      "Review every page thumbnail before compression starts",
      "Three compression presets in one clean panel",
      "Keep files private with in-browser processing only",
      "Dedicated mobile and desktop interfaces",
      "Download the smallest quality-safe result available",
    ],
    faqs: [
      { q: "Does compression keep text readable?", a: "Yes. The compressor optimizes PDF structure while keeping text and pages clear." },
      { q: "Are my PDFs uploaded?", a: "No. Compression runs locally in your browser on MyPDF Online." },
      { q: "Can I compress PDF for email?", a: "Yes. Shrink large PDFs to fit email attachment limits while keeping readability." },
      { q: "What compression levels exist?", a: "Extreme (most aggressive), Recommended (balanced), and Less (lightest pass)." },
      { q: "Is compress PDF online free?", a: "Yes. Unlimited compression with no account required." },
      { q: "Does it work on mobile?", a: "Yes. Same three presets in a touch-friendly mobile layout." },
    ],
    articleTitle: "Compress PDF Online Free — Reduce File Size Without Uploading",
    articleParagraphs: [
      "Need to compress PDF online free or reduce PDF file size for email? MyPDF Online shrinks documents by optimizing PDF structure while keeping text readable — all in your browser.",
      "Unlike upload-based compressors, there's no wait time for large files. Choose Extreme, Recommended, or Less compression and download instantly.",
      "A private, free alternative to iLovePDF and Smallpdf compress tools — no ads, no login, no server upload.",
    ],
    keywordTags: ["compress pdf online free", "reduce pdf file size", "shrink pdf online", "compress pdf for email", "pdf compressor no upload", "compress large pdf"],
    accentColor: "#0d9488",
  },
  remove: {
    heroSubtitle:
      "Delete unwanted pages from any PDF with visual thumbnails. Select pages to remove, download a clean PDF — 100% private, no upload.",
    stepsTitle: "How to Remove Pages from a PDF",
    stepsSubtitle: "3 steps — visual page selection",
    steps: [
      { n: "01", title: "Upload PDF", desc: "Select your PDF or drag it into the upload area." },
      { n: "02", title: "Select Pages", desc: "Click page thumbnails to mark unwanted pages for deletion." },
      { n: "03", title: "Download", desc: "Download your cleaned PDF with selected pages removed." },
    ],
    featuresTitle: "Why Our Remove Pages Tool Stands Out",
    features: [
      { title: "Visual Selection", desc: "See thumbnail previews of every page before deleting anything.", color: "#fff1f2" },
      { title: "No Upload", desc: "Remove pages without sending your document to any server.", color: "#eff6ff" },
      { title: "Quality Preserved", desc: "Only selected pages are removed — the rest of your PDF stays intact.", color: "#f0fdf4" },
      { title: "Fast Processing", desc: "Delete pages instantly with local browser processing.", color: "#fefce8" },
      { title: "Mobile Friendly", desc: "Touch-optimized page selection on phones and tablets.", color: "#f5f3ff" },
      { title: "Free Unlimited", desc: "Remove pages from as many PDFs as you need — no account.", color: "#eef2ff" },
    ],
    benefitsTitle: "Benefits of Browser-Based Page Removal",
    benefitsSubtitle: "Clean your PDFs privately and fast",
    benefits: [
      "Delete blank, duplicate, or unwanted pages in seconds",
      "Preview every page before making changes",
      "No software installation required",
      "Works on all devices and browsers",
      "Files stay on your device — never uploaded",
      "Download cleaned PDF instantly",
    ],
    faqs: [
      { q: "Is removing PDF pages free?", a: "Yes. Unlimited page removal with no fees on MyPDF Online." },
      { q: "Do files get uploaded?", a: "No. Processing happens entirely in your browser." },
      { q: "Can I remove multiple pages at once?", a: "Yes. Select as many pages as you need in one operation." },
      { q: "Will quality be affected?", a: "Only selected pages are removed. Remaining pages keep original quality." },
      { q: "Can I delete blank pages from a PDF?", a: "Yes. Preview thumbnails make it easy to spot and remove blank pages." },
      { q: "Does it work on mobile?", a: "Yes. Dedicated mobile UI for easy page selection." },
    ],
    articleTitle: "Remove PDF Pages Online Free — Delete Unwanted Pages",
    articleParagraphs: [
      "Need to remove pages from PDF online free or delete unwanted pages from a document? MyPDF Online lets you select pages visually and download a cleaned PDF — no upload, no login.",
      "Perfect for removing blank pages, covers, appendices, or irrelevant sections from contracts, reports, and scanned documents.",
      "All processing is local and private — your files never touch a server. A faster, safer alternative to cloud-based PDF editors.",
    ],
    keywordTags: ["remove pdf pages online free", "delete pages from pdf", "pdf page remover", "delete pdf pages free", "remove blank pages pdf", "remove unwanted pdf pages"],
    accentColor: "#dc2626",
  },
  organize: {
    heroSubtitle:
      "Reorder, rotate, and rearrange PDF pages with drag-and-drop. Visual thumbnails, instant download — no upload, works on mobile & desktop.",
    stepsTitle: "How to Organize PDF Pages Online",
    stepsSubtitle: "3 steps — drag, rotate, download",
    steps: [
      { n: "01", title: "Upload PDF", desc: "Select your PDF or drag it into the upload box." },
      { n: "02", title: "Drag & Rotate", desc: "Reorder page thumbnails and rotate pages as needed." },
      { n: "03", title: "Download", desc: "Save your reorganized PDF with the new page order." },
    ],
    featuresTitle: "Why Our PDF Organizer Is Different",
    features: [
      { title: "Drag & Drop Reorder", desc: "Visually rearrange pages — no guessing from page numbers.", color: "#f0fdfa" },
      { title: "Page Rotation", desc: "Rotate individual pages 90°, 180°, or 270° before downloading.", color: "#ecfeff" },
      { title: "Live Thumbnails", desc: "Every page rendered as a preview card for accurate organization.", color: "#f5f3ff" },
      { title: "No Upload", desc: "Organize PDFs privately — files never leave your browser.", color: "#eff6ff" },
      { title: "Mobile Touch UI", desc: "Drag-and-drop works on touch screens with a dedicated mobile layout.", color: "#f0fdf4" },
      { title: "Free & No Login", desc: "Open, organize, download. No account or subscription needed.", color: "#fefce8" },
    ],
    benefitsTitle: "Benefits of Browser-Based PDF Organization",
    benefitsSubtitle: "Fix page order in seconds",
    benefits: [
      "Reorder scanned pages into the correct sequence",
      "Rotate misaligned pages without desktop software",
      "Fix page order after merging multiple documents",
      "No installation or account required",
      "Private processing — no server upload",
      "Works on desktop and mobile browsers",
    ],
    faqs: [
      { q: "Can I reorder PDF pages by dragging?", a: "Yes. Drag page thumbnails to any position in the document." },
      { q: "Can I rotate pages?", a: "Yes. Rotate individual pages before downloading." },
      { q: "Are files uploaded?", a: "No. Organization happens entirely in your browser." },
      { q: "Is organize PDF pages free?", a: "Completely free with no limits on MyPDF Online." },
      { q: "Does it work on mobile?", a: "Yes. Touch-friendly drag-and-drop on phones and tablets." },
      { q: "Can I fix scanned document page order?", a: "Yes. Perfect for reordering pages from scanned multi-page documents." },
    ],
    articleTitle: "Organize PDF Pages Online Free — Reorder & Rotate",
    articleParagraphs: [
      "Need to reorder PDF pages online free or rotate PDF pages? MyPDF Online provides a visual drag-and-drop editor that runs entirely in your browser — no upload required.",
      "Fix misaligned scans, rearrange report sections, or reorganize merged documents in seconds with live page thumbnails.",
      "A private, modern alternative to desktop PDF software — free, fast, and works on any device.",
    ],
    keywordTags: ["organize pdf pages online free", "reorder pdf pages", "rotate pdf pages", "rearrange pdf online", "sort pdf pages free", "pdf page organizer"],
    accentColor: "#0d9488",
  },
};
