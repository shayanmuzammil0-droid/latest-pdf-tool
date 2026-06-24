interface CompressPDFLandingProps {
  onSelectTool: (tool: "merge" | "split" | "compress" | "remove" | "organize") => void;
}

export default function CompressPDFLanding({ onSelectTool }: CompressPDFLandingProps) {
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 pb-6">
      <div className="mb-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center" style={{ color: "#0f172a" }}>
          How to <span className="heading-gradient">Compress PDF Files</span> Online
        </h2>
        <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>Done in 3 steps with full page previews</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { n: "01", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 16V17a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/><path d="M12 3v13M7.5 7.5L12 3l4.5 4.5" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "Upload PDF", desc: "Load your document and preview all pages before picking a compression level." },
            { n: "02", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" stroke="#4f46e5" strokeWidth="2"/><path d="M8 12h8M12 8v8" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Choose Compression", desc: "Pick Extreme, Recommended, or Less compression from the settings panel." },
            { n: "03", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 3v13M7 11l5 5 5-5" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Download the Smaller PDF", desc: "Save the smallest quality-safe result your browser can produce." },
          ].map((step) => (
            <div key={step.n} className="step-card p-5 rounded-2xl text-center">
              <div className="text-xs font-black mb-3 tracking-widest heading-gradient">{step.n}</div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "#eef2ff" }}>{step.icon}</div>
              <h3 className="font-bold text-sm mb-1.5" style={{ color: "#0f172a" }}>{step.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 text-center" style={{ color: "#0f172a" }}>
          Why This <span className="heading-gradient">PDF Compressor</span> Is Different
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "Private Compression", desc: "All processing stays in the browser. Your PDF never leaves your device.", color: "#eff6ff" },
            { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M9 12h6M9 16h4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/><rect x="5" y="2" width="14" height="20" rx="2" stroke="#16a34a" strokeWidth="2"/></svg>), title: "Readable Output", desc: "The workflow is focused on keeping text and page clarity readable while reducing file overhead.", color: "#f0fdf4" },
            { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="#d97706" strokeWidth="2" strokeLinejoin="round"/></svg>), title: "Three Compression Levels", desc: "Extreme, Recommended, and Less compression let you tune how aggressive the cleanup should be.", color: "#fefce8" },
            { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" stroke="#7c3aed" strokeWidth="2"/><path d="M8 12h8M12 8v8" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Full Page Preview", desc: "See every page thumbnail on the left before you start compression.", color: "#f5f3ff" },
            { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#0d9488" strokeWidth="2"/><path d="M8 12l2.5 2.5L16 9" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "Quality-Safe Strategy", desc: "Compression rebuilds PDF structure instead of flattening pages into blurry images.", color: "#f0fdfa" },
            { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#4f46e5" strokeWidth="2"/><path d="M12 8v8M8 12h8" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Free and No Login", desc: "Compress, download, and move on. No account, no email, no watermark.", color: "#eef2ff" },
          ].map((feature) => (
            <div key={feature.title} className="feature-card p-5 rounded-2xl border flex gap-4" style={{ background: "#fff", borderColor: "#f1f5f9" }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: feature.color }}>{feature.svg}</div>
              <div>
                <h3 className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>{feature.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-16 benefits-block p-8 sm:p-10 rounded-3xl">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center" style={{ color: "#0f172a" }}>
          Benefits of <span className="heading-gradient">Browser-Based PDF Compression</span>
        </h2>
        <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>Lower size with a familiar editor layout</p>
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {[
            "Reduce PDF size before sharing or uploading elsewhere",
            "Review every page thumbnail before compression starts",
            "Choose from three compression presets in one clean panel",
            "Keep files private with in-browser processing only",
            "Use the same theme and workflow style as the rest of the site",
            "Download the smallest quality-safe result available",
          ].map((benefit) => (
            <div key={benefit} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "white" }}>✓</span>
              <span className="text-sm leading-relaxed" style={{ color: "#334155" }}>{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-16">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 text-center" style={{ color: "#0f172a" }}>
          Frequently Asked <span className="heading-gradient">Questions</span>
        </h2>
        <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
          {[
            { q: "Does this keep text readable?", a: "Yes. The compressor is built around quality-safe PDF optimization and avoids turning pages into blurry raster screenshots." },
            { q: "What changes between Extreme, Recommended, and Less compression?", a: "Each preset changes how aggressive the structural optimization passes are. Extreme is the most aggressive, Recommended is balanced, and Less compression is the lightest pass." },
            { q: "Are my PDFs uploaded to a server?", a: "No. Compression runs locally in your browser, so the PDF stays on your device." },
            { q: "Will every PDF get much smaller?", a: "Not always. Some PDFs are already optimized. In that case the tool keeps the smallest lossless result instead of making the file bigger." },
            { q: "Can I preview pages before compressing?", a: "Yes. The editor shows all page thumbnails on the left and the compression settings on the right, similar to the Split PDF workflow." },
            { q: "Does it work on mobile?", a: "Yes. The mobile version keeps the same theme and compression presets in a stacked touch-friendly layout." },
          ].map((item) => (
            <details key={item.q} className="faq-item border rounded-2xl overflow-hidden" style={{ borderColor: "#e2e8f0", background: "#fff" }}>
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-semibold text-sm" style={{ color: "#0f172a" }}>
                {item.q}
                <svg className="faq-arrow shrink-0 ml-3" width="18" height="18" fill="none" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: "#64748b" }}>{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="mb-16">
        <h2 className="text-2xl font-extrabold mb-6 text-center" style={{ color: "#0f172a" }}>
          More <span className="heading-gradient">PDF Tools</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: "PDF Merge", desc: "Combine files quickly", live: true, tool: "merge" as const, bg: "#eef2ff", svg: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M8 5h8M8 12h8M8 19h8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/><path d="M5 8l3-3 3 3M19 16l-3 3-3-3" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>) },
            { name: "PDF Split", desc: "Split into multiple files", live: true, tool: "split" as const, bg: "#eef2ff", svg: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M6 3h12M6 21h12M8 12h8M12 8v8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/></svg>) },
            { name: "Remove Pages", desc: "Delete unwanted pages", live: true, tool: "remove" as const, bg: "#fff1f2", svg: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M9 3h6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/><path d="M4 7h16" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/><path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>) },
            { name: "Organize PDF", desc: "Reorder pages visually", live: true, tool: "organize" as const, bg: "#f0fdfa", svg: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#0d9488" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#0d9488" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#0d9488" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#0d9488" strokeWidth="2"/></svg>) },
          ].map((tool) => (
            <div key={tool.name} className="tool-card p-4 rounded-2xl text-center cursor-pointer" onClick={() => onSelectTool(tool.tool)}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2.5" style={{ background: tool.bg }}>{tool.svg}</div>
              <p className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>{tool.name}</p>
              <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>{tool.desc}</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>Live</span>
            </div>
          ))}
        </div>
      </div>

      <div className="seo-article-block p-8 sm:p-10 rounded-3xl mb-8">
        <h2 className="text-xl sm:text-2xl font-extrabold mb-4" style={{ color: "#0f172a" }}>
          The Best Free PDF Compressor for Quality-First Size Reduction
        </h2>
        <div className="space-y-4 text-sm leading-relaxed" style={{ color: "#475569" }}>
          <p>
            Need to <strong style={{ color: "#0f172a" }}>compress PDF files online</strong> without sacrificing readability? This tool focuses on reducing file size by optimizing the PDF structure while keeping text and page rendering clear.
          </p>
          <p>
            The editor follows the same design language as the other tools on the site: <strong style={{ color: "#0f172a" }}>page thumbnails on the left</strong> and <strong style={{ color: "#0f172a" }}>settings on the right</strong>, so it feels consistent and fast to use.
          </p>
          <p>
            Because everything happens locally in the browser, it works as a <strong style={{ color: "#0f172a" }}>private PDF compressor</strong> with no upload queue, no account, and no server dependency.
          </p>
          <p className="font-semibold" style={{ color: "#4f46e5" }}>
            Ready to shrink your PDF? Scroll up, choose the compression level, and download the smallest quality-safe result instantly.
          </p>
        </div>
      </div>
    </section>
  );
}