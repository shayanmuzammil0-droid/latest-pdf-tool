import { useState, useRef, useCallback, useEffect } from "react";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragCancelEvent, DragEndEvent, DragStartEvent } from "@dnd-kit/core";
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

// ─── Types ────────────────────────────────────────────────────────────────────
type SplitMode = "extract" | "all" | "range";

interface SplitGroupInfo {
  fileNumber: number;
  position: number;
  total: number;
}

interface PageItem {
  id: string;
  index: number;
  thumbnail: string;
  rotation: number;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

const fmtSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};

const clonePdfBytes = (buffer: ArrayBuffer) => new Uint8Array(buffer.slice(0));

async function renderPageThumb(pdfDoc: pdfjsLib.PDFDocumentProxy, pageIndex: number): Promise<string> {
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

function parseRangeString(input: string, max: number): number[] {
  const result = new Set<number>();
  const parts = input.split(/[,\s]+/).filter(Boolean);
  for (const part of parts) {
    if (part.includes("-")) {
      const [s, e] = part.split("-").map((x) => parseInt(x, 10));
      if (!isNaN(s) && !isNaN(e)) {
        for (let i = Math.max(1, s); i <= Math.min(max, e); i++) result.add(i - 1);
      }
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n) && n >= 1 && n <= max) result.add(n - 1);
    }
  }
  return Array.from(result).sort((a, b) => a - b);
}

function formatRangeStringFromIndexes(indexes: number[]): string {
  if (indexes.length === 0) return "";
  const sorted = Array.from(new Set(indexes)).sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      parts.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);
      start = sorted[i];
      end = sorted[i];
    }
  }

  parts.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);
  return parts.join(", ");
}

function clampSplitEvery(value: number, max: number): number {
  if (!Number.isFinite(value)) return 1;
  if (max <= 0) return 1;
  return Math.min(max, Math.max(1, Math.round(value)));
}

function getSplitGroupInfo(orderIndex: number, totalPages: number, chunkSize: number): SplitGroupInfo {
  const normalizedChunkSize = Math.max(1, chunkSize);
  const groupStartIndex = Math.floor(orderIndex / normalizedChunkSize) * normalizedChunkSize;
  const groupEndIndex = Math.min(groupStartIndex + normalizedChunkSize, totalPages) - 1;

  return {
    fileNumber: Math.floor(orderIndex / normalizedChunkSize) + 1,
    position: orderIndex - groupStartIndex + 1,
    total: groupEndIndex - groupStartIndex + 1,
  };
}

// ─── Sortable Page Card ────────────────────────────────────────────────────────
interface PageCardProps {
  page: PageItem;
  isSelected: boolean;
  showSelection: boolean;
  splitGroupInfo?: SplitGroupInfo | null;
  onTap: (id: string) => void;
  onRotate: (id: string) => void;
}

