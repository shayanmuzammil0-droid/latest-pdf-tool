import { SITE_NAME, SITE_TAGLINE, SITE_URL, TOOL_LABELS, TOOL_ROUTES, TOOL_SHORT_DESC, type ToolId } from "./site";

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
  howToSteps?: string[];
}

const brandKeywords =
  "mypdf online, mypdf.online, free pdf tools, pdf tools online free, browser pdf editor, no upload pdf, private pdf tools";

const sharedKeywords = `${brandKeywords}, pdf editor browser, no login pdf tools, pdf tools no ads, client side pdf processing`;

export const homeSeo: PageSeo = {
  path: "/",
  title: "MyPDF Online — Free PDF Tools | Merge, Split, Compress, No Upload",
  description:
    "MyPDF Online offers 5 free PDF tools in your browser: merge, split, compress, remove pages & organize. No file upload, no login, no ads. Private, fast — mobile & desktop.",
  keywords: `${sharedKeywords}, merge pdf online free, split pdf online free, compress pdf online free, combine pdf free, pdf combiner online, remove pdf pages free, organize pdf pages, ilovepdf alternative no upload, smallpdf alternative free`,
  h1: "Free PDF Tools Online — Private, Fast & Easy",
  faqs: [
    {
      q: "What is MyPDF Online?",
      a: "MyPDF Online is a free suite of five browser-based PDF tools: merge, split, compress, remove pages, and organize. All processing happens on your device — files are never uploaded to a server.",
    },
    {
      q: "Are MyPDF Online tools really free?",
      a: "Yes. All five tools are completely free with no hidden fees, premium tiers, watermarks, or usage limits.",
    },
    {
      q: "Do my PDF files get uploaded to a server?",
      a: "No. Every tool processes files locally in your browser using JavaScript. Your documents never leave your device.",
    },
    {
      q: "How is MyPDF Online different from iLovePDF or Smallpdf?",
      a: "Unlike most competitors, MyPDF Online never uploads your files. Processing is 100% client-side for maximum privacy. There are no ads, no login walls, and dedicated mobile UIs for every tool.",
    },
    {
      q: "Does it work on mobile phones?",
      a: "Yes. Each tool has a dedicated mobile interface designed for touch, separate from the desktop layout.",
    },
    {
      q: "Can I handle large PDF files?",
      a: "Yes. Tools support large files and batch operations (50+ PDFs for merge) because processing uses your device's power, not a remote server.",
    },
    {
      q: "Are there ads on MyPDF Online?",
      a: "No ads, pop-ups, or distractions. The experience stays clean and focused on your PDF task.",
    },
  ],
};

export const aboutSeo: PageSeo = {
  path: "/about",
  title: "About MyPDF Online — Private Browser-Based PDF Tools",
  description:
    "Learn how MyPDF Online works. Free PDF tools that process files entirely in your browser. No upload, no account, no ads. Your privacy comes first.",
  keywords: `${sharedKeywords}, about mypdf online, private pdf tools, browser pdf processing, pdf privacy`,
  faqs: [
    {
      q: "How does MyPDF Online protect my privacy?",
      a: "All PDF operations run locally in your web browser using pdf-lib and PDF.js. Your files are never transmitted to our servers or any third party.",
    },
    {
      q: "Who operates MyPDF Online?",
      a: "MyPDF Online is an independent free tool suite built to give users a fast, private alternative to upload-based PDF services.",
    },
  ],
};

