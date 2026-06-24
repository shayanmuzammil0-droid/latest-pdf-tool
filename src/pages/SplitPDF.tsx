import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { Layers3, Ruler, Rows3, SquareCheckBig } from "lucide-react";
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
import type { DragCancelEvent, DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Types ───────────────────────────────────────────────────────────────────
interface SplitToast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface PageThumb {
  index: number; // 0-based
  thumbnail: string;
}

interface CompressedPageAsset {
  bytes: Uint8Array;
  width: number;
  height: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};

const clonePdfBytes = (buffer: ArrayBuffer) => new Uint8Array(buffer.slice(0));
const getPdfBaseName = (name: string) => name.replace(/\.pdf$/i, "") || "document";

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
    return canvas.toDataURL("image/jpeg", 0.7);
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

const DownloadIcon = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
    <path d="M12 3v13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M7 11l5 5 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.25"/>
    <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

const ScissorsIcon = () => (
  <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
    <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="2"/>
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M20 4L8.12 15.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M14.47 14.48L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M8.12 8.12L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// ─── Split Mode Types ─────────────────────────────────────────────────────────
type SplitMode = "select" | "range" | "size";
type RangeMode = "custom" | "fixed";
type SelectExtractMode = "all" | "custom";
type SizeUnit = "KB" | "MB";

const MB_IN_BYTES = 1024 * 1024;
const KB_IN_BYTES = 1024;

interface RangeSegment {
  id: string;
  start: number;
  end: number;
}

interface SortableRangeCardProps {
  id: string;
  children: React.ReactNode;
}

interface RangeCardContentProps {
  segment: RangeSegment;
  index: number;
  firstThumb?: string;
  lastThumb?: string;
  showDragHint?: boolean;
}

function RangeCardContent({ segment, index, firstThumb, lastThumb, showDragHint = false }: RangeCardContentProps) {
  const count = segment.end - segment.start + 1;
  const isSinglePage = count === 1;

  return (
    <>
      <div className="range-preview-top">
        <p className="range-preview-title">Range {index + 1}</p>
        <div className="range-preview-top-actions">
          {showDragHint && (
            <span
              className="range-reorder-chip"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginRight: 4,
                padding: "3px 9px",
                borderRadius: 999,
                border: "1px solid #c7d2fe",
                background: "linear-gradient(180deg, #f5f7ff, #e9eeff)",
                color: "#4338ca",
                boxShadow: "0 1px 4px rgba(79,70,229,0.14)",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M8 6l-3 3 3 3M16 18l3-3-3-3M5 9h10M19 15H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Drag
              </span>
            </span>
          )}
          <span className="range-preview-badge">{isSinglePage ? segment.start : `${segment.start}–${segment.end}`}</span>
        </div>
      </div>
      <div className="range-preview-track">
        <div className="range-thumb-wrap">
          <div className="range-preview-thumb">
            {firstThumb ? <img src={firstThumb} alt={`Page ${segment.start}`} /> : <span>P{segment.start}</span>}
          </div>
          <span className="range-thumb-label">pg {segment.start}</span>
        </div>
        {!isSinglePage && (
          <>
            <div className="range-preview-connector">
              <div className="range-connector-line" />
              <span className="range-connector-dots">···</span>
              <div className="range-connector-line" />
            </div>
            <div className="range-thumb-wrap">
              <div className="range-preview-thumb">
                {lastThumb ? <img src={lastThumb} alt={`Page ${segment.end}`} /> : <span>P{segment.end}</span>}
              </div>
              <span className="range-thumb-label">pg {segment.end}</span>
            </div>
          </>
        )}
      </div>
      <div className="range-preview-meta">{count} {count === 1 ? "page" : "pages"}</div>
    </>
  );
}

function SortableRangeCard({ id, children }: SortableRangeCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`range-preview-card ${isDragging ? "range-card-dragging" : ""} ${!isDragging && isOver ? "range-card-drop-target" : ""}`}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

const clampPage = (value: number, max: number) => {
  if (max <= 0) return 1;
  return Math.max(1, Math.min(max, value));
};

const normalizeSegment = (segment: RangeSegment, max: number): RangeSegment => {
  const start = clampPage(segment.start, max);
  const end = clampPage(segment.end, max);
  return start <= end
    ? { ...segment, start, end }
    : { ...segment, start: end, end: start };
};

const buildFixedRanges = (max: number, size: number): RangeSegment[] => {
  if (max <= 0) return [];
  const chunk = Math.max(1, size);
  const ranges: RangeSegment[] = [];
  let cursor = 1;
  while (cursor <= max) {
    const end = Math.min(max, cursor + chunk - 1);
    ranges.push({ id: uid(), start: cursor, end });
    cursor = end + 1;
  }
  return ranges;
};

const pagesFromSegment = (segment: RangeSegment, max: number) => {
  const normalized = normalizeSegment(segment, max);
  const pages: number[] = [];
  for (let i = normalized.start; i <= normalized.end; i++) pages.push(i - 1);
  return pages;
};

// ─── Main Component ───────────────────────────────────────────────────────────
interface SplitPDFProps {
  onUploadScreenChange?: (isUploadScreen: boolean) => void;
}

export default function SplitPDF({ onUploadScreenChange }: SplitPDFProps) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [thumbnailRotations, setThumbnailRotations] = useState<Record<number, number>>({});
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [splitMode, setSplitMode] = useState<SplitMode>("select");
  const [rangeMode, setRangeMode] = useState<RangeMode>("custom");
  const [selectExtractMode, setSelectExtractMode] = useState<SelectExtractMode>("custom");
  const [mergeSelectedPages, setMergeSelectedPages] = useState(true);
  const [pagesToExtractInput, setPagesToExtractInput] = useState("");
  const [customRanges, setCustomRanges] = useState<RangeSegment[]>([{ id: uid(), start: 1, end: 1 }]);
  const [customRangeDrafts, setCustomRangeDrafts] = useState<Record<string, string>>({});
  const [fixedRangeSize, setFixedRangeSize] = useState(2);
  const [mergeRanges, setMergeRanges] = useState(true);
  const [maxSizePerFile, setMaxSizePerFile] = useState(1);
  const [maxSizeInput, setMaxSizeInput] = useState("1");
  const [maxSizeUnit, setMaxSizeUnit] = useState<SizeUnit>("MB");
  const [allowCompression, setAllowCompression] = useState(false);
  const [rangeInput, setRangeInput] = useState("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [splitting, setSplitting] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState("split-document.pdf");
  const [resultSize, setResultSize] = useState(0);
  const [resultPages, setResultPages] = useState(0);
  const [resultFileCount, setResultFileCount] = useState(0);
  const [activeRangeId, setActiveRangeId] = useState<string | null>(null);
  const [isRangeDragging, setIsRangeDragging] = useState(false);
  const [toasts, setToasts] = useState<SplitToast[]>([]);
  const [sizeMinimumBytes, setSizeMinimumBytes] = useState<{ raw: number; compressed: number } | null>(null);
  const [calculatingSizeMinimums, setCalculatingSizeMinimums] = useState(false);
  const [sizeMinimumApplied, setSizeMinimumApplied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditingPagesInputRef = useRef(false);
  const compressedPageCacheRef = useRef<Map<string, CompressedPageAsset>>(new Map());
  const rangeSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 110, tolerance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const thumbsByIndex = useMemo(() => {
    const map = new Map<number, string>();
    thumbs.forEach((thumb) => map.set(thumb.index, thumb.thumbnail));
    return map;
  }, [thumbs]);
  const pdfSizeBytes = pdfFile?.size ?? 0;
  const isMbOptionEnabled = pdfSizeBytes >= MB_IN_BYTES;
  const maxSizeLimitForKb = Math.max(1, Math.floor(pdfSizeBytes / KB_IN_BYTES) || (pdfSizeBytes > 0 ? 1 : 1));
  const maxSizeLimitForMb = Math.max(0.1, Number((pdfSizeBytes / MB_IN_BYTES).toFixed(1)) || 0.1);
  const currentSizeLimit = maxSizeUnit === "KB" ? maxSizeLimitForKb : maxSizeLimitForMb;
  const sizeLimitBytes = maxSizeUnit === "KB"
    ? Math.max(1, Math.round(maxSizePerFile)) * KB_IN_BYTES
    : Math.max(0.1, Number(maxSizePerFile.toFixed(1))) * MB_IN_BYTES;
  const effectiveCompression = allowCompression;
  const selectedMinimumBytes = sizeMinimumBytes
    ? (effectiveCompression ? sizeMinimumBytes.compressed : sizeMinimumBytes.raw)
    : KB_IN_BYTES;
  const safeMinimumBytes = sizeMinimumBytes?.raw ?? KB_IN_BYTES;
  const minimumLimitValue = maxSizeUnit === "KB"
    ? (allowCompression ? 1 : Math.max(1, Math.ceil(selectedMinimumBytes / KB_IN_BYTES)))
    : (allowCompression ? 0.1 : Math.max(0.1, Number((selectedMinimumBytes / MB_IN_BYTES).toFixed(1))));
  const parsedMaxSizeInput = Number.parseFloat(maxSizeInput);
  const typedLimitBytes = Number.isFinite(parsedMaxSizeInput)
    ? (maxSizeUnit === "KB"
      ? Math.max(1, Math.round(parsedMaxSizeInput)) * KB_IN_BYTES
      : Math.max(0.1, Number(parsedMaxSizeInput.toFixed(1))) * MB_IN_BYTES)
    : sizeLimitBytes;
  const showQualityRiskWarning = allowCompression
    && Number.isFinite(parsedMaxSizeInput)
    && typedLimitBytes < safeMinimumBytes;
  const showVeryLowWarning = showQualityRiskWarning && typedLimitBytes < safeMinimumBytes * 0.5;

  useEffect(() => {
    onUploadScreenChange?.(!pdfFile && !loading);
  }, [onUploadScreenChange, pdfFile, loading]);

  const addToast = (message: string, type: SplitToast["type"] = "info") => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const formatPageSelectionInput = useCallback((pages: Set<number>) => {
    const sortedPages = Array.from(pages).sort((a, b) => a - b);
    if (sortedPages.length === 0) return "";

    const chunks: string[] = [];
    let rangeStart = sortedPages[0];
    let previousPage = sortedPages[0];

    for (let index = 1; index <= sortedPages.length; index++) {
      const currentPage = sortedPages[index];
      const continuesRange = currentPage === previousPage + 1;

      if (continuesRange) {
        previousPage = currentPage;
        continue;
      }

      chunks.push(
        rangeStart === previousPage
          ? `${rangeStart + 1}`
          : `${rangeStart + 1}-${previousPage + 1}`
      );

      rangeStart = currentPage;
      previousPage = currentPage;
    }

    return chunks.join(",");
  }, []);

  const applySelectedPages = useCallback((next: Set<number>) => {
    setSelectedPages(next);
    setPagesToExtractInput(formatPageSelectionInput(next));
    setResultUrl(null);
  }, [formatPageSelectionInput]);

  const rotateThumbnail = useCallback((index: number) => {
    setThumbnailRotations((prev) => ({
      ...prev,
      [index]: ((prev[index] ?? 0) + 90) % 360,
    }));
  }, []);

  const clampSizeValue = useCallback((value: number, unit: SizeUnit) => {
    if (unit === "KB") {
      const minKb = allowCompression ? 1 : Math.max(1, Math.ceil(selectedMinimumBytes / KB_IN_BYTES));
      return Math.max(minKb, Math.min(maxSizeLimitForKb, Math.round(value) || minKb));
    }

    const minMb = allowCompression ? 0.1 : Math.max(0.1, Number((selectedMinimumBytes / MB_IN_BYTES).toFixed(1)));
    const roundedValue = Number(value.toFixed(1));
    return Math.max(minMb, Math.min(maxSizeLimitForMb, roundedValue || minMb));
  }, [allowCompression, maxSizeLimitForKb, maxSizeLimitForMb, selectedMinimumBytes]);

  const updateMaxSizePerFile = useCallback((value: number, unit: SizeUnit = maxSizeUnit) => {
    setMaxSizePerFile(clampSizeValue(value, unit));
    setResultUrl(null);
  }, [clampSizeValue, maxSizeUnit]);

  const formatSizeInputValue = useCallback((value: number, unit: SizeUnit) => {
    if (unit === "KB") return String(Math.max(1, Math.round(value)));
    return Number(Math.max(0.1, value).toFixed(1)).toString();
  }, []);

  const commitMaxSizeInput = useCallback((valueText?: string) => {
    const parsed = Number.parseFloat(valueText ?? maxSizeInput);
    const normalized = clampSizeValue(Number.isFinite(parsed) ? parsed : minimumLimitValue, maxSizeUnit);
    setMaxSizePerFile(normalized);
    setMaxSizeInput(formatSizeInputValue(normalized, maxSizeUnit));
    setResultUrl(null);
    return normalized;
  }, [clampSizeValue, formatSizeInputValue, maxSizeInput, maxSizeUnit, minimumLimitValue]);

  const handleMaxSizeUnitChange = useCallback((unit: SizeUnit) => {
    if (unit === "MB" && !isMbOptionEnabled) return;
    const currentBytes = maxSizeUnit === "KB"
      ? Math.max(1, Math.round(maxSizePerFile)) * KB_IN_BYTES
      : Math.max(0.1, Number(maxSizePerFile.toFixed(1))) * MB_IN_BYTES;
    const nextValue = unit === "KB"
      ? currentBytes / KB_IN_BYTES
      : currentBytes / MB_IN_BYTES;
    setMaxSizeUnit(unit);
    setMaxSizePerFile(clampSizeValue(nextValue, unit));
    setResultUrl(null);
  }, [clampSizeValue, isMbOptionEnabled, maxSizePerFile, maxSizeUnit]);

  const loadPDF = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      addToast("Please upload a PDF file.", "error");
      return;
    }
    setLoading(true);
    setLoadingProgress(0);
    setResultUrl(null);
    setThumbs([]);
    setThumbnailRotations({});
    setSelectedPages(new Set());
    setSplitMode("select");
    setSelectExtractMode("custom");
    setMaxSizeInput("1");
    setSizeMinimumBytes(null);
    setCalculatingSizeMinimums(false);
    setSizeMinimumApplied(false);
    compressedPageCacheRef.current.clear();
    try {
      const buf = await file.arrayBuffer();
      // Keep a separate copy for pdf-lib (pdfjs transfers its ArrayBuffer to the worker, detaching the original)
      const bufForPdfLib = buf.slice(0);
      setArrayBuffer(bufForPdfLib);

      // Get page count quickly using pdfjs (single document load)
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
      const pdfJsDoc = await loadingTask.promise;
      const count = pdfJsDoc.numPages;
      setPageCount(count);
      setPdfFile(file);
      setCustomRanges([{ id: uid(), start: 1, end: Math.min(3, count) }]);

      // Show editor immediately — thumbnails load in the background
      setLoading(false);
      addToast(`PDF loaded — ${count} pages found.`, "success");

      // Render thumbnails in background using the already-loaded pdfjs document
      const batchSize = 6;
      const allThumbs: PageThumb[] = [];
      for (let i = 0; i < count; i += batchSize) {
        const batch = Array.from({ length: Math.min(batchSize, count - i) }, (_, j) => i + j);
        const results = await Promise.all(
          batch.map((idx) => renderPageThumb(pdfJsDoc, idx).then((t) => ({ index: idx, thumbnail: t })))
        );
        allThumbs.push(...results);
        setThumbs([...allThumbs]);
        setLoadingProgress(Math.round(((i + batchSize) / count) * 100));
        await new Promise((r) => setTimeout(r, 0));
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to load PDF. File may be encrypted or corrupted.", "error");
      setLoading(false);
    } finally {
      setLoadingProgress(0);
    }
  }, []);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) loadPDF(e.target.files[0]);
    e.target.value = "";
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadPDF(file);
  };

  const togglePage = (idx: number) => {
    if (splitMode !== "select" || selectExtractMode !== "custom") return;
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      setPagesToExtractInput(formatPageSelectionInput(next));
      return next;
    });
    setResultUrl(null);
  };

  const selectAll = () => {
    applySelectedPages(new Set(Array.from({ length: pageCount }, (_, i) => i)));
  };

  const selectNone = () => {
    applySelectedPages(new Set());
  };

  const invertSelection = () => {
    if (selectExtractMode !== "custom") return;
    setSelectedPages((prev) => {
      const next = new Set<number>();
      for (let i = 0; i < pageCount; i++) {
        if (!prev.has(i)) next.add(i);
      }
      setPagesToExtractInput(formatPageSelectionInput(next));
      return next;
    });
    setResultUrl(null);
  };

  // Parse a range string like "1-3,5,7-9" to a set of 0-based indices
  const parseRange = (input: string, max: number): Set<number> => {
    const result = new Set<number>();
    const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes("-")) {
        const [a, b] = part.split("-").map((s) => parseInt(s.trim(), 10));
        if (!isNaN(a) && !isNaN(b)) {
          for (let i = Math.max(1, a); i <= Math.min(max, b); i++) result.add(i - 1);
        }
      } else {
        const n = parseInt(part, 10);
        if (!isNaN(n) && n >= 1 && n <= max) result.add(n - 1);
      }
    }
    return result;
  };

  const updateCustomRange = (id: string, key: "start" | "end", value: number) => {
    const safeMax = Math.max(1, pageCount || 1);
    const safeValue = clampPage(Number.isFinite(value) ? value : 1, safeMax);
    setCustomRanges((prev) => prev.map((segment) => segment.id === id ? { ...segment, [key]: safeValue } : segment));
    setResultUrl(null);
  };

  const getCustomRangeDraftKey = (id: string, key: "start" | "end") => `${id}:${key}`;

  const handleCustomRangeInputChange = (id: string, key: "start" | "end", value: string) => {
    const draftKey = getCustomRangeDraftKey(id, key);
    setCustomRangeDrafts((prev) => ({ ...prev, [draftKey]: value }));
  };

  const commitCustomRangeInput = (id: string, key: "start" | "end") => {
    const draftKey = getCustomRangeDraftKey(id, key);
    const segment = customRanges.find((item) => item.id === id);
    const fallback = segment ? segment[key] : 1;
    const raw = (customRangeDrafts[draftKey] ?? String(fallback)).trim();
    const parsed = Number.parseInt(raw, 10);
    const nextValue = Number.isFinite(parsed) ? parsed : fallback;
    updateCustomRange(id, key, nextValue);
    setCustomRangeDrafts((prev) => {
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
  };

  const addCustomRange = () => {
    setCustomRanges((prev) => [...prev, { id: uid(), start: 1, end: Math.min(2, pageCount || 1) }]);
    setResultUrl(null);
  };

  const removeCustomRange = (id: string) => {
    setCustomRangeDrafts((prev) => {
      const next = { ...prev };
      delete next[getCustomRangeDraftKey(id, "start")];
      delete next[getCustomRangeDraftKey(id, "end")];
      return next;
    });
    setCustomRanges((prev) => prev.length <= 1 ? prev : prev.filter((segment) => segment.id !== id));
    setResultUrl(null);
  };

  const onRangeDragStart = (event: DragStartEvent) => {
    setActiveRangeId(String(event.active.id));
    setIsRangeDragging(true);
  };

  const onRangeDragCancel = (_event: DragCancelEvent) => {
    setActiveRangeId(null);
    setIsRangeDragging(false);
  };

  const onRangeDragEnd = (event: DragEndEvent) => {
    const draggedId = String(event.active.id);
    const targetId = event.over ? String(event.over.id) : null;
    if (targetId && draggedId !== targetId) {
      setCustomRanges((prev) => {
        const oldIndex = prev.findIndex((segment) => segment.id === draggedId);
        const newIndex = prev.findIndex((segment) => segment.id === targetId);
        if (oldIndex < 0 || newIndex < 0) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
      setResultUrl(null);
    }
    setActiveRangeId(null);
    setIsRangeDragging(false);
  };

  const rangePreviewSegments = rangeMode === "custom"
    ? customRanges
      .map((segment) => normalizeSegment(segment, pageCount))
      .filter((segment) => segment.start >= 1 && segment.end <= Math.max(1, pageCount))
    : buildFixedRanges(pageCount, fixedRangeSize);

  const rangePreviewPages = (() => {
    const ordered: number[] = [];
    const seen = new Set<number>();
    rangePreviewSegments.forEach((segment) => {
      pagesFromSegment(segment, pageCount).forEach((page) => {
        if (!seen.has(page)) {
          ordered.push(page);
          seen.add(page);
        }
      });
    });
    return ordered;
  })();
  const activeRangeSegment = activeRangeId
    ? rangePreviewSegments.find((segment) => segment.id === activeRangeId) ?? null
    : null;
  const activeRangeIndex = activeRangeSegment
    ? rangePreviewSegments.findIndex((segment) => segment.id === activeRangeSegment.id)
    : -1;

  const shouldMergeRanges = rangeMode === "fixed" ? true : mergeRanges;

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

  const buildSplitDocument = useCallback(async (src: PDFDocument, pages: number[], shouldCompress: boolean) => {
    const output = await PDFDocument.create();
    const copied = await output.copyPages(src, pages);
    copied.forEach((page) => output.addPage(page));
    return output.save({ useObjectStreams: shouldCompress, objectsPerTick: 50 });
  }, []);

  const getCompressedPageAsset = useCallback(async (
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    pageIndex: number,
    scale: number,
    quality: number,
  ): Promise<CompressedPageAsset> => {
    const cacheKey = `${pageIndex}-${scale}-${quality}`;
    const cached = compressedPageCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const page = await pdfDoc.getPage(pageIndex + 1);
    const renderViewport = page.getViewport({ scale });
    const outputViewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(renderViewport.width));
    canvas.height = Math.max(1, Math.floor(renderViewport.height));
    const context = canvas.getContext("2d");

    if (!context) {
      page.cleanup();
      throw new Error("Unable to create a canvas context for compression.");
    }

    await page.render({ canvas, canvasContext: context, viewport: renderViewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error("Unable to compress page image."));
      }, "image/jpeg", quality);
    });

    const asset: CompressedPageAsset = {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      width: outputViewport.width,
      height: outputViewport.height,
    };

    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
    compressedPageCacheRef.current.set(cacheKey, asset);
    return asset;
  }, []);

  const buildLossyCompressedSplitDocument = useCallback(async (
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    pages: number[],
    maxBytes: number,
  ) => {
    const compressionProfiles = [
      { scale: 1.25, quality: 0.93 },
      { scale: 1.1, quality: 0.86 },
      { scale: 0.95, quality: 0.76 },
      { scale: 0.85, quality: 0.66 },
    ];

    let bestFit: Uint8Array | null = null;
    let smallestAbove: Uint8Array | null = null;

    for (const profile of compressionProfiles) {
      const output = await PDFDocument.create();

      for (const pageIndex of pages) {
        const asset = await getCompressedPageAsset(pdfDoc, pageIndex, profile.scale, profile.quality);
        const image = await output.embedJpg(asset.bytes);
        const page = output.addPage([asset.width, asset.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: asset.width,
          height: asset.height,
        });
      }

      const bytes = await output.save({ useObjectStreams: true, objectsPerTick: 50 });
      if (bytes.byteLength <= maxBytes) {
        if (!bestFit || bytes.byteLength > bestFit.byteLength) {
          bestFit = bytes;
        }
      } else if (!smallestAbove || bytes.byteLength < smallestAbove.byteLength) {
        smallestAbove = bytes;
      }
    }

    if (bestFit) return bestFit;
    if (smallestAbove) return smallestAbove;
    throw new Error("Unable to build compressed PDF.");
  }, [getCompressedPageAsset]);

  const buildCompressedSplitDocument = useCallback(async (
    src: PDFDocument,
    pdfJsDoc: pdfjsLib.PDFDocumentProxy,
    pages: number[],
    maxBytes: number,
  ) => {
    const exactBytes = await buildSplitDocument(src, pages, false);
    if (exactBytes.byteLength <= maxBytes) return exactBytes;

    const losslessBytes = await buildSplitDocument(src, pages, true);
    if (losslessBytes.byteLength <= maxBytes) return losslessBytes;

    return buildLossyCompressedSplitDocument(pdfJsDoc, pages, maxBytes);
  }, [buildLossyCompressedSplitDocument, buildSplitDocument]);

  const calculateSizeMinimums = useCallback(async () => {
    if (!pdfFile || pageCount <= 0 || calculatingSizeMinimums) return sizeMinimumBytes;
    if (sizeMinimumBytes) return sizeMinimumBytes;

    setCalculatingSizeMinimums(true);
    try {
      const sourceBytes = await getSourcePdfBytes();
      const src = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
      const pdfJsDoc = await pdfjsLib.getDocument({ data: sourceBytes.slice() }).promise;

      let rawMax = KB_IN_BYTES;
      let compressedMax = KB_IN_BYTES;
      for (let i = 0; i < pageCount; i++) {
        const rawBytes = await buildSplitDocument(src, [i], false);
        rawMax = Math.max(rawMax, rawBytes.byteLength);

        // Safe compressed minimum: lossless optimization only (no quality drop).
        const compressedBytes = await buildSplitDocument(src, [i], true);
        compressedMax = Math.max(compressedMax, compressedBytes.byteLength);
      }

      const minimums = { raw: rawMax, compressed: compressedMax };
      setSizeMinimumBytes(minimums);
      return minimums;
    } catch (error) {
      console.error("Unable to calculate minimum size limits", error);
      return null;
    } finally {
      setCalculatingSizeMinimums(false);
    }
  }, [
    buildCompressedSplitDocument,
    buildSplitDocument,
    calculatingSizeMinimums,
    getSourcePdfBytes,
    pageCount,
    pdfFile,
    sizeMinimumBytes,
  ]);

  const buildSizeSplitDocuments = useCallback(async (
    src: PDFDocument,
    pdfJsDoc: pdfjsLib.PDFDocumentProxy | null,
    maxBytes: number,
    shouldCompress: boolean,
  ) => {
    const parts: Array<{ pages: number[]; bytes: Uint8Array; exceedsLimit: boolean }> = [];

    // Always export one page per file in Size mode.
    for (let i = 0; i < pageCount; i++) {
      if (shouldCompress && pdfJsDoc) {
        const bytes = await buildCompressedSplitDocument(src, pdfJsDoc, [i], maxBytes);
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        parts.push({ pages: [i], bytes: copy, exceedsLimit: copy.byteLength > maxBytes });
      } else {
        // Exact original quality, no optimization.
        const bytes = await buildSplitDocument(src, [i], false);
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        parts.push({ pages: [i], bytes: copy, exceedsLimit: copy.byteLength > maxBytes });
      }
    }

    return parts;
  }, [buildCompressedSplitDocument, buildSplitDocument, pageCount]);

  const splitPDF = async () => {
    const pages = splitMode === "range"
      ? (() => {
        if (rangePreviewSegments.length === 0) return new Set<number>();
        if (!shouldMergeRanges) {
          return new Set(pagesFromSegment(rangePreviewSegments[0], pageCount));
        }
        return new Set(rangePreviewPages);
      })()
      : splitMode === "size"
        ? new Set<number>(Array.from({ length: pageCount }, (_, i) => i))
        : (selectExtractMode === "all"
          ? (() => new Set<number>(Array.from({ length: pageCount }, (_, i) => i)))()
          : selectedPages);

    if (pages.size === 0) { addToast("Select at least one page to extract.", "error"); return; }
    if (!pdfFile && !arrayBuffer) {
      addToast("Please upload a PDF file first.", "error");
      return;
    }

    setSplitting(true);
    setResultUrl(null);
    try {
      const sourceBytes = await getSourcePdfBytes();
      const src = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
      const baseName = getPdfBaseName(pdfFile?.name ?? "document.pdf");
      let maxBytesPerFile = Math.max(1, Math.round(sizeLimitBytes));

      if (splitMode === "size") {
        const normalizedLimit = commitMaxSizeInput();
        maxBytesPerFile = maxSizeUnit === "KB"
          ? Math.max(1, Math.round(normalizedLimit)) * KB_IN_BYTES
          : Math.max(0.1, Number(normalizedLimit.toFixed(1))) * MB_IN_BYTES;

        const minimums = sizeMinimumBytes ?? await calculateSizeMinimums();
        const minimumBytesForMode = minimums
          ? (allowCompression ? minimums.compressed : minimums.raw)
          : KB_IN_BYTES;

        if (!allowCompression && maxBytesPerFile < minimumBytesForMode) {
          maxBytesPerFile = minimumBytesForMode;
          setMaxSizeUnit("KB");
          setMaxSizePerFile(clampSizeValue(Math.ceil(minimumBytesForMode / KB_IN_BYTES), "KB"));
          addToast(`Minimum possible limit is ${fmtSize(minimumBytesForMode)} for this mode.`, "info");
        }

        const pdfJsDoc = allowCompression
          ? await pdfjsLib.getDocument({ data: sourceBytes.slice() }).promise
          : null;
        const sizePartsRaw = await buildSizeSplitDocuments(src, pdfJsDoc, maxBytesPerFile, allowCompression);
        const sizeParts = sizePartsRaw.slice(0, Math.max(1, pageCount));

        if (sizeParts.length === 0) {
          throw new Error("No files could be created for the selected size limit.");
        }

        const oversizedParts = sizeParts.filter((part) => part.exceedsLimit).length;
        if (oversizedParts > 0) {
          const minimumPossibleBytes = Math.max(...sizeParts.map((part) => part.bytes.byteLength));
          maxBytesPerFile = minimumPossibleBytes;

          const nextUnit: SizeUnit = isMbOptionEnabled && minimumPossibleBytes >= MB_IN_BYTES ? "MB" : "KB";
          const nextValue = nextUnit === "KB"
            ? Math.ceil(minimumPossibleBytes / KB_IN_BYTES)
            : Number((minimumPossibleBytes / MB_IN_BYTES).toFixed(1));

          setMaxSizeUnit(nextUnit);
          setMaxSizePerFile(clampSizeValue(nextValue, nextUnit));
          addToast(`Selected limit was too low. It was increased to minimum possible: ${fmtSize(minimumPossibleBytes)}.`, "info");
        }

        if (sizeParts.length === 1) {
          const singlePartBytes = new Uint8Array(sizeParts[0].bytes.byteLength);
          singlePartBytes.set(sizeParts[0].bytes);
          const blob = new Blob([singlePartBytes], { type: "application/pdf" });
          setResultSize(blob.size);
          setResultPages(sizeParts[0].pages.length);
          setResultFileCount(1);
          setResultName(`${baseName}-split.pdf`);
          setResultUrl(URL.createObjectURL(blob));
          addToast("Split complete! 1 PDF file created.", "success");
        } else {
          const zip = new JSZip();
          let totalPages = 0;

          sizeParts.forEach((part, index) => {
            const firstPage = part.pages[0] + 1;
            const lastPage = part.pages[part.pages.length - 1] + 1;
            const partName = `${baseName}-part-${index + 1}-${firstPage}-${lastPage}.pdf`;
            zip.file(partName, part.bytes);
            totalPages += part.pages.length;
          });

          const zipBytes = await zip.generateAsync({ type: "uint8array" });
          const zipBlobBytes = new Uint8Array(zipBytes.byteLength);
          zipBlobBytes.set(zipBytes);
          const blob = new Blob([zipBlobBytes], { type: "application/zip" });
          setResultSize(blob.size);
          setResultPages(totalPages);
          setResultFileCount(sizeParts.length);
          setResultName(`${baseName}-split.zip`);
          setResultUrl(URL.createObjectURL(blob));
          addToast(`Split complete! ${sizeParts.length} PDF files created.`, "success");
        }

        return;
      }

      const shouldCreateMultipleFiles = (
        splitMode === "range"
        && (rangeMode === "fixed" || !shouldMergeRanges)
        && rangePreviewSegments.length > 1
      ) || (
        splitMode === "select"
        && (selectExtractMode === "all" || !mergeSelectedPages)
        && pages.size > 0
      );

      if (shouldCreateMultipleFiles) {
        const zip = new JSZip();
        let totalPages = 0;
        let fileCount = 0;

        if (splitMode === "range") {
          for (let index = 0; index < rangePreviewSegments.length; index++) {
            const segment = rangePreviewSegments[index];
            const segmentPages = pagesFromSegment(segment, pageCount);
            if (segmentPages.length === 0) continue;

            const bytes = await buildSplitDocument(src, segmentPages, true);
            const pdfBytes = new Uint8Array(bytes);
            const partName = `${baseName}-part-${index + 1}-${segment.start}-${segment.end}.pdf`;
            zip.file(partName, pdfBytes);
            totalPages += segmentPages.length;
            fileCount += 1;
          }
        } else {
          const sortedPages = Array.from(pages).sort((a, b) => a - b);
          for (let index = 0; index < sortedPages.length; index++) {
            const pageNumber = sortedPages[index] + 1;
            const bytes = await buildSplitDocument(src, [sortedPages[index]], true);
            const pdfBytes = new Uint8Array(bytes);
            const partName = `${baseName}-page-${pageNumber}.pdf`;
            zip.file(partName, pdfBytes);
            totalPages += 1;
            fileCount += 1;
          }
        }

        if (fileCount === 0) {
          throw new Error("No valid page ranges were found to split.");
        }

        const zipBytes = await zip.generateAsync({ type: "uint8array" });
        const zipBlobBytes = new Uint8Array(zipBytes.byteLength);
        zipBlobBytes.set(zipBytes);
        const blob = new Blob([zipBlobBytes], { type: "application/zip" });
        setResultSize(blob.size);
        setResultPages(totalPages);
        setResultFileCount(fileCount);
        setResultName(`${baseName}-split.zip`);
        setResultUrl(URL.createObjectURL(blob));
        addToast(`Split complete! ${fileCount} PDF file${fileCount !== 1 ? "s" : ""} created.`, "success");
      } else {
        const sortedPages = Array.from(pages).sort((a, b) => a - b);
        const bytes = await buildSplitDocument(src, sortedPages, true);
        const normalizedBytes = new Uint8Array(bytes);
        const blob = new Blob([normalizedBytes], { type: "application/pdf" });
        setResultSize(blob.size);
        setResultPages(sortedPages.length);
        setResultFileCount(1);
        setResultName(`split-${pdfFile?.name ?? "document.pdf"}`);
        setResultUrl(URL.createObjectURL(blob));
        addToast(`Split complete! ${sortedPages.length} page${sortedPages.length !== 1 ? "s" : ""} extracted.`, "success");
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error && err.message
        ? err.message
        : "Unknown error while splitting PDF.";
      addToast(`Split failed. ${message}`, "error");
    } finally {
      setSplitting(false);
    }
  };

  const downloadResult = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = resultName;
    a.click();
  };

  const reset = () => {
    setPdfFile(null);
    setArrayBuffer(null);
    setPageCount(0);
    setThumbs([]);
    setThumbnailRotations({});
    setSelectedPages(new Set());
    setResultUrl(null);
    setResultName("split-document.pdf");
    setResultFileCount(0);
    setSplitMode("select");
    setRangeMode("custom");
    setSelectExtractMode("custom");
    setMergeSelectedPages(true);
    setPagesToExtractInput("");
    setCustomRanges([{ id: uid(), start: 1, end: 1 }]);
    setFixedRangeSize(2);
    setMergeRanges(true);
    setMaxSizePerFile(1);
    setMaxSizeInput("1");
    setMaxSizeUnit("MB");
    setAllowCompression(false);
    setRangeInput("");
    setSizeMinimumBytes(null);
    setCalculatingSizeMinimums(false);
    setSizeMinimumApplied(false);
    compressedPageCacheRef.current.clear();
  };

  const activePageCount = splitMode === "range"
    ? (shouldMergeRanges ? rangePreviewPages.length : (rangePreviewSegments[0] ? pagesFromSegment(rangePreviewSegments[0], pageCount).length : 0))
    : splitMode === "size"
      ? pageCount
      : (selectExtractMode === "all" ? pageCount : selectedPages.size);

  const modeLabel = splitMode === "select" ? "Pick Pages" : splitMode === "range" ? "Page Range" : "Size";
  const previewSelectedPages = splitMode === "range"
    ? new Set<number>(shouldMergeRanges
      ? rangePreviewPages
      : rangePreviewSegments[0]
        ? pagesFromSegment(rangePreviewSegments[0], pageCount)
        : [])
    : splitMode === "size"
      ? new Set<number>(Array.from({ length: pageCount }, (_, i) => i))
      : (selectExtractMode === "all"
        ? new Set<number>(Array.from({ length: pageCount }, (_, i) => i))
        : selectedPages);
  const selectionRangeLabel = activePageCount === 0
    ? "-"
    : splitMode === "range"
      ? `${rangePreviewSegments.length} range${rangePreviewSegments.length === 1 ? "" : "s"}`
      : splitMode === "size"
        ? `Max ${maxSizePerFile} ${maxSizeUnit}/file`
        : `${activePageCount} selected`;
  const fixedFileCount = Math.ceil(pageCount / Math.max(1, fixedRangeSize));
  const selectedPageFileCount = selectExtractMode === "all" ? pageCount : selectedPages.size;
  const isEditorMode = !!pdfFile && !loading;

  useEffect(() => {
    if (!pdfFile) return;

    if (!isMbOptionEnabled) {
      setMaxSizeUnit("KB");
      setMaxSizePerFile(maxSizeLimitForKb);
      return;
    }

    setMaxSizeUnit("MB");
    setMaxSizePerFile(maxSizeLimitForMb);
  }, [isMbOptionEnabled, maxSizeLimitForKb, maxSizeLimitForMb, pdfFile]);

  useEffect(() => {
    setMaxSizePerFile((prev) => clampSizeValue(prev, maxSizeUnit));
  }, [clampSizeValue, maxSizeUnit]);

  useEffect(() => {
    setMaxSizeInput(formatSizeInputValue(maxSizePerFile, maxSizeUnit));
  }, [formatSizeInputValue, maxSizePerFile, maxSizeUnit]);

  useEffect(() => {
    if (pdfFile && !sizeMinimumBytes && !calculatingSizeMinimums) {
      calculateSizeMinimums();
    }
  }, [calculateSizeMinimums, calculatingSizeMinimums, pdfFile, sizeMinimumBytes]);

  useEffect(() => {
    if (!sizeMinimumBytes || sizeMinimumApplied) return;
    const initialMinKb = Math.max(1, Math.ceil(sizeMinimumBytes.raw / KB_IN_BYTES));
    setMaxSizeUnit("KB");
    setMaxSizePerFile(clampSizeValue(initialMinKb, "KB"));
    setSizeMinimumApplied(true);
  }, [clampSizeValue, sizeMinimumApplied, sizeMinimumBytes]);

  useEffect(() => {
    if (splitMode === "select" && selectExtractMode === "custom") {
      if (isEditingPagesInputRef.current) {
        isEditingPagesInputRef.current = false;
        return;
      }
      setPagesToExtractInput(formatPageSelectionInput(selectedPages));
    }
  }, [formatPageSelectionInput, selectedPages, selectExtractMode, splitMode]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    if (isEditorMode) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isEditorMode]);

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className={`${isEditorMode ? "overflow-hidden" : ""} app-bg`}>
      <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFileInputChange} />

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

        {/* Hero */}
        {!pdfFile && (
          <div className="text-center mt-2 mb-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight mb-2" style={{ color: "#0f172a" }}>
              Split PDF Files Online —{" "}
              <span className="heading-gradient">Free &amp; No Login Required</span>
            </h1>
            <p className="text-sm sm:text-base max-w-xl mx-auto" style={{ color: "#64748b" }}>
              Extract specific pages from any PDF. Select pages visually, split by ranges, or break a large PDF into smaller files by size — all inside your browser.
            </p>
          </div>
        )}

        {/* Upload Zone */}
        {!pdfFile && (
          <div
            className={`upload-zone-premium rounded-3xl cursor-pointer select-none transition-all duration-300 ${isDraggingOver ? "upload-zone-active" : ""}`}
            style={{ padding: "52px 24px" }}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingOver(false); }}
            onClick={openFilePicker}
          >
            <div className="flex flex-col items-center gap-5 text-center">
              {/* Icon */}
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

              {isDraggingOver ? (
                <div>
                  <p className="text-xl font-extrabold mb-1" style={{ color: "#4f46e5" }}>Drop your PDF here!</p>
                  <p className="text-sm" style={{ color: "#818cf8" }}>Release to load file</p>
                </div>
              ) : (
                <div>
                  <p className="text-xl sm:text-2xl font-extrabold mb-1" style={{ color: "#0f172a" }}>Drag &amp; Drop a PDF File Here</p>
                  <p className="text-sm" style={{ color: "#64748b" }}>or click to browse from your device</p>
                </div>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); openFilePicker(); }}
                className="select-btn text-white font-extrabold text-lg sm:text-xl px-10 sm:px-14 py-4 sm:py-5 rounded-2xl flex items-center gap-3 shadow-2xl"
              >
                <UploadIcon /> Select PDF File
              </button>

              <div className="flex items-center gap-4 flex-wrap justify-center">
                {["Single PDF", "Any page count", "Select pages", "100% private"].map((tag) => (
                  <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(79,70,229,0.08)", color: "#6366f1" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="split-panel mt-6 p-6 rounded-3xl text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#eef2ff" }}>
              <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#6366f1" strokeWidth="3" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="font-bold text-sm mb-3" style={{ color: "#0f172a" }}>Loading PDF pages...</p>
            <div className="max-w-xs mx-auto">
              <div className="progress-track rounded-full overflow-hidden" style={{ height: 6 }}>
                <div className="progress-fill h-full rounded-full transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
              </div>
              <p className="text-xs mt-1.5" style={{ color: "#94a3b8" }}>{loadingProgress}% complete</p>
            </div>
          </div>
        )}

        {/* PDF Loaded — Split UI */}
        {pdfFile && !loading && (
          <>
            <div className="split-workspace">
              {/* Left: all page previews */}
              <div className="split-preview-panel">
                <div className="split-preview-header">
                  <div>
                    <p className="font-bold text-sm truncate max-w-[220px] sm:max-w-[360px]" style={{ color: "#0f172a" }}>{pdfFile.name}</p>
                    <p className="text-xs" style={{ color: "#94a3b8" }}>{pageCount} pages · {fmtSize(pdfFile.size)}</p>
                  </div>
                  <button
                    onClick={openFilePicker}
                    className="text-xs px-3 py-1.5 rounded-xl font-semibold border transition-all hover:shadow"
                    style={{ borderColor: "#c7d2fe", color: "#4f46e5", background: "#eef2ff" }}
                  >
                    Change File
                  </button>
                </div>
                {splitMode === "range" ? (
                  <div className={`range-preview-grid ${rangeMode === "custom" && rangePreviewSegments.length === 1 ? "single-center" : "multi-left"} ${isRangeDragging ? "is-dragging" : ""}`}>
                    {rangeMode === "custom" ? (
                      <DndContext
                        sensors={rangeSensors}
                        collisionDetection={closestCenter}
                        onDragStart={onRangeDragStart}
                        onDragCancel={onRangeDragCancel}
                        onDragEnd={onRangeDragEnd}
                      >
                        <SortableContext items={rangePreviewSegments.map((segment) => segment.id)} strategy={rectSortingStrategy}>
                          {rangePreviewSegments.map((segment, index) => {
                            const firstPage = segment.start - 1;
                            const lastPage = segment.end - 1;
                            const firstThumb = thumbsByIndex.get(firstPage);
                            const lastThumb = thumbsByIndex.get(lastPage);
                            return (
                              <SortableRangeCard key={segment.id} id={segment.id}>
                                <RangeCardContent
                                  segment={segment}
                                  index={index}
                                  firstThumb={firstThumb}
                                  lastThumb={lastThumb}
                                  showDragHint={true}
                                />
                              </SortableRangeCard>
                            );
                          })}
                        </SortableContext>
                        <DragOverlay>
                          {activeRangeSegment ? (
                            <div className="range-preview-card range-card-overlay">
                              <RangeCardContent
                                segment={activeRangeSegment}
                                index={activeRangeIndex}
                                firstThumb={thumbsByIndex.get(activeRangeSegment.start - 1)}
                                lastThumb={thumbsByIndex.get(activeRangeSegment.end - 1)}
                                showDragHint={true}
                              />
                            </div>
                          ) : null}
                        </DragOverlay>
                      </DndContext>
                    ) : (
                      rangePreviewSegments.map((segment, index) => {
                        const firstPage = segment.start - 1;
                        const lastPage = segment.end - 1;
                        const firstThumb = thumbsByIndex.get(firstPage);
                        const lastThumb = thumbsByIndex.get(lastPage);
                        return (
                          <div className="range-preview-card" key={segment.id}>
                            <RangeCardContent
                              segment={segment}
                              index={index}
                              firstThumb={firstThumb}
                              lastThumb={lastThumb}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="split-page-grid">
                    {Array.from({ length: pageCount }, (_, i) => {
                      const thumb = thumbsByIndex.get(i);
                      const thumbRotation = thumbnailRotations[i] ?? 0;
                      const isSelected = previewSelectedPages.has(i);
                      return (
                        <button
                          key={i}
                          onClick={() => { if (splitMode === "select" && selectExtractMode === "custom") togglePage(i); }}
                          className={`split-page-card ${isSelected ? "selected" : ""} ${splitMode !== "select" || selectExtractMode === "all" ? "read-only" : ""}`}
                          title={`Page ${i + 1}`}
                        >
                          <div className="split-page-thumb">
                            <button
                              type="button"
                              className="split-page-rotate-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                rotateThumbnail(i);
                              }}
                              aria-label={`Rotate page ${i + 1}`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            {thumb ? (
                              <img src={thumb} alt={`Page ${i + 1}`} className="w-full h-full" style={{ transform: `rotate(${thumbRotation}deg)` }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#eef2ff,#ede9fe)" }}>
                                <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#6366f1" opacity="0.5"/>
                                </svg>
                              </div>
                            )}
                            {isSelected && (
                              <div className="split-page-check">
                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                                  <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            )}
                          </div>
                          <span className={`split-page-label ${isSelected ? "selected" : ""}`}>Page {i + 1}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: settings */}
              <aside className="split-settings-panel rounded-2xl">
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4 p-5 sm:p-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Selected Setting</p>
                      <h3 className="text-xl font-extrabold mt-1" style={{ color: "#0f172a" }}>{modeLabel}</h3>
                    </div>

                    <div className="split-setting-summary text-sm">
                      <span><strong>Range:</strong> {selectionRangeLabel}</span>
                      <span><strong>Pages:</strong> {activePageCount}</span>
                      <span><strong>Size:</strong> {fmtSize(pdfFile.size)}</span>
                    </div>

                    <div className="split-mode-tabs grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 rounded-2xl" style={{ background: "#f1f5f9" }}>
                      {(["range", "select", "size"] as SplitMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => { setSplitMode(mode); setResultUrl(null); }}
                          className={`split-mode-tab px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${splitMode === mode ? "active" : ""}`}
                        >
                          {mode === "select" ? "Pick Pages" : mode === "range" ? "Page Range" : "Size"}
                        </button>
                      ))}
                    </div>

                    <div className="split-setting-content">
                    {splitMode === "range" && (
                      <div className="range-settings-grid">
                        <div className="range-mode-switch">
                          <button
                            className={`range-mode-chip ${rangeMode === "custom" ? "active" : ""}`}
                            onClick={() => { setRangeMode("custom"); setResultUrl(null); }}
                          >
                            <Rows3 size={16} /> Custom
                          </button>
                          <button
                            className={`range-mode-chip ${rangeMode === "fixed" ? "active" : ""}`}
                            onClick={() => { setRangeMode("fixed"); setResultUrl(null); }}
                          >
                            <Ruler size={16} /> Fixed
                          </button>
                        </div>

                        {rangeMode === "custom" ? (
                          <>
                            {customRanges.map((segment, index) => (
                              <div className="range-editor-card" key={segment.id}>
                                <div className="range-editor-top">
                                  <span className="range-editor-title">Range {index + 1}</span>
                                  {customRanges.length > 1 && (
                                    <button className="range-remove-btn" onClick={() => removeCustomRange(segment.id)}>Remove</button>
                                  )}
                                </div>
                                <div className="range-input-row">
                                  <div className="range-input-block">
                                    <label>From page</label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={pageCount}
                                      value={customRangeDrafts[getCustomRangeDraftKey(segment.id, "start")] ?? String(segment.start)}
                                      onChange={(e) => handleCustomRangeInputChange(segment.id, "start", e.target.value)}
                                      onBlur={() => commitCustomRangeInput(segment.id, "start")}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                                      }}
                                      className="split-range-input"
                                    />
                                  </div>
                                  <span className="range-arrow">to</span>
                                  <div className="range-input-block">
                                    <label>To page</label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={pageCount}
                                      value={customRangeDrafts[getCustomRangeDraftKey(segment.id, "end")] ?? String(segment.end)}
                                      onChange={(e) => handleCustomRangeInputChange(segment.id, "end", e.target.value)}
                                      onBlur={() => commitCustomRangeInput(segment.id, "end")}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                                      }}
                                      className="split-range-input"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button onClick={addCustomRange} className="range-add-btn">
                              <Layers3 size={16} /> Add Range
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="range-editor-card">
                              <div className="range-editor-top">
                                <span className="range-editor-title">Split into page ranges of</span>
                              </div>
                              <div className="range-input-row fixed-row">
                                <input
                                  type="number"
                                  min={1}
                                  max={pageCount}
                                  value={fixedRangeSize}
                                  onChange={(e) => {
                                    setFixedRangeSize(Math.max(1, Math.min(pageCount || 1, parseInt(e.target.value || "1", 10))));
                                    setResultUrl(null);
                                  }}
                                  className="split-range-input"
                                />
                                <span className="range-fixed-pill">{fixedRangeSize} {fixedRangeSize === 1 ? "page" : "pages"}</span>
                              </div>
                            </div>
                            <div className="fixed-warning">
                              <p>This PDF will be split into files of {fixedRangeSize} {fixedRangeSize === 1 ? "page" : "pages"}.</p>
                              <p>{fixedFileCount} PDF{fixedFileCount === 1 ? "" : "s"} will be created.</p>
                            </div>
                          </>
                        )}

                        {rangeMode === "custom" && (
                          <label className="merge-toggle-row">
                            <input type="checkbox" checked={mergeRanges} onChange={(e) => { setMergeRanges(e.target.checked); setResultUrl(null); }} />
                            <SquareCheckBig size={16} />
                            <span>Merge all ranges in one PDF file</span>
                          </label>
                        )}
                      </div>
                    )}

                    {splitMode === "select" && (
                      <div className="range-settings-grid">
                        <div className="range-mode-switch">
                          <button
                            className={`range-mode-chip ${selectExtractMode === "all" ? "active" : ""}`}
                            onClick={() => {
                              setSelectExtractMode("all");
                              setResultUrl(null);
                            }}
                          >
                            Extract all pages
                          </button>
                          <button
                            className={`range-mode-chip ${selectExtractMode === "custom" ? "active" : ""}`}
                            onClick={() => {
                              setSelectExtractMode("custom");
                              setResultUrl(null);
                            }}
                          >
                            Select pages
                          </button>
                        </div>

                        {selectExtractMode === "custom" && (
                          <>
                            <div className="range-editor-card">
                              <div className="range-input-block">
                                <label>Pages to extract:</label>
                                <input
                                  type="text"
                                  value={pagesToExtractInput}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    isEditingPagesInputRef.current = true;
                                    setPagesToExtractInput(value);
                                    const parsed = parseRange(value, pageCount);
                                    setSelectedPages(parsed);
                                    setResultUrl(null);
                                  }}
                                  className="split-range-input"
                                  placeholder="e.g. 1,2,5"
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold" style={{ color: "#64748b" }}>
                                {activePageCount} of {pageCount} pages selected
                              </span>
                              <div className="flex gap-2 ml-auto">
                                <button onClick={selectAll} className="split-action-btn">Select All</button>
                                <button onClick={selectNone} className="split-action-btn">Deselect All</button>
                                <button onClick={invertSelection} className="split-action-btn">Invert</button>
                              </div>
                            </div>

                            <label className="merge-toggle-row">
                              <input
                                type="checkbox"
                                checked={mergeSelectedPages}
                                onChange={(e) => { setMergeSelectedPages(e.target.checked); setResultUrl(null); }}
                              />
                              <SquareCheckBig size={16} />
                              <span>Merge extracted pages into one PDF file</span>
                            </label>
                          </>
                        )}

                        {(selectExtractMode === "all" || (selectExtractMode === "custom" && !mergeSelectedPages)) && (
                          <div className="fixed-warning">
                            <p>Selected pages will be converted into separate PDF files.</p>
                            <p>{selectedPageFileCount} PDF{selectedPageFileCount === 1 ? "" : "s"} will be created.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {splitMode === "size" && (
                      <div className="range-settings-grid">
                        <div className="range-editor-card">
                          <div className="range-input-block">
                            <label>Maximum size per file:</label>
                            <div className="range-input-row fixed-row size-input-row">
                              <input
                                type="number"
                                min={minimumLimitValue}
                                max={currentSizeLimit}
                                step={maxSizeUnit === "KB" ? 1 : 0.1}
                                value={maxSizeInput}
                                disabled={calculatingSizeMinimums && !sizeMinimumBytes}
                                onChange={(e) => {
                                  setMaxSizeInput(e.target.value);
                                }}
                                onBlur={() => {
                                  commitMaxSizeInput();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    commitMaxSizeInput();
                                  }
                                }}
                                className="split-range-input"
                              />
                              <div className="size-unit-switch">
                                {(["KB", "MB"] as SizeUnit[]).map((unit) => (
                                  <button
                                    key={unit}
                                    type="button"
                                    className={`size-unit-chip ${maxSizeUnit === unit ? "active" : ""}`}
                                    disabled={unit === "MB" && !isMbOptionEnabled}
                                    onClick={() => {
                                      handleMaxSizeUnitChange(unit);
                                    }}
                                  >
                                    {unit}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <label
                          className="merge-toggle-row"
                          title="Lossless compression optimizes PDF structure without reducing page quality."
                        >
                          <input
                            type="checkbox"
                            checked={allowCompression}
                            onChange={(e) => {
                              setAllowCompression(e.target.checked);
                              setResultUrl(null);
                            }}
                          />
                          <span>Allow compression</span>
                          <span className="setting-help-badge">?</span>
                        </label>

                        <div className="fixed-warning">
                          <p>Each page is exported as one PDF file ({pageCount} total).</p>
                          <p>
                            {calculatingSizeMinimums && !sizeMinimumBytes
                              ? "Calculating safe limit..."
                              : `Minimum safe limit (no quality loss): ${fmtSize(selectedMinimumBytes)} (${allowCompression ? "with compression" : "without compression"})`}
                          </p>
                          <p>Turn on compression only if you need smaller files.</p>
                        </div>

                        {showQualityRiskWarning && (
                          <div className="fixed-warning size-warning-highlight size-warning-small">
                            <p>Value below safe limit can reduce PDF quality.</p>
                            {showVeryLowWarning ? (
                              <p>Very low value may make PDF blurry and hard to read.</p>
                            ) : (
                              <p>Recommended: keep {Math.max(1, Math.ceil(safeMinimumBytes / KB_IN_BYTES))} KB or above.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    </div>{/* end split-setting-content */}
                  </div>{/* end scrollable */}

                  <div className="split-action-panel split-action-bottom px-5 sm:px-6 pt-2 pb-2">
                    {resultUrl ? (
                      <div className="flex flex-col items-stretch gap-2">
                        <button onClick={downloadResult} className="download-btn text-white font-extrabold text-base px-6 py-3.5 rounded-xl flex items-center justify-center gap-2.5 w-full">
                          <DownloadIcon /> {resultFileCount > 1 ? "Download ZIP" : "Download Split PDF"}
                        </button>
                        <div className="text-center">
                          <p className="text-sm font-bold" style={{ color: "#16a34a" }}>
                            {resultFileCount > 1
                              ? `Ready — ${resultFileCount} file${resultFileCount !== 1 ? "s" : ""}`
                              : `Ready — ${resultPages} page${resultPages !== 1 ? "s" : ""}`}
                          </p>
                          <p className="text-xs" style={{ color: "#64748b" }}>{fmtSize(resultSize)}</p>
                        </div>
                        <button
                          onClick={() => { setResultUrl(null); }}
                          className="text-sm px-4 py-2 rounded-xl border font-semibold"
                          style={{ borderColor: "#e2e8f0", color: "#64748b" }}
                        >
                          Split Again
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-stretch gap-2 text-center w-full">
                        <button
                          onClick={splitPDF}
                          disabled={splitting || activePageCount === 0}
                          className="merge-btn text-white font-extrabold text-sm px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                        >
                          {splitting ? (
                            <><SpinnerIcon /> Splitting PDF...</>
                          ) : (
                            <><ScissorsIcon /> Split PDF</>
                          )}
                        </button>
                        {activePageCount === 0 && !splitting && (
                          <p className="text-xs" style={{ color: "#94a3b8" }}>
                            {splitMode === "select" ? "Select at least one page from the left" : "Enter a valid page range"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
