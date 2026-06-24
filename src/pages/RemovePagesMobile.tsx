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
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};

async function renderPageThumb(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number
): Promise<string> {
  try {
    const page = await pdfDoc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    page.cleanup();
    return canvas.toDataURL("image/jpeg", 0.65);
  } catch {
    return "";
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────
interface RemovePagesMobileProps {
  onUploadScreenChange?: (isUploadScreen: boolean) => void;
}

export default function RemovePagesMobile({ onUploadScreenChange }: RemovePagesMobileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadSessionRef = useRef(0);
  const inputChangedRef = useRef(false);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set()); // pages marked for removal
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [rangeInput, setRangeInput] = useState("");

  useEffect(() => {
    onUploadScreenChange?.(!pdfFile && !loading);
  }, [onUploadScreenChange, pdfFile, loading]);

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const loadPdf = useCallback(
    async (file: File) => {
      if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
        addToast("Please select a valid PDF file", "error");
        return;
      }
      const sessionId = Date.now();
      loadSessionRef.current = sessionId;
      try {
        setLoading(true);
        setLoadingProgress(10);
        const sourceBuffer = await file.arrayBuffer();
        setArrayBuffer(sourceBuffer.slice(0));
        setLoadingProgress(30);

        const doc = await pdfjsLib
          .getDocument({ data: new Uint8Array(sourceBuffer.slice(0)) })
          .promise;
        const count = doc.numPages;
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
        setLoadingProgress(100);
        setLoading(false);

        // Render thumbnails in batches
        const batchSize = 4;
        for (let start = 0; start < count; start += batchSize) {
          const batchIndexes = Array.from(
            { length: Math.min(batchSize, count - start) },
            (_, offset) => start + offset
          );
          const rendered = await Promise.all(
            batchIndexes.map(async (pageIndex) => ({
              pageIndex,
              thumbnail: await renderPageThumb(doc, pageIndex),
            }))
          );
          if (loadSessionRef.current !== sessionId) return;
          setPages((prev) => {
            const next = [...prev];
            rendered.forEach(({ pageIndex, thumbnail }) => {
              if (next[pageIndex]) next[pageIndex] = { ...next[pageIndex], thumbnail };
            });
            return next;
          });
          setLoadingProgress(
            Math.min(100, Math.round(55 + (Math.min(start + batchSize, count) / count) * 45))
          );
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
      } catch {
        addToast("Failed to load PDF", "error");
        setLoading(false);
      }
    },
    [addToast]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.currentTarget.files?.[0];
      if (file) loadPdf(file);
      e.target.value = "";
    },
    [loadPdf]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) loadPdf(file);
    },
    [loadPdf]
  );

  const handleToggleMark = useCallback((id: string) => {
    setMarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleMarkAll = useCallback(() => {
    setMarkedIds(new Set(pages.map((p) => p.id)));
  }, [pages]);

  const handleMarkNone = useCallback(() => {
    setMarkedIds(new Set());
  }, []);

  const handleInvert = useCallback(() => {
    const next = new Set<string>();
    pages.forEach((p) => {
      if (!markedIds.has(p.id)) next.add(p.id);
    });
    setMarkedIds(next);
  }, [pages, markedIds]);

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
    if (markedIds.size === 0) {
      addToast("Select at least one page to remove", "error");
      return;
    }
    if (markedIds.size >= pageCount) {
      addToast("Cannot remove all pages — keep at least one", "error");
      return;
    }
    setRemoving(true);
    try {
      const freshBuffer = await pdfFile.arrayBuffer();
      const sourceBytes = new Uint8Array(freshBuffer.byteLength > 0 ? freshBuffer : arrayBuffer);
      const srcDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });

      // Build set of original page indices to REMOVE
      const markedOriginalIndexes = new Set(
        pages.filter((p) => markedIds.has(p.id)).map((p) => p.index)
      );

      // Keep pages whose original index is NOT marked
      const keepIndexes = Array.from({ length: pageCount }, (_, i) => i).filter(
        (i) => !markedOriginalIndexes.has(i)
      );

      if (keepIndexes.length === 0) {
        addToast("Cannot remove all pages — keep at least one", "error");
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
        `Done! ${markedIds.size} page${markedIds.size !== 1 ? "s" : ""} removed`,
        "success"
      );
    } catch (err) {
      console.error(err);
      addToast("Failed to process PDF", "error");
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
    setRemoving(false);
    setRangeInput("");
  }, []);

  const remainingCount = pageCount - markedIds.size;
  const canRemove = markedIds.size > 0 && markedIds.size < pageCount;

  return (
    <div className="relative" style={{ minHeight: "calc(100dvh - 56px)", background: "#f8faff" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={onFileChange}
      />

      {/* ── Toasts ── */}
      <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 pointer-events-none" style={{ zIndex: 60 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold shadow-2xl text-white max-w-xs ${
              t.type === "success" ? "bg-emerald-500" : t.type === "error" ? "bg-rose-500" : "bg-indigo-500"
            }`}
          >
            <span>{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}</span>
            {t.message}
          </div>
        ))}
      </div>

      {!pdfFile ? (
        /* ── Upload Screen ─────────────────────────────────────────────────── */
        <div className="flex flex-col px-4 pt-6 pb-2">
          {/* Hero */}
          <div className="text-center mb-4">
            <h1 className="text-3xl font-extrabold mb-2" style={{ color: "#0f172a" }}>
              Remove <span className="heading-gradient">PDF Pages</span>
            </h1>
            <p className="text-sm" style={{ color: "#64748b" }}>
              Tap pages to mark them for removal, then download the cleaned PDF
            </p>
          </div>

          {/* Upload Zone */}
          <div
            className={`upload-zone-premium rounded-3xl cursor-pointer mb-5 ${isDraggingOver ? "upload-zone-active" : ""}`}
            style={{ padding: "44px 24px" }}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-4 text-center relative z-10">
              {/* Animated PDF icon */}
              <div style={{ position: "relative", width: 80, height: 88 }}>
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "rotate(-10deg) translateX(-18px) translateY(-18px)",
                    zIndex: 1,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 52,
                      borderRadius: 8,
                      background: "linear-gradient(145deg,#fca5a5,#f87171)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      opacity: 0.75,
                    }}
                  />
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translateX(-29px) translateY(-34px)",
                    zIndex: 3,
                  }}
                >
                  <div
                    style={{
                      width: 58,
                      height: 68,
                      borderRadius: 12,
                      background: "linear-gradient(145deg,#ef4444,#dc2626,#b91c1c)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 8px 24px rgba(220,38,38,0.4)",
                    }}
                  >
                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                      <path
                        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                        fill="white"
                        opacity="0.95"
                      />
                      <polyline
                        points="14 2 14 8 20 8"
                        stroke="white"
                        strokeWidth="1.8"
                        fill="none"
                        opacity="0.6"
                      />
                      <path
                        d="M9 10l6 6M15 10l-6 6"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <p
                  className="font-extrabold text-xl mb-1"
                  style={{ color: isDraggingOver ? "#dc2626" : "#0f172a" }}
                >
                  {isDraggingOver ? "Drop your PDF here!" : "Drag & Drop a PDF File Here"}
                </p>
                <p
                  className="text-sm"
                  style={{ color: isDraggingOver ? "#f87171" : "#64748b" }}
                >
                  {isDraggingOver
                    ? "Release to load file"
                    : "or click to browse from your device"}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="select-btn text-white font-extrabold text-lg px-10 py-4 rounded-2xl flex items-center gap-3 shadow-2xl"
              >
                Select PDF File
              </button>
            </div>
          </div>

          {/* 3-step guide */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              {
                n: "01",
                icon: (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M4 16V17a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M12 3v13M7.5 7.5L12 3l4.5 4.5"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                title: "Upload PDF",
                desc: "Select or drag your PDF file",
              },
              {
                n: "02",
                icon: (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="#ef4444" strokeWidth="2" />
                    <path d="M9 9l6 6M15 9l-6 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ),
                title: "Mark Pages",
                desc: "Tap pages you want to delete",
              },
              {
                n: "03",
                icon: (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M12 3v13M7 11l5 5 5-5"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                ),
                title: "Download",
                desc: "Get your PDF without those pages",
              },
            ].map((s) => (
              <div key={s.n} className="step-card p-3 rounded-xl text-center">
                <div className="text-xs font-black mb-2" style={{ color: "#ef4444" }}>
                  {s.n}
                </div>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2"
                  style={{ background: "#fff1f2" }}
                >
                  {s.icon}
                </div>
                <h3 className="font-bold text-xs mb-1" style={{ color: "#0f172a" }}>
                  {s.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-2 mt-1 mb-4">
            {[
              { label: "100% Private", bg: "#f0fdf4", color: "#16a34a" },
              { label: "No Login", bg: "#eff6ff", color: "#2563eb" },
              { label: "Free Forever", bg: "#fefce8", color: "#d97706" },
            ].map((b) => (
              <span
                key={b.label}
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ background: b.bg, color: b.color }}
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>
      ) : loading ? (
        /* ── Loading Screen ───────────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center min-h-screen gap-5 px-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
          >
            <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-bold text-base" style={{ color: "#0f172a" }}>
              Loading PDF…
            </p>
            <p className="text-sm mt-1" style={{ color: "#64748b" }}>
              Generating page previews
            </p>
          </div>
          <div
            className="w-52 h-2 rounded-full overflow-hidden"
            style={{ background: "#e2e8f0" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${loadingProgress}%`,
                background: "linear-gradient(90deg, #ef4444, #f87171)",
              }}
            />
          </div>
          <p className="text-xs font-semibold" style={{ color: "#94a3b8" }}>
            {loadingProgress}%
          </p>
        </div>
      ) : (
        /* ── Editor Screen ────────────────────────────────────────────────── */
        <div
          className="flex flex-col overflow-hidden"
          style={{ height: "calc(100dvh - 56px)" }}
        >
          {/* Top bar */}
          <div
            className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b"
            style={{
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(12px)",
              borderColor: "#e2e8f0",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                  fill="white"
                  opacity="0.95"
                />
                <polyline
                  points="14 2 14 8 20 8"
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth="1.8"
                  fill="none"
                />
                <path
                  d="M9 11l6 6M15 11l-6 6"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-bold truncate"
                style={{ color: "#0f172a" }}
              >
                {pdfFile.name}
              </p>
              <p className="text-xs" style={{ color: "#64748b" }}>
                {pageCount} pages · {fmtSize(pdfFile.size)}
              </p>
            </div>
            <button
              onClick={reset}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#f1f5f9" }}
              aria-label="Close and choose a new file"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="#64748b"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Page grid scroll area */}
          <div className="flex-1 px-4 pt-4 pb-4 overflow-y-auto">
            {/* Range input — slim compact row */}
            <div
              className="flex items-center gap-2 mb-3 px-3 rounded-xl"
              style={{
                background: "linear-gradient(120deg, #fff1f2 0%, #fce7f3 100%)",
                border: "1.5px solid #fca5a5",
                boxShadow: "0 2px 8px rgba(220,38,38,0.11)",
                height: "38px"
              }}
            >
              <span className="text-[11px] font-extrabold whitespace-nowrap shrink-0" style={{ color: "#dc2626" }}>
                Pages to remove:
              </span>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" className="shrink-0">
                <path d="M4 6h16M4 10h10M4 14h7M4 18h5" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={rangeInput}
                onChange={(e) => handleRangeInputChange(e.target.value)}
                placeholder="1-3, 7, 10-12"
                className="flex-1 text-sm outline-none bg-transparent font-medium"
                style={{ color: "#0f172a" }}
              />
            </div>

            {/* Status hint + quick-select */}
            <div className="flex items-center justify-between mb-3">
              <p
                className="text-xs font-semibold"
                style={{ color: markedIds.size > 0 ? "#dc2626" : "#64748b" }}
              >
                {markedIds.size > 0
                  ? `${markedIds.size} page${markedIds.size !== 1 ? "s" : ""} marked for removal`
                  : "Tap a page to mark it for removal"}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleMarkAll}
                  className="ms-quick-btn"
                  style={{
                    color: "#dc2626",
                    borderColor: "#fecaca",
                    background: "linear-gradient(135deg, #fff5f5, #fee2e2)",
                  }}
                >
                  All
                </button>
                <button onClick={handleMarkNone} className="ms-quick-btn ms-quick-btn--neutral">
                  None
                </button>
                <button onClick={handleInvert} className="ms-quick-btn ms-quick-btn--accent">
                  Invert
                </button>
              </div>
            </div>

            {/* Remaining pages info banner */}
            {markedIds.size > 0 && (
              <div
                className="mb-3 px-3 py-1.5 rounded-xl flex items-center gap-2"
                style={{
                  background: markedIds.size >= pageCount ? "#fff1f2" : "#f0fdf4",
                  borderLeft: `3px solid ${markedIds.size >= pageCount ? "#f87171" : "#4ade80"}`,
                }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                  {markedIds.size >= pageCount ? (
                    <>
                      <circle cx="12" cy="12" r="10" stroke="#dc2626" strokeWidth="2" />
                      <path
                        d="M12 8v4M12 16h.01"
                        stroke="#dc2626"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </>
                  ) : (
                    <>
                      <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="2" />
                      <path
                        d="M8 12l3 3 5-5"
                        stroke="#16a34a"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  )}
                </svg>
                <p
                  className="text-xs font-medium"
                  style={{
                    color: markedIds.size >= pageCount ? "#dc2626" : "#15803d",
                  }}
                >
                  {markedIds.size >= pageCount
                    ? "Cannot remove all pages — keep at least 1"
                    : `${remainingCount} page${remainingCount !== 1 ? "s" : ""} will remain in the PDF`}
                </p>
              </div>
            )}

            {/* Page cards grid */}
            <div className="grid grid-cols-3 gap-3">
              {pages.map((page) => {
                const isMarked = markedIds.has(page.id);
                return (
                  <div
                    key={page.id}
                    onClick={() => handleToggleMark(page.id)}
                    className="rp-page-card"
                    style={{
                      borderRadius: 12,
                      border: `2px solid ${isMarked ? "#f87171" : "#e2e8f0"}`,
                      background: isMarked ? "#fff5f5" : "#ffffff",
                      boxShadow: isMarked
                        ? "0 0 0 2px #fecaca, 0 4px 12px rgba(220,38,38,0.18)"
                        : "0 1px 3px rgba(15,23,42,0.06)",
                      cursor: "pointer",
                      overflow: "hidden",
                      transition: "all 0.15s ease",
                      padding: "6px",
                      position: "relative",
                      userSelect: "none",
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "0.7",
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
                            opacity: isMarked ? 0.35 : 1,
                            transition: "opacity 0.15s ease",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                            <path
                              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                              fill="#6366f1"
                              opacity="0.4"
                            />
                            <polyline
                              points="14 2 14 8 20 8"
                              stroke="#6366f1"
                              strokeWidth="1.5"
                              fill="none"
                              opacity="0.5"
                            />
                          </svg>
                        </div>
                      )}

                      {/* Red overlay + ✕ icon when marked */}
                      {isMarked && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(220,38,38,0.22)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 8,
                          }}
                        >
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: "50%",
                              background: "#dc2626",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 2px 8px rgba(220,38,38,0.5)",
                            }}
                          >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                              <path
                                d="M18 6L6 18M6 6l12 12"
                                stroke="white"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Page number label */}
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 10,
                        fontWeight: 800,
                        lineHeight: 1,
                        textAlign: "center",
                        color: isMarked ? "#dc2626" : "#5b6a84",
                      }}
                    >
                      {page.index + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Bottom Action Sheet ──────────────────────────────────────── */}
          <div className="ms-bottom-sheet">
            {/* Stats row */}
            {markedIds.size > 0 && (
              <div className="flex items-center justify-around px-4 pt-2.5 pb-1">
                <div className="text-center">
                  <p className="text-xs font-semibold" style={{ color: "#94a3b8" }}>
                    Removing
                  </p>
                  <p className="text-base font-extrabold" style={{ color: "#dc2626" }}>
                    {markedIds.size}
                  </p>
                </div>
                <div style={{ width: 1, height: 28, background: "#e2e8f0" }} />
                <div className="text-center">
                  <p className="text-xs font-semibold" style={{ color: "#94a3b8" }}>
                    Remaining
                  </p>
                  <p className="text-base font-extrabold" style={{ color: "#0f172a" }}>
                    {remainingCount}
                  </p>
                </div>
                <div style={{ width: 1, height: 28, background: "#e2e8f0" }} />
                <div className="text-center">
                  <p className="text-xs font-semibold" style={{ color: "#94a3b8" }}>
                    Total
                  </p>
                  <p className="text-base font-extrabold" style={{ color: "#64748b" }}>
                    {pageCount}
                  </p>
                </div>
              </div>
            )}

            {/* Action button */}
            <div
              className="px-3.5 pt-1.5"
              style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
            >
              <button
                onClick={removePagesAndDownload}
                disabled={removing || !canRemove}
                className="w-full py-3 rounded-xl text-white font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
                style={{
                  background:
                    removing || !canRemove
                      ? "#94a3b8"
                      : "linear-gradient(135deg, #ef4444, #dc2626)",
                  boxShadow:
                    removing || !canRemove
                      ? "none"
                      : "0 3px 12px rgba(220,38,38,0.32)",
                }}
              >
                {removing ? (
                  <>
                    <svg
                      className="animate-spin"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="3"
                      />
                      <path
                        d="M12 2a10 10 0 0 1 10 10"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                    Processing…
                  </>
                ) : markedIds.size === 0 ? (
                  "Tap pages to select for removal"
                ) : markedIds.size >= pageCount ? (
                  "Keep at least 1 page"
                ) : (
                  <>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                      <path
                        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 11v6M14 11v6"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
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
  );
}
