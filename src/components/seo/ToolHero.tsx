import { getSeoForTool } from "@/lib/seo-config";
import { SITE_NAME, TOOL_LABELS, TOOL_ROUTES, type ToolId } from "@/lib/site";
import { TOOL_SEO_DATA } from "@/data/tool-seo-content";

interface ToolHeroProps {
  tool: ToolId;
}

export function ToolHero({ tool }: ToolHeroProps) {
  const seo = getSeoForTool(tool);
  const data = TOOL_SEO_DATA[tool];

  return (
    <header className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-2 text-center">
      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: data.accentColor }}>
        Free · No Upload · No Ads · {SITE_NAME}
      </p>
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight mb-3" style={{ color: "#0f172a" }}>
        {seo.h1 ?? TOOL_LABELS[tool]}
      </h1>
      <p className="text-sm sm:text-base max-w-2xl mx-auto leading-relaxed" style={{ color: "#64748b" }}>
        {data.heroSubtitle}
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {["No upload", "No login", "Mobile + Desktop", "Private", "Free"].map((tag) => (
          <span
            key={tag}
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}
          >
            {tag}
          </span>
        ))}
      </div>
    </header>
  );
}