export const toolSeo: Record<ToolId, PageSeo> = {
  merge: {
    path: TOOL_ROUTES.merge,
    title: "Merge PDF Online Free — Combine PDF Files | MyPDF Online",
    description:
      "Merge PDF files online for free at MyPDF Online. Combine multiple PDFs into one — no upload, no login, no ads. Drag to reorder, preview thumbnails. Works on mobile & desktop.",
    keywords:
      "merge pdf online free, combine pdf files, pdf combiner, combine pdf free, combine pdf files free, pdf merger no login, join pdf online, merge multiple pdfs, merge pdf without uploading, merge pdf browser, pdf joiner free, combine pdfs no login, merge pdf no sign up, secure pdf merge",
    h1: "Merge PDF Files Online Free",
    howToSteps: [
      "Click Select PDF Files or drag and drop your PDF documents.",
      "Drag file cards to arrange them in the order you want.",
      "Click Merge to combine all PDFs in your browser.",
      "Download your merged PDF instantly — no account needed.",
    ],
    faqs: [
      {
        q: "Is this PDF merge tool completely free?",
        a: "Yes — 100% free with no hidden fees, premium tiers, or usage limits on MyPDF Online.",
      },
      {
        q: "Do I need to sign up or log in?",
        a: "No registration or email is required. Open the page and start merging instantly.",
      },
      {
        q: "Are my PDFs uploaded to a server?",
        a: "No. All merging happens in your browser. Files never leave your device.",
      },
      {
        q: "How many PDF files can I merge at once?",
        a: "You can merge 50+ PDFs in a single operation without performance issues.",
      },
      {
        q: "Can I reorder PDFs before merging?",
        a: "Yes. Drag and drop file cards to set the exact page order in the final document.",
      },
      {
        q: "Does it work on mobile?",
        a: "Yes. MyPDF Online has a dedicated mobile interface for merging PDFs on phones and tablets.",
      },
    ],
    articleHeading: "The Best Free PDF Merge Tool — No Upload Required",
    articleParagraphs: [
      "Looking for the fastest way to merge PDF files online free? MyPDF Online combines multiple PDF documents into one seamless file — instantly, securely, and without any login.",
      "Unlike iLovePDF, Smallpdf, and other upload-based services, our PDF merger processes everything locally in your browser. Your sensitive documents are never transmitted to any server.",
      "With visual thumbnails, drag-and-drop ordering, and support for 50+ files per merge, MyPDF Online is the most private free PDF combiner available.",
    ],
  },
  split: {
    path: TOOL_ROUTES.split,
    title: "Split PDF Online Free — Extract Pages by Range | MyPDF Online",
    description:
      "Split PDF files online free at MyPDF Online. Extract pages, split by range, or separate every page — 100% in your browser. No upload, no login. Mobile & desktop.",
    keywords:
      "split pdf online free, extract pdf pages, separate pdf pages, pdf splitter, split pdf by range, split pdf by pages, divide pdf online, extract pages from pdf free, split pdf without uploading, split pdf into multiple files, pdf separator online, extract pdf pages online free",
    h1: "Split PDF Online Free",
    howToSteps: [
      "Upload your PDF file by clicking or dragging it into the upload area.",
      "Choose split mode: extract pages, split all, or split by custom range.",
      "Select pages or enter ranges like 1-3, 5, 8-10.",
      "Download split PDF files individually or as a ZIP archive.",
    ],
    faqs: [
      {
        q: "Is this PDF split tool completely free?",
        a: "Yes, unlimited splits with no subscriptions on MyPDF Online.",
      },
      {
        q: "Can I split by page range?",
        a: "Yes. Type ranges like 1-3, 6, 9-12 to extract exactly those pages.",
      },
      {
        q: "Are my PDF files uploaded to a server?",
        a: "No. Splitting is done locally in your browser for maximum privacy.",
      },
      {
        q: "Can I split a PDF into individual pages?",
        a: "Yes. Use Split All mode to create a separate PDF for every page.",
      },
      {
        q: "Can I reorder pages before splitting?",
        a: "Yes. Drag and drop page thumbnails to set your order before extracting.",
      },
      {
        q: "Does it work on mobile devices?",
        a: "Yes. The split editor has a dedicated mobile UI with touch-friendly controls.",
      },
    ],
    articleHeading: "Split PDF Files Online — Fast, Free & Private",
    articleParagraphs: [
      "Need to split a PDF online without uploading to a cloud server? MyPDF Online lets you extract individual pages, split by custom ranges, or separate every page — all in seconds.",
      "Visual page thumbnails show exactly what you're extracting before download. No account, no watermarks, no waiting in an upload queue.",
      "Everything runs client-side, so contracts, tax documents, and personal files stay on your device.",
    ],
  },
  compress: {
    path: TOOL_ROUTES.compress,
    title: "Compress PDF Online Free — Reduce File Size | MyPDF Online",
    description:
      "Compress PDF online free at MyPDF Online. Reduce PDF file size while keeping text readable — processed in your browser. No upload, no login, no ads.",
    keywords:
      "compress pdf online free, reduce pdf file size, pdf compressor, shrink pdf online, compress pdf for email, optimize pdf size, pdf size reducer free, compress pdf without uploading, compress large pdf, reduce pdf size online free, pdf compression tool free",
    h1: "Compress PDF Online Free",
    howToSteps: [
      "Upload your PDF and preview all page thumbnails.",
      "Choose a compression level: Extreme, Recommended, or Less.",
      "Click Compress to optimize the PDF in your browser.",
      "Download the smaller PDF file instantly.",
    ],
    faqs: [
      {
        q: "Does compression keep text readable?",
        a: "Yes. MyPDF Online optimizes PDF structure while keeping text and pages clear.",
      },
      {
        q: "Are my PDFs uploaded to a server?",
        a: "No. Compression runs locally in your browser on MyPDF Online.",
      },
      {
        q: "What compression levels are available?",
        a: "Extreme, Recommended, and Less — tune how aggressive the optimization should be.",
      },
      {
        q: "Will every PDF get much smaller?",
        a: "Some PDFs are already optimized. The tool keeps the smallest quality-safe result.",
      },
      {
        q: "Can I compress a PDF for email?",
        a: "Yes. Compress large PDFs to fit email attachment limits while keeping readability.",
      },
      {
        q: "Does it work on mobile?",
        a: "Yes. The mobile compressor has the same three presets in a touch-friendly layout.",
      },
    ],
    articleHeading: "Free PDF Compressor — Quality-First Size Reduction",
    articleParagraphs: [
      "Need to compress PDF files online without sacrificing readability? MyPDF Online reduces file size by optimizing PDF structure while keeping text clear.",
      "Preview every page before compression and choose from three presets. No upload queue — even large files compress on your device instantly.",
      "A private alternative to upload-based compressors like iLovePDF and Smallpdf.",
    ],
  },
  remove: {
    path: TOOL_ROUTES.remove,
    title: "Remove PDF Pages Online Free — Delete Pages | MyPDF Online",
    description:
      "Remove pages from PDF online free at MyPDF Online. Delete unwanted pages with visual thumbnails — 100% in your browser. No login, private, fast.",
    keywords:
      "remove pdf pages online free, delete pages from pdf, pdf page remover, remove unwanted pdf pages, delete pdf pages no login, remove pages from pdf free, delete pdf page online, remove blank pages from pdf",
    h1: "Remove PDF Pages Online Free",
    howToSteps: [
      "Upload your PDF file to the remove pages tool.",
      "Browse page thumbnails and select pages to delete.",
      "Click Remove to process the PDF in your browser.",
      "Download your cleaned PDF with unwanted pages removed.",
    ],
    faqs: [
      {
        q: "Is removing PDF pages free?",
        a: "Yes. Delete as many pages as you need with no limits on MyPDF Online.",
      },
      {
        q: "Do I need to upload my PDF?",
        a: "No. Your file stays on your device and is processed entirely in the browser.",
      },
      {
        q: "Can I preview pages before deleting?",
        a: "Yes. Thumbnail previews let you select exactly which pages to remove.",
      },
      {
        q: "Will the remaining PDF keep its quality?",
        a: "Yes. Only selected pages are removed; the rest stays intact.",
      },
      {
        q: "Can I remove multiple pages at once?",
        a: "Yes. Select as many pages as you need in one operation.",
      },
      {
        q: "Does it work on mobile?",
        a: "Yes. A dedicated mobile UI makes page selection easy on phones.",
      },
    ],
    articleHeading: "Remove PDF Pages Online — Free, Private & Easy",
    articleParagraphs: [
      "Quickly remove unwanted pages from any PDF without installing software or creating an account on MyPDF Online.",
      "Delete blank pages, covers, or irrelevant sections with visual selection. Download your cleaned PDF instantly.",
      "All processing is local — your files never touch a server.",
    ],
  },
  organize: {
    path: TOOL_ROUTES.organize,
    title: "Organize PDF Pages Online Free — Reorder & Rotate | MyPDF Online",
    description:
      "Organize PDF pages online free at MyPDF Online. Reorder, rotate, and rearrange pages with drag-and-drop — in your browser. No upload, no login.",
    keywords:
      "organize pdf pages online free, reorder pdf pages, rotate pdf pages, rearrange pdf online, pdf page organizer, sort pdf pages free, pdf page rotation online, reorder pdf pages online free, rotate pdf page online free",
    h1: "Organize PDF Pages Online Free",
    howToSteps: [
      "Upload your PDF to the organize tool.",
      "Drag page thumbnails to reorder them.",
      "Rotate individual pages as needed.",
      "Download your reorganized PDF file.",
    ],
    faqs: [
      {
        q: "Can I reorder PDF pages by dragging?",
        a: "Yes. Drag and drop page thumbnails to rearrange your document.",
      },
      {
        q: "Can I rotate individual pages?",
        a: "Yes. Rotate pages before downloading your reorganized PDF.",
      },
      {
        q: "Is this tool free?",
        a: "Completely free with no account required on MyPDF Online.",
      },
      {
        q: "Are my files uploaded anywhere?",
        a: "No. Organization happens entirely in your browser.",
      },
      {
        q: "Can I fix scanned pages that are upside down?",
        a: "Yes. Rotate any page 90°, 180°, or 270° before downloading.",
      },
      {
        q: "Does it work on mobile?",
        a: "Yes. Touch-friendly drag-and-drop on mobile devices.",
      },
    ],
    articleHeading: "Organize PDF Pages Online — Reorder, Rotate & Download",
    articleParagraphs: [
      "Rearrange PDF pages in seconds with MyPDF Online's visual drag-and-drop editor that runs entirely in your browser.",
      "Fix page order in scanned documents, rotate misaligned pages, and download a perfectly organized PDF.",
      "No software install, no upload, no privacy risk.",
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
    alternateName: ["MyPDF", "mypdf.online"],
    url: absoluteUrl(page.path),
    description: page.description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript. Works in Chrome, Firefox, Safari, Edge.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "100% browser-based processing — no server upload",
      "No login or account required",
      "Dedicated mobile and desktop interfaces",
      "Free with no ads",
      "Supports large PDF files and batch operations",
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
    alternateName: "mypdf.online",
    url: SITE_URL,
    description: SITE_TAGLINE,
  };
}

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/og-image.jpg`,
    description: SITE_TAGLINE,
    sameAs: [],
  };
}

export function buildItemListSchema() {
  const tools = (Object.keys(TOOL_ROUTES) as ToolId[]).map((id, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: TOOL_LABELS[id],
    url: absoluteUrl(TOOL_ROUTES[id]),
    description: TOOL_SHORT_DESC[id],
  }));
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${SITE_NAME} — Free PDF Tools`,
    description: SITE_TAGLINE,
    numberOfItems: tools.length,
    itemListElement: tools,
  };
}

export function buildHowToSchema(name: string, description: string, steps: string[], url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    url,
    step: steps.map((text, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: `Step ${index + 1}`,
      text,
    })),
  };
}
