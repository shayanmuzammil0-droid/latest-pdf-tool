import { SITE_NAME, SITE_TAGLINE, SITE_URL, TOOL_ROUTES, type ToolId } from "./site";

export interface FaqItem {
  q: string;
  a: string;
}

export interface PageSeo {
  path: string;
  title: string;
  description: string;
  keywords: string;
  h1?: string;
  faqs?: FaqItem[];
  articleHeading?: string;
  articleParagraphs?: string[];
}

const sharedKeywords =
  "free pdf tools online, pdf editor browser, no upload pdf tool, private pdf editor, pdf tools no login, pdf tools no ads";

export const homeSeo: PageSeo = {
  path: "/",
  title: "Free PDF Tools Online — Merge, Split, Compress & More | No Upload, No Ads",
  description:
    "Free online PDF tools that run 100% in your browser. Merge, split, compress, remove pages & organize PDFs — private, fast, no login, no ads. Works on mobile & desktop.",
  keywords: `${sharedKeywords}, merge pdf online free, split pdf online, compress pdf free, remove pdf pages, organize pdf pages`,
  faqs: [
    {
      q: "Are these PDF tools really free?",
      a: "Yes. All five tools are completely free with no hidden fees, premium tiers, or usage limits.",
    },
    {
      q: "Do my PDF files get uploaded to a server?",
      a: "No. Every tool processes files locally in your browser. Your documents never leave your device.",
    },
    {
      q: "Do I need to create an account?",
      a: "No account, email, or login is required. Open a tool and start working instantly.",
    },
    {
      q: "Does it work on mobile phones?",
      a: "Yes. Each tool has a dedicated mobile UI designed for touch, plus a full desktop experience.",
    },
    {
      q: "Can I handle large PDF files?",
      a: "Yes. The tools are optimized for large files and batch operations, all processed on your device.",
    },
    {
      q: "Are there ads on the site?",
      a: "No ads, pop-ups, or distractions. The experience stays clean and focused on your PDF task.",
    },
  ],
};

