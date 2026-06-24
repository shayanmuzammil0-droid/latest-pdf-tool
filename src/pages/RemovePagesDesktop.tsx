import { useState, useRef, useCallback, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ─── Types ────────────────────────────────────────────────────────────────────
interface PageItem {
  id: string;
  index: number; // 0-based original page index
  thumbnail: string;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

function parsePageRanges(input: string, maxPages: number): { indexes: Set<number>; invalidTokens: string[] } {
  const indexes = new Set<number>();
  const invalidTokens: string[] = [];
  const tokens = input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    if (token.includes("-")) {
      const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!rangeMatch) {
        invalidTokens.push(token);
        continue;
      }

      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      const from = Math.min(start, end);
      const to = Math.max(start, end);

      // Out-of-bounds values are ignored by clamping to valid PDF page bounds.
      if (to < 1 || from > maxPages) {
        invalidTokens.push(token);
        continue;
      }

      const clampedFrom = Math.max(1, from);
      const clampedTo = Math.min(maxPages, to);
      for (let page = clampedFrom; page <= clampedTo; page += 1) indexes.add(page - 1);
      continue;
    }

    const page = Number(token);
    if (!Number.isInteger(page) || page < 1 || page > maxPages) {
      invalidTokens.push(token);
      continue;
    }
    indexes.add(page - 1);
  }

  return { indexes, invalidTokens };
}

function formatPageRanges(indexes: number[]): string {
  if (indexes.length === 0) return "";
  const sorted = Array.from(new Set(indexes)).sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    parts.push(start === prev ? `${start + 1}` : `${start + 1}-${prev + 1}`);
    start = current;
    prev = current;
  }

  parts.push(start === prev ? `${start + 1}` : `${start + 1}-${prev + 1}`);
  return parts.join(",");
}

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};