function SortablePageCard({ page, isSelected, showSelection, splitGroupInfo, onTap, onRotate }: PageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: page.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`ms-page-card${isDragging ? " ms-page-card--dragging" : ""}${!isDragging && isOver ? " ms-page-card--drop-target" : ""}${isSelected ? " ms-page-card--selected" : ""}`}
      onClick={() => {
        if (showSelection && !isDragging) onTap(page.id);
      }}
      {...attributes}
      {...listeners}
    >
      {/* Drag handle */}
      <div className="ms-page-card__drag" aria-label="Drag card to reorder">
        <span className="ms-page-card__drag-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5V12.5M1.5 7H12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <path d="M7 1.5L5.5 3M7 1.5L8.5 3M7 12.5L5.5 11M7 12.5L8.5 11M1.5 7L3 5.5M1.5 7L3 8.5M12.5 7L11 5.5M12.5 7L11 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
        <span className="ms-page-card__drag-text">Drag</span>
        <span className="ms-page-card__drag-bars" aria-hidden="true">
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
            <rect x="2" y="0.75" width="14" height="1.5" rx="0.75" fill="currentColor" opacity="0.45"/>
            <rect x="2" y="4.25" width="14" height="1.5" rx="0.75" fill="currentColor" opacity="0.45"/>
            <rect x="2" y="7.75" width="14" height="1.5" rx="0.75" fill="currentColor" opacity="0.45"/>
          </svg>
        </span>
      </div>

      {/* Thumbnail */}
      <div
        className="ms-page-card__thumb"
        onPointerDownCapture={(e) => e.stopPropagation()}
        onMouseDownCapture={(e) => e.stopPropagation()}
        onTouchStartCapture={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (showSelection && !isDragging) onTap(page.id);
        }}
        aria-label={`Page ${page.index + 1}${isSelected ? " (selected)" : ""}`}
      >
        <button
          type="button"
          className="ms-page-card__rotate-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRotate(page.id);
          }}
          aria-label={`Rotate page ${page.index + 1}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {page.thumbnail ? (
          <img src={page.thumbnail} alt={`Page ${page.index + 1}`} style={{ transform: `rotate(${page.rotation}deg)` }} />
        ) : (
          <div className="ms-page-card__thumb-placeholder">
            <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
              <rect x="0" y="0" width="22" height="28" rx="3" fill="#e2e8f0"/>
              <rect x="3.5" y="6" width="15" height="1.5" rx="0.75" fill="#94a3b8"/>
              <rect x="3.5" y="10" width="10" height="1.5" rx="0.75" fill="#94a3b8"/>
              <rect x="3.5" y="14" width="13" height="1.5" rx="0.75" fill="#94a3b8"/>
              <rect x="3.5" y="18" width="8" height="1.5" rx="0.75" fill="#94a3b8"/>
            </svg>
          </div>
        )}
        {showSelection && isSelected && (
          <div className="ms-page-card__check">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="11" fill="#4f46e5"/>
              <path d="M6.5 11l3 3 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
        {splitGroupInfo && (
          <div className="ms-page-card__split-badge">
            <span className="ms-page-card__split-badge-text">
              PDF {splitGroupInfo.fileNumber} • {splitGroupInfo.total === 1 ? "single" : `${splitGroupInfo.position}/${splitGroupInfo.total}`}
            </span>
          </div>
        )}
      </div>

      {/* Page label */}
      <div className={`ms-page-card__label${isSelected ? " ms-page-card__label--active" : ""}`}>
        {page.index + 1}
      </div>
    </div>
  );
}

function PageCardOverlay({ page, isSelected, splitGroupInfo }: { page: PageItem; isSelected: boolean; splitGroupInfo?: SplitGroupInfo | null }) {
  return (
    <div className={`ms-page-card ms-page-card--overlay${isSelected ? " ms-page-card--selected" : ""}`}>
      <div className="ms-page-card__drag">
        <span className="ms-page-card__drag-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5V12.5M1.5 7H12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <path d="M7 1.5L5.5 3M7 1.5L8.5 3M7 12.5L5.5 11M7 12.5L8.5 11M1.5 7L3 5.5M1.5 7L3 8.5M12.5 7L11 5.5M12.5 7L11 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
        <span className="ms-page-card__drag-text">Drag</span>
        <span className="ms-page-card__drag-bars" aria-hidden="true">
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
            <rect x="2" y="0.75" width="14" height="1.5" rx="0.75" fill="currentColor" opacity="0.45"/>
            <rect x="2" y="4.25" width="14" height="1.5" rx="0.75" fill="currentColor" opacity="0.45"/>
            <rect x="2" y="7.75" width="14" height="1.5" rx="0.75" fill="currentColor" opacity="0.45"/>
          </svg>
        </span>
      </div>

      <div className="ms-page-card__thumb">
        {page.thumbnail ? (
          <img src={page.thumbnail} alt={`Page ${page.index + 1}`} style={{ transform: `rotate(${page.rotation}deg)` }} />
        ) : (
          <div className="ms-page-card__thumb-placeholder">
            <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
              <rect x="0" y="0" width="22" height="28" rx="3" fill="#e2e8f0"/>
              <rect x="3.5" y="6" width="15" height="1.5" rx="0.75" fill="#94a3b8"/>
              <rect x="3.5" y="10" width="10" height="1.5" rx="0.75" fill="#94a3b8"/>
              <rect x="3.5" y="14" width="13" height="1.5" rx="0.75" fill="#94a3b8"/>
              <rect x="3.5" y="18" width="8" height="1.5" rx="0.75" fill="#94a3b8"/>
            </svg>
          </div>
        )}
        {isSelected && (
          <div className="ms-page-card__check">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="11" fill="#4f46e5"/>
              <path d="M6.5 11l3 3 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
        {splitGroupInfo && (
          <div className="ms-page-card__split-badge">
            <span className="ms-page-card__split-badge-text">
              PDF {splitGroupInfo.fileNumber} • {splitGroupInfo.total === 1 ? "single" : `${splitGroupInfo.position}/${splitGroupInfo.total}`}
            </span>
          </div>
        )}
      </div>

      <div className={`ms-page-card__label${isSelected ? " ms-page-card__label--active" : ""}`}>
        {page.index + 1}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
interface SplitPDFMobileProps {
  onUploadScreenChange?: (isUploadScreen: boolean) => void;
}

export default function SplitPDFMobile({ onUploadScreenChange }: SplitPDFMobileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragJustEndedRef = useRef(false);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const dragPointerYRef = useRef<number | null>(null);
  const dragAutoScrollFrameRef = useRef<number | null>(null);
  const loadSessionRef = useRef(0);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [splitMode, setSplitMode] = useState<SplitMode>("extract");
  const [splitEveryCount, setSplitEveryCount] = useState(1);
  const [splitEveryInput, setSplitEveryInput] = useState("1");
  const [rangeInput, setRangeInput] = useState("");
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [isPageDragging, setIsPageDragging] = useState(false);

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [splitting, setSplitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    onUploadScreenChange?.(!pdfFile && !loading);
  }, [onUploadScreenChange, pdfFile, loading]);

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 110, tolerance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadPdf = useCallback(async (file: File) => {
    if (!file.type.includes("pdf")) {
      addToast("Please select a valid PDF file", "error");
      return;
    }
    const sessionId = Date.now();
    loadSessionRef.current = sessionId;
    try {
      setLoading(true);
      setLoadingProgress(10);
      const sourceBuffer = await file.arrayBuffer();
      const pdfLibBuffer = sourceBuffer.slice(0);
      const pdfJsBuffer = sourceBuffer.slice(0);
      setArrayBuffer(pdfLibBuffer);
      setLoadingProgress(30);

      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfJsBuffer) }).promise;
      const count = doc.numPages;
      if (loadSessionRef.current !== sessionId) return;
      setPageCount(count);
      const pageItems: PageItem[] = Array.from({ length: count }, (_, index) => ({
        id: uid(),
        index,
        thumbnail: "",
        rotation: 0,
      }));

      setPdfFile(file);
      setPages(pageItems);
      setSelectedIds(new Set());
      setSplitEveryCount(1);
      setSplitEveryInput("1");
      setRangeInput("");
      setSplitMode("extract");
      setLoadingProgress(100);
      setLoading(false);

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
        const ratio = (Math.min(start + batchSize, count)) / count;
        setLoadingProgress(Math.min(100, Math.round(55 + ratio * 45)));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    } catch {
      addToast("Failed to load PDF", "error");
      setLoading(false);
    }
  }, [addToast]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) loadPdf(file);
  }, [loadPdf]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadPdf(file);
  }, [loadPdf]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    dragJustEndedRef.current = false;
    setActivePageId(String(event.active.id));
    setIsPageDragging(true);
  }, []);

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setActivePageId(null);
    setIsPageDragging(false);
    dragJustEndedRef.current = true;
    window.setTimeout(() => {
      dragJustEndedRef.current = false;
    }, 140);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPages((prev) => {
        const oldIdx = prev.findIndex((p) => p.id === active.id);
        const newIdx = prev.findIndex((p) => p.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
    setActivePageId(null);
    setIsPageDragging(false);
    dragJustEndedRef.current = true;
    window.setTimeout(() => {
      dragJustEndedRef.current = false;
    }, 140);
  }, []);

  // Lock outer page scroll while editor is active so only the inner grid scrollbar shows
  useEffect(() => {
    if (!pdfFile || loading) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pdfFile, loading]);

  useEffect(() => {
    const stopAutoScroll = () => {
      if (dragAutoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(dragAutoScrollFrameRef.current);
        dragAutoScrollFrameRef.current = null;
      }
    };

    if (!isPageDragging) {
      dragPointerYRef.current = null;
      stopAutoScroll();
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      dragPointerYRef.current = event.clientY;
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) dragPointerYRef.current = touch.clientY;
    };

    const tick = () => {
      const container = gridScrollRef.current;
      const pointerY = dragPointerYRef.current;

      if (container && pointerY !== null) {
        const rect = container.getBoundingClientRect();
        const threshold = 96;
        const topDistance = pointerY - rect.top;
        const bottomDistance = rect.bottom - pointerY;
        let delta = 0;

        if (topDistance < threshold) {
          const ratio = Math.max(0, (threshold - topDistance) / threshold);
          delta = -Math.ceil(4 + ratio * 16);
        } else if (bottomDistance < threshold) {
          const ratio = Math.max(0, (threshold - bottomDistance) / threshold);
          delta = Math.ceil(4 + ratio * 16);
        }

        if (delta !== 0) {
          container.scrollTop += delta;
        }
      }

      dragAutoScrollFrameRef.current = window.requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    dragAutoScrollFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchmove", onTouchMove);
      dragPointerYRef.current = null;
      stopAutoScroll();
    };
  }, [isPageDragging]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectedIdsToRangeString = useCallback((ids: Set<string>) => {
    const indexes = pages
      .filter((p) => ids.has(p.id))
      .map((p) => p.index);
    return formatRangeStringFromIndexes(indexes);
  }, [pages]);

  const indexesToIdSet = useCallback((indexes: number[]) => {
    const indexSet = new Set(indexes);
    const idSet = new Set<string>();
    pages.forEach((p) => {
      if (indexSet.has(p.index)) idSet.add(p.id);
    });
    return idSet;
  }, [pages]);

  const handleRangeInputChange = useCallback((value: string) => {
    setRangeInput(value);
    const parsed = parseRangeString(value, pageCount);
    setSelectedIds(indexesToIdSet(parsed));
  }, [pageCount, indexesToIdSet]);

  const handleModeChange = useCallback((mode: SplitMode) => {
    setSplitMode(mode);
    if (mode === "range") {
      setRangeInput(selectedIdsToRangeString(selectedIds));
    }
  }, [selectedIds, selectedIdsToRangeString]);

  const applySplitEveryValue = useCallback((value: number) => {
    const normalized = clampSplitEvery(value, pageCount);
    setSplitEveryCount(normalized);
    setSplitEveryInput(String(normalized));
  }, [pageCount]);

  const handleSplitEveryInputChange = useCallback((value: string) => {
    const digitsOnly = value.replace(/[^\d]/g, "");
    if (digitsOnly === "") {
      setSplitEveryInput("");
      return;
    }

    const normalized = clampSplitEvery(parseInt(digitsOnly, 10), pageCount);
    setSplitEveryCount(normalized);
    setSplitEveryInput(String(normalized));
  }, [pageCount]);

  const handleSplitEveryBlur = useCallback(() => {
    if (!splitEveryInput) {
      setSplitEveryInput(String(splitEveryCount));
      return;
    }

    applySplitEveryValue(parseInt(splitEveryInput, 10));
  }, [applySplitEveryValue, splitEveryCount, splitEveryInput]);

  const handleToggleSelect = useCallback((id: string) => {
    if (dragJustEndedRef.current) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (splitMode === "range") {
        setRangeInput(selectedIdsToRangeString(next));
      }
      return next;
    });
  }, [splitMode, selectedIdsToRangeString]);

  const handleSelectAll = useCallback(() => {
    const allIds = new Set(pages.map((p) => p.id));
    setSelectedIds(allIds);
    if (splitMode === "range") {
      setRangeInput(selectedIdsToRangeString(allIds));
    }
  }, [pages, splitMode, selectedIdsToRangeString]);

  const handleSelectNone = useCallback(() => {
    setSelectedIds(new Set());
    if (splitMode === "range") {
      setRangeInput("");
    }
  }, [splitMode]);

  const handleInvertSelection = useCallback(() => {
    const next = new Set<string>();
    pages.forEach((p) => {
      if (!selectedIds.has(p.id)) next.add(p.id);
    });
    setSelectedIds(next);
    if (splitMode === "range") {
      setRangeInput(selectedIdsToRangeString(next));
    }
  }, [pages, selectedIds, splitMode, selectedIdsToRangeString]);

  const handleRotatePage = useCallback((id: string) => {
    setPages((prev) => prev.map((page) => (
      page.id === id ? { ...page, rotation: (page.rotation + 90) % 360 } : page
    )));
  }, []);

  const activePage = activePageId ? pages.find((p) => p.id === activePageId) ?? null : null;
  const normalizedSplitEveryCount = clampSplitEvery(splitEveryCount, pageCount || 1);
  const splitAllFileCount = pageCount > 0 ? Math.ceil(pageCount / normalizedSplitEveryCount) : 0;
  const splitGroupInfoById = new Map<string, SplitGroupInfo>();

  if (splitMode === "all") {
    pages.forEach((page, orderIndex) => {
      splitGroupInfoById.set(page.id, getSplitGroupInfo(orderIndex, pages.length, normalizedSplitEveryCount));
    });
  }

  const getSourcePdfBytes = useCallback(async () => {
    if (pdfFile) {
      const freshBuffer = await pdfFile.arrayBuffer();
      if (freshBuffer.byteLength > 0) return clonePdfBytes(freshBuffer);
    }

    if (arrayBuffer && arrayBuffer.byteLength > 0) {
      return clonePdfBytes(arrayBuffer);
    }

    throw new Error("No valid PDF data is available. Please re-upload the file.");
  }, [arrayBuffer, pdfFile]);

  const splitPdf = useCallback(async () => {
    if (!pdfFile || !arrayBuffer) return;
    setSplitting(true);
    try {
      const sourceBytes = await getSourcePdfBytes();
      const pdfLib = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
      const outputFiles: { name: string; bytes: Uint8Array }[] = [];
      const baseName = pdfFile.name.replace(/\.pdf$/i, "");

      if (splitMode === "all") {
        for (let start = 0; start < pages.length; start += normalizedSplitEveryCount) {
          const chunk = pages.slice(start, start + normalizedSplitEveryCount);
          const doc = await PDFDocument.create();
          const copiedPages = await doc.copyPages(pdfLib, chunk.map((pageItem) => pageItem.index));
          copiedPages.forEach((page) => doc.addPage(page));
          const firstPageNumber = chunk[0].index + 1;
          const lastPageNumber = chunk[chunk.length - 1].index + 1;
          outputFiles.push({
            name: firstPageNumber === lastPageNumber
              ? `${baseName}-page-${firstPageNumber}.pdf`
              : `${baseName}-pages-${firstPageNumber}-${lastPageNumber}.pdf`,
            bytes: new Uint8Array(await doc.save()),
          });
        }
      } else if (splitMode === "extract") {
        if (selectedIds.size === 0) {
          addToast("Select at least one page first", "error");
          setSplitting(false);
          return;
        }
        const ordered = pages.filter((p) => selectedIds.has(p.id));
        const doc = await PDFDocument.create();
        const pgs = await doc.copyPages(pdfLib, ordered.map((p) => p.index));
        pgs.forEach((pg) => doc.addPage(pg));
        outputFiles.push({
          name: `${baseName}-extracted.pdf`,
          bytes: new Uint8Array(await doc.save()),
        });
      } else if (splitMode === "range") {
        const rangePages = parseRangeString(rangeInput, pageCount);
        if (rangePages.length === 0) {
          addToast("Enter a valid range (e.g. 1-3, 5)", "error");
          setSplitting(false);
          return;
        }
        const doc = await PDFDocument.create();
        const pgs = await doc.copyPages(pdfLib, rangePages);
        pgs.forEach((pg) => doc.addPage(pg));
        outputFiles.push({
          name: `${baseName}-range.pdf`,
          bytes: new Uint8Array(await doc.save()),
        });
      }

      if (outputFiles.length === 0) {
        throw new Error("No output files were generated for the selected split mode.");
      }

      if (outputFiles.length === 1) {
        const blob = new Blob([outputFiles[0].bytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = outputFiles[0].name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        addToast("PDF downloaded!", "success");
      } else {
        const zip = new JSZip();
        outputFiles.forEach((f) => zip.file(f.name, f.bytes));
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}-split.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        addToast(`${outputFiles.length} PDFs zipped & downloaded!`, "success");
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to split PDF", "error");
    } finally {
      setSplitting(false);
    }
  }, [pdfFile, arrayBuffer, splitMode, selectedIds, pages, pageCount, rangeInput, addToast, getSourcePdfBytes, normalizedSplitEveryCount]);

  const reset = useCallback(() => {
    loadSessionRef.current = Date.now();
    setPdfFile(null);
    setArrayBuffer(null);
    setPages([]);
    setSelectedIds(new Set());
    setPageCount(0);
    setSplitEveryCount(1);
    setSplitEveryInput("1");
    setRangeInput("");
    setSplitMode("extract");
  }, []);

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-bg">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Toasts */}
      <div className="fixed top-4 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl ${
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
              Split <span className="heading-gradient">PDF</span>
            </h1>
            <p className="text-sm" style={{ color: "#64748b" }}>
              Extract pages, split by range, or separate every page
            </p>
          </div>

          {/* Upload Zone */}
          <div
            className={`upload-zone-premium rounded-3xl cursor-pointer mb-5 ${isDraggingOver ? "upload-zone-active" : ""}`}
            style={{ padding: "44px 24px" }}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-4 text-center relative z-10">
              <div style={{ position: "relative", width: 80, height: 88 }}>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "rotate(-10deg) translateX(-18px) translateY(-18px)", zIndex: 1 }}>
                  <div style={{ width: 44, height: 52, borderRadius: 8, background: "linear-gradient(145deg,#a5b4fc,#818cf8)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", opacity: 0.75 }} />
                </div>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translateX(-29px) translateY(-34px)", zIndex: 3 }}>
                  <div style={{ width: 58, height: 68, borderRadius: 12, background: "linear-gradient(145deg,#6366f1,#4f46e5,#4338ca)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(79,70,229,0.4)" }}>
                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white" opacity="0.95"/>
                      <polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="1.8" fill="none" opacity="0.6"/>
                      <circle cx="6" cy="18" r="2" stroke="white" strokeWidth="1.4" opacity="0.9"/>
                      <path d="M19 7L9.5 16.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.9"/>
                      <circle cx="19" cy="16.5" r="2" stroke="white" strokeWidth="1.4" opacity="0.9"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-extrabold text-xl mb-1" style={{ color: isDraggingOver ? "#4f46e5" : "#0f172a" }}>
                  {isDraggingOver ? "Drop your PDF here!" : "Drag & Drop a PDF File Here"}
                </p>
                <p className="text-sm" style={{ color: isDraggingOver ? "#818cf8" : "#64748b" }}>
                  {isDraggingOver ? "Release to load file" : "or click to browse from your device"}
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

        </div>
      ) : loading ? (
        /* ── Loading Screen ───────────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center min-h-screen gap-5 px-8">
          <div className="w-16 h-16 rounded-2xl logo-icon flex items-center justify-center shadow-lg">
            <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="font-bold text-base" style={{ color: "#0f172a" }}>Loading PDF…</p>
            <p className="text-sm mt-1" style={{ color: "#64748b" }}>Generating page previews</p>
          </div>
          <div className="w-52 h-2 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${loadingProgress}%`, background: "linear-gradient(90deg, #4f46e5, #6366f1)" }}
            />
          </div>
          <p className="text-xs font-semibold" style={{ color: "#94a3b8" }}>{loadingProgress}%</p>
        </div>
      ) : (
        /* ── Editor Screen ────────────────────────────────────────────────── */
        <div className="flex flex-col overflow-hidden" style={{ height: "calc(100dvh - 56px)" }}>
          {/* Top bar */}
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
              <p className="text-sm font-bold truncate" style={{ color: "#0f172a" }}>{pdfFile.name}</p>
              <p className="text-xs" style={{ color: "#64748b" }}>{pageCount} pages · {fmtSize(pdfFile.size)}</p>
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

          {/* Page grid */}
          <div ref={gridScrollRef} className="flex-1 px-4 pt-4 pb-4 overflow-y-auto">
            {/* Context hint */}
            {splitMode !== "all" && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold" style={{ color: "#64748b" }}>
                  {splitMode === "extract"
                    ? (selectedIds.size > 0
                      ? `${selectedIds.size} of ${pageCount} selected`
                      : "Tap pages to select · Drag to reorder")
                    : (rangeInput
                      ? `Range: ${rangeInput}`
                      : "Tap or type range · Reorder")}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="ms-quick-btn ms-quick-btn--primary"
                  >
                    All
                  </button>
                  <button
                    onClick={handleSelectNone}
                    className="ms-quick-btn ms-quick-btn--neutral"
                  >
                    None
                  </button>
                  <button
                    onClick={handleInvertSelection}
                    className="ms-quick-btn ms-quick-btn--accent"
                  >
                    Invert
                  </button>
                </div>
              </div>
            )}

            {splitMode === "all" && (
              <div
                className="mb-2 px-3 py-1.5 rounded-xl flex items-center gap-2"
                style={{ background: "#eef2ff" }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="#4f46e5" strokeWidth="2"/>
                  <path d="M12 8v4M12 16h.01" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
                <p className="text-xs font-medium" style={{ color: "#4f46e5" }}>
                  Every {normalizedSplitEveryCount} page{normalizedSplitEveryCount !== 1 ? "s" : ""} → {splitAllFileCount} PDF{splitAllFileCount !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {splitMode === "range" && (
              <div className="mb-3 px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: "#f0fdf4" }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="2"/>
                  <path d="M8 12l3 3 5-5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-xs font-medium" style={{ color: "#15803d" }}>
                  Specify ranges below — selected pages become one PDF
                </p>
              </div>
            )}

            {/* Sortable page cards */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              autoScroll={false}
              onDragStart={handleDragStart}
              onDragCancel={handleDragCancel}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
                <div className={`grid grid-cols-3 gap-3${isPageDragging ? " ms-card-grid--dragging" : ""}`}>
                  {pages.map((page) => (
                    <SortablePageCard
                      key={page.id}
                      page={page}
                      isSelected={selectedIds.has(page.id)}
                      showSelection={splitMode !== "all"}
                      splitGroupInfo={splitMode === "all" ? splitGroupInfoById.get(page.id) ?? null : null}
                      onTap={handleToggleSelect}
                      onRotate={handleRotatePage}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activePage ? (
                  <PageCardOverlay
                    page={activePage}
                    isSelected={selectedIds.has(activePage.id)}
                    splitGroupInfo={splitMode === "all" ? splitGroupInfoById.get(activePage.id) ?? null : null}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* ── Bottom Action Sheet ──────────────────────────────────────── */}
          <div
            className="ms-bottom-sheet bg-white border-t"
          >
            {/* Mode tabs */}
            <div className="flex gap-1.5 px-3.5 pt-2 pb-1.5">
              {(
                [
                  { id: "extract" as SplitMode, emoji: "☑️", label: "Extract" },
                  { id: "all" as SplitMode, emoji: "✂️", label: "Split All" },
                  { id: "range" as SplitMode, emoji: "📋", label: "By Range" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModeChange(m.id)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5"
                  style={
                    splitMode === m.id
                      ? {
                          background: "linear-gradient(135deg, #4f46e5, #6366f1)",
                          color: "white",
                          boxShadow: "0 2px 8px rgba(79,70,229,0.32)",
                        }
                      : { background: "#f1f5f9", color: "#64748b" }
                  }
                >
                  <span className="text-sm leading-none">{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Range input */}
            {splitMode === "range" && (
              <div className="px-3.5 pb-1.5">
                <input
                  type="text"
                  inputMode="text"
                  value={rangeInput}
                  onChange={(e) => handleRangeInputChange(e.target.value)}
                  placeholder={`Pages 1–${pageCount}, e.g. 1-3, 5, 8`}
                  className="w-full px-3 py-1.5 rounded-lg text-[13px] font-medium outline-none"
                  style={{
                    border: "2px solid #c7d2fe",
                    background: "#fafbff",
                    color: "#0f172a",
                  }}
                />
              </div>
            )}

            {splitMode === "all" && (
              <div className="px-3.5 pb-1.5">
                <div className="ms-split-inline-control">
                  <span className="ms-split-inline-control__label">After every</span>
                  <button
                    type="button"
                    className="ms-split-inline-control__button"
                    onClick={() => applySplitEveryValue(normalizedSplitEveryCount - 1)}
                    disabled={normalizedSplitEveryCount <= 1}
                    aria-label="Decrease split interval"
                  >
                    -
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={splitEveryInput}
                    onChange={(e) => handleSplitEveryInputChange(e.target.value)}
                    onBlur={handleSplitEveryBlur}
                    className="ms-split-inline-control__input"
                    aria-label="Pages per split file"
                  />
                  <button
                    type="button"
                    className="ms-split-inline-control__button"
                    onClick={() => applySplitEveryValue(normalizedSplitEveryCount + 1)}
                    disabled={normalizedSplitEveryCount >= pageCount}
                    aria-label="Increase split interval"
                  >
                    +
                  </button>
                  <span className="ms-split-inline-control__suffix">page{normalizedSplitEveryCount !== 1 ? "s" : ""}</span>
                </div>
              </div>
            )}

            {/* Execute button */}
            <div className="px-3.5 pt-0.5" style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}>
              <button
                onClick={splitPdf}
                disabled={splitting}
                className="w-full py-3 rounded-xl text-white font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
                style={{
                  background: splitting ? "#94a3b8" : "linear-gradient(135deg, #4f46e5, #6366f1)",
                  boxShadow: splitting ? "none" : "0 3px 12px rgba(79,70,229,0.32)",
                }}
              >
                {splitting ? (
                  <>
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Processing…
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                      <path d="M12 3v13M7 11l5 5 5-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 21h18" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                    </svg>
                    {splitMode === "all"
                      ? `Split into ${splitAllFileCount} PDF${splitAllFileCount !== 1 ? "s" : ""}`
                      : splitMode === "extract"
                        ? selectedIds.size > 0
                          ? `Extract ${selectedIds.size} Page${selectedIds.size !== 1 ? "s" : ""}`
                          : "Extract Selected Pages"
                        : "Extract Range"}
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