export const toolSeo: Record<ToolId, PageSeo> = {
  merge: {
    path: TOOL_ROUTES.merge,
    title: "Merge PDF Online Free — Combine PDF Files Instantly | No Login",
    description:
      "Merge PDF files online for free. Combine multiple PDFs into one document in your browser — no upload, no login, no ads. Fast, private, works on mobile & desktop.",
    keywords:
      "merge pdf online free, combine pdf files, pdf merger no login, join pdf online, merge multiple pdfs, pdf combiner free, secure pdf merge browser",
    faqs: [
      {
        q: "Is this PDF merge tool completely free?",
        a: "Yes — 100% free with no hidden fees, premium tiers, or usage limits.",
      },
      {
        q: "Do I need to sign up or log in?",
        a: "No registration or email is required. Open the page and start merging instantly.",
      },
      {
        q: "Are my PDFs safe and private?",
        a: "All processing happens in your browser. Files are never sent to any server.",
      },
      {
        q: "How many PDF files can I merge at once?",
        a: "You can merge 50+ PDFs in a single operation without performance issues.",
      },
      {
        q: "Does it work on mobile?",
        a: "Yes. The tool is fully responsive with a dedicated mobile interface.",
      },
    ],
    articleHeading: "The Best Free PDF Merge Tool Online",
    articleParagraphs: [
      "Looking for the fastest way to merge PDF files online free? Combine multiple PDF documents into one seamless file — instantly, securely, and without any login.",
      "Unlike other online PDF combiners that require registration or charge fees, our PDF merger delivers a clean, distraction-free experience with visual file previews.",
      "All files are processed locally on your device, making this one of the most secure online PDF combiners available.",
    ],
  },
  split: {
    path: TOOL_ROUTES.split,
    title: "Split PDF Online Free — Extract & Separate Pages | No Upload",
    description:
      "Split PDF files online for free. Extract pages, split by range, or separate every page — all in your browser. Private, fast, no login. Mobile & desktop supported.",
    keywords:
      "split pdf online free, extract pdf pages, separate pdf pages, pdf splitter no login, split pdf by range, divide pdf online, extract pages from pdf free",
    faqs: [
      {
        q: "Is this PDF split tool completely free?",
        a: "Yes, it's fully free with unlimited splits and no subscriptions.",
      },
      {
        q: "Can I split by page range?",
        a: "Yes. Type ranges like 1-3, 6, 9-12 to extract exactly those pages.",
      },
      {
        q: "Are my PDF files uploaded to a server?",
        a: "No. Processing is done locally in your browser for maximum privacy.",
      },
      {
        q: "Can I reorder pages before splitting?",
        a: "Yes. Drag and drop page thumbnails to set your order before extracting.",
      },
      {
        q: "Does it work on mobile devices?",
        a: "Yes. The split editor is optimized for mobile with touch-friendly controls.",
      },
    ],
    articleHeading: "Split PDF Files Online — Fast, Free & Private",
    articleParagraphs: [
      "Need to split a PDF online without uploading to a cloud server? Extract individual pages, split by custom ranges, or separate every page — all in seconds.",
      "Visual page thumbnails let you see exactly what you're extracting before you download. No account, no watermarks, no waiting.",
      "Everything runs client-side in your browser, so sensitive documents stay on your device.",
    ],
  },
  compress: {
    path: TOOL_ROUTES.compress,
    title: "Compress PDF Online Free — Reduce PDF File Size | No Upload",
    description:
      "Compress PDF files online for free. Reduce file size while keeping text readable — processed in your browser. No login, no upload, no ads. Mobile & desktop.",
    keywords:
      "compress pdf online free, reduce pdf file size, pdf compressor no login, shrink pdf online, optimize pdf size, pdf size reducer free, compress pdf without upload",
    faqs: [
      {
        q: "Does compression keep text readable?",
        a: "Yes. The compressor optimizes PDF structure while keeping text and pages clear.",
      },
      {
        q: "Are my PDFs uploaded to a server?",
        a: "No. Compression runs locally in your browser.",
      },
      {
        q: "What compression levels are available?",
        a: "Choose Extreme, Recommended, or Less compression depending on how aggressive you want the optimization.",
      },
      {
        q: "Will every PDF get much smaller?",
        a: "Some PDFs are already optimized. The tool keeps the smallest quality-safe result available.",
      },
      {
        q: "Does it work on mobile?",
        a: "Yes. The mobile version keeps the same presets in a touch-friendly layout.",
      },
    ],
    articleHeading: "The Best Free PDF Compressor for Quality-First Size Reduction",
    articleParagraphs: [
      "Need to compress PDF files online without sacrificing readability? Reduce file size by optimizing PDF structure while keeping text clear.",
      "Preview every page thumbnail before compression and choose from three compression presets in one clean panel.",
      "Because everything happens locally, it works as a private PDF compressor with no upload queue or server dependency.",
    ],
  },
  remove: {
    path: TOOL_ROUTES.remove,
    title: "Remove PDF Pages Online Free — Delete Unwanted Pages | No Upload",
    description:
      "Remove pages from PDF files online for free. Delete unwanted pages with visual thumbnails — 100% in your browser. No login, private, fast. Mobile & desktop.",
    keywords:
      "remove pdf pages online free, delete pages from pdf, pdf page remover, remove unwanted pdf pages, delete pdf pages no login, extract and remove pdf pages",
    faqs: [
      {
        q: "Is removing PDF pages free?",
        a: "Yes. Delete as many pages as you need with no limits or fees.",
      },
      {
        q: "Do I need to upload my PDF?",
        a: "No. Your file stays on your device and is processed entirely in the browser.",
      },
      {
        q: "Can I preview pages before deleting?",
        a: "Yes. See thumbnail previews of every page and select exactly which to remove.",
      },
      {
        q: "Will the remaining PDF keep its quality?",
        a: "Yes. Only selected pages are removed; the rest of the document stays intact.",
      },
      {
        q: "Does it work on mobile?",
        a: "Yes. A dedicated mobile UI makes page selection easy on phones and tablets.",
      },
    ],
    articleHeading: "Remove PDF Pages Online — Free, Private & Easy",
    articleParagraphs: [
      "Quickly remove unwanted pages from any PDF without installing software or creating an account.",
      "Select pages visually with thumbnails, download your cleaned PDF instantly, and keep full control of your document.",
      "All processing is local and private — your files never touch a server.",
    ],
  },
  organize: {
    path: TOOL_ROUTES.organize,
    title: "Organize PDF Pages Online Free — Reorder & Rotate | No Upload",
    description:
      "Organize PDF pages online for free. Reorder, rotate, and rearrange pages with drag-and-drop — in your browser. No login, no upload, no ads. Mobile & desktop.",
    keywords:
      "organize pdf pages online free, reorder pdf pages, rotate pdf pages, rearrange pdf online, pdf page organizer, sort pdf pages free, pdf page rotation online",
    faqs: [
      {
        q: "Can I reorder PDF pages by dragging?",
        a: "Yes. Drag and drop page thumbnails to rearrange your document in any order.",
      },
      {
        q: "Can I rotate individual pages?",
        a: "Yes. Rotate pages as needed before downloading your reorganized PDF.",
      },
      {
        q: "Is this tool free?",
        a: "Completely free with no account required.",
      },
      {
        q: "Are my files uploaded anywhere?",
        a: "No. Organization happens entirely in your browser on your device.",
      },
      {
        q: "Does it work on mobile?",
        a: "Yes. Touch-friendly drag-and-drop is available on mobile devices.",
      },
    ],
    articleHeading: "Organize PDF Pages Online — Reorder, Rotate & Download",
    articleParagraphs: [
      "Rearrange PDF pages in seconds with a visual drag-and-drop editor that runs entirely in your browser.",
      "Rotate misaligned scans, fix page order, and download a perfectly organized PDF — no software install needed.",
      "Your documents stay private because nothing is uploaded to external servers.",
    ],
  },
};

export function getSeoForTool(tool: ToolId): PageSeo {
  return toolSeo[tool];
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path === "/" ? "/" : path}`;
}

export function buildWebAppSchema(page: PageSeo, toolName?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: toolName ? `${toolName} — ${SITE_NAME}` : SITE_NAME,
    url: absoluteUrl(page.path),
    description: page.description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript. Works in Chrome, Firefox, Safari, Edge.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "100% browser-based processing",
      "No file upload to servers",
      "No login required",
      "Mobile and desktop UI",
      "Free with no ads",
    ],
  };
}

export function buildFaqSchema(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function buildBreadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_TAGLINE,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