async function renderPageThumb(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number
): Promise<string> {
  try {
    const page = await pdfDoc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 0.6 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    page.cleanup();
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return "";
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────
interface RemovePagesDesktopProps {
  onUploadScreenChange?: (isUploadScreen: boolean) => void;
}

export default function RemovePagesDesktop({ onUploadScreenChange }: RemovePagesDesktopProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadSessionRef = useRef(0);
  const inputChangedRef = useRef(false);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [rangeInput, setRangeInput] = useState("");

  const isEditorMode = !!pdfFile && !loading;

  useEffect(() => {
    onUploadScreenChange?.(!pdfFile && !loading);
  }, [onUploadScreenChange, pdfFile, loading]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    if (isEditorMode) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [isEditorMode]);

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const loadPdf = useCallback(
    async (file: File) => {
      if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
        addToast("Please upload a PDF file.", "error");
        return;
      }
      const sessionId = Date.now();
      loadSessionRef.current = sessionId;
      setLoading(true);
      setLoadingProgress(0);
      setPages([]);
      try {
        const buf = await file.arrayBuffer();
        const bufForPdfLib = buf.slice(0);
        setArrayBuffer(bufForPdfLib);

        const pdfJsDoc = await pdfjsLib
          .getDocument({ data: new Uint8Array(buf) })
          .promise;
        const count = pdfJsDoc.numPages;
        if (loadSessionRef.current !== sessionId) return;

        setPageCount(count);
        const pageItems: PageItem[] = Array.from({ length: count }, (_, index) => ({
          id: uid(),
          index,
          thumbnail: "",
        }));
        setPdfFile(file);
        setPages(pageItems);
        setMarkedIds(new Set());
        setLoading(false);
        addToast(`PDF loaded — ${count} page${count !== 1 ? "s" : ""} found.`, "success");

        const batchSize = 6;
        for (let start = 0; start < count; start += batchSize) {
          if (loadSessionRef.current !== sessionId) return;
          const batch = Array.from(
            { length: Math.min(batchSize, count - start) },
            (_, j) => start + j
          );
          const results = await Promise.all(
            batch.map((idx) =>
              renderPageThumb(pdfJsDoc, idx).then((t) => ({ index: idx, thumbnail: t }))
            )
          );
          setPages((prev) => {
            const next = [...prev];
            results.forEach(({ index, thumbnail }) => {
              if (next[index]) next[index] = { ...next[index], thumbnail };
            });
            return next;
          });
          setLoadingProgress(Math.round(((start + batchSize) / count) * 100));
          await new Promise((r) => setTimeout(r, 0));
        }
      } catch (err) {
        console.error(err);
        addToast("Failed to load PDF. File may be encrypted or corrupted.", "error");
        setLoading(false);
      } finally {
        setLoadingProgress(0);
      }
    },
    [addToast]
  );

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) loadPdf(e.target.files[0]);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadPdf(file);
  };

  const handleToggle = (id: string) => {
    setMarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMarkAll = () => setMarkedIds(new Set(pages.map((p) => p.id)));
  const handleMarkNone = () => setMarkedIds(new Set());
  const handleInvert = () => {
    const next = new Set<string>();
    pages.forEach((p) => { if (!markedIds.has(p.id)) next.add(p.id); });
    setMarkedIds(next);
  };

  const handleRangeInputChange = useCallback((value: string) => {
    inputChangedRef.current = true;
    setRangeInput(value);
    if (!value.trim()) {
      setMarkedIds(new Set());
      return;
    }

    const { indexes } = parsePageRanges(value, pageCount);
    const idByIndex = new Map<number, string>();
    pages.forEach((p) => idByIndex.set(p.index, p.id));

    const next = new Set<string>();
    indexes.forEach((idx) => {
      const id = idByIndex.get(idx);
      if (id) next.add(id);
    });
    setMarkedIds(next);
  }, [pageCount, pages]);

  useEffect(() => {
    if (inputChangedRef.current) {
      inputChangedRef.current = false;
      return;
    }
    const markedIndexes = pages
      .filter((p) => markedIds.has(p.id))
      .map((p) => p.index);
    const nextValue = formatPageRanges(markedIndexes);
    setRangeInput((prev) => (prev === nextValue ? prev : nextValue));
  }, [markedIds, pages]);

  const removePagesAndDownload = useCallback(async () => {
    if (!pdfFile || !arrayBuffer) return;
    if (markedIds.size === 0) { addToast("Select at least one page to remove.", "error"); return; }
    if (markedIds.size >= pageCount) { addToast("Cannot remove all pages — keep at least one.", "error"); return; }

    setRemoving(true);
    try {
      const freshBuffer = await pdfFile.arrayBuffer();
      const sourceBytes = new Uint8Array(freshBuffer.byteLength > 0 ? freshBuffer : arrayBuffer);
      const srcDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });

      const markedOriginalIndexes = new Set(
        pages.filter((p) => markedIds.has(p.id)).map((p) => p.index)
      );
      const keepIndexes = Array.from({ length: pageCount }, (_, i) => i).filter(
        (i) => !markedOriginalIndexes.has(i)
      );

      if (keepIndexes.length === 0) {
        addToast("Cannot remove all pages — keep at least one.", "error");
        setRemoving(false);
        return;
      }

      const outDoc = await PDFDocument.create();
      const copiedPages = await outDoc.copyPages(srcDoc, keepIndexes);
      copiedPages.forEach((p) => outDoc.addPage(p));

      const outBytes = await outDoc.save();
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const baseName = pdfFile.name.replace(/\.pdf$/i, "");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}-pages-removed.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      addToast(
        `Done! ${markedIds.size} page${markedIds.size !== 1 ? "s" : ""} removed. ${keepIndexes.length} page${keepIndexes.length !== 1 ? "s" : ""} saved.`,
        "success"
      );
    } catch (err) {
      console.error(err);
      addToast("Failed to process PDF.", "error");
    } finally {
      setRemoving(false);
    }
  }, [pdfFile, arrayBuffer, pages, markedIds, pageCount, addToast]);

  const reset = useCallback(() => {
    setPdfFile(null);
    setArrayBuffer(null);
    setPageCount(0);
    setPages([]);
    setMarkedIds(new Set());
    setLoading(false);
    setLoadingProgress(0);
    setRangeInput("");
  }, []);

  const remainingCount = pageCount - markedIds.size;
  const canRemove = markedIds.size > 0 && markedIds.size < pageCount;

  return (
    <div className={`${isEditorMode ? "overflow-hidden" : ""} app-bg`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={onFileInputChange}
      />

      {/* ── Toasts ── */}
      <div className="fixed top-16 right-4 sm:right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-pill pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold shadow-2xl text-white max-w-xs ${
              t.type === "success" ? "bg-emerald-500" : t.type === "error" ? "bg-rose-500" : "bg-indigo-500"
            }`}
          >
            <span className="text-base">{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}</span>
            {t.message}
          </div>
        ))}
      </div>

      <div className={isEditorMode ? "split-editor-shell" : "max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6"}>

        {/* ── Upload Screen ─────────────────────────────────────────────── */}
        {!pdfFile && (
          <>
            <div className="text-center mt-2 mb-6">
              <h1
                className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight mb-2"
                style={{ color: "#0f172a" }}
              >
                Remove Pages from PDF —{" "}
                <span className="heading-gradient">Free &amp; No Login Required</span>
              </h1>
              <p
                className="text-sm sm:text-base max-w-xl mx-auto"
                style={{ color: "#64748b" }}
              >
                Select the pages you want to delete, preview them visually, and download
                a clean PDF instantly — all inside your browser.
              </p>
            </div>

            <div
              className={`upload-zone-premium rounded-3xl cursor-pointer select-none transition-all duration-300 ${isDraggingOver ? "upload-zone-active" : ""}`}
              style={{ padding: "52px 24px" }}
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingOver(false); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-5 text-center">
                {/* Icon */}
                <div style={{ position: "relative", width: 80, height: 88 }}>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "rotate(-10deg) translateX(-18px) translateY(-18px)", zIndex: 1 }}>
                    <div style={{ width: 44, height: 52, borderRadius: 8, background: "linear-gradient(145deg,#fca5a5,#f87171)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", opacity: 0.75 }} />
                  </div>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translateX(-29px) translateY(-34px)", zIndex: 3 }}>
                    <div style={{ width: 58, height: 68, borderRadius: 12, background: "linear-gradient(145deg,#ef4444,#dc2626,#b91c1c)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(220,38,38,0.4)" }}>
                      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white" opacity="0.95" />
                        <polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="1.8" fill="none" opacity="0.6" />
                        <path d="M9 10l6 6M15 10l-6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xl sm:text-2xl font-extrabold mb-1" style={{ color: isDraggingOver ? "#dc2626" : "#0f172a" }}>
                    {isDraggingOver ? "Drop your PDF here!" : "Drag & Drop a PDF File Here"}
                  </p>
                  <p className="text-sm" style={{ color: isDraggingOver ? "#f87171" : "#64748b" }}>
                    {isDraggingOver ? "Release to load file" : "or click the button below to browse from your device"}
                  </p>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="select-btn text-white font-extrabold text-lg sm:text-xl px-10 sm:px-14 py-4 sm:py-5 rounded-2xl flex items-center gap-3 shadow-2xl"
                >
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                    <path d="M4 16.004V17a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M12 3v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M7.5 7.5L12 3l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Select PDF File
                </button>

                <div className="flex items-center gap-4 flex-wrap justify-center">
                  {["Any PDF", "100% Private", "No Login", "Instant Result"].map((tag) => (
                    <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

          </>
        )}

        {/* ── Loading Screen ─────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center min-h-96 gap-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}>
              <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-bold text-base" style={{ color: "#0f172a" }}>Loading PDF…</p>
              <p className="text-sm mt-1" style={{ color: "#64748b" }}>Generating page previews</p>
            </div>
            <div className="w-64 h-2 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%`, background: "linear-gradient(90deg, #ef4444, #f87171)" }}
              />
            </div>
          </div>
        )}

        {/* ── Editor Screen ──────────────────────────────────────────────── */}
        {isEditorMode && (
          <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
            {/* Top bar */}
            <div
              className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)", borderColor: "#e2e8f0" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0" style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white" opacity="0.95" />
                  <polyline points="14 2 14 8 20 8" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" fill="none" />
                  <path d="M9 11l6 6M15 11l-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "#0f172a" }}>{pdfFile!.name}</p>
                <p className="text-xs" style={{ color: "#64748b" }}>{pageCount} pages · {fmtSize(pdfFile!.size)}</p>
              </div>

              {/* Quick-select buttons */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold mr-1" style={{ color: "#94a3b8" }}>Select:</span>
                <button
                  onClick={handleMarkAll}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{ color: "#dc2626", borderColor: "#fecaca", border: "1px solid", background: "linear-gradient(135deg, #fff5f5, #fee2e2)" }}
                >
                  All
                </button>
                <button
                  onClick={handleMarkNone}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
                  style={{ color: "#475569", borderColor: "#dbe5f4", background: "linear-gradient(180deg, #ffffff, #f8fafc)" }}
                >
                  None
                </button>
                <button
                  onClick={handleInvert}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
                  style={{ color: "#0f766e", borderColor: "#99f6e4", background: "linear-gradient(135deg, #f0fdfa, #ccfbf1)" }}
                >
                  Invert
                </button>
              </div>

              {/* Status */}
              {markedIds.size > 0 && (
                <div
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca" }}
                >
                  {markedIds.size} marked · {remainingCount} remaining
                </div>
              )}

              <button
                onClick={reset}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ml-1"
                style={{ background: "#f1f5f9" }}
                aria-label="Load a new file"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Page grid */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {markedIds.size > 0 && (
                <div
                  className="mb-4 px-4 py-2.5 rounded-xl flex items-center gap-2"
                  style={{
                    background: markedIds.size >= pageCount ? "#fff1f2" : "#f0fdf4",
                    border: `1px solid ${markedIds.size >= pageCount ? "#fecaca" : "#bbf7d0"}`,
                  }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                    {markedIds.size >= pageCount ? (
                      <>
                        <circle cx="12" cy="12" r="10" stroke="#dc2626" strokeWidth="2" />
                        <path d="M12 8v4M12 16h.01" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" />
                      </>
                    ) : (
                      <>
                        <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="2" />
                        <path d="M8 12l3 3 5-5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    )}
                  </svg>
                  <p className="text-xs font-medium" style={{ color: markedIds.size >= pageCount ? "#dc2626" : "#15803d" }}>
                    {markedIds.size >= pageCount
                      ? "Cannot remove all pages — keep at least 1"
                      : `${remainingCount} page${remainingCount !== 1 ? "s" : ""} will remain in the output PDF`}
                  </p>
                </div>
              )}

              {markedIds.size === 0 && (
                <p className="text-sm font-medium mb-4" style={{ color: "#94a3b8" }}>
                  Click on a page thumbnail to mark it for removal (it will turn red)
                </p>
              )}

              {/* Grid  */}
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}
              >
                {pages.map((page) => {
                  const isMarked = markedIds.has(page.id);
                  return (
                    <div
                      key={page.id}
                      onClick={() => handleToggle(page.id)}
                      style={{
                        borderRadius: 12,
                        border: `2px solid ${isMarked ? "#f87171" : "#e2e8f0"}`,
                        background: isMarked ? "#fff5f5" : "#ffffff",
                        boxShadow: isMarked
                          ? "0 0 0 2px #fecaca, 0 6px 18px rgba(220,38,38,0.2)"
                          : "0 2px 6px rgba(15,23,42,0.06)",
                        cursor: "pointer",
                        overflow: "hidden",
                        transition: "all 0.15s ease",
                        padding: "7px",
                        position: "relative",
                        userSelect: "none",
                      }}
                    >
                      {/* Thumbnail */}
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "0.707",
                          borderRadius: 8,
                          overflow: "hidden",
                          background: "linear-gradient(160deg, #f8fafc, #eef2ff)",
                          position: "relative",
                        }}
                      >
                        {page.thumbnail ? (
                          <img
                            src={page.thumbnail}
                            alt={`Page ${page.index + 1}`}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              objectPosition: "center",
                              display: "block",
                              opacity: isMarked ? 0.3 : 1,
                              transition: "opacity 0.15s ease",
                            }}
                          />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#6366f1" opacity="0.4" />
                              <polyline points="14 2 14 8 20 8" stroke="#6366f1" strokeWidth="1.5" fill="none" opacity="0.5" />
                            </svg>
                          </div>
                        )}

                        {/* Red overlay + ✕ */}
                        {isMarked && (
                          <div style={{ position: "absolute", inset: 0, background: "rgba(220,38,38,0.25)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
                            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(220,38,38,0.5)" }}>
                              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                                <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Page label */}
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          fontWeight: 800,
                          lineHeight: 1,
                          textAlign: "center",
                          color: isMarked ? "#dc2626" : "#5b6a84",
                        }}
                      >
                        Page {page.index + 1}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Sticky Bottom Action Bar ──────────────────────────────── */}
            <div
              className="flex-shrink-0 px-6 py-2 border-t"
              style={{
                background: "rgba(255,255,255,0.98)",
                borderColor: "#e2e8f0",
                boxShadow: "0 -3px 16px rgba(15,23,42,0.06)",
              }}
            >
              <div className="flex items-center gap-4">
                {/* Stats on left */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: "#fff1f2", border: "1px solid #fecaca" }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-base font-extrabold" style={{ color: "#dc2626" }}>
                      {markedIds.size} to remove
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#16a34a" strokeWidth="2" />
                      <polyline points="14 2 14 8 20 8" stroke="#16a34a" strokeWidth="1.5" fill="none" />
                    </svg>
                    <span className="text-base font-extrabold" style={{ color: "#16a34a" }}>
                      {remainingCount} will remain
                    </span>
                  </div>
                </div>

                {/* Range input in center */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0 max-w-xl mx-auto">
                  <p className="text-xs font-extrabold whitespace-nowrap shrink-0" style={{ color: "#dc2626" }}>
                    Pages to remove:
                  </p>
                  <div
                    className="flex items-center flex-1 gap-1.5 px-3 py-1 rounded-xl"
                    style={{
                      background: "linear-gradient(120deg, #fff1f2 0%, #fce7f3 100%)",
                      border: "1.5px solid #fca5a5",
                      boxShadow: "0 2px 10px rgba(220,38,38,0.13)"
                    }}
                  >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" className="shrink-0">
                      <path d="M4 6h16M4 10h10M4 14h7M4 18h5" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round"/>
                    </svg>
                    <input
                      type="text"
                      value={rangeInput}
                      onChange={(e) => handleRangeInputChange(e.target.value)}
                      placeholder="e.g. 1, 2, 3-5"
                      className="flex-1 h-7 px-1.5 text-xs outline-none bg-transparent font-semibold"
                      style={{ color: "#1e293b" }}
                    />
                  </div>
                </div>

                {/* Remove button on right */}
                <button
                  onClick={removePagesAndDownload}
                  disabled={removing || !canRemove}
                  className="flex items-center gap-2 px-10 py-4 rounded-xl text-white font-extrabold text-base transition-all active:scale-95"
                  style={{
                    background: removing || !canRemove
                      ? "#94a3b8"
                      : "linear-gradient(135deg, #ef4444, #dc2626)",
                    boxShadow: removing || !canRemove
                      ? "none"
                      : "0 4px 14px rgba(220,38,38,0.36)",
                    minWidth: 290,
                    justifyContent: "center",
                  }}
                >
                  {removing ? (
                    <>
                      <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Processing…
                    </>
                  ) : markedIds.size === 0 ? (
                    "Select pages to remove"
                  ) : markedIds.size >= pageCount ? (
                    "Keep at least 1 page"
                  ) : (
                    <>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 11v6M14 11v6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Remove {markedIds.size} Page{markedIds.size !== 1 ? "s" : ""} &amp; Download
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
