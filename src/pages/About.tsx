import { Link } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import { aboutSeo } from "@/lib/seo-config";
import { SITE_NAME, SITE_TAGLINE, TOOL_LABELS, TOOL_ROUTES, type ToolId } from "@/lib/site";

export default function About() {
  const tools = (Object.keys(TOOL_ROUTES) as ToolId[]);

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#f8fafc 0%,#fff 40%)" }}>
      <SEOHead
        page={aboutSeo}
        breadcrumbs={[
          { name: SITE_NAME, path: "/" },
          { name: "About", path: "/about" },
        ]}
        includeOrganization
      />

      <header className="border-b" style={{ borderColor: "#e2e8f0", background: "#fff" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-extrabold text-base heading-gradient">
            {SITE_NAME}
          </Link>
          <Link to="/" className="text-sm font-semibold" style={{ color: "#4f46e5" }}>
            ← All Tools
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-black mb-4" style={{ color: "#0f172a" }}>
          About {SITE_NAME}
        </h1>
        <p className="text-base leading-relaxed mb-6" style={{ color: "#64748b" }}>
          {SITE_TAGLINE}
        </p>

        <section className="mb-8 space-y-4 text-sm leading-relaxed" style={{ color: "#475569" }}>
          <h2 className="text-xl font-bold" style={{ color: "#0f172a" }}>
            How it works
          </h2>
          <p>
            {SITE_NAME} runs entirely in your web browser. When you open a tool and select a PDF file,
            the file is read from your device and processed using JavaScript libraries (pdf-lib and PDF.js).
            No data is sent to our servers. When you download the result, the file is created locally on your device.
          </p>
          <p>
            This approach is faster for large files (no upload wait), more private (your documents never leave your computer),
            and works offline once the page has loaded.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4" style={{ color: "#0f172a" }}>
            Our tools
          </h2>
          <ul className="space-y-2">
            {tools.map((id) => (
              <li key={id}>
                <Link to={TOOL_ROUTES[id]} className="text-sm font-semibold" style={{ color: "#4f46e5" }}>
                  {TOOL_LABELS[id]}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-8 space-y-4 text-sm leading-relaxed" style={{ color: "#475569" }}>
          <h2 className="text-xl font-bold" style={{ color: "#0f172a" }}>
            Privacy
          </h2>
          <p>
            We do not collect, store, or transmit your PDF files. We do not require accounts or personal information to use the tools.
            Standard web analytics may be used in the future to understand traffic patterns; file contents are never accessed.
          </p>
        </section>

        <section className="p-6 rounded-2xl border" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
          <h2 className="text-lg font-bold mb-2" style={{ color: "#0f172a" }}>
            Contact
          </h2>
          <p className="text-sm" style={{ color: "#64748b" }}>
            For questions or feedback about {SITE_NAME}, visit{" "}
            <a href="https://mypdf.online" className="font-semibold" style={{ color: "#4f46e5" }}>
              mypdf.online
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
