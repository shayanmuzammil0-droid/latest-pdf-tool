import { useState, useRef, useCallback, useEffect, useMemo, startTransition, memo } from "react";
import JSZip from "jszip";
import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
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

interface SortableCardProps {
  page: PageItem;
  position: number;
  tone: SourceTone;
  sourceLabel: string;
  sourceName: string;
  sourcePageCount: number;
  isSelected: boolean;
  onToggleSelect: (pageId: string) => void;
  onRotate: (pageId: string) => void;
  onDelete: (pageId: string) => void;
}

interface OrganizePDFMobileProps {
  onUploadScreenChange?: (isUploadScreen: boolean) => void;
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
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    page.cleanup();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return "";
  }
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
  tone,
  sourceLabel,
  sourceName,
  sourcePageCount,
  isSelected,
  onToggleSelect,
  onRotate,
  onDelete,
}: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.88 : 1,
        cursor: isDragging ? "grabbing" : "grab",
        borderRadius: 12,
        border: `1.5px solid ${isSelected || isDragging ? tone.accent : tone.border}`,
        background: "#fff",
        boxShadow: isDragging
          ? "0 8px 18px rgba(15,23,42,0.18)"
          : isSelected
            ? "0 0 0 1px rgba(20,184,166,0.35), 0 1px 4px rgba(15,23,42,0.08)"
            : "0 1px 3px rgba(15,23,42,0.07)",
        overflow: "hidden",
        userSelect: "none",
        minWidth: 0,
        touchAction: "none",
        position: "relative",
        zIndex: isDragging ? 1200 : 1,
        willChange: "transform",
        contain: "layout paint style",
      }}
    >
      <div className="px-1.5 py-1 flex items-center justify-between gap-1" style={{ background: tone.bg, borderBottom: `1px solid ${tone.border}` }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelect(page.id);
            }}
            className="w-4.5 h-4.5 rounded border flex items-center justify-center flex-shrink-0"
            style={{
              background: isSelected ? tone.accent : "#fff",
              color: isSelected ? "#fff" : "transparent",
              borderColor: isSelected ? tone.accent : tone.border,
            }}
            title={isSelected ? "Deselect" : "Select"}
          >
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-[8px] font-black uppercase truncate" style={{ color: tone.text }}>{sourceLabel}</span>
        </div>
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0" style={{ background: tone.accent }}>
          {position}
        </span>
      </div>

      <div className="px-1.5 py-1" style={{ background: tone.bg, borderBottom: `1px solid ${tone.border}` }}>
        <p className="text-[9px] font-bold truncate leading-tight" style={{ color: "#0f172a" }} title={sourceName}>{sourceName}</p>
        <p className="text-[8px] leading-tight" style={{ color: "#64748b" }}>Pg {page.pageIndex + 1}/{sourcePageCount}</p>
      </div>

      <div style={{ width: "100%", aspectRatio: "0.7", padding: 4, background: `linear-gradient(180deg, ${tone.bg}, #fff)` }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 6, overflow: "hidden", border: `1px solid ${tone.border}`, background: "#fff" }}>
          {page.thumbnail ? (
            <img
              src={page.thumbnail}
              alt={`${sourceName} page ${page.pageIndex + 1}`}
              draggable={false}
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
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill={tone.accent} opacity="0.15" />
                <polyline points="14 2 14 8 20 8" stroke={tone.accent} strokeWidth="1.5" fill="none" />
              </svg>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center" style={{ borderTop: `1px solid ${tone.border}`, background: tone.bg }}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRotate(page.id);
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] font-bold"
          style={{
            color: tone.text,
            borderRight: `1px solid ${tone.border}`,
            background: "rgba(255,255,255,0.9)",
            boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.08)",
          }}
          title="Rotate"
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.5 15a8.5 8.5 0 1 0 .5-4.1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          Rotate
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(page.id);
          }}
          className="min-w-8 px-2 py-1.5 text-[11px] font-extrabold"
          style={{
            color: "#ef4444",
            background: "rgba(239,68,68,0.16)",
            boxShadow: "inset 0 0 0 1px rgba(239,68,68,0.28)",
          }}
          title="Remove"
        >
          X
        </button>
      </div>
    </div>
  );
});

