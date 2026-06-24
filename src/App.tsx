import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import ToolSEOContent from "@/components/seo/ToolSEOContent";
import { ToolHero } from "@/components/seo/ToolHero";
import { ToolPageHeader } from "@/components/seo/ToolPageHeader";
import { getSeoForTool } from "@/lib/seo-config";
import { SITE_NAME, TOOL_LABELS, TOOL_ROUTES, type ToolId } from "@/lib/site";
import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import "./index.css";
import SplitPDF from "./pages/SplitPDF";
import SplitPDFMobile from "./pages/SplitPDFMobile";
import CompressPDFDesktop from "./pages/CompressPDFDesktop";
import CompressPDFMobile from "./pages/CompressPDFMobile";
import RemovePagesDesktop from "./pages/RemovePagesDesktop";
import RemovePagesMobile from "./pages/RemovePagesMobile";
import OrganizePDFDesktop from "./pages/OrganizePDFDesktop";
import OrganizePDFMobile from "./pages/OrganizePDFMobile";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent, DragOverEvent, DragCancelEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useIsMobile } from "./hooks/use-mobile";

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ─── Types ───────────────────────────────────────────────────────────────────
interface PDFFile {
  id: string;
  file: File;
  name: string;
  size: number;
  rotation: number;
  pages?: number;
  thumbnail?: string; // base64 data URL
  arrayBuffer?: ArrayBuffer;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};
const totalSize = (files: PDFFile[]) => files.reduce((a, f) => a + f.size, 0);

// Render first page of PDF to canvas → base64 thumbnail
async function renderThumbnail(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 0.6 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return "";
  }
}

// ─── Icons ───────────────────────────────────────────────────────────────────
const UploadIcon = () => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path d="M4 16.004V17a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 3v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M7.5 7.5L12 3l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MergeIcon = () => (
  <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
    <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 8l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
    <path d="M12 3v13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M7 11l5 5 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

const GripIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="9" cy="7" r="1.5" fill="currentColor"/>
    <circle cx="15" cy="7" r="1.5" fill="currentColor"/>
    <circle cx="9" cy="12" r="1.5" fill="currentColor"/>
    <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
    <circle cx="9" cy="17" r="1.5" fill="currentColor"/>
    <circle cx="15" cy="17" r="1.5" fill="currentColor"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.25"/>
    <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

const ShieldIcon = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ZapIcon = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
  </svg>
);

const FreeIcon = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// ─── Sortable Card ─────────────────────────────────────────────────────────────
interface SortableCardProps {
  file: PDFFile;
  index: number;
  onRemove: (id: string) => void;
  onRotate: (id: string) => void;
  isOver: boolean;
}

