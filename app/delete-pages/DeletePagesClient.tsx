"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdfSetup";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

export default function DeletePagesClient() {
  const [stage, setStage] = useState<"upload" | "select">("upload");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [zoneOver, setZoneOver] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openFile = useCallback(async (file: File) => {
    const bytes = await file.arrayBuffer();
    setFileBytes(bytes);
    setFileName(file.name);
    setThumbs([]);
    setSelected(new Set());

    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    setNumPages(doc.numPages);
    setStage("select");

    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i);
      const vp = pg.getViewport({ scale: 0.28 });
      const cv = document.createElement("canvas");
      cv.width = vp.width;
      cv.height = vp.height;
      await pg.render({ canvasContext: cv.getContext("2d")!, viewport: vp }).promise;
      setThumbs((prev) => [...prev, cv.toDataURL("image/jpeg", 0.75)]);
    }
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setZoneOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f?.type === "application/pdf") openFile(f);
    },
    [openFile]
  );

  const onPick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) openFile(f);
      e.target.value = "";
    },
    [openFile]
  );

  const toggle = (pageNum: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
      return next;
    });
  };

  const selectAll = () =>
    setSelected(new Set(Array.from({ length: numPages }, (_, i) => i + 1)));

  const clearAll = () => setSelected(new Set());

  const deletePages = async () => {
    if (!fileBytes || selected.size === 0 || selected.size >= numPages) return;
    setDeleting(true);
    try {
      const src = await PDFDocument.load(fileBytes);
      const out = await PDFDocument.create();
      const keepIndices = Array.from({ length: numPages }, (_, i) => i).filter(
        (i) => !selected.has(i + 1)
      );
      const pages = await out.copyPages(src, keepIndices);
      pages.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/pdf" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + "-deleted.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = selected.size > 0 && selected.size < numPages;

  // ── Upload stage ──────────────────────────────────────────────────────────
  if (stage === "upload") {
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
          Delete Pages
        </h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Click pages to mark them for removal, then download the cleaned PDF.
        </p>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setZoneOver(true);
          }}
          onDragLeave={() => setZoneOver(false)}
          onDrop={onDrop}
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
            Drop a PDF here or click to select
          </div>
          <div style={{ fontSize: 13, color: MUTED }}>One file at a time</div>
          <input
            type="file"
            accept="application/pdf"
            onChange={onPick}
            style={{ display: "none" }}
          />
        </label>
      </div>
    );
  }

  // ── Select stage ──────────────────────────────────────────────────────────
  const deleteLabel =
    selected.size === 0
      ? "Delete & Download"
      : selected.size >= numPages
      ? "Keep at least 1 page"
      : `Delete ${selected.size} page${selected.size !== 1 ? "s" : ""}`;

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
          gap: 14,
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
        <span style={{ fontSize: 14, fontWeight: 600 }}>Delete Pages</span>
        <span
          style={{
            fontSize: 13,
            color: MUTED,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 240,
          }}
        >
          {fileName}
        </span>
        <div style={{ flex: 1 }} />

        {/* Selection status */}
        {selected.size > 0 && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: selected.size >= numPages ? "#b91c1c" : RED,
            }}
          >
            {selected.size} of {numPages} selected
          </span>
        )}

        {/* Select all / Clear */}
        <button
          onClick={selected.size === numPages ? clearAll : selectAll}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "7px 13px",
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            background: "#fff",
            color: MUTED,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {selected.size === numPages ? "Clear all" : "Select all"}
        </button>

        <button
          onClick={deletePages}
          disabled={deleting || !canDelete}
          style={{
            background: canDelete ? RED : "#f0c8cc",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontWeight: 700,
            fontSize: 13,
            cursor: canDelete ? "pointer" : "not-allowed",
            whiteSpace: "nowrap",
          }}
        >
          {deleting ? "Saving…" : deleteLabel}
        </button>
      </div>

      {/* Instruction strip */}
      <div
        style={{
          padding: "10px 24px",
          borderBottom: `1px solid ${LINE}`,
          fontSize: 13,
          color: MUTED,
          background: "#fafafa",
        }}
      >
        Click pages to mark them for deletion. Click again to unmark.
        {thumbs.length < numPages && (
          <span style={{ marginLeft: 12, color: "#aab" }}>
            Loading thumbnails… ({thumbs.length}/{numPages})
          </span>
        )}
      </div>

      {/* Thumbnail grid */}
      <div
        style={{
          flex: 1,
          padding: "24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: 14,
          alignContent: "start",
        }}
      >
        {Array.from({ length: numPages }).map((_, i) => {
          const pageNum = i + 1;
          const isSelected = selected.has(pageNum);
          const thumb = thumbs[i];

          return (
            <PageCard
              key={i}
              pageNum={pageNum}
              thumb={thumb}
              isSelected={isSelected}
              onToggle={() => toggle(pageNum)}
            />
          );
        })}
      </div>
    </div>
  );
}

function PageCard({
  pageNum,
  thumb,
  isSelected,
  onToggle,
}: {
  pageNum: number;
  thumb: string | undefined;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `2px solid ${isSelected ? RED : hover ? "#f0c8cc" : LINE}`,
        borderRadius: 8,
        overflow: "hidden",
        cursor: "pointer",
        background: "#fff",
        userSelect: "none",
        transition: "border-color 0.12s",
        position: "relative",
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: "relative", lineHeight: 0 }}>
        {thumb ? (
          <img
            src={thumb}
            alt={`Page ${pageNum}`}
            draggable={false}
            style={{
              width: "100%",
              display: "block",
              filter: isSelected ? "brightness(0.55)" : "none",
              transition: "filter 0.12s",
            }}
          />
        ) : (
          <div
            style={{
              aspectRatio: "0.773",
              background: "#f3f4f6",
              width: "100%",
            }}
          />
        )}

        {/* Hover hint (not selected) */}
        {!isSelected && hover && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(229,35,47,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(229,35,47,0.85)",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontSize: 20,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              ×
            </div>
          </div>
        )}

        {/* Selected state */}
        {isSelected && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: RED,
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontSize: 26,
                fontWeight: 700,
                lineHeight: 1,
                boxShadow: "0 2px 10px rgba(229,35,47,0.45)",
              }}
            >
              ×
            </div>
          </div>
        )}
      </div>

      {/* Page number label */}
      <div
        style={{
          padding: "5px 0",
          textAlign: "center",
          fontSize: 11,
          fontWeight: isSelected ? 700 : 400,
          color: isSelected ? RED : MUTED,
          background: isSelected ? "#fff5f6" : "#fff",
          transition: "color 0.12s, background 0.12s",
        }}
      >
        {isSelected ? `✕ ${pageNum}` : pageNum}
      </div>
    </div>
  );
}
