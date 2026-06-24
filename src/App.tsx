import { useState, useRef, useCallback, useEffect } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import "./index.css";
import SplitPDF from "./pages/SplitPDF";
import SplitPDFMobile from "./pages/SplitPDFMobile";
import CompressPDFDesktop from "./pages/CompressPDFDesktop";
import CompressPDFMobile from "./pages/CompressPDFMobile";
import CompressPDFLanding from "./pages/CompressPDFLanding";
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
export default function App() {
  const [activeTool, setActiveTool] = useState<"merge" | "split" | "compress" | "remove" | "organize">("merge");
  const [isSplitUploadScreen, setIsSplitUploadScreen] = useState(true);
  const [isCompressUploadScreen, setIsCompressUploadScreen] = useState(true);
  const [isRemoveUploadScreen, setIsRemoveUploadScreen] = useState(true);
  const [isOrganizeUploadScreen, setIsOrganizeUploadScreen] = useState(true);
  const isMobile = useIsMobile();
  const [isMobileToolMenuOpen, setIsMobileToolMenuOpen] = useState(false);
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

  useEffect(() => {
    if (!isMobile) setIsMobileToolMenuOpen(false);
  }, [isMobile]);

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

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen app-bg overflow-x-hidden">

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

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 header-glass border-b" style={{ borderColor: "rgba(226,232,240,0.8)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl logo-icon flex items-center justify-center shadow-md">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white" opacity="0.95"/>
                <polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="1.8" fill="none" opacity="0.7"/>
                <path d="M9 13h6M9 16h4" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.8"/>
              </svg>
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight" style={{ color: "#0f172a" }}>PDF</span>
                <span className="font-extrabold text-base tracking-tight heading-gradient">{activeToolLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMobile ? (
              <button
                onClick={() => setIsMobileToolMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold"
                style={{ background: "#f8fafc", borderColor: "#e2e8f0", color: "#334155" }}
                aria-expanded={isMobileToolMenuOpen}
                aria-label="Open tool menu"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                Tools
              </button>
            ) : (
              <>
                <div className="tool-nav-tabs flex items-center gap-1 p-1 rounded-xl" style={{ background: "#f1f5f9" }}>
                  <button
                    onClick={() => setActiveTool("merge")}
                    className={`tool-nav-tab flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${activeTool === "merge" ? "active" : ""}`}
                  >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                      <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Merge PDF
                  </button>
                  <button
                    onClick={() => setActiveTool("split")}
                    className={`tool-nav-tab flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${activeTool === "split" ? "active" : ""}`}
                  >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="2"/>
                      <circle cx="6" cy="18" r="2.5" stroke="currentColor" strokeWidth="2"/>
                      <path d="M19 4L8.5 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M13.5 13.5L19 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M8.5 8.5L11.5 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Split PDF
                  </button>
                  <button
                    onClick={() => setActiveTool("compress")}
                    className={`tool-nav-tab flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${activeTool === "compress" ? "active" : ""}`}
                  >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 3v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16 14l-4 4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 10v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Compress PDF
                  </button>
                  <button
                    onClick={() => setActiveTool("remove")}
                    className={`tool-nav-tab flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${activeTool === "remove" ? "active" : ""}`}
                  >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                      <path d="M9 3h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 11v5M14 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Remove Pages
                  </button>
                  <button
                    onClick={() => setActiveTool("organize")}
                    className={`tool-nav-tab flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${activeTool === "organize" ? "active" : ""}`}
                  >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    Organize PDF
                  </button>
                </div>
                <div className="trust-badge hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "#f0fdf4", color: "#16a34a", border: "1.5px solid #bbf7d0" }}>
                  <ShieldIcon /> Private
                </div>
                <div className="trust-badge hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "#eff6ff", color: "#2563eb", border: "1.5px solid #bfdbfe" }}>
                  <ZapIcon /> No Login
                </div>
                <div className="trust-badge hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "#fefce8", color: "#d97706", border: "1.5px solid #fde68a" }}>
                  <FreeIcon /> Free
                </div>
              </>
            )}
          </div>
        </div>

        {isMobile && isMobileToolMenuOpen && (
          <div className="max-w-5xl mx-auto px-4 pb-3">
            <div className="rounded-2xl border p-2 shadow-lg" style={{ background: "rgba(255,255,255,0.98)", borderColor: "#e2e8f0" }}>
              {([
                ["merge", "Merge PDF"],
                ["split", "Split PDF"],
                ["compress", "Compress PDF"],
                ["remove", "Remove Pages"],
                ["organize", "Organize PDF"],
              ] as const).map(([tool, label]) => (
                <button
                  key={tool}
                  onClick={() => {
                    setActiveTool(tool);
                    setIsMobileToolMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-bold"
                  style={{ background: activeTool === tool ? "#f0fdfa" : "transparent", color: activeTool === tool ? "#0f766e" : "#334155" }}
                >
                  <span>{label}</span>
                  {activeTool === tool && (
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {activeTool === "split" ? (
      <>
        {isMobile
          ? <SplitPDFMobile onUploadScreenChange={setIsSplitUploadScreen} />
          : <SplitPDF onUploadScreenChange={setIsSplitUploadScreen} />}

        {isSplitUploadScreen && <section className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 pb-6">

          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center" style={{ color: "#0f172a" }}>
              How to <span className="heading-gradient">Split PDF Files Online</span>
            </h2>
            <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>Done in 4 steps — quick and easy</p>
            <div className="grid sm:grid-cols-4 gap-4">
              {[
                { n: "01", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 16V17a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/><path d="M12 3v13M7.5 7.5L12 3l4.5 4.5" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "Upload PDF", desc: "Select your PDF file or drag and drop it into the upload box." },
                { n: "02", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Pick Split Mode", desc: "Choose Extract, Split All, or By Range depending on your need." },
                { n: "03", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" stroke="#4f46e5" strokeWidth="2"/><path d="M12 7v10M8.5 10.5 12 7l3.5 3.5M8.5 13.5 12 17l3.5-3.5" stroke="#4f46e5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "Arrange & Select", desc: "Drag thumbnails to reorder and select pages or type custom ranges." },
                { n: "04", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 3v13M7 11l5 5 5-5" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Download Files", desc: "Download your split PDFs instantly as files or ZIP, with no login." },
              ].map((s) => (
                <div key={s.n} className="step-card p-5 rounded-2xl text-center">
                  <div className="text-xs font-black mb-3 tracking-widest heading-gradient">{s.n}</div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "#eef2ff" }}>{s.icon}</div>
                  <h3 className="font-bold text-sm mb-1.5" style={{ color: "#0f172a" }}>{s.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 text-center" style={{ color: "#0f172a" }}>
              Why Our <span className="heading-gradient">PDF Split Tool</span> Is Different
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#4f46e5" strokeWidth="2"/><path d="M8 12h8M12 8v8" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/></svg>), title: "100% Free Forever", desc: "Split PDFs without limits, subscriptions, or hidden premium walls.", color: "#eef2ff" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" stroke="#16a34a" strokeWidth="2"/><path d="M2 21v-2a4 4 0 0 1 4-4h6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/><path d="M16 21l2 2 4-4" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "No Login Required", desc: "Open the page and split right away. No account, no email, no wait.", color: "#f0fdf4" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "100% Private", desc: "Everything runs in your browser, so your files never leave your device.", color: "#eff6ff" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="#d97706" strokeWidth="2" strokeLinejoin="round"/></svg>), title: "Fast Client-Side Splitting", desc: "Extract pages and ranges instantly with efficient local processing.", color: "#fefce8" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" stroke="#7c3aed" strokeWidth="2"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Visual Page Thumbnails", desc: "Preview every page before splitting so you always extract exactly what you need.", color: "#f5f3ff" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" stroke="#0891b2" strokeWidth="2"/><path d="M8 12h8M12 8v8" stroke="#0891b2" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Flexible Split Modes", desc: "Split all pages, extract selected pages, or split by exact custom ranges.", color: "#ecfeff" },
              ].map((f) => (
                <div key={f.title} className="feature-card p-5 rounded-2xl border flex gap-4" style={{ background: "#fff", borderColor: "#f1f5f9" }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: f.color }}>{f.svg}</div>
                  <div>
                    <h3 className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>{f.title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-16 benefits-block p-8 sm:p-10 rounded-3xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center" style={{ color: "#0f172a" }}>
              Benefits of <span className="heading-gradient">Browser‑Based PDF Splitting</span>
            </h2>
            <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>No software. No server. No friction.</p>
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {[
                "Split large PDFs in seconds with smooth in-browser performance",
                "Extract only the pages you need from any document",
                "No installation or app download required",
                "Works on desktop, tablet, and mobile browsers",
                "Supports page reordering before split operations",
                "Your files remain private and local on your device",
              ].map((b) => (
                <div key={b} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "white" }}>✓</span>
                  <span className="text-sm leading-relaxed" style={{ color: "#334155" }}>{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 text-center" style={{ color: "#0f172a" }}>
              Frequently Asked <span className="heading-gradient">Questions</span>
            </h2>
            <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
              {[
                { q: "Is this PDF split tool completely free?", a: "Yes, it's fully free. You can split PDFs as many times as you want without paying." },
                { q: "Do I need to sign up to split PDF files?", a: "No signup is required. Just upload your file and split instantly." },
                { q: "Can I split by page range?", a: "Yes. You can type ranges like 1-3, 6, 9-12 and extract exactly those pages." },
                { q: "Can I reorder pages before splitting?", a: "Yes. Drag and drop page cards to set your order before extracting or splitting." },
                { q: "Are my PDF files uploaded to a server?", a: "No. Processing is done locally in your browser for maximum privacy." },
                { q: "Does it work on mobile devices?", a: "Yes. The split editor is optimized for mobile with touch-friendly page controls." },
              ].map((item) => (
                <details key={item.q} className="faq-item border rounded-2xl overflow-hidden" style={{ borderColor: "#e2e8f0", background: "#fff" }}>
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-semibold text-sm" style={{ color: "#0f172a" }}>
                    {item.q}
                    <svg className="faq-arrow shrink-0 ml-3" width="18" height="18" fill="none" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </summary>
                  <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: "#64748b" }}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-extrabold mb-6 text-center" style={{ color: "#0f172a" }}>
              More <span className="heading-gradient">PDF Tools</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { svg: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M8 5h8M8 12h8M8 19h8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/><path d="M5 8l3-3 3 3M19 16l-3 3-3-3" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), name: "PDF Merge", desc: "Combine files quickly" },
                { svg: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#6366f1" strokeWidth="2"/></svg>), name: "PDF Compress", desc: "Reduce file size", live: true, tool: "compress" as const },
                { svg: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#6366f1" strokeWidth="2"/><path d="M9 13h6M9 17h4" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/></svg>), name: "PDF to Word", desc: "Convert to editable doc" },
                { svg: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#6366f1" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" stroke="#6366f1" strokeWidth="1.5"/><path d="M21 15l-5-5L5 21" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), name: "PDF to JPG", desc: "Export as images" },
              ].map((tool) => (
                <div key={tool.name} className="tool-card p-4 rounded-2xl text-center cursor-pointer" onClick={"tool" in tool && tool.tool ? () => setActiveTool(tool.tool) : undefined}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2.5" style={{ background: "#eef2ff" }}>{tool.svg}</div>
                  <p className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>{tool.name}</p>
                  <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>{tool.desc}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "live" in tool && tool.live ? "#f0fdf4" : "#eef2ff", color: "live" in tool && tool.live ? "#16a34a" : "#818cf8", border: "live" in tool && tool.live ? "1px solid #bbf7d0" : undefined }}>{"live" in tool && tool.live ? "Live" : "Coming soon"}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="seo-article-block p-8 sm:p-10 rounded-3xl mb-8">
            <h2 className="text-xl sm:text-2xl font-extrabold mb-4" style={{ color: "#0f172a" }}>
              The Best Free PDF Split Tool Online
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: "#475569" }}>
              <p>
                Need a fast way to <strong style={{ color: "#0f172a" }}>split PDF files online free</strong>? This tool lets you split full documents, extract selected pages, or use custom page ranges in seconds.
              </p>
              <p>
                Unlike many tools, our <strong style={{ color: "#0f172a" }}>PDF splitter without login</strong> works instantly and keeps the experience clean with visual page thumbnails and drag-to-reorder controls.
              </p>
              <p>
                All processing happens locally in your browser, making it a <strong style={{ color: "#0f172a" }}>secure browser-based PDF splitter</strong> that keeps your documents private.
              </p>
              <p>
                <strong style={{ color: "#0f172a" }}>SEO description:</strong> Split PDF files online for free with page preview, range selection, and secure browser-based processing. No login, no upload, instant results.
              </p>
              <p className="font-semibold" style={{ color: "#4f46e5" }}>
                Ready to split your PDF? Scroll up, choose a mode, and download instantly.
              </p>
            </div>
          </div>
        </section>}
      </>
      ) : activeTool === "compress" ? (
      <>
        {isMobile
          ? <CompressPDFMobile onUploadScreenChange={setIsCompressUploadScreen} />
          : <CompressPDFDesktop onUploadScreenChange={setIsCompressUploadScreen} />}

        {isCompressUploadScreen && <CompressPDFLanding onSelectTool={setActiveTool} />}
      </>
      ) : activeTool === "remove" ? (
      <>
        {isMobile
          ? <RemovePagesMobile onUploadScreenChange={setIsRemoveUploadScreen} />
          : <RemovePagesDesktop onUploadScreenChange={setIsRemoveUploadScreen} />}

        {isRemoveUploadScreen && <section className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 pb-6">

          {/* How it works */}
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center" style={{ color: "#0f172a" }}>
              How to <span className="heading-gradient">Remove PDF Pages</span> Online
            </h2>
            <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>Done in 3 steps — quick and easy</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { n: "01", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 16V17a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/><path d="M12 3v13M7.5 7.5L12 3l4.5 4.5" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "Upload Your PDF", desc: "Click 'Select PDF File' or drag and drop your PDF into the upload box." },
                { n: "02", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#ef4444" strokeWidth="2"/><path d="M9 9l6 6M15 9l-6 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Select Pages to Remove", desc: "Click page thumbnails to mark them, or type a range like 1-3, 7, 10-12." },
                { n: "03", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 3v13M7 11l5 5 5-5" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Download the Result", desc: "Hit 'Remove Pages' and your cleaned PDF downloads instantly. No login." },
              ].map((s) => (
                <div key={s.n} className="step-card p-5 rounded-2xl text-center">
                  <div className="text-xs font-black mb-3 tracking-widest heading-gradient">{s.n}</div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "#fff1f2" }}>{s.icon}</div>
                  <h3 className="font-bold text-sm mb-1.5" style={{ color: "#0f172a" }}>{s.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Why Different */}
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 text-center" style={{ color: "#0f172a" }}>
              Why Our <span className="heading-gradient">PDF Pages Remover Tool</span> Is Different
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/><path d="M8 12h8M12 8v8" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/></svg>), title: "100% Free Forever", desc: "Remove PDF pages without limits, subscriptions, or hidden premium walls.", color: "#fff1f2" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" stroke="#16a34a" strokeWidth="2"/><path d="M2 21v-2a4 4 0 0 1 4-4h6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/><path d="M16 21l2 2 4-4" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "No Login Required", desc: "Open the page and remove pages right away. No account, no email, no wait.", color: "#f0fdf4" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "100% Private", desc: "Everything runs in your browser — your files never leave your device.", color: "#eff6ff" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="#d97706" strokeWidth="2" strokeLinejoin="round"/></svg>), title: "Instant Processing", desc: "Pages are removed and the PDF is rebuilt instantly with no server wait.", color: "#fefce8" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" stroke="#7c3aed" strokeWidth="2"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Visual Page Thumbnails", desc: "See every page preview before removing so you never delete the wrong page.", color: "#f5f3ff" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" stroke="#0891b2" strokeWidth="2"/><path d="M9 8h6M9 12h6M9 16h3" stroke="#0891b2" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Click or Type Range", desc: "Select pages by clicking thumbnails or by typing ranges like 1-5, 7, 9-11.", color: "#ecfeff" },
              ].map((f) => (
                <div key={f.title} className="feature-card p-5 rounded-2xl border flex gap-4" style={{ background: "#fff", borderColor: "#f1f5f9" }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: f.color }}>{f.svg}</div>
                  <div>
                    <h3 className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>{f.title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div className="mb-16 benefits-block p-8 sm:p-10 rounded-3xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center" style={{ color: "#0f172a" }}>
              Benefits of <span className="heading-gradient">Browser‑Based PDF Pages Removers</span>
            </h2>
            <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>No software. No server. No friction.</p>
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {[
                "Delete unwanted pages from any PDF in seconds",
                "No software download or installation required",
                "Files never leave your device — maximum privacy",
                "Works on Windows, Mac, iOS, Android, and Linux",
                "Remove one page, many pages, or entire ranges",
                "No watermarks or quality loss in the output PDF",
              ].map((b) => (
                <div key={b} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "white" }}>✓</span>
                  <span className="text-sm leading-relaxed" style={{ color: "#334155" }}>{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 text-center" style={{ color: "#0f172a" }}>
              Frequently Asked <span className="heading-gradient">Questions</span>
            </h2>
            <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
              {[
                { q: "Is this PDF pages remover completely free?", a: "Yes, it's fully free. You can remove pages from PDFs as many times as you want without paying anything." },
                { q: "Do I need to sign up to remove PDF pages?", a: "No signup is required. Just upload your file and remove pages instantly — no account or email needed." },
                { q: "Can I remove multiple pages at once?", a: "Yes. Click multiple thumbnails to mark them, or type a range like 1-3, 6, 9-12 to select exactly the pages you want to delete." },
                { q: "Are my PDF files uploaded to a server?", a: "No. Processing is done entirely within your browser. Your files are never sent to any server, keeping them 100% private." },
                { q: "Will the output PDF lose quality?", a: "No. Pages are copied directly from the original PDF structure without re-encoding, so text, images, and formatting remain identical." },
                { q: "Does it work on mobile devices?", a: "Yes. The tool is fully optimized for mobile with touch-friendly page thumbnails and works on iOS and Android browsers." },
              ].map((item) => (
                <details key={item.q} className="faq-item border rounded-2xl overflow-hidden" style={{ borderColor: "#e2e8f0", background: "#fff" }}>
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-semibold text-sm" style={{ color: "#0f172a" }}>
                    {item.q}
                    <svg className="faq-arrow shrink-0 ml-3" width="18" height="18" fill="none" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </summary>
                  <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: "#64748b" }}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>

          {/* More PDF Tools */}
          <div className="mb-16">
            <h2 className="text-2xl font-extrabold mb-6 text-center" style={{ color: "#0f172a" }}>
              More <span className="heading-gradient">PDF Tools</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div
                className="tool-card p-4 rounded-2xl text-center cursor-pointer"
                onClick={() => setActiveTool("merge")}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2.5" style={{ background: "#eef2ff" }}>
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M8 5h8M8 12h8M8 19h8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/><path d="M5 8l3-3 3 3M19 16l-3 3-3-3" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>PDF Merge</p>
                <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>Combine files quickly</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>Live</span>
              </div>
              <div
                className="tool-card p-4 rounded-2xl text-center cursor-pointer"
                onClick={() => setActiveTool("split")}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2.5" style={{ background: "#eef2ff" }}>
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M6 3h12M6 21h12M8 12h8M12 8v8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <p className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>PDF Split</p>
                <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>Split into multiple files</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>Live</span>
              </div>
              {[
                { svg: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#6366f1" strokeWidth="2"/></svg>), name: "PDF Compress", desc: "Reduce file size", live: true, tool: "compress" as const },
                { svg: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#6366f1" strokeWidth="2"/><path d="M9 13h6M9 17h4" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/></svg>), name: "PDF to Word", desc: "Convert to editable doc" },
              ].map((tool) => (
                <div key={tool.name} className="tool-card p-4 rounded-2xl text-center cursor-pointer" onClick={"tool" in tool && tool.tool ? () => setActiveTool(tool.tool) : undefined}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2.5" style={{ background: "#eef2ff" }}>{tool.svg}</div>
                  <p className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>{tool.name}</p>
                  <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>{tool.desc}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "live" in tool && tool.live ? "#f0fdf4" : "#eef2ff", color: "live" in tool && tool.live ? "#16a34a" : "#818cf8", border: "live" in tool && tool.live ? "1px solid #bbf7d0" : undefined }}>{"live" in tool && tool.live ? "Live" : "Coming soon"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SEO Article Block */}
          <div className="seo-article-block p-8 sm:p-10 rounded-3xl mb-8">
            <h2 className="text-xl sm:text-2xl font-extrabold mb-4" style={{ color: "#0f172a" }}>
              The Best Free PDF Pages Remover Tool Online
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: "#475569" }}>
              <p>
                Need a fast, free way to <strong style={{ color: "#0f172a" }}>remove pages from a PDF online</strong>? This tool lets you delete any page, multiple pages, or a full range of pages from any PDF — instantly and with no login required.
              </p>
              <p>
                Unlike many tools, our <strong style={{ color: "#0f172a" }}>PDF page remover without login</strong> works instantly and keeps the experience clean with live visual page thumbnails, so you always see exactly what you're deleting before you download.
              </p>
              <p>
                All processing happens locally in your browser using JavaScript, making it a <strong style={{ color: "#0f172a" }}>secure browser-based PDF pages remover</strong> that keeps your documents completely private — no file is ever sent to a server.
              </p>
              <p>
                Whether you're trimming blank pages, removing confidential content, or cleaning up a scanned document, this tool handles it in seconds on any device — desktop, tablet, or mobile.
              </p>
              <p className="font-semibold" style={{ color: "#ef4444" }}>
                Ready to remove pages? Scroll up, upload your PDF, and download your clean file instantly.
              </p>
            </div>
          </div>
        </section>}
      </>
      ) : activeTool === "organize" ? (
      <>
        {isMobile
          ? <OrganizePDFMobile onUploadScreenChange={setIsOrganizeUploadScreen} />
          : <OrganizePDFDesktop onUploadScreenChange={setIsOrganizeUploadScreen} />}

        {isOrganizeUploadScreen && <section className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 pb-6">

          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center" style={{ color: "#0f172a" }}>
              How to <span className="heading-gradient">Organize PDF Pages</span> Online
            </h2>
            <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>Done in 3 steps — quick and easy</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { n: "01", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 16V17a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" stroke="#0d9488" strokeWidth="2" strokeLinecap="round"/><path d="M12 3v13M7.5 7.5L12 3l4.5 4.5" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "Upload Your PDF", desc: "Select your PDF or drag it into the upload box to load all pages instantly." },
                { n: "02", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#0d9488" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#0d9488" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#0d9488" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#0d9488" strokeWidth="2"/></svg>), title: "Drag Pages Into Order", desc: "Move thumbnails around until the page sequence matches exactly what you want in the final PDF." },
                { n: "03", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 3v13M7 11l5 5 5-5" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" stroke="#0d9488" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Download Organized PDF", desc: "Click save and your reordered PDF downloads instantly with the new page sequence preserved." },
              ].map((s) => (
                <div key={s.n} className="step-card p-5 rounded-2xl text-center">
                  <div className="text-xs font-black mb-3 tracking-widest heading-gradient">{s.n}</div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "#f0fdfa" }}>{s.icon}</div>
                  <h3 className="font-bold text-sm mb-1.5" style={{ color: "#0f172a" }}>{s.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 text-center" style={{ color: "#0f172a" }}>
              Why This <span className="heading-gradient">PDF Organizer</span> Is Different
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#0d9488" strokeWidth="2" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "100% Private", desc: "All processing runs locally in your browser. Your PDF never gets uploaded to a server.", color: "#f0fdfa" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M4 12h16M12 4l8 8-8 8" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "Visual Reordering", desc: "See real page thumbnails before you move them so the output order is always clear.", color: "#ecfeff" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M8 8h8M8 12h8M8 16h8" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/><path d="M5 8h.01M5 12h.01M5 16h.01" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round"/></svg>), title: "Exact Order Control", desc: "Drag pages into any sequence you need for reports, contracts, handouts, or presentations.", color: "#f0fdf4" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="#d97706" strokeWidth="2" strokeLinejoin="round"/></svg>), title: "Fast In-Browser Processing", desc: "No waiting for uploads or server queues. Reorder and save immediately.", color: "#fefce8" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" stroke="#7c3aed" strokeWidth="2"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Live Page Previews", desc: "Each page is rendered as a preview card so you can organize visually instead of guessing from page numbers.", color: "#f5f3ff" },
                { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#2563eb" strokeWidth="2"/><path d="M12 8v8M8 12h8" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Free and No Login", desc: "Open the page, upload the file, organize it, and download. No account, no email, no subscription.", color: "#eff6ff" },
              ].map((f) => (
                <div key={f.title} className="feature-card p-5 rounded-2xl border flex gap-4" style={{ background: "#fff", borderColor: "#f1f5f9" }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: f.color }}>{f.svg}</div>
                  <div>
                    <h3 className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>{f.title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-16 benefits-block p-8 sm:p-10 rounded-3xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center" style={{ color: "#0f172a" }}>
              Benefits of <span className="heading-gradient">Organizing PDF Pages</span>
            </h2>
            <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>Simple page management without desktop software</p>
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {[
                "Put reports and proposals into the correct reading order",
                "Rearrange scanned documents after importing or combining files",
                "Prepare presentation decks and printable packets faster",
                "Work entirely in the browser with no installation required",
                "Keep sensitive documents local for maximum privacy",
                "Save a clean reordered PDF with no watermark added",
              ].map((b) => (
                <div key={b} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)", color: "white" }}>✓</span>
                  <span className="text-sm leading-relaxed" style={{ color: "#334155" }}>{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 text-center" style={{ color: "#0f172a" }}>
              Frequently Asked <span className="heading-gradient">Questions</span>
            </h2>
            <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
              {[
                { q: "Can I reorder pages in any sequence I want?", a: "Yes. Drag the page thumbnails into any order you want. The downloaded PDF will follow that same exact sequence." },
                { q: "Is this Organize PDF tool free?", a: "Yes. It is free to use with no login requirement, no subscription, and no watermark on the output file." },
                { q: "Are my files uploaded to a server?", a: "No. The tool works directly in your browser and keeps the PDF on your device during processing." },
                { q: "Does it work on mobile devices?", a: "Yes. On mobile you can use a touch-friendly drag-and-drop layout to reorder pages and save the organized PDF." },
                { q: "Will page quality change after saving?", a: "No. The pages are copied directly from the original PDF structure and reordered without recompressing the content." },
                { q: "Can I go back to the original order?", a: "Yes. Both desktop and mobile include a Reset Order action that restores the original sequence from the uploaded PDF." },
              ].map((item) => (
                <details key={item.q} className="faq-item border rounded-2xl overflow-hidden" style={{ borderColor: "#e2e8f0", background: "#fff" }}>
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-semibold text-sm" style={{ color: "#0f172a" }}>
                    {item.q}
                    <svg className="faq-arrow shrink-0 ml-3" width="18" height="18" fill="none" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" stroke="#0d9488" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </summary>
                  <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: "#64748b" }}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-extrabold mb-6 text-center" style={{ color: "#0f172a" }}>
              More <span className="heading-gradient">PDF Tools</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="tool-card p-4 rounded-2xl text-center cursor-pointer" onClick={() => setActiveTool("merge")}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2.5" style={{ background: "#eef2ff" }}>
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M8 5h8M8 12h8M8 19h8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/><path d="M5 8l3-3 3 3M19 16l-3 3-3-3" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>PDF Merge</p>
                <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>Combine files quickly</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>Live</span>
              </div>
              <div className="tool-card p-4 rounded-2xl text-center cursor-pointer" onClick={() => setActiveTool("split")}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2.5" style={{ background: "#eef2ff" }}>
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M6 3h12M6 21h12M8 12h8M12 8v8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <p className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>PDF Split</p>
                <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>Split into multiple files</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>Live</span>
              </div>
              <div className="tool-card p-4 rounded-2xl text-center cursor-pointer" onClick={() => setActiveTool("remove")}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2.5" style={{ background: "#fff1f2" }}>
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M9 3h6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/><path d="M4 7h16" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/><path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>Remove Pages</p>
                <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>Delete unwanted pages</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>Live</span>
              </div>
              <div className="tool-card p-4 rounded-2xl text-center cursor-pointer" onClick={() => setActiveTool("compress")}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2.5" style={{ background: "#eef2ff" }}>
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#6366f1" strokeWidth="2"/></svg>
                </div>
                <p className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>PDF Compress</p>
                <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>Reduce file size</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>Live</span>
              </div>
            </div>
          </div>

          <div className="seo-article-block p-8 sm:p-10 rounded-3xl mb-8">
            <h2 className="text-xl sm:text-2xl font-extrabold mb-4" style={{ color: "#0f172a" }}>
              The Best Free Organize PDF Tool Online
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: "#475569" }}>
              <p>
                Need a simple way to <strong style={{ color: "#0f172a" }}>rearrange pages in a PDF online</strong>? This tool lets you upload any PDF, drag pages into the correct order, and download the organized result in seconds.
              </p>
              <p>
                Unlike many PDF tools that rely on server uploads, our <strong style={{ color: "#0f172a" }}>browser-based PDF organizer</strong> keeps every file on your device. That makes it fast, private, and practical for contracts, internal reports, and sensitive documents.
              </p>
              <p>
                Live page previews make reordering much easier than working from page numbers alone. You see each page visually, drag it where it belongs, and save the output when everything looks right.
              </p>
              <p>
                Whether you need to fix the sequence of scanned pages, prepare a report before sharing it, or reorder a combined document after merging files, this <strong style={{ color: "#0f172a" }}>free Organize PDF tool</strong> gives you a fast, clean workflow on desktop and mobile.
              </p>
              <p className="font-semibold" style={{ color: "#0d9488" }}>
                Ready to organize your PDF? Scroll up, upload your file, drag pages into place, and download the final version instantly.
              </p>
            </div>
          </div>
        </section>}
      </>
      ) : (
      <>

      {/* ── HERO UPLOAD ZONE — first thing user sees ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-4">

        {/* Hero subtitle — above upload */}
        {files.length === 0 && (
          <div className="text-center mt-2 mb-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight mb-2" style={{ color: "#0f172a" }}>
              Merge PDF Files Online —{" "}
              <span className="heading-gradient">Free &amp; No Login Required</span>
            </h1>
            <p className="text-sm sm:text-base max-w-xl mx-auto" style={{ color: "#64748b" }}>
              Combine multiple PDFs into one in seconds. 100% browser‑based, zero uploads, completely private.
            </p>
          </div>
        )}

        {/* Upload Zone */}
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

      {/* ── SEO CONTENT SECTIONS ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 mt-20 pb-6">

        {/* How it works */}
        <div className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center" style={{ color: "#0f172a" }}>
            How to <span className="heading-gradient">Merge PDF Files</span> Online
          </h2>
          <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>Done in 4 steps — takes under 10 seconds</p>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { n: "01", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 16V17a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/><path d="M12 3v13M7.5 7.5L12 3l4.5 4.5" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "Upload PDFs", desc: "Click 'Select PDF Files' or drag & drop your PDF documents directly." },
              { n: "02", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "Set the Order", desc: "Drag file cards to arrange them in the exact order you want." },
              { n: "03", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#4f46e5" strokeWidth="2"/><path d="M8 12h8M12 8l4 4-4 4" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "Click Merge", desc: "Hit the Merge button. Processing happens instantly in your browser." },
              { n: "04", icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 3v13M7 11l5 5 5-5" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/></svg>), title: "Download", desc: "Your merged PDF downloads instantly. No email or account needed." },
            ].map((s) => (
              <div key={s.n} className="step-card p-5 rounded-2xl text-center">
                <div className="text-xs font-black mb-3 tracking-widest heading-gradient">{s.n}</div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "#eef2ff" }}>{s.icon}</div>
                <h3 className="font-bold text-sm mb-1.5" style={{ color: "#0f172a" }}>{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 text-center" style={{ color: "#0f172a" }}>
            Why Our <span className="heading-gradient">PDF Merge Tool</span> Is Different
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#4f46e5" strokeWidth="2"/><path d="M8 12h8M12 8v8" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/></svg>), title: "100% Free Forever", desc: "No hidden costs, no premium plans, no credit card. Full access at zero cost.", color: "#eef2ff" },
              { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" stroke="#16a34a" strokeWidth="2"/><path d="M2 21v-2a4 4 0 0 1 4-4h6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/><path d="M16 21l2 2 4-4" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "No Login Required", desc: "Start merging instantly — no signup, no email, no account needed.", color: "#f0fdf4" },
              { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), title: "100% Private", desc: "Files stay on your device. Nothing is ever uploaded to any server.", color: "#eff6ff" },
              { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="#d97706" strokeWidth="2" strokeLinejoin="round"/></svg>), title: "Blazing Fast", desc: "Powered by pdf-lib for instant client-side merging with zero server latency.", color: "#fefce8" },
              { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" stroke="#7c3aed" strokeWidth="2"/><path d="M9 10h6M9 14h4" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/></svg>), title: "PDF Thumbnails", desc: "See actual first-page previews of every uploaded PDF before merging.", color: "#f5f3ff" },
              { svg: (<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" stroke="#0891b2" strokeWidth="2"/><path d="M9 7h6M9 11h6M9 15h4" stroke="#0891b2" strokeWidth="2" strokeLinecap="round"/><path d="M17 17l2.5 2.5" stroke="#0891b2" strokeWidth="2" strokeLinecap="round"/></svg>), title: "50+ Files at Once", desc: "Merge large batches of PDFs without any performance degradation.", color: "#ecfeff" },
            ].map((f) => (
              <div key={f.title} className="feature-card p-5 rounded-2xl border flex gap-4" style={{ background: "#fff", borderColor: "#f1f5f9" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: f.color }}>{f.svg}</div>
                <div>
                  <h3 className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>{f.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits gradient block */}
        <div className="mb-16 benefits-block p-8 sm:p-10 rounded-3xl">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center" style={{ color: "#0f172a" }}>
            Benefits of <span className="heading-gradient">Browser‑Based PDF Merging</span>
          </h2>
          <p className="text-center text-sm mb-8" style={{ color: "#64748b" }}>No software. No server. No stress.</p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {[
              "Merge PDFs in under 10 seconds — start to finish",
              "No software download or installation required",
              "Files never leave your device — maximum privacy",
              "Works on Windows, Mac, iOS, Android, and Linux",
              "No ads, no pop-ups, no distractions whatsoever",
              "Works offline once the page has loaded",
            ].map((b) => (
              <div key={b} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "white" }}>✓</span>
                <span className="text-sm leading-relaxed" style={{ color: "#334155" }}>{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 text-center" style={{ color: "#0f172a" }}>
            Frequently Asked <span className="heading-gradient">Questions</span>
          </h2>
          <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
            {[
              { q: "Is this PDF merge tool completely free?", a: "Yes — 100% free with no hidden fees, premium tiers, or usage limits. Merge as many PDFs as you need, as often as you like." },
              { q: "Do I need to sign up or log in?", a: "No. There's no registration, no login, and no email required. Open the page and start merging instantly." },
              { q: "Are my PDFs safe and private?", a: "Absolutely. All processing happens inside your browser using JavaScript. Your files are never sent to any server." },
              { q: "How many PDF files can I merge?", a: "You can merge 50+ PDFs in a single operation. The tool is optimized for large batches with no performance issues." },
              { q: "Does it work on mobile?", a: "Yes, the tool is fully responsive and works on iOS, Android, and all modern mobile browsers." },
              { q: "What if a PDF is password-protected?", a: "Encrypted PDFs may fail to merge. Remove password protection first. The tool will show an error if a file can't be processed." },
            ].map((item) => (
              <details key={item.q} className="faq-item border rounded-2xl overflow-hidden" style={{ borderColor: "#e2e8f0", background: "#fff" }}>
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-semibold text-sm" style={{ color: "#0f172a" }}>
                  {item.q}
                  <svg className="faq-arrow shrink-0 ml-3" width="18" height="18" fill="none" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </summary>
                <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: "#64748b" }}>{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Related Tools */}
        <div className="mb-16">
          <h2 className="text-2xl font-extrabold mb-6 text-center" style={{ color: "#0f172a" }}>
            More <span className="heading-gradient">PDF Tools</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* PDF Split — live */}
            <div
              key="PDF Split"
              className="tool-card p-4 rounded-2xl text-center cursor-pointer"
              onClick={() => setActiveTool("split")}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2.5" style={{ background: "#eef2ff" }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M6 3h12M6 21h12M8 12h8M12 8v8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <p className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>PDF Split</p>
              <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>Split into multiple files</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>Live</span>
            </div>
            {/* Related tools */}
            {[
              { svg: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#6366f1" strokeWidth="2"/></svg>), name: "PDF Compress", desc: "Reduce file size", live: true, tool: "compress" as const },
              { svg: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#6366f1" strokeWidth="2"/><path d="M9 13h6M9 17h4" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/></svg>), name: "PDF to Word", desc: "Convert to editable doc" },
              { svg: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#6366f1" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" stroke="#6366f1" strokeWidth="1.5"/><path d="M21 15l-5-5L5 21" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>), name: "PDF to JPG", desc: "Export as images" },
            ].map((tool) => (
              <div key={tool.name} className="tool-card p-4 rounded-2xl text-center cursor-pointer" onClick={"tool" in tool && tool.tool ? () => setActiveTool(tool.tool) : undefined}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2.5" style={{ background: "#eef2ff" }}>{tool.svg}</div>
                <p className="font-bold text-sm mb-1" style={{ color: "#0f172a" }}>{tool.name}</p>
                <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>{tool.desc}</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "live" in tool && tool.live ? "#f0fdf4" : "#eef2ff", color: "live" in tool && tool.live ? "#16a34a" : "#818cf8", border: "live" in tool && tool.live ? "1px solid #bbf7d0" : undefined }}>{"live" in tool && tool.live ? "Live" : "Coming soon"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── SEO ARTICLE BLOCK (user-provided text) ── */}
        <div className="seo-article-block p-8 sm:p-10 rounded-3xl mb-8">
          <h2 className="text-xl sm:text-2xl font-extrabold mb-4" style={{ color: "#0f172a" }}>
            The Best Free PDF Merge Tool Online
          </h2>
          <div className="space-y-4 text-sm leading-relaxed" style={{ color: "#475569" }}>
            <p>
              Looking for the fastest way to <strong style={{ color: "#0f172a" }}>merge PDF files online free</strong>? You've found it. Our PDF merge tool combines multiple PDF documents into one seamless file — instantly, securely, and without any login required.
            </p>
            <p>
              Unlike other online PDF combiners that require account registration or charge fees, our <strong style={{ color: "#0f172a" }}>PDF merger online without ads</strong> delivers a clean, distraction-free experience with visual file previews so you always merge the right documents.
            </p>
            <p>
              Our tool uses cutting-edge browser technology to process all files locally on your device. This means your sensitive documents are never transmitted to any external server, making it the <strong style={{ color: "#0f172a" }}>most secure online PDF combiner</strong> available.
            </p>
            <p className="font-semibold" style={{ color: "#4f46e5" }}>
              Ready to merge PDFs instantly? Scroll up and start merging — no registration, no payment, no hassle.
            </p>
          </div>
        </div>
      </section>

      </>
      )}

      {/* ── Footer ── */}
      {!(activeTool === "split" && !isSplitUploadScreen) && !(activeTool === "compress" && !isCompressUploadScreen) && !(activeTool === "remove" && !isRemoveUploadScreen) && !(activeTool === "organize" && !isOrganizeUploadScreen) && <footer className="border-t py-8 mt-4" style={{ borderColor: "#e2e8f0", background: "#fff" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg logo-icon flex items-center justify-center shadow">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white"/></svg>
            </div>
            <span className="font-extrabold text-sm" style={{ color: "#0f172a" }}>PDF Merge Tool</span>
          </div>
          <p className="text-xs mb-3" style={{ color: "#94a3b8" }}>
            Free · No Login · No Ads · Browser-Based · Privacy-Safe · Works on All Devices
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            {["merge pdf online free", "combine pdfs no login", "pdf joiner free", "secure pdf merge"].map((kw) => (
              <span key={kw} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#f8fafc", color: "#cbd5e1", border: "1px solid #f1f5f9" }}>{kw}</span>
            ))}
          </div>
          <p className="text-xs" style={{ color: "#e2e8f0" }}>
            © {new Date().getFullYear()} PDF Merge Online. All processing done locally in your browser. Your files are never uploaded.
          </p>
        </div>
      </footer>}
    </div>
  );
}