function SortableCard({ file: f, index, onRemove, onRotate, isOver }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: f.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`file-card-premium ${isDragging ? "card-dragging" : ""} ${!isDragging && isOver ? "card-drag-over card-drag-over-after" : ""}`}
      {...attributes}
      {...listeners}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="order-badge">{index + 1}</span>
        <div className="flex items-center gap-1.5">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRotate(f.id); }}
            className="rotate-btn"
            title="Rotate 90 degrees"
            aria-label="Rotate PDF 90 degrees"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 2v6h-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.49 15a9 9 0 1 1 .51-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
          <span
            className="drag-handle-chip"
            title="Drag to reorder this PDF"
            aria-label="Drag to reorder this PDF"
          >
            <span className="drag-handle-icon" aria-hidden="true">
              <GripIcon />
            </span>
            <span className="drag-handle-text">Reorder</span>
          </span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemove(f.id); }}
            className="remove-btn"
            title="Remove"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Thumbnail */}
      <div className="thumbnail-container mx-3 mb-2 rounded-xl overflow-hidden" style={{ height: 140 }}>
        {f.thumbnail ? (
          <img
            src={f.thumbnail}
            alt={`Preview of ${f.name}`}
            className="w-full h-full object-cover object-top"
            style={{ imageRendering: "auto", transform: `rotate(${f.rotation}deg)`, transition: "transform 0.2s ease" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #eef2ff, #ede9fe)", transform: `rotate(${f.rotation}deg)`, transition: "transform 0.2s ease" }}>
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#6366f1" opacity="0.6"/>
              <polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="1.5" fill="none"/>
              <text x="7" y="17" fontSize="4.5" fill="white" fontWeight="800">PDF</text>
            </svg>
          </div>
        )}
        {f.pages !== undefined && f.pages > 0 && (
          <div className="page-badge">{f.pages}p</div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 pb-3">
        <p className="text-xs font-semibold truncate leading-tight mb-1" style={{ color: "#1e293b" }} title={f.name}>
          {f.name.replace(/\.pdf$/i, "")}
        </p>
        <p className="text-xs" style={{ color: "#94a3b8" }}>{fmtSize(f.size)}</p>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
interface AppProps {
  initialTool?: ToolId;
}

export default function App({ initialTool = "merge" }: AppProps) {
  const activeTool = initialTool;
  const [isSplitUploadScreen, setIsSplitUploadScreen] = useState(true);
  const [isCompressUploadScreen, setIsCompressUploadScreen] = useState(true);
  const [isRemoveUploadScreen, setIsRemoveUploadScreen] = useState(true);
  const [isOrganizeUploadScreen, setIsOrganizeUploadScreen] = useState(true);
  const isMobile = useIsMobile();
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [merging, setMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [mergedSize, setMergedSize] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeToolLabel =
    activeTool === "merge"
      ? "Merge"
      : activeTool === "split"
        ? "Split"
        : activeTool === "compress"
          ? "Compress"
          : activeTool === "remove"
            ? "Remove"
            : "Organize";
  const [overId, setOverId] = useState<string | null>(null);
  const [isMainMergeVisible, setIsMainMergeVisible] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainMergeButtonRef = useRef<HTMLButtonElement>(null);
  const dragStartOrderRef = useRef<string[] | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 12 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addToast = (message: string, type: Toast["type"] = "info") => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };


  useEffect(() => {
    if (activeTool === "split") setIsSplitUploadScreen(true);
    if (activeTool === "compress") setIsCompressUploadScreen(true);
    if (activeTool === "remove") setIsRemoveUploadScreen(true);
    if (activeTool === "organize") setIsOrganizeUploadScreen(true);
  }, [activeTool]);


  const addFiles = useCallback(async (incoming: File[]) => {
    const pdfs = incoming.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    const rejected = incoming.length - pdfs.length;
    if (rejected > 0) addToast(`${rejected} non-PDF file(s) skipped.`, "error");
    if (pdfs.length === 0) return;

    setLoadingFiles(true);
    try {
      const newFiles = await Promise.all(
        pdfs.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          // Page count via pdf-lib
          let pages = 0;
          try {
            const pdfDoc = await PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
            pages = pdfDoc.getPageCount();
          } catch { /* ignore */ }
          // Thumbnail via PDF.js
          const thumbnail = await renderThumbnail(arrayBuffer.slice(0));
          return { id: uid(), file, name: file.name, size: file.size, rotation: 0, pages, thumbnail, arrayBuffer } as PDFFile;
        })
      );
      setFiles((prev) => [...prev, ...newFiles]);
      setMergedUrl(null);
      addToast(`${pdfs.length} file${pdfs.length > 1 ? "s" : ""} added successfully.`, "success");
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(true); };
  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingOver(false);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setMergedUrl(null);
  };

  const rotateFile = (id: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, rotation: (f.rotation + 90) % 360 } : f)));
    setMergedUrl(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setOverId(null);
    dragStartOrderRef.current = files.map((f) => f.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const activeIdValue = event.active.id as string;
    const overIdValue = (event.over?.id as string) ?? null;

    setOverId(overIdValue);

    if (!overIdValue || activeIdValue === overIdValue) return;

    setFiles((items) => {
      const oldIndex = items.findIndex((f) => f.id === activeIdValue);
      const newIndex = items.findIndex((f) => f.id === overIdValue);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    const startOrder = dragStartOrderRef.current;
    if (startOrder && startOrder.length > 0) {
      setFiles((items) => {
        const byId = new Map(items.map((item) => [item.id, item]));
        const restored = startOrder
          .map((id) => byId.get(id))
          .filter((item): item is PDFFile => Boolean(item));
        return restored.length === items.length ? restored : items;
      });
    }

    setActiveId(null);
    setOverId(null);
    dragStartOrderRef.current = null;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      const startOrder = dragStartOrderRef.current;
      if (startOrder && startOrder.length > 0) {
        setFiles((items) => {
          const byId = new Map(items.map((item) => [item.id, item]));
          const restored = startOrder
            .map((id) => byId.get(id))
            .filter((item): item is PDFFile => Boolean(item));
          return restored.length === items.length ? restored : items;
        });
      }
    }

    setActiveId(null);
    setOverId(null);
    dragStartOrderRef.current = null;

    if (over && active.id !== over.id) {
      setMergedUrl(null);
    }
  };

  const mergePDFs = async () => {
    if (files.length < 2) { addToast("Add at least 2 PDF files to merge.", "error"); return; }
    setMerging(true);
    setProgress(0);
    setMergedUrl(null);
    try {
      const merged = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        const src = await PDFDocument.load(files[i].arrayBuffer!.slice(0), { ignoreEncryption: true });
        const copied = await merged.copyPages(src, src.getPageIndices());
        copied.forEach((p) => {
          const baseAngle = p.getRotation().angle;
          p.setRotation(degrees((baseAngle + files[i].rotation) % 360));
          merged.addPage(p);
        });
        setProgress(Math.round(((i + 1) / files.length) * 100));
        await new Promise((r) => setTimeout(r, 20));
      }
      const bytes = await merged.save();
      const normalizedBytes = new Uint8Array(bytes);
      const blob = new Blob([normalizedBytes], { type: "application/pdf" });
      setMergedSize(blob.size);
      setMergedUrl(URL.createObjectURL(blob));
      addToast("Merge complete! Your PDF is ready to download.", "success");
    } catch (err) {
      console.error(err);
      addToast("Merge failed. Some PDFs may be encrypted.", "error");
    } finally {
      setMerging(false);
    }
  };

  const downloadMerged = () => {
    if (!mergedUrl) return;
    const a = document.createElement("a");
    a.href = mergedUrl;
    a.download = "merged-document.pdf";
    a.click();
  };

  const clearAll = () => { setFiles([]); setMergedUrl(null); setProgress(0); };

  useEffect(() => () => { if (mergedUrl) URL.revokeObjectURL(mergedUrl); }, [mergedUrl]);

  useEffect(() => {
    const target = mainMergeButtonRef.current;
    if (!target) {
      setIsMainMergeVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMainMergeVisible(entry.isIntersecting);
      },
      { threshold: 0.2 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [files.length, mergedUrl]);

  const activeFile = activeId ? files.find((f) => f.id === activeId) ?? null : null;

  const pageSeo = getSeoForTool(activeTool);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen app-bg overflow-x-hidden">
      <SEOHead
        page={pageSeo}
        toolName={TOOL_LABELS[activeTool]}
        breadcrumbs={[
          { name: SITE_NAME, path: "/" },
          { name: TOOL_LABELS[activeTool], path: TOOL_ROUTES[activeTool] },
        ]}
      />

      {/* ── Toasts ── */}
      <div className="fixed top-16 right-4 sm:right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-pill pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold shadow-2xl text-white max-w-xs ${
            t.type === "success" ? "bg-emerald-500" : t.type === "error" ? "bg-rose-500" : "bg-indigo-500"
          }`}>
            <span className="text-base">{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}</span>
            {t.message}
          </div>
        ))}
      </div>

      <ToolPageHeader tool={activeTool} />
      <ToolHero tool={activeTool} />

      {activeTool === "split" ? (
      <>
        {isMobile
          ? <SplitPDFMobile onUploadScreenChange={setIsSplitUploadScreen} />
          : <SplitPDF onUploadScreenChange={setIsSplitUploadScreen} />}
      </>
      ) : activeTool === "compress" ? (
      <>
        {isMobile
          ? <CompressPDFMobile onUploadScreenChange={setIsCompressUploadScreen} />
          : <CompressPDFDesktop onUploadScreenChange={setIsCompressUploadScreen} />}


      </>
      ) : activeTool === "remove" ? (
      <>
        {isMobile
          ? <RemovePagesMobile onUploadScreenChange={setIsRemoveUploadScreen} />
          : <RemovePagesDesktop onUploadScreenChange={setIsRemoveUploadScreen} />}
      </>
      ) : activeTool === "organize" ? (
      <>
        {isMobile
          ? <OrganizePDFMobile onUploadScreenChange={setIsOrganizeUploadScreen} />
          : <OrganizePDFDesktop onUploadScreenChange={setIsOrganizeUploadScreen} />}
      </>
      ) : (
      <>

      {/* ── HERO UPLOAD ZONE — first thing user sees ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-4">


        <div
          className={`upload-zone-premium rounded-3xl cursor-pointer select-none transition-all duration-300 ${isDraggingOver ? "upload-zone-active" : ""}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: files.length > 0 ? "28px 24px" : "52px 24px" }}
        >
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={onFileInputChange} />

          <div className="flex flex-col items-center gap-5 text-center">
            {/* 3D PDF icon stack */}
            <div className="pdf-icon-stack relative" style={{ width: 80, height: 88 }}>
              <div className="abs-center" style={{ transform: "rotate(-12deg) translateX(-14px) translateY(4px)", zIndex: 1 }}>
                <div className="mini-pdf-card" style={{ background: "linear-gradient(145deg,#a5b4fc,#818cf8)" }} />
              </div>
              <div className="abs-center" style={{ transform: "rotate(8deg) translateX(14px) translateY(6px)", zIndex: 2 }}>
                <div className="mini-pdf-card" style={{ background: "linear-gradient(145deg,#c4b5fd,#a78bfa)" }} />
              </div>
              <div className="abs-center" style={{ zIndex: 3 }}>
                <div className="main-pdf-icon" style={{ background: "linear-gradient(145deg,#6366f1,#4f46e5,#4338ca)" }}>
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white" opacity="0.95"/>
                    <polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="1.8" fill="none" opacity="0.6"/>
                    <text x="7.5" y="17" fontSize="4.5" fill="white" fontWeight="800" letterSpacing="0.5">PDF</text>
                  </svg>
                </div>
              </div>
              {/* Floating sparkles */}
              <div className="sparkle" style={{ top: 2, right: 4, animationDelay: "0s" }}>✦</div>
              <div className="sparkle" style={{ bottom: 8, left: 2, animationDelay: "0.7s" }}>✦</div>
            </div>

            {isDraggingOver ? (
              <div>
                <p className="text-xl font-extrabold mb-1" style={{ color: "#4f46e5" }}>Drop your PDFs here!</p>
                <p className="text-sm" style={{ color: "#818cf8" }}>Release to add files</p>
              </div>
            ) : (
              <div>
                <p className="text-xl sm:text-2xl font-extrabold mb-1" style={{ color: "#0f172a" }}>
                  {files.length > 0 ? "Upload More PDFs" : "Drag & Drop PDF Files Here"}
                </p>
                <p className="text-sm" style={{ color: "#64748b" }}>
                  {files.length > 0 ? "Or click to browse more files" : "or click the button below to browse files from your device"}
                </p>
              </div>
            )}

            {/* ── BIG VIBRANT SELECT BUTTON ── */}
            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="select-btn text-white font-extrabold text-lg sm:text-xl px-10 sm:px-14 py-4 sm:py-5 rounded-2xl flex items-center gap-3 shadow-2xl"
              disabled={loadingFiles}
            >
              {loadingFiles ? (
                <><SpinnerIcon /> Processing files...</>
              ) : (
                <><UploadIcon /> {files.length > 0 ? "Add More Files" : "Select PDF Files"}</>
              )}
            </button>

            <div className="flex items-center gap-4 flex-wrap justify-center">
              {["50+ files", "Any size", "Instant merge", "100% private"].map((tag) => (
                <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(79,70,229,0.08)", color: "#6366f1" }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ── FILE GRID ── */}
      {files.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-4">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="font-bold text-base" style={{ color: "#0f172a" }}>
                {files.length} File{files.length > 1 ? "s" : ""}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "#eef2ff", color: "#6366f1" }}>
                {fmtSize(totalSize(files))} total
              </span>
            </div>
            <button
              onClick={clearAll}
              className="text-xs px-3 py-1.5 rounded-xl font-semibold border transition-all hover:shadow"
              style={{ borderColor: "#fecaca", color: "#ef4444", background: "#fef2f2" }}
            >
              Clear All
            </button>
          </div>

          {files.length >= 2 && (
            <div className="mb-3 flex items-center justify-center sm:justify-start">
              <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>
                💡 Drag cards to reorder before merging
              </p>
            </div>
          )}

          {/* Grid */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={files.map((f) => f.id)} strategy={rectSortingStrategy}>
              <div className={`file-grid ${activeId ? "file-grid-dragging" : ""}`}>
                {files.map((f, idx) => (
                  <SortableCard
                    key={f.id}
                    file={f}
                    index={idx}
                    onRemove={removeFile}
                    onRotate={rotateFile}
                    isOver={!!activeId && overId === f.id && activeId !== f.id}
                  />
                ))}
                {/* Add More Card */}
                <div
                  className="add-more-card rounded-2xl flex flex-col items-center justify-center cursor-pointer gap-2 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#eef2ff" }}>
                    <PlusIcon />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: "#6366f1" }}>Add More</span>
                </div>
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeFile ? (
                <div className="file-card-premium file-card-drag-preview" style={{ width: "168px" }}>
                  <div className="flex items-center justify-between px-3 pt-3 pb-2">
                    <span className="order-badge">
                      {files.findIndex((f) => f.id === activeFile.id) + 1}
                    </span>
                    <span className="drag-handle-chip">
                      <span className="drag-handle-icon"><GripIcon /></span>
                      <span className="drag-handle-text">Reorder</span>
                    </span>
                  </div>
                  <div className="thumbnail-container mx-3 mb-2 rounded-xl overflow-hidden" style={{ height: 140 }}>
                    {activeFile.thumbnail ? (
                      <img
                        src={activeFile.thumbnail}
                        alt=""
                        className="w-full h-full object-cover object-top"
                        style={{ transform: `rotate(${activeFile.rotation}deg)` }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #eef2ff, #ede9fe)", transform: `rotate(${activeFile.rotation}deg)` }}>
                        <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#6366f1" opacity="0.6"/>
                          <polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="1.5" fill="none"/>
                          <text x="7" y="17" fontSize="4.5" fill="white" fontWeight="800">PDF</text>
                        </svg>
                      </div>
                    )}
                    {activeFile.pages !== undefined && activeFile.pages > 0 && (
                      <div className="page-badge">{activeFile.pages}p</div>
                    )}
                  </div>
                  <div className="px-3 pb-3">
                    <p className="text-xs font-semibold truncate leading-tight mb-1" style={{ color: "#1e293b" }}>
                      {activeFile.name.replace(/\.pdf$/i, "")}
                    </p>
                    <p className="text-xs" style={{ color: "#94a3b8" }}>{fmtSize(activeFile.size)}</p>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* ── MERGE PANEL ── */}
          <div className="merge-panel mt-5 p-5 rounded-2xl">
            {merging && (
              <div className="mb-4">
                <div className="flex justify-between text-xs font-medium mb-1.5" style={{ color: "#64748b" }}>
                  <span>Merging PDFs — processing in browser...</span>
                  <span className="font-bold" style={{ color: "#4f46e5" }}>{progress}%</span>
                </div>
                <div className="progress-track rounded-full overflow-hidden" style={{ height: 8 }}>
                  <div className="progress-fill h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              {!mergedUrl ? (
                <div className="w-full flex flex-col items-center gap-2 text-center">
                  <button
                    ref={mainMergeButtonRef}
                    onClick={mergePDFs}
                    disabled={merging || files.length < 2}
                    className="merge-btn main-merge-btn text-white font-extrabold text-lg sm:text-2xl px-9 sm:px-12 py-4.5 sm:py-5 rounded-2xl flex items-center justify-center gap-3 min-w-[300px] sm:min-w-[460px] disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                  >
                    {merging ? (
                      <><SpinnerIcon /> Merging {files.length} PDFs...</>
                    ) : (
                      <><MergeIcon /> Merge {files.length} PDF{files.length > 1 ? "s" : ""}</>
                    )}
                  </button>
                  {files.length < 2 && !merging && (
                    <p className="text-sm" style={{ color: "#94a3b8" }}>Add at least 2 PDFs to merge</p>
                  )}
                </div>
              ) : (
                <>
                  <button onClick={downloadMerged} className="download-btn text-white font-extrabold text-base sm:text-lg px-8 sm:px-12 py-4 rounded-2xl flex items-center gap-3">
                    <DownloadIcon /> Download Merged PDF
                  </button>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#16a34a" }}>✓ Ready to download</p>
                    <p className="text-xs" style={{ color: "#64748b" }}>{fmtSize(mergedSize)}</p>
                  </div>
                  <button
                    onClick={() => { setMergedUrl(null); setProgress(0); }}
                    className="text-sm px-4 py-2 rounded-xl border font-semibold transition-all hover:shadow"
                    style={{ borderColor: "#e2e8f0", color: "#64748b" }}
                  >
                    Merge Again
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {!mergedUrl && files.length >= 2 && !isMainMergeVisible && (
        <div className="fixed bottom-5 right-5 z-40 px-2 w-[min(72vw,20rem)]">
          <button
            onClick={mergePDFs}
            disabled={merging}
            className="merge-btn text-white font-extrabold text-sm sm:text-base px-5 sm:px-6 py-3.5 rounded-xl flex items-center justify-center gap-1.5 w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            {merging ? (
              <><SpinnerIcon /> Merging {files.length} PDFs...</>
            ) : (
              <><MergeIcon /> Merge {files.length} PDF{files.length > 1 ? "s" : ""}</>
            )}
          </button>
        </div>
      )}

      </>
      )}

      <ToolSEOContent tool={activeTool} />
      {/* ── Footer ── */}
      {!(activeTool === "split" && !isSplitUploadScreen) && !(activeTool === "compress" && !isCompressUploadScreen) && !(activeTool === "remove" && !isRemoveUploadScreen) && !(activeTool === "organize" && !isOrganizeUploadScreen) && <footer className="border-t py-8 mt-4" style={{ borderColor: "#e2e8f0", background: "#fff" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg logo-icon flex items-center justify-center shadow">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white"/></svg>
            </div>
            <span className="font-extrabold text-sm" style={{ color: "#0f172a" }}>{SITE_NAME}</span>
          </div>
          <p className="text-xs mb-3" style={{ color: "#94a3b8" }}>
            Free · No Login · No Ads · Browser-Based · Privacy-Safe · Works on All Devices
          </p>
          <nav className="flex flex-wrap justify-center gap-3 mb-4" aria-label="PDF tools">
            {(Object.keys(TOOL_ROUTES) as ToolId[]).map((tool) => (
              <Link key={tool} to={TOOL_ROUTES[tool]} className="text-xs font-semibold" style={{ color: "#4f46e5" }}>
                {TOOL_LABELS[tool]}
              </Link>
            ))}
            <Link to="/about" className="text-xs font-semibold" style={{ color: "#64748b" }}>
              About
            </Link>
          </nav>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            {["merge pdf online free", "split pdf no upload", "compress pdf free", "private pdf tools"].map((kw) => (
              <span key={kw} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#f8fafc", color: "#cbd5e1", border: "1px solid #f1f5f9" }}>{kw}</span>
            ))}
          </div>
          <p className="text-xs" style={{ color: "#e2e8f0" }}>
            © {new Date().getFullYear()} {SITE_NAME}. All processing done locally in your browser. Your files are never uploaded.
          </p>
        </div>
      </footer>}
    </div>
  );
}
