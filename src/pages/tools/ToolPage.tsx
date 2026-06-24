import App from "@/App";
import type { ToolId } from "@/lib/site";

interface ToolPageProps {
  tool: ToolId;
}

/** Dedicated standalone page — one PDF tool per URL for focused SEO */
export default function ToolPage({ tool }: ToolPageProps) {
  return <App initialTool={tool} />;
}
