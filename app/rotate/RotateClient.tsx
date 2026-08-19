"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PDFDocument, degrees } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdfSetup";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

type Rotation = 0 | 90 | 180 | 270;

export default function RotateClient() {
  const [stage, setStage] = useState<"upload" | "edit">("upload");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  // Maps 1-based page number → additional rotation applied on top of PDF's own rotation
  const [rotations, setRotations] = useState<Record<number, Rotation>>({});
  const [zoneOver, setZoneOver] = useState(false);
  const [saving, setSaving] = useState(false);

  const openFile = useCallback(async (file: File) => {
    const bytes = await file.arrayBuffer();
    setFileBytes(bytes);
    setFileName(file.name);
    setThumbs([]);
    setRotations({});

    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    setNumPages(doc.numPages);
    setStage("edit");

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

  const getRotation = (pageNum: number): Rotation =>
    (rotations[pageNum] ?? 0) as Rotation;

  const rotatePage = (pageNum: number) =>
    setRotations((prev) => {
      const cur = prev[pageNum] ?? 0;
      const next = ((cur + 90) % 360) as Rotation;
      const updated = { ...prev };
      if (next === 0) delete updated[pageNum];
      else updated[pageNum] = next;
      return updated;
    });

  const rotateAll = () =>
    setRotations((prev) => {
      const result: Record<number, Rotation> = {};
      for (let i = 1; i <= numPages; i++) {
        const next = (((prev[i] ?? 0) + 90) % 360) as Rotation;
        if (next !== 0) result[i] = next;
      }
      return result;
    });

  const resetAll = () => setRotations({});

  const rotatedCount = Object.keys(rotations).length;
  const canSave = rotatedCount > 0;

  const save = async () => {
    if (!fileBytes) return;
    setSaving(true);
    try {
      const src = await PDFDocument.load(fileBytes);
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((pg, i) => {
        const additional = rotations[i + 1] ?? 0;
        if (additional !== 0) {
          // Add our rotation on top of whatever the original page had
          const existing = pg.getRotation().angle;
          pg.setRotation(degrees((existing + additional) % 360));
        }
        out.addPage(pg);
      });
      const bytes = await out.save();
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/pdf" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + "-rotated.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setSaving(false);
    }
  };

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
          Rotate PDF
        </h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Click any page to rotate it 90 degrees clockwise. Keep clicking to
          keep rotating. Download when done.
        </p>
        <label
          onDragOver={(e) => { e.preventDefault(); setZoneOver(true); }}
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
        <span style={{ fontSize: 14, fontWeight: 600 }}>Rotate PDF</span>
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
        {rotatedCount > 0 && (
          <span style={{ fontSize: 13, fontWeight: 600, color: RED }}>
            {rotatedCount} page{rotatedCount !== 1 ? "s" : ""} rotated
          </span>
        )}
        <button
          onClick={rotateAll}
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
          Rotate all 90°
        </button>
        {rotatedCount > 0 && (
          <button
            onClick={resetAll}
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
            Reset
          </button>
        )}
        <button
          onClick={save}
          disabled={saving || !canSave}
          style={{
            background: canSave ? RED : "#f0c8cc",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontWeight: 700,
            fontSize: 13,
            cursor: canSave ? "pointer" : "not-allowed",
            whiteSpace: "nowrap",
          }}
        >
          {saving ? "Saving…" : "Download PDF"}
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
        Click a page to rotate it 90° clockwise. Click again to keep rotating.
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
          const rot = getRotation(pageNum);
          return (
            <RotateCard
              key={i}
              pageNum={pageNum}
              thumb={thumbs[i]}
              rotation={rot}
              onClick={() => rotatePage(pageNum)}
            />
          );
        })}
      </div>
    </div>
  );
}

function RotateCard({
  pageNum,
  thumb,
  rotation,
  onClick,
}: {
  pageNum: number;
  thumb: string | undefined;
  rotation: Rotation;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const isRotated = rotation !== 0;
  // Scale down slightly when landscape so it fits inside the portrait container
  const isLandscape = rotation === 90 || rotation === 270;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `2px solid ${isRotated ? RED : hover ? "#f0c8cc" : LINE}`,
        borderRadius: 8,
        overflow: "hidden",
        cursor: "pointer",
        background: "#fff",
        userSelect: "none",
        transition: "border-color 0.12s",
        position: "relative",
      }}
    >
      {/* Thumbnail area */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          // Fixed portrait container so the grid stays stable
          aspectRatio: "0.773",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f8fa",
        }}
      >
        {thumb ? (
          <img
            src={thumb}
            alt={`Page ${pageNum}`}
            draggable={false}
            style={{
              width: "100%",
              display: "block",
              transform: `rotate(${rotation}deg) scale(${isLandscape ? 0.773 : 1})`,
              transformOrigin: "center center",
              transition: "transform 0.25s ease",
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#f3f4f6" }} />
        )}

        {/* Hover hint */}
        {hover && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(229,35,47,0.07)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(229,35,47,0.88)",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontSize: 17,
              }}
            >
              ↻
            </div>
          </div>
        )}

        {/* Rotation badge */}
        {isRotated && (
          <div
            style={{
              position: "absolute",
              top: 5,
              right: 5,
              background: RED,
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 5px",
              borderRadius: 4,
              lineHeight: 1.4,
              pointerEvents: "none",
            }}
          >
            {rotation}°
          </div>
        )}
      </div>

      {/* Page number label */}
      <div
        style={{
          padding: "5px 0",
          textAlign: "center",
          fontSize: 11,
          fontWeight: isRotated ? 700 : 400,
          color: isRotated ? RED : MUTED,
          background: isRotated ? "#fff5f6" : "#fff",
          transition: "color 0.12s, background 0.12s",
        }}
      >
        {pageNum}
      </div>
    </div>
  );
}
