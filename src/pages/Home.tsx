import { Link } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import { homeSeo } from "@/lib/seo-config";
import { SITE_NAME, SITE_TAGLINE, TOOL_LABELS, TOOL_ROUTES, type ToolId } from "@/lib/site";

const TOOLS: {
  id: ToolId;
  desc: string;
  color: string;
  bg: string;
}[] = [
  {
    id: "merge",
    desc: "Combine multiple PDFs into one file. Drag to reorder, preview thumbnails, download instantly.",
    color: "#4f46e5",
    bg: "#eef2ff",
  },
  {
    id: "split",
    desc: "Split by page range, extract selected pages, or separate every page into individual files.",
    color: "#6366f1",
    bg: "#eef2ff",
  },
  {
    id: "compress",
    desc: "Reduce PDF file size with three compression levels while keeping text readable.",
    color: "#0d9488",
    bg: "#f0fdfa",
  },
  {
    id: "remove",
    desc: "Delete unwanted pages with visual thumbnails. Keep only the pages you need.",
    color: "#dc2626",
    bg: "#fff1f2",
  },
  {
    id: "organize",
    desc: "Reorder, rotate, and rearrange PDF pages with drag-and-drop.",
    color: "#7c3aed",
    bg: "#f5f3ff",
  },
];

const TRUST_BADGES = [
  { label: "100% Private", sub: "Files never leave your browser" },
  { label: "No Login", sub: "Start instantly, no account" },
  { label: "No Ads", sub: "Clean, distraction-free UI" },
  { label: "Free Forever", sub: "All 5 tools, zero cost" },
  { label: "Mobile + Desktop", sub: "Optimized UI for every device" },
  { label: "Large Files", sub: "Handles big PDFs & batches" },
];

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#f8fafc 0%,#fff 40%)" }}>
      <SEOHead page={homeSeo} includeWebsiteSchema includeItemList includeOrganization />

      <header className="border-b sticky top-0 z-30 backdrop-blur-md" style={{ borderColor: "#e2e8f0", background: "rgba(255,255,255,0.92)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl logo-icon flex items-center justify-center shadow">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white" />
              </svg>
            </div>
            <div>
              <p className="font-extrabold text-sm sm:text-base tracking-tight heading-gradient">{SITE_NAME}</p>
              <p className="text-[10px] sm:text-xs" style={{ color: "#94a3b8" }}>
                Free · Private · Browser-based
              </p>
            </div>
          </div>
          <nav className="hidden sm:flex items-center gap-1 flex-wrap justify-end" aria-label="PDF tools">
            {TOOLS.map((t) => (
              <Link
                key={t.id}
                to={TOOL_ROUTES[t.id]}
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors hover:bg-indigo-50"
                style={{ color: "#475569" }}
              >
                {TOOL_LABELS[t.id]}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#4f46e5" }}>
            100% Free · No Upload · No Ads
          </p>
          <h1 className="text-3xl sm:text-5xl font-black mb-5 leading-tight" style={{ color: "#0f172a" }}>
            {homeSeo.h1 ?? "Free PDF Tools Online"} —{" "}
            <span className="heading-gradient">Private, Fast &amp; Easy</span>
          </h1>
          <p className="text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed" style={{ color: "#64748b" }}>
            {SITE_TAGLINE} Your files are processed entirely in your browser — nothing is uploaded to any server.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {TRUST_BADGES.map((b) => (
              <div
                key={b.label}
                className="px-3 py-2 rounded-xl border text-left"
                style={{ background: "#fff", borderColor: "#e2e8f0" }}
              >
                <p className="text-xs font-bold" style={{ color: "#0f172a" }}>
                  {b.label}
                </p>
                <p className="text-[10px]" style={{ color: "#94a3b8" }}>
                  {b.sub}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16" aria-label="All PDF tools">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-2" style={{ color: "#0f172a" }}>
            Choose Your <span className="heading-gradient">PDF Tool</span>
          </h2>
          <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>
            Five powerful tools — each with dedicated mobile &amp; desktop interfaces
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TOOLS.map((tool) => (
              <Link
                key={tool.id}
                to={TOOL_ROUTES[tool.id]}
                className="tool-card group p-6 rounded-2xl border block transition-all hover:shadow-lg"
                style={{ background: "#fff", borderColor: "#e2e8f0" }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: tool.bg }}
                >
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                      stroke={tool.color}
                      strokeWidth="2"
                    />
                    <path d="M9 13h6M9 17h4" stroke={tool.color} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <h3 className="font-extrabold text-lg mb-2 group-hover:text-indigo-600 transition-colors" style={{ color: "#0f172a" }}>
                  {TOOL_LABELS[tool.id]}
                </h3>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "#64748b" }}>
                  {tool.desc}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: tool.color }}>
                  Open {TOOL_LABELS[tool.id]} →
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-8" style={{ color: "#0f172a" }}>
            MyPDF Online vs <span className="heading-gradient">Upload-Based PDF Tools</span>
          </h2>
          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "#e2e8f0" }}>
            <table className="w-full text-sm" style={{ background: "#fff" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th className="text-left p-4 font-bold" style={{ color: "#0f172a" }}>Feature</th>
                  <th className="p-4 font-bold" style={{ color: "#4f46e5" }}>MyPDF Online</th>
                  <th className="p-4 font-bold" style={{ color: "#64748b" }}>iLovePDF / Smallpdf</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["File upload to server", "Never — 100% browser", "Yes — cloud processing"],
                  ["Account required", "No", "Often for advanced features"],
                  ["Ads on free tier", "No ads", "Yes — ads & upsells"],
                  ["Mobile-optimized UI", "Dedicated per tool", "Responsive only"],
                  ["Large file speed", "Instant — no upload wait", "Slower — upload first"],
                  ["Privacy", "Files stay on device", "Files sent to servers"],
                ].map(([feature, us, them]) => (
                  <tr key={feature} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                    <td className="p-4 font-medium" style={{ color: "#334155" }}>{feature}</td>
                    <td className="p-4 text-center font-semibold" style={{ color: "#16a34a" }}>{us}</td>
                    <td className="p-4 text-center" style={{ color: "#94a3b8" }}>{them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-8" style={{ color: "#0f172a" }}>
            Why Use <span className="heading-gradient">Browser-Based PDF Tools?</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: "Maximum Privacy",
                text: "Unlike cloud PDF services, your documents never leave your device. Ideal for contracts, medical records, and sensitive files.",
              },
              {
                title: "No Waiting for Uploads",
                text: "Large PDFs process instantly on your machine. No upload queue, no server timeouts, no file size limits from a remote server.",
              },
              {
                title: "Works Offline",
                text: "Once the page loads, tools work without an internet connection. Perfect for travel or low-bandwidth situations.",
              },
              {
                title: "Dedicated Mobile UI",
                text: "Not just a shrunk desktop site — each tool has a touch-optimized mobile interface for the best experience on phones.",
              },
              {
                title: "No Account Required",
                text: "Skip registration, email verification, and subscriptions. Open a tool and get your PDF done in seconds.",
              },
              {
                title: "Handles Big Files",
                text: "Merge 50+ PDFs, split large documents, and compress heavy files — all powered by efficient browser technology.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="p-5 rounded-2xl border"
                style={{ background: "#fff", borderColor: "#f1f5f9" }}
              >
                <h3 className="font-bold text-sm mb-2" style={{ color: "#0f172a" }}>
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        {homeSeo.faqs && (
          <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-8" style={{ color: "#0f172a" }}>
              Frequently Asked <span className="heading-gradient">Questions</span>
            </h2>
            <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
              {homeSeo.faqs.map((item) => (
                <details
                  key={item.q}
                  className="faq-item border rounded-2xl overflow-hidden"
                  style={{ borderColor: "#e2e8f0", background: "#fff" }}
                >
                  <summary
                    className="flex items-center justify-between px-5 py-4 cursor-pointer font-semibold text-sm"
                    style={{ color: "#0f172a" }}
                  >
                    {item.q}
                    <svg className="faq-arrow shrink-0 ml-3" width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: "#64748b" }}>
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
          <div className="seo-article-block p-8 sm:p-10 rounded-3xl">
            <h2 className="text-xl sm:text-2xl font-extrabold mb-4" style={{ color: "#0f172a" }}>
              The Complete Free PDF Toolkit — Better Than Cloud Upload Tools
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: "#475569" }}>
              <p>
                Searching for <strong style={{ color: "#0f172a" }}>free PDF tools online</strong> that don't require uploading your files? <strong style={{ color: "#0f172a" }}>MyPDF Online</strong> (mypdf.online) includes merge, split, compress, remove pages, and organize — everything you need without installing software.
              </p>
              <p>
                Most popular PDF websites upload your documents to their cloud, creating privacy risks and slow wait times for large files. Our tools use modern browser technology to process PDFs <strong style={{ color: "#0f172a" }}>locally on your device</strong> — faster, safer, and completely free with no ads.
              </p>
              <p>
                Whether you need to <strong style={{ color: "#0f172a" }}>merge PDF files online free</strong>, split a document by page range, compress a large PDF for email, remove blank pages, or reorder a scanned document — each tool is designed for speed and simplicity on both mobile and desktop.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8" style={{ borderColor: "#e2e8f0", background: "#fff" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs mb-3" style={{ color: "#94a3b8" }}>
            {SITE_NAME} · Free · No Login · No Ads · Browser-Based · Privacy-Safe
          </p>
          <nav className="flex flex-wrap justify-center gap-3 mb-4" aria-label="Footer links">
            {TOOLS.map((t) => (
              <Link key={t.id} to={TOOL_ROUTES[t.id]} className="text-xs font-semibold" style={{ color: "#4f46e5" }}>
                {TOOL_LABELS[t.id]}
              </Link>
            ))}
            <Link to="/about" className="text-xs font-semibold" style={{ color: "#64748b" }}>
              About
            </Link>
          </nav>
          <p className="text-xs" style={{ color: "#cbd5e1" }}>
            © {new Date().getFullYear()} {SITE_NAME}. All processing done locally in your browser.
          </p>
        </div>
      </footer>
    </div>
  );
}
