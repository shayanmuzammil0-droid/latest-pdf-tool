import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type CompressionLevel = "extreme" | "recommended" | "less";

interface CompressToast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface CompressFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  thumbnail: string;
  arrayBuffer: ArrayBuffer;
}

interface CompressionResult {
  url: string;
  name: string;
  size: number;
  originalSize: number;
  fileCount: number;
}

interface CompressPDFBaseProps {
  isMobile: boolean;
  onUploadScreenChange?: (isUploadScreen: boolean) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getPdfBaseName = (name: string) => name.replace(/\.pdf$/i, "") || "document";

const clonePdfBytes = (buffer: ArrayBuffer): Uint8Array => new Uint8Array(buffer.slice(0));

const duplicateBytes = (bytes: Uint8Array): Uint8Array => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
};

const COMPRESSION_OPTIONS: Array<{
  id: CompressionLevel;
  title: string;
  subtitle: string;
  detail: string;
  accent: string;
  bg: string;
  border: string;
  passes: number;
}> = [
  {
    id: "extreme",
    title: "Extreme Compression",
    subtitle: "Less quality, high compression",
    detail: "Most aggressive non-rasterizing cleanup. Best chance to reduce extra PDF overhead while keeping text and page content readable.",
    accent: "#dc2626",
    bg: "#fff1f2",
    border: "#fecaca",
    passes: 3,
  },
  {
    id: "recommended",
    title: "Recommended Compression",
    subtitle: "Good quality, good compression",
    detail: "Balanced PDF optimization pass that preserves original page content and removes common structural waste.",
    accent: "#4f46e5",
    bg: "#eef2ff",
    border: "#c7d2fe",
    passes: 2,
  },
  {
    id: "less",
    title: "Less compression",
    subtitle: "High quality, less compression",
    detail: "Light structural cleanup with the safest optimization path for already-efficient PDFs.",
    accent: "#0d9488",
    bg: "#f0fdfa",
    border: "#99f6e4",
    passes: 1,
  },
];

async function renderFirstPageThumb(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<string> {
  try {
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 0.62 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d")!;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    page.cleanup();
    return canvas.toDataURL("image/jpeg", 0.88);
  } catch {
    return "";
  }
}

async function rebuildPdfLossless(bytes: Uint8Array): Promise<Uint8Array> {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, source.getPageIndices());
  pages.forEach((page) => output.addPage(page));
  return new Uint8Array(await output.save({ useObjectStreams: true, objectsPerTick: 50 }));
}

function FilePreviewCard({ item }: { item: CompressFileItem }) {
  return (
    <div className="file-card-premium" style={{ cursor: "default" }}>
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="order-badge" style={{ width: 26, height: 26, fontSize: 10 }}>{item.pageCount}p</span>
        <span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: "#eef2ff", color: "#4f46e5" }}>
          PDF
        </span>
      </div>
      <div className="thumbnail-container mx-3 mb-2 rounded-xl overflow-hidden" style={{ height: 156 }}>
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={`Preview of ${item.name}`} className="w-full h-full object-cover object-top" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #eef2ff, #ede9fe)" }}>
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#6366f1" opacity="0.6"/>
              <polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="1.5" fill="none"/>
              <text x="7" y="17" fontSize="4.5" fill="white" fontWeight="800">PDF</text>
            </svg>
          </div>
        )}
        <div className="page-badge">{item.pageCount} pages</div>
      </div>
      <div className="px-3 pb-3">
        <p className="text-xs font-semibold truncate leading-tight mb-1" style={{ color: "#1e293b" }} title={item.name}>
          {item.name.replace(/\.pdf$/i, "")}
        </p>
        <p className="text-xs" style={{ color: "#94a3b8" }}>{fmtSize(item.size)}</p>
      </div>
    </div>
  );
}

