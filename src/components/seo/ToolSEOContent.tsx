import { Link } from "react-router-dom";
import { TOOL_SEO_DATA } from "@/data/tool-seo-content";
import { TOOL_LABELS, TOOL_ROUTES, type ToolId } from "@/lib/site";

interface ToolSEOContentProps {
  tool: ToolId;
}

export default function ToolSEOContent({ tool }: ToolSEOContentProps) {
  const data = TOOL_SEO_DATA[tool];
  const otherTools = (Object.keys(TOOL_ROUTES) as ToolId[]).filter((t) => t !== tool);

  return (
    <article className="max-w-5xl mx-auto px-4 sm:px-6 mt-12 pb-8" aria-label={`${TOOL_LABELS[tool]} guide`}>
      {/* How it works */}
      <section className="mb-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center" style={{ color: "#0f172a" }}>
          {data.stepsTitle.split(" ").slice(0, 3).join(" ")}{" "}
          <span className="heading-gradient">{data.stepsTitle.split(" ").slice(3).join(" ") || "Online"}</span>
        </h2>
        <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>{data.stepsSubtitle}</p>
        <ol className={`grid gap-4 ${data.steps.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          {data.steps.map((step) => (
            <li key={step.n} className="step-card p-5 rounded-2xl text-center list-none">
              <div className="text-xs font-black mb-3 tracking-widest heading-gradient">{step.n}</div>
              <h3 className="font-bold text-sm mb-1.5" style={{ color: "#0f172a" }}>{step.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{step.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="mb-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 text-center" style={{ color: "#0f172a" }}>
          <span className="heading-gradient">{data.featuresTitle}</span>
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.features.map((f) => (
            <div key={f.title} className="feature-card p-5 rounded-2xl border flex gap-4" style={{ background: "#fff", borderColor: "#f1f5f9" }}>
              <div className="w-3 h-3 rounded-full shrink-0 mt-1.5" style={{ background: data.accentColor }} />
              <div>
                <h3 className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>{f.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="mb-16 benefits-block p-8 sm:p-10 rounded-3xl">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center" style={{ color: "#0f172a" }}>
          {data.benefitsTitle}
        </h2>
        <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>{data.benefitsSubtitle}</p>
        <ul className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto list-none">
          {data.benefits.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5" style={{ background: `linear-gradient(135deg,${data.accentColor},#7c3aed)`, color: "white" }}>✓</span>
              <span className="text-sm leading-relaxed" style={{ color: "#334155" }}>{b}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="mb-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 text-center" style={{ color: "#0f172a" }}>
          Frequently Asked <span className="heading-gradient">Questions</span>
        </h2>
        <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
          {data.faqs.map((item) => (
            <details key={item.q} className="faq-item border rounded-2xl overflow-hidden" style={{ borderColor: "#e2e8f0", background: "#fff" }}>
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-semibold text-sm" style={{ color: "#0f172a" }}>
                {item.q}
                <svg className="faq-arrow shrink-0 ml-3" width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" stroke={data.accentColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: "#64748b" }}>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Other tools */}
      <section className="mb-16">
        <h2 className="text-2xl font-extrabold mb-6 text-center" style={{ color: "#0f172a" }}>
          More Free <span className="heading-gradient">PDF Tools</span>
        </h2>
        <nav className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="Other PDF tools">
          {otherTools.map((t) => (
            <Link
              key={t}
              to={TOOL_ROUTES[t]}
              className="tool-card p-4 rounded-2xl text-center block hover:shadow-md transition-shadow"
            >
              <p className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>{TOOL_LABELS[t]}</p>
              <span className="text-xs font-medium" style={{ color: data.accentColor }}>Open →</span>
            </Link>
          ))}
        </nav>
      </section>

      {/* SEO article */}
      <section className="seo-article-block p-8 sm:p-10 rounded-3xl mb-8">
        <h2 className="text-xl sm:text-2xl font-extrabold mb-4" style={{ color: "#0f172a" }}>
          {data.articleTitle}
        </h2>
        <div className="space-y-4 text-sm leading-relaxed" style={{ color: "#475569" }}>
          {data.articleParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-6">
          {data.keywordTags.map((kw) => (
            <span key={kw} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#f8fafc", color: "#94a3b8", border: "1px solid #f1f5f9" }}>
              {kw}
            </span>
          ))}
        </div>
      </section>
    </article>
  );
}
