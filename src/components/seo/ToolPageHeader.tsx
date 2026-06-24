import { Link } from "react-router-dom";
import { SITE_NAME, TOOL_LABELS, TOOL_ROUTES, type ToolId } from "@/lib/site";

interface ToolPageHeaderProps {
  tool: ToolId;
}

export function ToolPageHeader({ tool }: ToolPageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 header-glass border-b" style={{ borderColor: "rgba(226,232,240,0.8)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity min-w-0">
          <div className="w-9 h-9 rounded-xl logo-icon flex items-center justify-center shadow-md shrink-0">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white" opacity="0.95" />
            </svg>
          </div>
          <div className="min-w-0">
            <span className="font-extrabold text-sm sm:text-base tracking-tight block truncate" style={{ color: "#0f172a" }}>
              {SITE_NAME}
            </span>
            <span className="text-xs font-bold heading-gradient">{TOOL_LABELS[tool]}</span>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/"
            className="hidden sm:inline-flex text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors hover:bg-indigo-50"
            style={{ borderColor: "#e2e8f0", color: "#4f46e5" }}
          >
            All Tools
          </Link>
          <div className="hidden md:flex items-center gap-1.5">
            {["Private", "Free", "No Login"].map((badge) => (
              <span key={badge} className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile tool quick links */}
      <nav className="sm:hidden border-t px-4 py-2 flex gap-2 overflow-x-auto" style={{ borderColor: "#f1f5f9" }} aria-label="Quick tool links">
        {(Object.keys(TOOL_ROUTES) as ToolId[]).map((t) => (
          <Link
            key={t}
            to={TOOL_ROUTES[t]}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0"
            style={{
              background: t === tool ? "#eef2ff" : "#f8fafc",
              color: t === tool ? "#4f46e5" : "#64748b",
            }}
          >
            {TOOL_LABELS[t]}
          </Link>
        ))}
      </nav>
    </header>
  );
}