export default function CompressPDFBase({ isMobile, onUploadScreenChange }: CompressPDFBaseProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadSessionRef = useRef(0);

  const [items, setItems] = useState<CompressFileItem[]>([]);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>("recommended");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionStage, setCompressionStage] = useState("Preparing documents");
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [toasts, setToasts] = useState<CompressToast[]>([]);

  const selectedOption = COMPRESSION_OPTIONS.find((option) => option.id === compressionLevel) ?? COMPRESSION_OPTIONS[1];
  const totalPages = useMemo(() => items.reduce((sum, item) => sum + item.pageCount, 0), [items]);
  const totalOriginalSize = useMemo(() => items.reduce((sum, item) => sum + item.size, 0), [items]);
  const percentSaved = result && result.originalSize > 0
    ? Math.max(0, Math.round((1 - result.size / result.originalSize) * 100))
    : 0;
  const bytesSaved = result ? Math.max(0, result.originalSize - result.size) : 0;
  const isEditorVisible = items.length > 0 && !loading;

  useEffect(() => {
    onUploadScreenChange?.(!isEditorVisible);
  }, [isEditorVisible, onUploadScreenChange]);

  useEffect(() => () => {
    if (result?.url) URL.revokeObjectURL(result.url);
  }, [result]);

  const addToast = useCallback((message: string, type: CompressToast["type"] = "info") => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000);
  }, []);

  const clearResult = useCallback(() => {
    setResult((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  const reset = useCallback(() => {
    loadSessionRef.current = Date.now();
    setItems([]);
    setCompressionLevel("recommended");
    setLoading(false);
    setLoadingProgress(0);
    setCompressing(false);
    setCompressionProgress(0);
    setCompressionStage("Preparing documents");
    clearResult();
  }, [clearResult]);

  const loadFiles = useCallback(async (incoming: File[]) => {
    const pdfs = incoming.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    const rejected = incoming.length - pdfs.length;

    if (rejected > 0) addToast(`${rejected} non-PDF file(s) skipped.`, "error");
    if (pdfs.length === 0) return;

    const sessionId = Date.now();
    loadSessionRef.current = sessionId;
    setLoading(true);
    setLoadingProgress(8);
    clearResult();

    try {
      const loadedItems: CompressFileItem[] = [];

      for (let index = 0; index < pdfs.length; index++) {
        const file = pdfs[index];
        const sourceBuffer = await file.arrayBuffer();
        const storedBuffer = sourceBuffer.slice(0);
        const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(sourceBuffer.slice(0)) }).promise;
        const thumbnail = await renderFirstPageThumb(pdfDoc);

        if (loadSessionRef.current !== sessionId) return;

        loadedItems.push({
          id: uid(),
          file,
          name: file.name,
          size: file.size,
          pageCount: pdfDoc.numPages,
          thumbnail,
          arrayBuffer: storedBuffer,
        });

        setLoadingProgress(Math.round(((index + 1) / pdfs.length) * 100));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }

      setItems(loadedItems);
      addToast(`${loadedItems.length} PDF${loadedItems.length === 1 ? "" : "s"} ready for compression.`, "success");
    } catch (error) {
      console.error(error);
      addToast("Failed to load one or more PDFs. Some files may be encrypted or damaged.", "error");
    } finally {
      setLoading(false);
      setLoadingProgress(0);
    }
  }, [addToast, clearResult]);

  const onFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
    if (fileList.length > 0) loadFiles(fileList);
    event.currentTarget.value = "";
  }, [loadFiles]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDraggingOver(false);
    const fileList = Array.from(event.dataTransfer.files || []);
    if (fileList.length > 0) loadFiles(fileList);
  }, [loadFiles]);

  const compressOneFile = useCallback(async (item: CompressFileItem) => {
    const sourceBytes = clonePdfBytes(item.arrayBuffer);
    let bestBytes = duplicateBytes(sourceBytes);
    let currentBytes = duplicateBytes(sourceBytes);

    for (let pass = 0; pass < selectedOption.passes; pass++) {
      currentBytes = await rebuildPdfLossless(currentBytes);
      if (currentBytes.byteLength < bestBytes.byteLength) {
        bestBytes = duplicateBytes(currentBytes);
      }
    }

    return bestBytes.byteLength <= sourceBytes.byteLength ? bestBytes : sourceBytes;
  }, [selectedOption.passes]);

  const compressPdf = useCallback(async () => {
    if (items.length === 0) return;

    setCompressing(true);
    setCompressionProgress(6);
    setCompressionStage(items.length === 1 ? "Reading original PDF" : "Reading original PDFs");
    clearResult();

    try {
      const outputs: Array<{ name: string; bytes: Uint8Array }> = [];

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        setCompressionStage(`Compressing ${item.name}`);
        setCompressionProgress(Math.min(92, Math.round(((index + 0.25) / items.length) * 100)));
        const compressedBytes = await compressOneFile(item);
        outputs.push({
          name: `${getPdfBaseName(item.name)}-compressed.pdf`,
          bytes: compressedBytes,
        });
        setCompressionProgress(Math.min(94, Math.round(((index + 1) / items.length) * 100)));
      }

      let nextResult: CompressionResult;

      if (outputs.length === 1) {
        const only = outputs[0].bytes;
        const blobBytes = only.buffer.slice(only.byteOffset, only.byteOffset + only.byteLength) as ArrayBuffer;
        const blob = new Blob([blobBytes], { type: "application/pdf" });
        nextResult = {
          url: URL.createObjectURL(blob),
          name: outputs[0].name,
          size: blob.size,
          originalSize: totalOriginalSize,
          fileCount: 1,
        };
      } else {
        setCompressionStage("Bundling compressed PDFs");
        const zip = new JSZip();
        outputs.forEach((output) => {
          zip.file(output.name, output.bytes);
        });
        const zipBytes = await zip.generateAsync({ type: "uint8array" });
        const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer;
        const blob = new Blob([zipBuffer], { type: "application/zip" });
        nextResult = {
          url: URL.createObjectURL(blob),
          name: `compressed-pdfs-${Date.now()}.zip`,
          size: blob.size,
          originalSize: totalOriginalSize,
          fileCount: outputs.length,
        };
      }

      setCompressionProgress(100);
      setCompressionStage("Compression complete");
      setResult((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return nextResult;
      });

      if (nextResult.size < totalOriginalSize) {
        addToast(`Compression complete. Saved ${fmtSize(totalOriginalSize - nextResult.size)}.`, "success");
      } else {
        addToast("These PDFs are already tightly optimized. No further lossless savings were found.", "info");
      }
    } catch (error) {
      console.error(error);
      addToast("Compression failed. Try another PDF or a different preset.", "error");
    } finally {
      setCompressing(false);
    }
  }, [addToast, clearResult, compressOneFile, items, totalOriginalSize]);

  const downloadCompressed = useCallback(() => {
    if (!result) return;
    const anchor = document.createElement("a");
    anchor.href = result.url;
    anchor.download = result.name;
    anchor.click();
  }, [result]);

  const renderUpload = () => (
    <div className={isMobile ? "flex flex-col px-4 pt-6 pb-2" : "max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6"}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={onFileChange}
      />

      <div className="text-center mt-2 mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight mb-2" style={{ color: "#0f172a" }}>
          Compress PDF Files Online {" "}
          <span className="heading-gradient">Without Leaving the Browser</span>
        </h1>
        <p className="text-sm sm:text-base max-w-2xl mx-auto" style={{ color: "#64748b" }}>
          Compress one PDF or multiple PDFs at once. Keep the workflow quality-first and reduce file size with the same clean site theme.
        </p>
      </div>

      <div
        className={`upload-zone-premium rounded-3xl cursor-pointer select-none transition-all duration-300 ${isDraggingOver ? "upload-zone-active" : ""}`}
        style={{ padding: isMobile ? "44px 24px" : "52px 24px" }}
        onDrop={onDrop}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDraggingOver(false);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-5 text-center relative z-10">
          <div className="pdf-icon-stack relative" style={{ width: 80, height: 88 }}>
            <div className="abs-center" style={{ transform: "rotate(-12deg) translateX(-14px) translateY(4px)", zIndex: 1 }}>
              <div className="mini-pdf-card" style={{ background: "linear-gradient(145deg,#fca5a5,#ef4444)" }} />
            </div>
            <div className="abs-center" style={{ transform: "rotate(8deg) translateX(14px) translateY(6px)", zIndex: 2 }}>
              <div className="mini-pdf-card" style={{ background: "linear-gradient(145deg,#c4b5fd,#6366f1)" }} />
            </div>
            <div className="abs-center" style={{ zIndex: 3 }}>
              <div className="main-pdf-icon" style={{ background: "linear-gradient(145deg,#4f46e5,#7c3aed,#4338ca)" }}>
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white" opacity="0.95"/>
                  <polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="1.8" fill="none" opacity="0.6"/>
                  <path d="M9 11h6M9 15h4" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M17 18l3-3M20 15h-3v-3" stroke="#4f46e5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className="sparkle" style={{ top: 2, right: 4, animationDelay: "0s" }}>✦</div>
            <div className="sparkle" style={{ bottom: 8, left: 2, animationDelay: "0.7s" }}>✦</div>
          </div>

          <div>
            <p className="text-xl sm:text-2xl font-extrabold mb-1" style={{ color: isDraggingOver ? "#4f46e5" : "#0f172a" }}>
              {isDraggingOver ? "Drop your PDFs here!" : "Drag & Drop PDF Files Here"}
            </p>
            <p className="text-sm" style={{ color: isDraggingOver ? "#818cf8" : "#64748b" }}>
              {isDraggingOver ? "Release to load files" : "or click to browse multiple PDFs from your device"}
            </p>
          </div>

          <button
            onClick={(event) => {
              event.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="select-btn text-white font-extrabold text-lg sm:text-xl px-10 sm:px-14 py-4 sm:py-5 rounded-2xl flex items-center gap-3 shadow-2xl"
          >
            Select PDF Files
          </button>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            {["Multiple PDFs", "First-page previews", "Quality-first", "100% private"].map((tag) => (
              <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(79,70,229,0.08)", color: "#6366f1" }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Compression Setting</p>
        <h3 className="text-xl font-extrabold mt-1" style={{ color: "#0f172a" }}>Quality-first PDF compression</h3>
      </div>

      <div className="split-setting-summary text-sm">
        <span><strong>Files:</strong> {items.length}</span>
        <span><strong>Pages:</strong> {totalPages}</span>
        <span><strong>Original:</strong> {fmtSize(totalOriginalSize)}</span>
      </div>

      <div className="split-setting-content">
        <div className="range-settings-grid">
          {COMPRESSION_OPTIONS.map((option) => {
            const active = compressionLevel === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setCompressionLevel(option.id);
                  clearResult();
                }}
                className="text-left rounded-2xl p-4 transition-all"
                style={{
                  border: `1.5px solid ${active ? option.accent : option.border}`,
                  background: active ? option.bg : "#ffffff",
                  boxShadow: active ? `0 0 0 2px ${option.border}` : "0 1px 4px rgba(15,23,42,0.04)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold" style={{ color: active ? option.accent : "#0f172a" }}>{option.title}</p>
                    <p className="text-xs font-semibold mt-1" style={{ color: active ? option.accent : "#64748b" }}>{option.subtitle}</p>
                  </div>
                  <span
                    className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: active ? option.accent : option.border, background: active ? option.accent : "#fff" }}
                  >
                    {active && (
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </div>
                <p className="text-xs leading-relaxed mt-3" style={{ color: "#475569" }}>{option.detail}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed-warning" style={{ borderColor: "#c7d2fe", background: "#f8faff" }}>
        <p style={{ color: "#3730a3" }}>Focus: smallest possible file with preserved readability.</p>
        <p style={{ color: "#475569" }}>Compression rebuilds the PDF structure without rasterizing pages, so text and page rendering stay clear while redundant overhead is removed.</p>
      </div>

      {compressing && (
        <div className="range-editor-card">
          <div className="flex items-center justify-between gap-3">
            <span className="range-editor-title">{compressionStage}</span>
            <span className="text-xs font-bold" style={{ color: "#4f46e5" }}>{compressionProgress}%</span>
          </div>
          <div className="progress-track rounded-full overflow-hidden" style={{ height: 8 }}>
            <div className="progress-fill h-full rounded-full transition-all duration-300" style={{ width: `${compressionProgress}%` }} />
          </div>
        </div>
      )}

      {result && (
        <div className="range-editor-card" style={{ borderColor: percentSaved > 0 ? "#86efac" : "#cbd5e1", background: percentSaved > 0 ? "#f0fdf4" : "#f8fafc" }}>
          <div className="flex items-center justify-between gap-3">
            <span className="range-editor-title" style={{ color: percentSaved > 0 ? "#166534" : "#334155" }}>
              {percentSaved > 0 ? "Compressed files ready" : "No further lossless savings found"}
            </span>
            <span className="text-xs font-black px-2 py-1 rounded-full" style={{ background: percentSaved > 0 ? "#dcfce7" : "#e2e8f0", color: percentSaved > 0 ? "#166534" : "#475569" }}>
              {percentSaved > 0 ? `${percentSaved}% smaller` : "Already optimized"}
            </span>
          </div>
          <div className="text-xs leading-relaxed" style={{ color: percentSaved > 0 ? "#166534" : "#475569" }}>
            <p><strong>Files:</strong> {result.fileCount}</p>
            <p><strong>Original:</strong> {fmtSize(result.originalSize)}</p>
            <p><strong>Compressed:</strong> {fmtSize(result.size)}</p>
            <p><strong>Saved:</strong> {fmtSize(bytesSaved)}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="text-sm px-4 py-3 rounded-2xl font-semibold border transition-all hover:shadow"
        style={{ borderColor: "#e2e8f0", color: "#64748b", background: "#fff" }}
      >
        Add or Change PDFs
      </button>
    </div>
  );

  const renderLeftPanelHeader = () => (
    <>
      <div className="split-preview-header">
        <div>
          <p className="font-bold text-sm" style={{ color: "#0f172a" }}>{items.length} PDF{items.length === 1 ? "" : "s"} selected</p>
          <p className="text-xs" style={{ color: "#94a3b8" }}>{totalPages} pages total · {fmtSize(totalOriginalSize)}</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-xs px-3 py-1.5 rounded-xl font-semibold border transition-all hover:shadow"
          style={{ borderColor: "#c7d2fe", color: "#4f46e5", background: "#eef2ff" }}
        >
          Add PDFs
        </button>
      </div>

      <div className="mb-3 px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: "#eef2ff" }}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="#4f46e5" strokeWidth="2"/>
          <path d="M12 8v4M12 16h.01" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
        <p className="text-xs font-medium" style={{ color: "#4338ca" }}>
          Left side shows one first-page thumbnail card for each PDF. Compression starts from the button at the bottom of this section.
        </p>
      </div>
    </>
  );

  const renderLeftPanelFooter = () => (
    <div className="mt-5 pt-4 border-t" style={{ borderColor: "#e2e8f0" }}>
      {result ? (
        <div className="flex flex-col gap-3">
          <button onClick={downloadCompressed} className="download-btn text-white font-extrabold text-base px-8 py-4 rounded-2xl flex items-center justify-center gap-3">
            {result.fileCount === 1 ? "Download Compressed PDF" : "Download ZIP of Compressed PDFs"}
          </button>
          <button
            type="button"
            onClick={compressPdf}
            disabled={compressing}
            className="text-sm px-4 py-3 rounded-2xl font-semibold border transition-all hover:shadow"
            style={{ borderColor: "#c7d2fe", color: "#4f46e5", background: "#eef2ff" }}
          >
            Re-run Compression
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={compressPdf}
          disabled={compressing || items.length === 0}
          className="merge-btn text-white font-extrabold text-base sm:text-lg px-8 py-4 rounded-2xl flex items-center justify-center gap-3 w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        >
          {compressing
            ? `Compressing ${items.length} PDF${items.length === 1 ? "" : "s"}...`
            : `Compress ${items.length} PDF${items.length === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );

  const renderDesktopEditor = () => (
    <div className="split-editor-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={onFileChange}
      />
      <div className="split-workspace">
        <div className="split-preview-panel">
          {renderLeftPanelHeader()}
          <div className="file-grid">
            {items.map((item) => (
              <FilePreviewCard key={item.id} item={item} />
            ))}
          </div>
          {renderLeftPanelFooter()}
        </div>

        <aside className="split-settings-panel rounded-2xl">
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4 p-5 sm:p-6">
              {renderSettings()}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );

  const renderMobileEditor = () => (
    <div className="app-bg">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={onFileChange}
      />

      <div
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderColor: "#e2e8f0" }}
      >
        <div className="w-9 h-9 rounded-xl logo-icon flex items-center justify-center shadow-sm flex-shrink-0">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white" opacity="0.95"/>
            <polyline points="14 2 14 8 20 8" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" fill="none"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: "#0f172a" }}>{items.length} PDF{items.length === 1 ? "" : "s"} selected</p>
          <p className="text-xs" style={{ color: "#64748b" }}>{totalPages} pages · {fmtSize(totalOriginalSize)}</p>
        </div>
        <button
          onClick={reset}
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "#f1f5f9" }}
          aria-label="Close"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="px-4 pt-4 pb-6 flex flex-col gap-4">
        <div className="split-panel rounded-3xl p-4">
          {renderSettings()}
        </div>

        <div className="split-panel rounded-3xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: "#0f172a" }}>PDF thumbnail cards</p>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#eef2ff", color: "#4f46e5" }}>
              {items.length} file{items.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="file-grid">
            {items.map((item) => (
              <FilePreviewCard key={item.id} item={item} />
            ))}
          </div>
          {renderLeftPanelFooter()}
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-bg">
      <div className={isMobile ? "fixed top-4 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" : "fixed top-16 right-4 sm:right-6 z-50 flex flex-col gap-2 pointer-events-none"}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-pill pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold shadow-2xl text-white ${
              toast.type === "success" ? "bg-emerald-500" : toast.type === "error" ? "bg-rose-500" : "bg-indigo-500"
            }`}
          >
            <span className="text-base">{toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"}</span>
            {toast.message}
          </div>
        ))}
      </div>

      {items.length === 0 ? renderUpload() : loading ? (
        <div className={isMobile ? "flex flex-col items-center justify-center min-h-screen gap-5 px-8" : "split-panel mt-6 p-6 rounded-3xl text-center max-w-3xl mx-auto"}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#eef2ff" }}>
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#6366f1" strokeWidth="3" opacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="font-bold text-sm mb-3" style={{ color: "#0f172a" }}>Loading PDF files...</p>
          <div className="max-w-xs mx-auto w-full">
            <div className="progress-track rounded-full overflow-hidden" style={{ height: 6 }}>
              <div className="progress-fill h-full rounded-full transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
            </div>
            <p className="text-xs mt-1.5 text-center" style={{ color: "#94a3b8" }}>{loadingProgress}% complete</p>
          </div>
        </div>
      ) : (
        isMobile ? renderMobileEditor() : renderDesktopEditor()
      )}
    </div>
  );
}