export default function OrganizePDFMobile({ onUploadScreenChange }: OrganizePDFMobileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadSessionRef = useRef(0);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const sourceToneIndexRef = useRef(new Map<string, number>());
  const dragScrollRafRef = useRef<number | null>(null);
  const dragScrollVelocityRef = useRef(0);
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
  const selectedPageSet = useMemo(() => new Set(selectedPageIds), [selectedPageIds]);
  const selectedPageCount = selectedPageIds.length;

  useEffect(() => {
    setSelectedPageIds((prev) => prev.filter((id) => pages.some((page) => page.id === id)));
    setSelectedMovePosition((prev) => {
      const parsed = Number.parseInt(prev, 10);
      if (!Number.isFinite(parsed) || parsed < 1) return "1";
      return String(Math.min(parsed, Math.max(pages.length, 1)));
    });
  }, [pages]);

  useEffect(() => {
    onUploadScreenChange?.(!isEditorVisible);
  }, [isEditorVisible, onUploadScreenChange]);

  useEffect(() => {
    const prevBodyOverflowX = document.body.style.overflowX;
    const prevBodyOverscrollX = (document.body.style as CSSStyleDeclaration & { overscrollBehaviorX?: string }).overscrollBehaviorX || "";
    const prevDocOverflowX = document.documentElement.style.overflowX;
    const prevDocOverscrollX = (document.documentElement.style as CSSStyleDeclaration & { overscrollBehaviorX?: string }).overscrollBehaviorX || "";

    document.body.style.overflowX = "hidden";
    document.documentElement.style.overflowX = "hidden";
    (document.body.style as CSSStyleDeclaration & { overscrollBehaviorX?: string }).overscrollBehaviorX = "none";
    (document.documentElement.style as CSSStyleDeclaration & { overscrollBehaviorX?: string }).overscrollBehaviorX = "none";

    return () => {
      document.body.style.overflowX = prevBodyOverflowX;
      document.documentElement.style.overflowX = prevDocOverflowX;
      (document.body.style as CSSStyleDeclaration & { overscrollBehaviorX?: string }).overscrollBehaviorX = prevBodyOverscrollX;
      (document.documentElement.style as CSSStyleDeclaration & { overscrollBehaviorX?: string }).overscrollBehaviorX = prevDocOverscrollX;
    };
  }, []);

  const ensureDragScrollLoop = useCallback(() => {
    if (dragScrollRafRef.current != null) return;

    const tick = () => {
      dragScrollRafRef.current = null;
      if (!isPageDraggingRef.current) return;

      const target = editorScrollRef.current;
      const velocity = dragScrollVelocityRef.current;
      if (target && velocity !== 0) {
        target.scrollTop += velocity;
      }

      dragScrollRafRef.current = requestAnimationFrame(tick);
    };

    dragScrollRafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      if (dragScrollRafRef.current != null) {
        cancelAnimationFrame(dragScrollRafRef.current);
        dragScrollRafRef.current = null;
      }
    };
  }, []);

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800);
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
    sourceToneIndexRef.current.clear();
    setIsEditorVisible(false);
    setLoading(false);
    setLoadingProgress(0);
    setIsRenderingThumbs(false);
    setSaving(false);
    setExportMode("merge");
    setSelectedPageIds([]);
    setSelectedMoveTarget("top");
    setSelectedMovePosition("1");
  }, []);

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
      let activeThumbJobs = 0;

      const sortPagesBySourceOrder = (items: PageItem[]) =>
        [...items].sort((a, b) => {
          const toneA = sourceToneIndexRef.current.get(a.sourceId) ?? Number.MAX_SAFE_INTEGER;
          const toneB = sourceToneIndexRef.current.get(b.sourceId) ?? Number.MAX_SAFE_INTEGER;
          if (toneA !== toneB) return toneA - toneB;
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
            for (let start = startAt; start < pageItems.length; start += 12) {
              if (loadSessionRef.current !== sessionId) return;
              const batchItems = pageItems.slice(start, start + 12);
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
      orderedParsed.forEach((entry) => sourceToneIndexRef.current.set(entry.source.id, entry.source.toneIndex));

      const allSources = orderedParsed.map((entry) => entry.source);
      const allPages = orderedParsed.flatMap((entry) => entry.pageItems);

      setSources((prev) => [...prev, ...allSources].sort((a, b) => a.toneIndex - b.toneIndex));
      setPages((prev) => sortPagesBySourceOrder([...prev, ...allPages]));

      let warmCount = 0;
      if (shouldDelayEditorOpen) {
        warmCount = Math.min(allPages.length, 36);
        if (warmCount > 0) {
          const warmTargets = orderedParsed
            .flatMap((entry) => entry.pageItems.map((page) => ({ page, pdfDoc: entry.pdfDoc })))
            .slice(0, warmCount);

          let rendered = 0;
          for (let start = 0; start < warmTargets.length; start += 12) {
            if (loadSessionRef.current !== sessionId) return;
            const batch = warmTargets.slice(start, start + 12);
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
      addToast("Failed to load one or more PDFs.", "error");
      setIsRenderingThumbs(false);
      setLoadingProgress(0);
    } finally {
      if (loadSessionRef.current === sessionId) {
        setLoading(false);
      }
    }
  }, [addToast, applyThumbResults, flushPendingThumbs, isEditorVisible, sources.length]);

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

  const handlePageDragStart = (_event: DragStartEvent) => {
    isPageDraggingRef.current = true;
    ensureDragScrollLoop();
  };

  const handlePageDragCancel = () => {
    isPageDraggingRef.current = false;
    flushPendingThumbs();
    dragScrollVelocityRef.current = 0;
    if (dragScrollRafRef.current != null) {
      cancelAnimationFrame(dragScrollRafRef.current);
      dragScrollRafRef.current = null;
    }
  };

  const handlePageDragEnd = (event: DragEndEvent) => {
    isPageDraggingRef.current = false;
    flushPendingThumbs();
    dragScrollVelocityRef.current = 0;
    if (dragScrollRafRef.current != null) {
      cancelAnimationFrame(dragScrollRafRef.current);
      dragScrollRafRef.current = null;
    }
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setPages((prev) => {
      const oldIndex = prev.findIndex((page) => page.id === active.id);
      const newIndex = prev.findIndex((page) => page.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handlePageDragMove = (event: DragMoveEvent) => {
    const container = editorScrollRef.current;
    const translated = event.active.rect.current.translated;
    if (!container || !translated) return;

    const bounds = container.getBoundingClientRect();
    const threshold = 72;
    const maxSpeed = 22;
    const minSpeed = 6;

    let nextVelocity = 0;
    if (translated.bottom > bounds.bottom - threshold) {
      const proximity = Math.min(1, (translated.bottom - (bounds.bottom - threshold)) / threshold);
      nextVelocity = minSpeed + proximity * (maxSpeed - minSpeed);
    } else if (translated.top < bounds.top + threshold) {
      const proximity = Math.min(1, ((bounds.top + threshold) - translated.top) / threshold);
      nextVelocity = -(minSpeed + proximity * (maxSpeed - minSpeed));
    }

    dragScrollVelocityRef.current = nextVelocity;
    ensureDragScrollLoop();
  };

  const resetPageOrder = () => {
    setPages((prev) => buildDefaultPageOrder(sources, prev));
  };

  const togglePageSelection = useCallback((pageId: string) => {
    setSelectedPageIds((prev) => (prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]));
  }, []);

  const rotatePage = useCallback((pageId: string) => {
    setPages((prev) => prev.map((page) => (page.id === pageId ? { ...page, rotation: ((page.rotation ?? 0) + 90) % 360 } : page)));
  }, []);

  const deletePage = useCallback((pageId: string) => {
    setPages((prev) => prev.filter((page) => page.id !== pageId));
    setSelectedPageIds((prev) => prev.filter((id) => id !== pageId));
  }, []);

  const moveSelectedPages = () => {
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

    setPages((prev) =>
      moveSelectedPagesToTarget(
        prev,
        new Set(selectedPageIds),
        selectedMoveTarget,
        selectedMoveTarget === "position" ? Number.parseInt(selectedMovePosition, 10) : undefined
      )
    );

    addToast(
      selectedMoveTarget === "position"
        ? `Moved ${selectedPageIds.length} selected page${selectedPageIds.length !== 1 ? "s" : ""} before page ${selectedMovePosition}.`
        : `Moved ${selectedPageIds.length} selected page${selectedPageIds.length !== 1 ? "s" : ""} to the ${selectedMoveTarget}.`,
      "success"
    );
  };

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
        anchor.download = sources.length === 1 ? `${getPdfBaseName(sources[0].name)}-organized.pdf` : "organized-merged.pdf";
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

        copied.forEach((copiedPage, index) => {
          if (sourcePages[index].rotation) {
            const currentAngle = copiedPage.getRotation().angle;
            copiedPage.setRotation(degrees((currentAngle + sourcePages[index].rotation) % 360));
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
    <div className="app-bg overflow-x-hidden w-full max-w-full">
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
            className={`toast-pill pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-xl text-white max-w-xs ${
              toast.type === "success" ? "bg-emerald-500" : toast.type === "error" ? "bg-rose-500" : "bg-indigo-500"
            }`}
          >
            <span className="text-base">{toast.type === "success" ? "+" : toast.type === "error" ? "!" : "i"}</span>
            {toast.message}
          </div>
        ))}
      </div>

      {isUploadScreen && (
        <div className="px-4 pt-6 pb-6">
          <div className="text-center mb-5">
            <h1 className="text-xl font-extrabold leading-tight mb-1" style={{ color: "#0f172a" }}>Organize PDF Pages</h1>
            <p className="text-sm" style={{ color: "#64748b" }}>Upload one or many PDFs, reorder pages, then download merged or separate output.</p>
          </div>

          <div
            className={`rounded-3xl border-2 border-dashed transition-all duration-200 cursor-pointer flex flex-col items-center gap-4 px-5 py-9 ${isDraggingOver ? "border-teal-400" : "border-teal-200"}`}
            style={{ background: isDraggingOver ? "#f0fdfa" : "#f8ffff" }}
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
            <div style={{ width: 62, height: 62, borderRadius: 16, background: "linear-gradient(135deg, #14b8a6, #0d9488)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(13,148,136,0.35)" }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                <path d="M7 12h10M14 9l3 3-3 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 6h6M9 18h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            <div className="text-center">
              <p className="text-lg font-extrabold mb-1" style={{ color: isDraggingOver ? "#0f766e" : "#0f172a" }}>
                {isDraggingOver ? "Drop your PDFs here" : "Drag & Drop PDF Files Here"}
              </p>
              <p className="text-sm" style={{ color: isDraggingOver ? "#14b8a6" : "#64748b" }}>
                {isDraggingOver ? "Release to open them now" : "Tap below to choose one or multiple PDF files"}
              </p>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openFilePicker();
              }}
              className="px-5 py-3 rounded-2xl text-white font-extrabold text-sm"
              style={{ background: "linear-gradient(135deg, #14b8a6, #0d9488)", boxShadow: "0 6px 20px rgba(13,148,136,0.36)" }}
            >
              Select PDF Files
            </button>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                "Multiple PDFs",
                "Fast open",
                "Private",
                "Merge or separate",
              ].map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: "rgba(20,184,166,0.08)", color: "#0f766e" }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {loading && (
            <div className="mt-4">
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
        </div>
      )}

      {isEditorMode && (
        <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
          <div
            ref={editorScrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-2.5"
            style={{ touchAction: "pan-y", overscrollBehaviorX: "none" as any }}
          >
            <section className="rounded-2xl border p-3" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold" style={{ color: "#0f172a" }}>Quick settings</h3>
                  <p className="text-[10px] mt-0.5" style={{ color: "#64748b" }}>Drag pages, tap to select, then export.</p>
                </div>
                <button onClick={resetPageOrder} className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold border whitespace-nowrap" style={{ background: "#f8fafc", borderColor: "#e2e8f0", color: "#334155" }}>Reset pages</button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                <div className="rounded-xl px-2 py-1.5" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <p className="text-[8px] font-black uppercase" style={{ color: "#94a3b8" }}>PDFs</p>
                  <p className="text-xs font-extrabold" style={{ color: "#0f172a" }}>{sources.length}</p>
                </div>
                <div className="rounded-xl px-2 py-1.5" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <p className="text-[8px] font-black uppercase" style={{ color: "#94a3b8" }}>Pages</p>
                  <p className="text-xs font-extrabold" style={{ color: "#0f172a" }}>{totalPages}</p>
                </div>
                <div className="rounded-xl px-2 py-1.5" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <p className="text-[8px] font-black uppercase" style={{ color: "#94a3b8" }}>Size</p>
                  <p className="text-xs font-extrabold" style={{ color: "#0f172a" }}>{fmtSize(totalSize)}</p>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="rounded-xl px-2.5 py-2" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase" style={{ color: "#64748b" }}>Selected</span>
                    <span
                      className="text-[10px] font-black px-2 py-0.5 rounded-full leading-none"
                      style={{
                        color: selectedPageCount > 0 ? "#0f766e" : "#64748b",
                        background: selectedPageCount > 0 ? "#ccfbf1" : "#e2e8f0",
                        boxShadow: selectedPageCount > 0 ? "inset 0 0 0 1px #99f6e4" : "inset 0 0 0 1px #cbd5e1",
                      }}
                    >
                      {selectedPageCount}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                    {(["top", "bottom", "position"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setSelectedMoveTarget(mode)}
                        className="rounded-lg px-1.5 py-1 text-[9px] font-black uppercase border"
                        style={{
                          borderColor: selectedMoveTarget === mode ? "#14b8a6" : "#e2e8f0",
                          background: selectedMoveTarget === mode ? "#f0fdfa" : "#fff",
                          color: selectedMoveTarget === mode ? "#0f766e" : "#64748b",
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedMoveTarget === "position" && (
                      <input
                        type="number"
                        min={1}
                        max={Math.max(totalPages, 1)}
                        value={selectedMovePosition}
                        onChange={(event) => setSelectedMovePosition(event.target.value)}
                        className="w-16 rounded-lg border px-2 py-1.5 text-[11px] outline-none"
                        style={{ borderColor: "#cbd5e1", background: "#fff", color: "#0f172a" }}
                        placeholder="1"
                      />
                    )}
                    <button
                      onClick={moveSelectedPages}
                      disabled={selectedPageCount === 0}
                      className="flex-1 rounded-lg px-3 py-1.5 text-[10px] font-extrabold text-white"
                      style={{ background: selectedPageCount === 0 ? "#94a3b8" : "linear-gradient(135deg, #14b8a6, #0d9488)" }}
                    >
                      Move
                    </button>
                    <button onClick={() => setSelectedPageIds([])} className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold border" style={{ color: "#334155", borderColor: "#dbe5f4", background: "#fff" }}>Clear</button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase" style={{ color: "#64748b" }}>Export</span>
                  {sources.length > 1 ? (
                    <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "#e2e8f0" }}>
                      <button
                        onClick={() => setExportMode("merge")}
                        className="px-3 py-1 text-[10px] font-black uppercase"
                        style={{ background: exportMode === "merge" ? "#0d9488" : "#f8fafc", color: exportMode === "merge" ? "#fff" : "#64748b" }}
                      >
                        Merge
                      </button>
                      <button
                        onClick={() => setExportMode("separate")}
                        className="px-3 py-1 text-[10px] font-black uppercase border-l"
                        style={{ borderLeftColor: "#e2e8f0", background: exportMode === "separate" ? "#0d9488" : "#f8fafc", color: exportMode === "separate" ? "#fff" : "#64748b" }}
                      >
                        Separate
                      </button>
                    </div>
                  ) : (
                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold" style={{ color: "#0f766e", background: "#f0fdfa", border: "1px solid #99f6e4" }}>Single PDF</span>
                  )}
                </div>
              </div>
            </section>

            <div className="flex items-center justify-between rounded-2xl border px-3 py-2" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
              <p className="text-[10px] font-semibold" style={{ color: "#64748b" }}>Small cards for faster browsing and drag sorting</p>
              <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase" style={{ background: "#f0fdfa", color: "#0f766e" }}>
                {selectedPageCount > 0 ? `${selectedPageCount} on` : "tap select"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-2xl border px-3 py-2" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
              <div>
                <p className="text-[10px] font-bold uppercase" style={{ color: "#64748b" }}>Files</p>
                <p className="text-[11px] font-semibold" style={{ color: "#0f172a" }}>{sources.length} PDF{sources.length !== 1 ? "s" : ""} loaded</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={openFilePicker} className="rounded-lg px-3 py-1.5 text-[10px] font-extrabold text-white" style={{ background: "#0d9488" }}>Add PDFs</button>
                <button onClick={resetAll} className="rounded-lg px-3 py-1.5 text-[10px] font-bold border" style={{ color: "#334155", borderColor: "#dbe5f4", background: "#fff" }}>Reset all</button>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handlePageDragStart}
              onDragCancel={handlePageDragCancel}
              onDragEnd={handlePageDragEnd}
              onDragMove={handlePageDragMove}
              autoScroll={false}
            >
              <SortableContext items={pages.map((page) => page.id)} strategy={rectSortingStrategy}>
                <div
                  className="grid gap-2 pb-2 w-full"
                  style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", overscrollBehaviorX: "none" as any }}
                >
                  {pages.map((page, index) => {
                    const meta = sourceMeta.get(page.sourceId);
                    if (!meta) return null;

                    return (
                      <SortablePageCard
                        key={page.id}
                        page={page}
                        position={index + 1}
                        tone={meta.tone}
                        sourceLabel={`PDF ${meta.order}`}
                        sourceName={meta.source.name}
                        sourcePageCount={meta.source.pageCount}
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

          <div className="flex-shrink-0 px-3 py-2 border-t" style={{ borderColor: "#e2e8f0", background: "rgba(255,255,255,0.96)" }}>
            <button
              onClick={saveAndDownload}
              disabled={saving || pages.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-extrabold text-sm active:scale-[0.99] transition-transform"
              style={{
                background: saving || pages.length === 0 ? "#94a3b8" : "#0f8a7d",
                boxShadow: saving || pages.length === 0 ? "none" : "0 3px 8px rgba(15,138,125,0.16)",
              }}
            >
              {saving ? "Preparing..." : exportMode === "merge" || sources.length === 1 ? "Download Organized PDF" : "Download ZIP"}
            </button>
          </div>
        </div>
      )}

      {isRenderingThumbs && null}
    </div>
  );
}
