import { useState, useRef, useCallback, useEffect, useMemo, startTransition, memo } from "react";
import JSZip from "jszip";
import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  verticalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type ExportMode = "merge" | "separate";
type SelectedMoveTarget = "top" | "bottom" | "position";

interface SourceTone {
  accent: string;
  border: string;
  bg: string;
  text: string;
}

interface ImportedPdf {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  arrayBuffer: ArrayBuffer;
  toneIndex: number;
}

interface PageItem {
  id: string;
  sourceId: string;
  pageIndex: number;
  thumbnail: string;
  rotation: number;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface PageCardProps {
  page: PageItem;
  position: number;
  sourceLabel: string;
  sourceName: string;
  sourcePageCount: number;
  tone: SourceTone;
  isSelected: boolean;
  onToggleSelect: (pageId: string) => void;
  onRotate: (pageId: string) => void;
  onDelete: (pageId: string) => void;
}

const SOURCE_TONES: SourceTone[] = [
  { accent: "#0d9488", border: "#99f6e4", bg: "#f0fdfa", text: "#115e59" },
  { accent: "#2563eb", border: "#93c5fd", bg: "#eff6ff", text: "#1d4ed8" },
  { accent: "#dc2626", border: "#fecaca", bg: "#fff1f2", text: "#b91c1c" },
  { accent: "#7c3aed", border: "#d8b4fe", bg: "#f5f3ff", text: "#6d28d9" },
  { accent: "#d97706", border: "#fcd34d", bg: "#fffbeb", text: "#b45309" },
  { accent: "#0891b2", border: "#a5f3fc", bg: "#ecfeff", text: "#0e7490" },
  { accent: "#16a34a", border: "#86efac", bg: "#f0fdf4", text: "#15803d" },
  { accent: "#db2777", border: "#f9a8d4", bg: "#fdf2f8", text: "#be185d" },
  { accent: "#ea580c", border: "#fdba74", bg: "#fff7ed", text: "#c2410c" },
  { accent: "#4f46e5", border: "#a5b4fc", bg: "#eef2ff", text: "#4338ca" },
  { accent: "#854d0e", border: "#fde68a", bg: "#fefce8", text: "#713f12" },
  { accent: "#9333ea", border: "#e9d5ff", bg: "#faf5ff", text: "#7e22ce" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};

const getPdfBaseName = (name: string) => name.replace(/\.pdf$/i, "") || "document";

const clonePdfBytes = (buffer: ArrayBuffer) => new Uint8Array(buffer.slice(0));

type ThumbProfile = "warm" | "background";

async function renderPageThumb(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  profile: ThumbProfile = "background"
): Promise<string> {
  try {
    const page = await pdfDoc.getPage(pageIndex + 1);
    const scale = profile === "warm" ? 0.15 : 0.17;
    const quality = profile === "warm" ? 0.33 : 0.36;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d")!;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    page.cleanup();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return "";
  }
}

function groupPagesBySourceOrder(orderedSources: ImportedPdf[], pages: PageItem[]) {
  const pagesBySource = new Map<string, PageItem[]>();
  pages.forEach((page) => {
    const group = pagesBySource.get(page.sourceId);
    if (group) group.push(page);
    else pagesBySource.set(page.sourceId, [page]);
  });
  return orderedSources.flatMap((source) => pagesBySource.get(source.id) || []);
}

function buildDefaultPageOrder(orderedSources: ImportedPdf[], pages: PageItem[]) {
  return orderedSources.flatMap((source) =>
    pages
      .filter((page) => page.sourceId === source.id)
      .sort((a, b) => a.pageIndex - b.pageIndex)
  );
}

function moveSelectedPagesToTarget(
  pages: PageItem[],
  selectedIds: Set<string>,
  target: SelectedMoveTarget,
  targetPosition?: number
) {
  if (selectedIds.size === 0) return pages;

  const selectedPages = pages.filter((page) => selectedIds.has(page.id));
  const unselectedPages = pages.filter((page) => !selectedIds.has(page.id));

  if (selectedPages.length === 0) return pages;

  if (target === "top") return [...selectedPages, ...unselectedPages];
  if (target === "bottom") return [...unselectedPages, ...selectedPages];

  const rawIndex = Math.max(0, Math.min((targetPosition ?? 1) - 1, pages.length));
  const selectedBeforeTarget = pages.slice(0, rawIndex).filter((page) => selectedIds.has(page.id)).length;
  const insertionIndex = Math.max(0, Math.min(rawIndex - selectedBeforeTarget, unselectedPages.length));

  return [
    ...unselectedPages.slice(0, insertionIndex),
    ...selectedPages,
    ...unselectedPages.slice(insertionIndex),
  ];
}

const SortablePageCard = memo(function SortablePageCard({
  page,
  position,
  sourceLabel,
  sourceName,
  sourcePageCount,
  tone,
  isSelected,
  onToggleSelect,
  onRotate,
  onDelete,
}: PageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.9 : 1,
        cursor: isDragging ? "grabbing" : "grab",
        borderRadius: 10,
        border: `1.5px solid ${isSelected || isDragging ? tone.accent : tone.border}`,
        background: "#fff",
        boxShadow: isDragging
          ? "0 8px 18px rgba(15,23,42,0.2)"
          : isSelected
            ? "0 0 0 1px rgba(20,184,166,0.35), 0 1px 4px rgba(15,23,42,0.08)"
          : "0 1px 3px rgba(15,23,42,0.07)",
        overflow: "hidden",
        userSelect: "none",
        position: "relative",
        zIndex: isDragging ? 50 : 1,
        willChange: "transform",
        contain: "layout paint style",
      }}
    >
      {/* Header: source badge + position number */}
      <div
        className="px-2 pt-1.5 pb-1 flex items-center justify-between gap-1"
        style={{ background: tone.bg, borderBottom: `1px solid ${tone.border}` }}
      >
        <div className="min-w-0 flex items-center gap-1">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelect(page.id);
            }}
            className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0"
            style={{
              background: isSelected ? tone.accent : "#fff",
              color: isSelected ? "#fff" : "transparent",
              borderColor: isSelected ? tone.accent : tone.border,
            }}
            title={isSelected ? "Deselect page" : "Select page"}
          >
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-[0.06em] uppercase min-w-0 overflow-hidden"
            style={{ background: "#fff", color: tone.text, border: `1px solid ${tone.border}` }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: tone.accent }} />
            <span className="truncate">{sourceLabel}</span>
          </span>
        </div>
        <span
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-black"
          style={{ background: tone.accent, color: "#fff", fontSize: 12 }}
        >
          {position}
        </span>
      </div>

      {/* Sub-header: filename + page */}
      <div className="px-2 py-1" style={{ background: tone.bg, borderBottom: `1px solid ${tone.border}` }}>
        <p className="text-[10px] font-bold truncate leading-tight" style={{ color: "#0f172a" }} title={sourceName}>
          {sourceName}
        </p>
        <p className="text-[9px] leading-tight" style={{ color: "#64748b" }}>
          Pg {page.pageIndex + 1}/{sourcePageCount}
        </p>
      </div>

      {/* Thumbnail */}
      <div style={{ width: "100%", aspectRatio: "0.72", background: `linear-gradient(180deg, ${tone.bg}, #ffffff)`, padding: 5, overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 6, overflow: "hidden", background: "#fff", border: `1px solid ${tone.border}` }}>
          {page.thumbnail ? (
            <img
              src={page.thumbnail}
              alt={`${sourceName} page ${page.pageIndex + 1}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center",
                display: "block",
                transform: page.rotation ? `rotate(${page.rotation}deg)` : undefined,
                transition: "transform 0.25s ease",
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill={tone.accent} opacity="0.15" />
                <polyline points="14 2 14 8 20 8" stroke={tone.accent} strokeWidth="1.5" fill="none" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Action bar: Rotate + Delete */}
      <div className="flex items-center" style={{ borderTop: `1px solid ${tone.border}`, background: tone.bg }}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRotate(page.id); }}
          className="flex-1 flex items-center justify-center gap-0.5 py-1 text-[10px] font-bold"
          style={{ color: tone.text, borderRight: `1px solid ${tone.border}`, background: "transparent" }}
          title="Rotate 90°"
        >
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
            <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.51 15a9 9 0 1 0 .49-4.36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Rotate
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(page.id); }}
          className="flex items-center justify-center py-1 px-2"
          style={{ color: "#ef4444", background: "transparent" }}
          title="Remove page"
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
});

interface SourceCardProps {
  source: ImportedPdf;
  index: number;
  tone: SourceTone;
  groupPageCount: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SortableSourceCard({ source, index, tone, groupPageCount, isFirst, isLast, onMoveUp, onMoveDown }: SourceCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: source.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.85 : 1,
        position: "relative",
        zIndex: isDragging ? 50 : 1,
      }}
    >
      <div
        className="rounded-xl border p-2.5 flex items-center gap-2 cursor-grab"
        style={{ borderColor: isDragging ? tone.accent : tone.border, background: tone.bg }}
      >
        {/* Drag grip */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border"
          style={{ background: "#fff", borderColor: tone.border, color: tone.text }}
          title="Drag to reorder"
        >
          <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="8" cy="5" r="1.5" /><circle cx="16" cy="5" r="1.5" />
            <circle cx="8" cy="12" r="1.5" /><circle cx="16" cy="12" r="1.5" />
            <circle cx="8" cy="19" r="1.5" /><circle cx="16" cy="19" r="1.5" />
          </svg>
        </div>

        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tone.accent }} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-wide flex-shrink-0" style={{ color: tone.text }}>PDF {index + 1}</span>
          </div>
          <p className="text-xs font-bold truncate leading-tight" style={{ color: "#0f172a" }} title={source.name}>{source.name}</p>
          <p className="text-[10px] leading-tight" style={{ color: "#64748b" }}>{groupPageCount} pg · {fmtSize(source.size)}</p>
        </div>

        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={isFirst}
            className="w-6 h-6 rounded flex items-center justify-center border"
            style={{ background: "#fff", borderColor: tone.border, color: tone.text, opacity: isFirst ? 0.3 : 1 }}
            title="Move up"
          >
            <svg width="9" height="9" fill="none" viewBox="0 0 24 24">
              <path d="M12 5l-7 7M12 5l7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={isLast}
            className="w-6 h-6 rounded flex items-center justify-center border"
            style={{ background: "#fff", borderColor: tone.border, color: tone.text, opacity: isLast ? 0.3 : 1 }}
            title="Move down"
          >
            <svg width="9" height="9" fill="none" viewBox="0 0 24 24">
              <path d="M12 19l-7-7M12 19l7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

interface OrganizePDFDesktopProps {
  onUploadScreenChange?: (isUploadScreen: boolean) => void;
}

export default function OrganizePDFDesktop({ onUploadScreenChange }: OrganizePDFDesktopProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadSessionRef = useRef(0);
  const isPageDraggingRef = useRef(false);
  const pendingThumbsRef = useRef(new Map<string, string>());

  const [sources, setSources] = useState<ImportedPdf[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isRenderingThumbs, setIsRenderingThumbs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("merge");
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [selectedMoveTarget, setSelectedMoveTarget] = useState<SelectedMoveTarget>("top");
  const [selectedMovePosition, setSelectedMovePosition] = useState("1");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isEditorVisible, setIsEditorVisible] = useState(false);

  const isUploadScreen = !isEditorVisible;
  const isEditorMode = isEditorVisible;

  const sourceMeta = useMemo(() => {
    const map = new Map<string, { source: ImportedPdf; tone: SourceTone; order: number }>();
    sources.forEach((source, index) => {
      map.set(source.id, {
        source,
        tone: SOURCE_TONES[source.toneIndex % SOURCE_TONES.length],
        order: index + 1,
      });
    });
    return map;
  }, [sources]);

  const totalPages = pages.length;
  const totalSize = useMemo(() => sources.reduce((sum, source) => sum + source.size, 0), [sources]);
  const isSeparateZip = exportMode === "separate" && sources.length > 1;
  const selectedPageSet = useMemo(() => new Set(selectedPageIds), [selectedPageIds]);
  const selectedPageCount = selectedPageIds.length;

  useEffect(() => {
    onUploadScreenChange?.(!isEditorVisible);
  }, [isEditorVisible, onUploadScreenChange]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    if (isEditorMode) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isEditorMode]);

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000);
  }, []);

  const applyThumbResults = useCallback((results: Array<{ id: string; thumbnail: string }>) => {
    if (results.length === 0) return;
    if (isPageDraggingRef.current) {
      results.forEach((item) => pendingThumbsRef.current.set(item.id, item.thumbnail));
      return;
    }
    const thumbMap = new Map(results.map((item) => [item.id, item.thumbnail]));
    startTransition(() => {
      setPages((prev) =>
        prev.map((page) => (thumbMap.has(page.id) ? { ...page, thumbnail: thumbMap.get(page.id)! } : page))
      );
    });
  }, []);

  const flushPendingThumbs = useCallback(() => {
    if (pendingThumbsRef.current.size === 0) return;
    const thumbMap = new Map(pendingThumbsRef.current);
    pendingThumbsRef.current.clear();
    startTransition(() => {
      setPages((prev) =>
        prev.map((page) => (thumbMap.has(page.id) ? { ...page, thumbnail: thumbMap.get(page.id)! } : page))
      );
    });
  }, []);

  const resetAll = useCallback(() => {
    setSources([]);
    setPages([]);
    setIsEditorVisible(false);
    setLoading(false);
    setLoadingProgress(0);
    setIsRenderingThumbs(false);
    setExportMode("merge");
    setSelectedPageIds([]);
    setSelectedMoveTarget("top");
    setSelectedMovePosition("1");
  }, []);

  useEffect(() => {
    setSelectedPageIds((prev) => prev.filter((pageId) => pages.some((page) => page.id === pageId)));
    setSelectedMovePosition((prev) => {
      const parsed = Number.parseInt(prev, 10);
      if (!Number.isFinite(parsed) || parsed < 1) return "1";
      return String(Math.min(parsed, Math.max(pages.length, 1)));
    });
  }, [pages]);

  const loadFiles = useCallback(async (incoming: File[]) => {
    const pdfs = incoming.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    const rejected = incoming.length - pdfs.length;
    if (rejected > 0) addToast(`${rejected} non-PDF file(s) skipped.`, "error");
    if (pdfs.length === 0) return;

    const sessionId = Date.now();
    const shouldDelayEditorOpen = !isEditorVisible && sources.length === 0;
    loadSessionRef.current = sessionId;
    pendingThumbsRef.current.clear();
    setLoading(true);
    setLoadingProgress(5);
    setIsRenderingThumbs(false);

    try {
      const sourceOffset = sources.length;
      const sourceOrderMap = new Map<string, number>(sources.map((source) => [source.id, source.toneIndex]));
      let activeThumbJobs = 0;

      const sortPagesBySourceOrder = (items: PageItem[]) =>
        [...items].sort((a, b) => {
          const orderA = sourceOrderMap.get(a.sourceId) ?? Number.MAX_SAFE_INTEGER;
          const orderB = sourceOrderMap.get(b.sourceId) ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return a.pageIndex - b.pageIndex;
        });

      const parseFile = async (file: File, index: number) => {
        const fileBuffer = await file.arrayBuffer();
        const storedBuffer = fileBuffer.slice(0);
        const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) }).promise;
        const sourceId = uid();
        const pageItems = Array.from({ length: pdfDoc.numPages }, (_, pageIndex) => ({
          id: uid(),
          sourceId,
          pageIndex,
          thumbnail: "",
          rotation: 0,
        }));
        const source: ImportedPdf = {
          id: sourceId,
          file,
          name: file.name,
          size: file.size,
          pageCount: pdfDoc.numPages,
          arrayBuffer: storedBuffer,
          toneIndex: sourceOffset + index,
        };
        return { source, pageItems, pdfDoc };
      };

      const runThumbJob = (pdfDoc: pdfjsLib.PDFDocumentProxy, pageItems: PageItem[], startAt = 0) => {
        activeThumbJobs += 1;
        setIsRenderingThumbs(true);
        void (async () => {
          try {
            for (let start = startAt; start < pageItems.length; start += 14) {
              if (loadSessionRef.current !== sessionId) return;
              const batchItems = pageItems.slice(start, start + 14);
              const results = await Promise.all(
                batchItems.map(async (page) => ({
                  id: page.id,
                  thumbnail: await renderPageThumb(pdfDoc, page.pageIndex, "background"),
                }))
              );
              applyThumbResults(results);
            }
          } finally {
            activeThumbJobs -= 1;
            if (loadSessionRef.current === sessionId && activeThumbJobs <= 0) {
              setIsRenderingThumbs(false);
              flushPendingThumbs();
            }
          }
        })();
      };

      let parsedCount = 0;
      const totalToParse = Math.max(pdfs.length, 1);
      const parsed = await Promise.all(
        pdfs.map(async (file, index) => {
          const entry = await parseFile(file, index);
          if (loadSessionRef.current === sessionId) {
            parsedCount += 1;
            const parseProgress = 10 + Math.round((parsedCount / totalToParse) * 50);
            setLoadingProgress(Math.min(parseProgress, 60));
          }
          return entry;
        })
      );

      if (loadSessionRef.current !== sessionId) return;

      const orderedParsed = [...parsed].sort((a, b) => a.source.toneIndex - b.source.toneIndex);
      orderedParsed.forEach((entry) => sourceOrderMap.set(entry.source.id, entry.source.toneIndex));

      const allSources = orderedParsed.map((entry) => entry.source);
      const allPages = orderedParsed.flatMap((entry) => entry.pageItems);
      setSources((prev) => [...prev, ...allSources].sort((a, b) => a.toneIndex - b.toneIndex));
      setPages((prev) => sortPagesBySourceOrder([...prev, ...allPages]));

      let warmCount = 0;
      if (shouldDelayEditorOpen) {
        warmCount = Math.min(allPages.length, 56);
        if (warmCount > 0) {
          const warmTargets = orderedParsed
            .flatMap((entry) => entry.pageItems.map((page) => ({ page, pdfDoc: entry.pdfDoc })))
            .slice(0, warmCount);

          let rendered = 0;
          for (let start = 0; start < warmTargets.length; start += 14) {
            if (loadSessionRef.current !== sessionId) return;
            const batch = warmTargets.slice(start, start + 14);
            const batchResults = await Promise.all(
              batch.map(async (target) => ({
                id: target.page.id,
                thumbnail: await renderPageThumb(target.pdfDoc, target.page.pageIndex, "warm"),
              }))
            );
            rendered += batchResults.length;
            applyThumbResults(batchResults);
            if (loadSessionRef.current === sessionId) {
              const warmProgress = 60 + Math.round((rendered / warmCount) * 35);
              setLoadingProgress(Math.min(warmProgress, 95));
            }
          }
          if (loadSessionRef.current !== sessionId) return;
        }
      }

      setLoadingProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 70));
      if (shouldDelayEditorOpen) {
        setIsEditorVisible(true);
      }
      setLoading(false);
      setLoadingProgress(0);
      addToast(`${pdfs.length} PDF${pdfs.length !== 1 ? "s" : ""} added.`, "success");

      if (loadSessionRef.current !== sessionId) return;

      let remainingWarm = warmCount;
      for (const entry of orderedParsed) {
        const skip = Math.min(remainingWarm, entry.pageItems.length);
        remainingWarm -= skip;
        if (entry.pageItems.length > skip) {
          runThumbJob(entry.pdfDoc, entry.pageItems, skip);
        }
      }
    } catch (error) {
      console.error(error);
      addToast("Failed to load one or more PDFs. Files may be encrypted or corrupted.", "error");
      setIsRenderingThumbs(false);
      setLoadingProgress(0);
    } finally {
      if (loadSessionRef.current === sessionId) {
        setLoading(false);
      }
    }
  }, [addToast, applyThumbResults, flushPendingThumbs, isEditorVisible, sources, sources.length]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) loadFiles(Array.from(event.target.files));
    event.target.value = "";
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDraggingOver(false);
    if (event.dataTransfer.files?.length) loadFiles(Array.from(event.dataTransfer.files));
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 110, tolerance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (_event: DragStartEvent) => {
    isPageDraggingRef.current = true;
  };

  const handleDragCancel = () => {
    isPageDraggingRef.current = false;
    flushPendingThumbs();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    isPageDraggingRef.current = false;
    flushPendingThumbs();
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setPages((prev) => {
      const oldIndex = prev.findIndex((page) => page.id === active.id);
      const newIndex = prev.findIndex((page) => page.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleSourceDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSources((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const nextSources = arrayMove(prev, oldIndex, newIndex);
      setPages((currentPages) => groupPagesBySourceOrder(nextSources, currentPages));
      return nextSources;
    });
  };

  const moveSource = (sourceId: string, direction: -1 | 1) => {
    setSources((prev) => {
      const currentIndex = prev.findIndex((source) => source.id === sourceId);
      if (currentIndex < 0) return prev;
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const nextSources = arrayMove(prev, currentIndex, nextIndex);
      setPages((currentPages) => groupPagesBySourceOrder(nextSources, currentPages));
      return nextSources;
    });
  };

  const resetSourceOrder = useCallback(() => {
    setSources((prev) => {
      const restoredSources = [...prev].sort((a, b) => a.toneIndex - b.toneIndex);
      setPages((currentPages) => groupPagesBySourceOrder(restoredSources, currentPages));
      return restoredSources;
    });
  }, []);

  const rotatePage = useCallback((pageId: string) => {
    setPages((prev) => prev.map((p) => p.id === pageId ? { ...p, rotation: ((p.rotation ?? 0) + 90) % 360 } : p));
  }, []);

  const togglePageSelection = useCallback((pageId: string) => {
    setSelectedPageIds((prev) => prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]);
  }, []);

  const deletePage = useCallback((pageId: string) => {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
    setSelectedPageIds((prev) => prev.filter((id) => id !== pageId));
  }, []);

  const moveSelectedPages = useCallback(() => {
    if (selectedPageIds.length === 0) {
      addToast("Select at least one page first.", "error");
      return;
    }

    if (selectedMoveTarget === "position") {
      const parsed = Number.parseInt(selectedMovePosition, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > pages.length) {
        addToast(`Enter a page position from 1 to ${pages.length}.`, "error");
        return;
      }
    }

    const nextPages = moveSelectedPagesToTarget(
      pages,
      new Set(selectedPageIds),
      selectedMoveTarget,
      selectedMoveTarget === "position" ? Number.parseInt(selectedMovePosition, 10) : undefined
    );

    setPages(nextPages);
    addToast(
      selectedMoveTarget === "position"
        ? `Moved ${selectedPageIds.length} selected page${selectedPageIds.length !== 1 ? "s" : ""} before page ${selectedMovePosition}.`
        : `Moved ${selectedPageIds.length} selected page${selectedPageIds.length !== 1 ? "s" : ""} to the ${selectedMoveTarget}.`,
      "success"
    );
  }, [addToast, pages, selectedMovePosition, selectedMoveTarget, selectedPageIds]);

  const saveAndDownload = useCallback(async () => {
    if (sources.length === 0 || pages.length === 0) return;

    setSaving(true);
    try {
      if (exportMode === "merge" || sources.length === 1) {
        const sourceDocs = new Map<string, PDFDocument>();
        const output = await PDFDocument.create();

        for (const page of pages) {
          let sourceDoc = sourceDocs.get(page.sourceId);
          if (!sourceDoc) {
            const source = sources.find((item) => item.id === page.sourceId);
            if (!source) continue;
            sourceDoc = await PDFDocument.load(clonePdfBytes(source.arrayBuffer), { ignoreEncryption: true });
            sourceDocs.set(page.sourceId, sourceDoc);
          }
          const [copied] = await output.copyPages(sourceDoc, [page.pageIndex]);
          if (page.rotation) {
            const currentAngle = copied.getRotation().angle;
            copied.setRotation(degrees((currentAngle + page.rotation) % 360));
          }
          output.addPage(copied);
        }

        const bytes = await output.save();
        const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = sources.length === 1
          ? `${getPdfBaseName(sources[0].name)}-organized.pdf`
          : "organized-merged.pdf";
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1200);
        addToast("Merged organized PDF downloaded.", "success");
        return;
      }

      const zip = new JSZip();
      for (const source of sources) {
        const sourcePages = pages.filter((page) => page.sourceId === source.id);
        if (sourcePages.length === 0) continue;
        const sourceDoc = await PDFDocument.load(clonePdfBytes(source.arrayBuffer), { ignoreEncryption: true });
        const output = await PDFDocument.create();
        const copied = await output.copyPages(sourceDoc, sourcePages.map((page) => page.pageIndex));
        copied.forEach((copiedPage, i) => {
          if (sourcePages[i].rotation) {
            const currentAngle = copiedPage.getRotation().angle;
            copiedPage.setRotation(degrees((currentAngle + sourcePages[i].rotation) % 360));
          }
          output.addPage(copiedPage);
        });
        const bytes = await output.save();
        zip.file(`${getPdfBaseName(source.name)}-organized.pdf`, bytes);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);
      const anchor = document.createElement("a");
      anchor.href = zipUrl;
      anchor.download = "organized-pdfs.zip";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(zipUrl), 1200);
      addToast("Separate organized PDFs downloaded as ZIP.", "success");
    } catch (error) {
      console.error(error);
      addToast("Failed to save organized PDF output.", "error");
    } finally {
      setSaving(false);
    }
  }, [addToast, exportMode, pages, sources]);

  return (
    <div className={`${isEditorMode ? "overflow-hidden" : ""} app-bg`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="fixed top-12 sm:top-14 right-4 sm:right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-pill pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold shadow-2xl text-white max-w-xs ${
              toast.type === "success" ? "bg-emerald-500" : toast.type === "error" ? "bg-rose-500" : "bg-indigo-500"
            }`}
          >
            <span className="text-base">{toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"}</span>
            {toast.message}
          </div>
        ))}
      </div>

      <div className={isEditorMode ? "split-editor-shell" : "max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6"}>
        {isUploadScreen && (
          <>
            <div className="text-center mt-2 mb-6">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight mb-2" style={{ color: "#0f172a" }}>
                Organize PDF Pages Online{" "}
                <span className="heading-gradient">Across Multiple PDFs</span>
              </h1>
              <p className="text-sm sm:text-base max-w-2xl mx-auto" style={{ color: "#64748b" }}>
                Upload one or many PDFs, see every page together, reorder everything visually, then download one merged file or separate organized files.
              </p>
            </div>

            <div
              className={`upload-zone-premium rounded-3xl cursor-pointer select-none transition-all duration-300 ${isDraggingOver ? "upload-zone-active" : ""}`}
              style={{ padding: "52px 24px" }}
              onDrop={onDrop}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDraggingOver(false);
              }}
              onClick={openFilePicker}
            >
              <div className="flex flex-col items-center gap-5 text-center">
                <div style={{ position: "relative", width: 88, height: 90 }}>
                  <div style={{ position: "absolute", top: 24, left: 4, width: 44, height: 56, borderRadius: 10, background: "linear-gradient(145deg,#bfdbfe,#60a5fa)", opacity: 0.7 }} />
                  <div style={{ position: "absolute", top: 10, left: 22, width: 52, height: 64, borderRadius: 10, background: "linear-gradient(145deg,#99f6e4,#2dd4bf)", opacity: 0.85 }} />
                  <div style={{ position: "absolute", top: 0, left: 30, width: 58, height: 72, borderRadius: 12, background: "linear-gradient(145deg,#14b8a6,#0d9488,#0f766e)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 26px rgba(13,148,136,0.35)" }}>
                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                      <path d="M7 12h10M14 9l3 3-3 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9 6h6M9 18h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div>
                  <p className="text-xl sm:text-2xl font-extrabold mb-1" style={{ color: isDraggingOver ? "#0f766e" : "#0f172a" }}>
                    {isDraggingOver ? "Drop your PDFs here!" : "Drag & Drop PDF Files Here"}
                  </p>
                  <p className="text-sm" style={{ color: isDraggingOver ? "#14b8a6" : "#64748b" }}>
                    {isDraggingOver ? "Release to load all PDFs" : "or click below to select one or multiple PDF files"}
                  </p>
                </div>

                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    openFilePicker();
                  }}
                  className="select-btn text-white font-extrabold text-lg sm:text-xl px-10 sm:px-14 py-4 sm:py-5 rounded-2xl flex items-center gap-3 shadow-2xl"
                >
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                    <path d="M4 16.004V17a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M12 3v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M7.5 7.5L12 3l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Select PDF Files
                </button>

                <div className="flex items-center gap-4 flex-wrap justify-center">
                  {["Multiple PDFs", "Group Colors", "Merge or Separate", "100% Private"].map((tag) => (
                    <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(20,184,166,0.08)", color: "#0f766e" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {loading && !isEditorMode && (
          <div className="max-w-xl mx-auto mt-5 mb-2">
            <div className="rounded-2xl border p-4" style={{ background: "#ffffff", borderColor: "#d1fae5" }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-bold" style={{ color: "#0f172a" }}>Opening PDFs...</p>
                <span className="text-xs font-bold" style={{ color: "#0f766e" }}>{loadingProgress}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
                <div className="h-full rounded-full transition-all duration-200" style={{ width: `${loadingProgress}%`, background: "linear-gradient(90deg, #14b8a6, #2dd4bf)" }} />
              </div>
            </div>
          </div>
        )}

        {isEditorMode && (
          <div
            className="relative overflow-hidden"
            style={{
              height: "calc(100vh - 3.5rem)",
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) 470px",
            }}
          >
            <div className="min-w-0 flex flex-col overflow-hidden" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)" }}>
              <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0" style={{ borderColor: "#e2e8f0" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0" style={{ background: "linear-gradient(135deg, #14b8a6, #0d9488)" }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                    <path d="M7 12h10M14 9l3 3-3 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 6h6M9 18h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "#0f172a" }}>
                    Organize PDF Pages
                  </p>
                  <p className="text-xs" style={{ color: "#64748b" }}>
                    {sources.length} PDF{sources.length !== 1 ? "s" : ""} · {totalPages} page{totalPages !== 1 ? "s" : ""} · {fmtSize(totalSize)}
                  </p>
                </div>

                <button
                  onClick={openFilePicker}
                  className="px-3 py-2 rounded-xl text-xs font-bold border"
                  style={{ color: "#0f766e", borderColor: "#99f6e4", background: "linear-gradient(135deg, #f0fdfa, #ccfbf1)" }}
                >
                  Add PDFs
                </button>
                <button
                  onClick={resetAll}
                  className="px-3 py-2 rounded-xl text-xs font-bold border"
                  style={{ color: "#475569", borderColor: "#dbe5f4", background: "#f8fafc" }}
                >
                  Clear All
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="mb-4 px-4 py-3 rounded-2xl border flex items-start gap-3" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#ecfeff", color: "#0f766e" }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <path d="M7 8h10M7 12h10M7 16h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#0f172a" }}>Drag pages on the left, manage file groups on the right</p>
                    <p className="text-xs mt-1" style={{ color: "#64748b" }}>
                      Color borders show which source PDF each page belongs to. Move files up or down in settings to regroup whole document blocks.
                    </p>
                  </div>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragCancel={handleDragCancel} onDragEnd={handleDragEnd} autoScroll={false}>
                  <SortableContext items={pages.map((page) => page.id)} strategy={rectSortingStrategy}>
                    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
                      {pages.map((page, index) => {
                        const meta = sourceMeta.get(page.sourceId);
                        if (!meta) return null;
                        return (
                          <SortablePageCard
                            key={page.id}
                            page={page}
                            position={index + 1}
                            sourceLabel={`PDF ${meta.order}`}
                            sourceName={meta.source.name}
                            sourcePageCount={meta.source.pageCount}
                            tone={meta.tone}
                            isSelected={selectedPageSet.has(page.id)}
                            onToggleSelect={togglePageSelection}
                            onRotate={rotatePage}
                            onDelete={deletePage}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>

            <aside className="flex flex-col border-l overflow-hidden" style={{ borderColor: "#e2e8f0", background: "rgba(248,250,252,0.96)", backdropFilter: "blur(12px)" }}>
              <div
                className="px-5 py-2 border-b flex items-center min-h-[40px] flex-shrink-0"
                style={{
                  borderColor: "#e2e8f0",
                  background: "rgba(248,250,252,0.98)",
                }}
              >
                <p className="text-base font-black tracking-[0.08em] uppercase leading-none" style={{ color: "#0f766e" }}>Settings</p>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                <section className="rounded-2xl border p-3" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xs font-bold flex-1" style={{ color: "#0f172a" }}>Export Mode</h3>
                    <span className="text-[10px] font-semibold" style={{ color: "#94a3b8" }}>
                      {isSeparateZip ? "ZIP" : "PDF"}
                    </span>
                    <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "#e2e8f0" }}>
                      <button
                        onClick={() => setExportMode("merge")}
                        className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors"
                        style={{
                          background: exportMode === "merge" ? "#0d9488" : "#f8fafc",
                          color: exportMode === "merge" ? "#fff" : "#64748b",
                        }}
                      >
                        Merge
                      </button>
                      <button
                        onClick={() => setExportMode("separate")}
                        className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors border-l"
                        style={{
                          borderLeftColor: "#e2e8f0",
                          background: exportMode === "separate" ? "#0d9488" : "#f8fafc",
                          color: exportMode === "separate" ? "#fff" : "#64748b",
                        }}
                      >
                        Separate
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>
                    {exportMode === "merge"
                      ? "Merge all pages into one organized PDF."
                      : sources.length <= 1 ? "Download as single organized PDF." : `Download ${sources.length} organized PDFs as ZIP.`}
                  </p>
                </section>

                <section className="rounded-2xl border p-3" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold" style={{ color: "#0f172a" }}>Move Selected Pages</h3>
                      <p className="text-[10px] mt-0.5" style={{ color: "#64748b" }}>
                        {selectedPageCount} page{selectedPageCount !== 1 ? "s" : ""} selected
                      </p>
                    </div>
                    {selectedPageCount > 0 && (
                      <button
                        onClick={() => setSelectedPageIds([])}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold border"
                        style={{ color: "#334155", borderColor: "#dbe5f4", background: "#f8fafc" }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                    {([
                      { value: "top", label: "Top" },
                      { value: "bottom", label: "Bottom" },
                      { value: "position", label: "Position" },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setSelectedMoveTarget(option.value)}
                        className="rounded-xl px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide border transition-colors"
                        style={{
                          borderColor: selectedMoveTarget === option.value ? "#14b8a6" : "#e2e8f0",
                          background: selectedMoveTarget === option.value ? "#f0fdfa" : "#fff",
                          color: selectedMoveTarget === option.value ? "#0f766e" : "#64748b",
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {selectedMoveTarget === "position" && (
                    <div className="mb-1.5">
                      <label className="block text-[9px] font-semibold mb-1" style={{ color: "#475569" }}>
                        Move selected pages before position
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(totalPages, 1)}
                        value={selectedMovePosition}
                        onChange={(event) => setSelectedMovePosition(event.target.value)}
                        className="w-full rounded-xl border px-3 py-1.5 text-[12px] outline-none"
                        style={{ borderColor: "#cbd5e1", background: "#fff", color: "#0f172a" }}
                        placeholder={`1-${Math.max(totalPages, 1)}`}
                      />
                    </div>
                  )}

                  <button
                    onClick={moveSelectedPages}
                    disabled={selectedPageCount === 0}
                    className="w-full rounded-xl px-4 py-2.5 text-xs font-extrabold text-white"
                    style={{
                      background: selectedPageCount === 0 ? "#94a3b8" : "linear-gradient(135deg, #14b8a6, #0d9488)",
                      boxShadow: selectedPageCount === 0 ? "none" : "0 6px 14px rgba(13,148,136,0.16)",
                    }}
                  >
                    Move Selected
                  </button>
                </section>

                <section className="rounded-2xl border p-4" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold" style={{ color: "#0f172a" }}>Imported PDFs</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={resetSourceOrder}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border"
                        style={{ color: "#334155", borderColor: "#dbe5f4", background: "#f8fafc" }}
                      >
                        Reset Order
                      </button>
                      <button
                        onClick={openFilePicker}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border"
                        style={{ color: "#0f766e", borderColor: "#99f6e4", background: "#f0fdfa" }}
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSourceDragEnd}>
                    <SortableContext items={sources.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {sources.map((source, index) => {
                          const tone = SOURCE_TONES[source.toneIndex % SOURCE_TONES.length];
                          const groupPages = pages.filter((page) => page.sourceId === source.id);
                          return (
                            <SortableSourceCard
                              key={source.id}
                              source={source}
                              index={index}
                              tone={tone}
                              groupPageCount={groupPages.length}
                              isFirst={index === 0}
                              isLast={index === sources.length - 1}
                              onMoveUp={() => moveSource(source.id, -1)}
                              onMoveDown={() => moveSource(source.id, 1)}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                </section>

              </div>

              <div className="px-4 pt-1 pb-1.5 border-t flex-shrink-0" style={{ borderColor: "#e2e8f0", background: "rgba(255,255,255,0.97)" }}>
                <div className="flex items-center justify-center gap-2 mt-1 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: "#0f172a" }}>
                      {exportMode === "merge"
                        ? `Merging ${sources.length} PDF${sources.length !== 1 ? "s" : ""} → 1 file`
                        : sources.length === 1 ? "1 organized PDF" : `${sources.length} PDFs → ZIP`}
                    </p>
                  </div>
                  <div className="flex items-baseline gap-0.5 flex-shrink-0">
                    <span className="text-base font-black" style={{ color: "#0f766e" }}>{totalPages}</span>
                    <span className="text-[10px] font-semibold" style={{ color: "#94a3b8" }}>Pages</span>
                  </div>
                </div>

                <button
                  onClick={saveAndDownload}
                  disabled={saving || pages.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl text-white font-extrabold text-sm active:scale-[0.99] transition-transform"
                  style={{
                    background: saving || pages.length === 0 ? "#94a3b8" : "linear-gradient(135deg, #14b8a6, #0d9488)",
                    boxShadow: saving || pages.length === 0 ? "none" : "0 6px 16px rgba(13,148,136,0.25)",
                  }}
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                      Preparing…
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                        <path d="M12 3v13M7 11l5 5 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                      </svg>
                      {exportMode === "merge" || sources.length === 1 ? "Download Organized PDF" : "Download ZIP"}
                    </>
                  )}
                </button>
              </div>
            </aside>

            {isRenderingThumbs && null}
          </div>
        )}
      </div>
    </div>
  );
}
