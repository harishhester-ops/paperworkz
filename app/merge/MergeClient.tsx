"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdfSetup";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

type FileEntry = {
  id: string;
  file: File;
  bytes: ArrayBuffer;
  pageCount: number;
  thumbUrl: string;
};

let counter = 0;

async function buildEntry(file: File): Promise<FileEntry> {
  const bytes = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const pageCount = doc.numPages;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 0.18 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return {
    id: String(++counter),
    file,
    bytes,
    pageCount,
    thumbUrl: canvas.toDataURL("image/jpeg", 0.7),
  };
}

export default function MergeClient() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [zoneOver, setZoneOver] = useState(false);
  const [merging, setMerging] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const dragSrcIdx = useRef<number | null>(null);

  const addFiles = useCallback(async (list: FileList | File[]) => {
    const pdfs = Array.from(list).filter((f) => f.type === "application/pdf");
    if (!pdfs.length) return;
    setLoading(true);
    const built = await Promise.all(pdfs.map(buildEntry));
    setEntries((prev) => [...prev, ...built]);
    setLoading(false);
  }, []);

  const onZoneDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setZoneOver(false);
      await addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const onPick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) await addFiles(e.target.files);
      e.target.value = "";
    },
    [addFiles]
  );

  const remove = (id: string) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const moveUp = (i: number) => {
    if (i === 0) return;
    setEntries((prev) => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  };

  const moveDown = (i: number) => {
    setEntries((prev) => {
      if (i === prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  };

  const onItemDragStart = (i: number, id: string) => {
    dragSrcIdx.current = i;
    setDraggingId(id);
  };

  const onItemDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(i);
  };

  const onItemDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    e.stopPropagation();
    const from = dragSrcIdx.current;
    if (from !== null && from !== i) {
      setEntries((prev) => {
        const next = [...prev];
        const [item] = next.splice(from, 1);
        next.splice(i, 0, item);
        return next;
      });
    }
    dragSrcIdx.current = null;
    setDraggingId(null);
    setDropTarget(null);
  };

  const onItemDragEnd = () => {
    dragSrcIdx.current = null;
    setDraggingId(null);
    setDropTarget(null);
  };

  const merge = async () => {
    if (entries.length < 2) return;
    setMerging(true);
    try {
      const out = await PDFDocument.create();
      for (const entry of entries) {
        const src = await PDFDocument.load(entry.bytes);
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
      }
      const bytes = await out.save();
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/pdf" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setMerging(false);
    }
  };

  const totalPages = entries.reduce((s, e) => s + e.pageCount, 0);

  // Empty state
  if (entries.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link
          href="/"
          style={{
            fontSize: 13,
            color: MUTED,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 36,
          }}
        >
          ← All tools
        </Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>
          Merge PDF
        </h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Upload two or more PDFs, arrange them in order, then download as a
          single file.
        </p>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setZoneOver(true);
          }}
          onDragLeave={() => setZoneOver(false)}
          onDrop={onZoneDrop}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            border: `2px dashed ${zoneOver ? RED : LINE}`,
            borderRadius: 16,
            padding: "64px 24px",
            cursor: "pointer",
            background: zoneOver ? "#fff5f6" : "#fafafb",
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          <div style={{ fontSize: 32 }}>📄</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {loading ? "Loading…" : "Drop PDF files here or click to select"}
          </div>
          <div style={{ fontSize: 13, color: MUTED }}>
            Select multiple files at once
          </div>
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={onPick}
            style={{ display: "none" }}
          />
        </label>
      </div>
    );
  }

  // Files loaded
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Top bar */}
      <div
        style={{
          height: 56,
          borderBottom: `1px solid ${LINE}`,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 16,
          position: "sticky",
          top: 0,
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(12px)",
          zIndex: 10,
        }}
      >
        <Link href="/" style={{ fontWeight: 800, fontSize: 15, color: INK }}>
          Paper<span style={{ color: RED }}>Workz</span>
        </Link>
        <div style={{ width: 1, height: 20, background: LINE }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Merge PDF</span>
        <div style={{ flex: 1 }} />
        {loading && (
          <span style={{ fontSize: 13, color: MUTED }}>Loading…</span>
        )}
        <span style={{ fontSize: 13, color: MUTED }}>
          {entries.length} file{entries.length !== 1 ? "s" : ""} &middot;{" "}
          {totalPages} page{totalPages !== 1 ? "s" : ""}
        </span>
        <label
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: "8px 14px",
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            cursor: "pointer",
            background: "#fff",
            whiteSpace: "nowrap",
          }}
        >
          + Add more
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={onPick}
            style={{ display: "none" }}
          />
        </label>
        <button
          onClick={merge}
          disabled={merging || entries.length < 2}
          style={{
            background: entries.length < 2 ? "#f0c8cc" : RED,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontWeight: 700,
            fontSize: 13,
            cursor: entries.length < 2 ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {merging ? "Merging…" : "Merge & Download"}
        </button>
      </div>

      {/* List */}
      <div
        style={{
          flex: 1,
          padding: "32px 24px 48px",
          maxWidth: 760,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <p style={{ fontSize: 13, color: MUTED, margin: "0 0 18px" }}>
          Drag to reorder, or use the arrows. Files merge top to bottom.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.map((entry, i) => {
            const isDragging = draggingId === entry.id;
            const isTarget = dropTarget === i;
            return (
              <div
                key={entry.id}
                draggable
                onDragStart={() => onItemDragStart(i, entry.id)}
                onDragOver={(e) => onItemDragOver(e, i)}
                onDrop={(e) => onItemDrop(e, i)}
                onDragEnd={onItemDragEnd}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  border: `1px solid ${isTarget ? RED : LINE}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  background: isTarget ? "#fff5f6" : "#fff",
                  opacity: isDragging ? 0.38 : 1,
                  cursor: "grab",
                  transition: "border-color 0.12s, background 0.12s, opacity 0.12s",
                  userSelect: "none",
                }}
              >
                {/* Drag handle */}
                <div
                  style={{
                    color: "#c5cad4",
                    fontSize: 15,
                    lineHeight: 1,
                    flexShrink: 0,
                    letterSpacing: "-1px",
                  }}
                >
                  ⠿
                </div>

                {/* Thumbnail */}
                <img
                  src={entry.thumbUrl}
                  alt=""
                  draggable={false}
                  style={{
                    width: 40,
                    height: 52,
                    objectFit: "cover",
                    objectPosition: "top center",
                    border: `1px solid ${LINE}`,
                    borderRadius: 4,
                    flexShrink: 0,
                    background: "#f7f8fa",
                  }}
                />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: INK,
                    }}
                  >
                    {entry.file.name}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
                    {entry.pageCount} page{entry.pageCount !== 1 ? "s" : ""}{" "}
                    &middot; {(entry.file.size / 1024).toFixed(0)} KB
                  </div>
                </div>

                {/* Order badge */}
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "#f3f4f6",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: MUTED,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>

                {/* Up / Down */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                  <ArrowBtn
                    label="↑"
                    title="Move up"
                    disabled={i === 0}
                    onClick={() => moveUp(i)}
                  />
                  <ArrowBtn
                    label="↓"
                    title="Move down"
                    disabled={i === entries.length - 1}
                    onClick={() => moveDown(i)}
                  />
                </div>

                {/* Remove */}
                <RemoveBtn onClick={() => remove(entry.id)} />
              </div>
            );
          })}
        </div>

        {/* Inline add-more zone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setZoneOver(true);
          }}
          onDragLeave={() => setZoneOver(false)}
          onDrop={onZoneDrop}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            border: `2px dashed ${zoneOver ? RED : LINE}`,
            borderRadius: 12,
            padding: 18,
            marginTop: 8,
            cursor: "pointer",
            background: zoneOver ? "#fff5f6" : "transparent",
            fontSize: 13,
            fontWeight: 600,
            color: MUTED,
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          + Add more PDF files
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={onPick}
            style={{ display: "none" }}
          />
        </label>
      </div>
    </div>
  );
}

function ArrowBtn({
  label,
  title,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 24,
        height: 24,
        border: `1px solid ${disabled ? "#f0f0f2" : LINE}`,
        borderRadius: 5,
        background: "#fff",
        color: disabled ? "#d0d3da" : MUTED,
        fontSize: 11,
        display: "grid",
        placeItems: "center",
        cursor: disabled ? "default" : "pointer",
        padding: 0,
      }}
    >
      {label}
    </button>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title="Remove"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28,
        height: 28,
        border: `1px solid ${hover ? RED : LINE}`,
        borderRadius: 7,
        background: "#fff",
        color: hover ? RED : MUTED,
        fontSize: 16,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        flexShrink: 0,
        padding: 0,
        transition: "border-color 0.12s, color 0.12s",
      }}
    >
      ×
    </button>
  );
}
