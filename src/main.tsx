import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Home from "./pages/Home";
import About from "./pages/About";
import MergePDFPage from "./pages/tools/MergePDFPage";
import SplitPDFPage from "./pages/tools/SplitPDFPage";
import CompressPDFPage from "./pages/tools/CompressPDFPage";
import RemovePagesPage from "./pages/tools/RemovePagesPage";
import OrganizePDFPage from "./pages/tools/OrganizePDFPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/merge-pdf" element={<MergePDFPage />} />
          <Route path="/split-pdf" element={<SplitPDFPage />} />
          <Route path="/compress-pdf" element={<CompressPDFPage />} />
          <Route path="/remove-pages" element={<RemovePagesPage />} />
          <Route path="/organize-pdf" element={<OrganizePDFPage />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
