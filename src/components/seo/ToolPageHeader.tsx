import { Link } from "react-router-dom";
import { SITE_NAME, TOOL_LABELS, TOOL_ROUTES, type ToolId } from "@/lib/site";

const TOOL_NAV: { id: ToolId; short: string }[] = [
  { id: "merge", short: "Merge" },
  { id: "split", short: "Split" },
  { id: "compress", short: "Compress" },
  { id: "remove", short: "Remove" },
  { id: "organize", short: "Organize" },
];

interface ToolPageHeaderProps {
  tool: ToolId;
}

export function ToolPageHeader({ tool }: ToolPageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 header-glass border-b" style={{ borderColor: "rgba(226,232,240,0.8)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 rounded-xl logo-icon flex items-center justify-center shadow-md">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white" opacity="0.95" />
              <polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="1.8" fill="none" opacity="0.7" />
              <path d="M9 13h6M9 16h4" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
            </svg>
          </div>
          <span className="font-extrabold text-sm sm:text-base tracking-tight hidden sm:inline" style={{ color: "#0f172a" }}>
            {SITE_NAME}
          </span>
        </Link>

        <nav className="tool-nav-tabs flex items-center gap-0.5 p-1 rounded-xl flex-1 justify-center max-w-md mx-1" style={{ background: "#f1f5f9" }} aria-label="PDF tools">
          {TOOL_NAV.map(({ id, short }) => (
            <Link
              key={id}
              to={TOOL_ROUTES[id]}
              className={`tool-nav-tab flex items-center justify-center px-1.5 sm:px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${tool === id ? "active" : ""}`}
            >
              <span className="hidden sm:inline">{TOOL_LABELS[id]}</span>
              <span className="sm:hidden">{short}</span>
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-1 shrink-0">
          {["Private", "Free"].map((badge) => (
            <span key={badge} className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
              {badge}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
