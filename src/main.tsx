import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Home from "./pages/Home";
import About from "./pages/About";
import App from "./App";
import type { ToolId } from "./lib/site";

function ToolPage({ tool }: { tool: ToolId }) {
  return <App initialTool={tool} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/merge-pdf" element={<ToolPage tool="merge" />} />
          <Route path="/split-pdf" element={<ToolPage tool="split" />} />
          <Route path="/compress-pdf" element={<ToolPage tool="compress" />} />
          <Route path="/remove-pages" element={<ToolPage tool="remove" />} />
          <Route path="/organize-pdf" element={<ToolPage tool="organize" />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
