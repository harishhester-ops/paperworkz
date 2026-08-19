"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import { zipSync } from "fflate";
import { pdfjsLib } from "@/lib/pdfSetup";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

type Mode = "every" | "ranges";

type RangeRow = {
  id: string;
  input: string;
};

let rowSeed = 0;
const newId = () => `r${++rowSeed}`;

// Parses "1-3, 5, 8-10" → [1,2,3,5,8,9,10], clamped to [1,max], sorted, deduped
function parseRange(raw: string, max: number): number[] {
  const pages = new Set<number>();
  for (const part of raw.split(",")) {
    const t = part.trim();
    const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const from = Math.max(1, parseInt(m[1]));
      const to = Math.min(max, parseInt(m[2]));
      if (from <= to) for (let p = from; p <= to; p++) pages.add(p);
    } else {
      const n = parseInt(t);
      if (!isNaN(n) && n >= 1 && n <= max) pages.add(n);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

function rangeIsValid(input: string, max: number) {
  return input.trim().length > 0 && parseRange(input, max).length > 0;
}

// Row colors — cycle through a small palette for visual distinction
const ROW_COLORS = ["#e5232f", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

export default function SplitClient() {
  const [stage, setStage] = useState<"upload" | "split">("upload");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [zoneOver, setZoneOver] = useState(false);
  const [mode, setMode] = useState<Mode>("every");
  const [rows, setRows] = useState<RangeRow[]>([{ id: newId(), input: "" }]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [splitting, setSplitting] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const openFile = useCallback(async (file: File) => {
    const bytes = await file.arrayBuffer();
    setFileBytes(bytes);
    setFileName(file.name);
    setThumbs([]);
    setRows([{ id: newId(), input: "" }]);
    setActiveRowId(null);
    setMode("every");

    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    setNumPages(doc.numPages);
    setStage("split");

    // Render thumbnails progressively so the UI isn't blocked
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i);
      const vp = pg.getViewport({ scale: 0.13 });
      const cv = document.createElement("canvas");
      cv.width = vp.width;
      cv.height = vp.height;
      await pg.render({ canvasContext: cv.getContext("2d")!, viewport: vp }).promise;
      setThumbs((prev) => [...prev, cv.toDataURL("image/jpeg", 0.6)]);
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

  const updateRow = (id: string, input: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, input } : r)));

  const addRow = () =>
    setRows((prev) => [...prev, { id: newId(), input: "" }]);

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));
    if (activeRowId === id) setActiveRowId(null);
  };

  // Which pages each row covers (for highlight logic)
  const rowPages = rows.map((r) => new Set(parseRange(r.input, numPages)));

  // Active row's pages → red highlight in strip
  const activeIdx = rows.findIndex((r) => r.id === activeRowId);
  const activePages = activeIdx >= 0 ? rowPages[activeIdx] : null;

  // All covered pages across all rows → subtle gray tint when no row is active
  const allCoveredPages =
    mode === "every"
      ? null // all pages covered
      : new Set(rows.flatMap((r) => parseRange(r.input, numPages)));

  const split = async () => {
    if (!fileBytes) return;
    setSplitting(true);
    try {
      const src = await PDFDocument.load(fileBytes);
      const base = fileName.replace(/\.pdf$/i, "");
      const files: Record<string, Uint8Array> = {};

      if (mode === "every") {
        for (let i = 0; i < numPages; i++) {
          const out = await PDFDocument.create();
          const [pg] = await out.copyPages(src, [i]);
          out.addPage(pg);
          files[`${base}-page-${i + 1}.pdf`] = new Uint8Array(await out.save());
        }
      } else {
        const validRows = rows.filter((r) => rangeIsValid(r.input, numPages));
        for (let ri = 0; ri < validRows.length; ri++) {
          const pages = parseRange(validRows[ri].input, numPages);
          const out = await PDFDocument.create();
          const copied = await out.copyPages(src, pages.map((p) => p - 1));
          copied.forEach((pg) => out.addPage(pg));
          const label = validRows[ri].input.trim().replace(/\s+/g, "");
          files[`${base}-part-${ri + 1}-p${label}.pdf`] = new Uint8Array(await out.save());
        }
      }

      const zipped = zipSync(files, { level: 0 }); // PDFs are already compressed
      const url = URL.createObjectURL(new Blob([zipped], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}-split.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setSplitting(false);
    }
  };

  const canSplit =
    mode === "every"
      ? numPages > 0
      : rows.some((r) => rangeIsValid(r.input, numPages));

  const outputCount =
    mode === "every"
      ? numPages
      : rows.filter((r) => rangeIsValid(r.input, numPages)).length;

  // ── Upload stage ──────────────────────────────────────────────────────────
  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link
          href="/"
          style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}
        >
          ← All tools
        </Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>Split PDF</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Split every page into separate files, or define custom page ranges. Downloads as a ZIP.
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
          <div style={{ fontWeight: 700, fontSize: 15 }}>Drop a PDF here or click to select</div>
          <div style={{ fontSize: 13, color: MUTED }}>One file at a time</div>
          <input type="file" accept="application/pdf" onChange={onPick} style={{ display: "none" }} />
        </label>
      </div>
    );
  }

  // ── Split stage ───────────────────────────────────────────────────────────
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
        <span style={{ fontSize: 14, fontWeight: 600 }}>Split PDF</span>
        <span
          style={{
            fontSize: 13,
            color: MUTED,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 280,
          }}
        >
          {fileName}
        </span>
        <div style={{ flex: 1 }} />
        {outputCount > 0 && (
          <span style={{ fontSize: 13, color: MUTED }}>
            {outputCount} file{outputCount !== 1 ? "s" : ""} out
          </span>
        )}
        <button
          onClick={split}
          disabled={splitting || !canSplit}
          style={{
            background: canSplit ? RED : "#f0c8cc",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontWeight: 700,
            fontSize: 13,
            cursor: canSplit ? "pointer" : "not-allowed",
            whiteSpace: "nowrap",
          }}
        >
          {splitting ? "Splitting…" : "Split & Download"}
        </button>
      </div>

      {/* Page thumbnail strip */}
      <div
        ref={stripRef}
        style={{
          borderBottom: `1px solid ${LINE}`,
          padding: "14px 24px",
          overflowX: "auto",
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          background: "#fafafa",
          flexShrink: 0,
        }}
      >
        {Array.from({ length: numPages }).map((_, i) => {
          const pageNum = i + 1;
          const thumb = thumbs[i];

          // Determine highlight state
          let highlight: string | null = null;
          if (mode === "every") {
            highlight = RED;
          } else if (activePages) {
            if (activePages.has(pageNum)) {
              highlight = ROW_COLORS[activeIdx % ROW_COLORS.length];
            }
          } else if (allCoveredPages?.has(pageNum)) {
            // Find which row covers this page (first match)
            const rIdx = rowPages.findIndex((set) => set.has(pageNum));
            highlight = rIdx >= 0 ? ROW_COLORS[rIdx % ROW_COLORS.length] : null;
          }

          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "relative",
                  border: `2px solid ${highlight ?? LINE}`,
                  borderRadius: 4,
                  overflow: "hidden",
                  transition: "border-color 0.15s",
                  background: "#fff",
                  width: 46,
                  height: 60,
                }}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={`Page ${pageNum}`}
                    draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: "#f0f1f3" }} />
                )}
                {highlight && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: highlight + "22",
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
              <span style={{ fontSize: 10, color: highlight ? highlight : MUTED, fontWeight: highlight ? 700 : 400 }}>
                {pageNum}
              </span>
            </div>
          );
        })}
        {thumbs.length < numPages && (
          <div style={{ fontSize: 12, color: MUTED, alignSelf: "center", whiteSpace: "nowrap", paddingLeft: 4 }}>
            Loading pages…
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: "28px 24px 56px", maxWidth: 700, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {/* Mode toggle */}
        <div
          style={{
            display: "inline-flex",
            border: `1px solid ${LINE}`,
            borderRadius: 10,
            padding: 3,
            marginBottom: 28,
            background: "#fafafa",
          }}
        >
          {(["every", "ranges"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setActiveRowId(null); }}
              style={{
                padding: "8px 20px",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                background: mode === m ? "#fff" : "transparent",
                color: mode === m ? INK : MUTED,
                boxShadow: mode === m ? "0 1px 4px #1113180f" : "none",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {m === "every" ? "Every page" : "Custom ranges"}
            </button>
          ))}
        </div>

        {/* Every page mode */}
        {mode === "every" && (
          <div
            style={{
              border: `1px solid ${LINE}`,
              borderRadius: 14,
              padding: "22px 24px",
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              Split every page
            </div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
              Each page becomes its own PDF file. Your download will contain{" "}
              <strong style={{ color: INK }}>{numPages} files</strong> in a ZIP archive.
            </div>
            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {Array.from({ length: Math.min(numPages, 8) }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: "#fff0f1",
                    color: RED,
                    border: `1px solid #f0c8cc`,
                  }}
                >
                  page-{i + 1}.pdf
                </div>
              ))}
              {numPages > 8 && (
                <div
                  style={{
                    fontSize: 12,
                    color: MUTED,
                    padding: "4px 10px",
                    alignSelf: "center",
                  }}
                >
                  + {numPages - 8} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom ranges mode */}
        {mode === "ranges" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 13, color: MUTED, margin: "0 0 4px" }}>
              Each row becomes one PDF file. Use ranges like{" "}
              <code
                style={{
                  background: "#f3f4f6",
                  padding: "1px 5px",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                1-3
              </code>
              , single pages like{" "}
              <code
                style={{
                  background: "#f3f4f6",
                  padding: "1px 5px",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                5
              </code>
              , or combinations like{" "}
              <code
                style={{
                  background: "#f3f4f6",
                  padding: "1px 5px",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                1-3, 5, 8-10
              </code>
              .
            </p>

            {rows.map((row, ri) => {
              const pages = parseRange(row.input, numPages);
              const valid = rangeIsValid(row.input, numPages);
              const empty = row.input.trim().length === 0;
              const rowColor = ROW_COLORS[ri % ROW_COLORS.length];

              return (
                <div
                  key={row.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    border: `1px solid ${activeRowId === row.id ? rowColor : LINE}`,
                    borderRadius: 12,
                    background: "#fff",
                    transition: "border-color 0.15s",
                  }}
                >
                  {/* Part number */}
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: rowColor + "18",
                      border: `1.5px solid ${rowColor}44`,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: rowColor,
                      flexShrink: 0,
                    }}
                  >
                    {ri + 1}
                  </div>

                  {/* Range input */}
                  <input
                    type="text"
                    value={row.input}
                    placeholder={`e.g. ${ri === 0 ? "1-3" : ri === 1 ? "4-6" : `${ri * 3 + 1}-${(ri + 1) * 3}`}`}
                    onChange={(e) => updateRow(row.id, e.target.value)}
                    onFocus={() => setActiveRowId(row.id)}
                    onBlur={() => setActiveRowId(null)}
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      fontSize: 14,
                      background: "transparent",
                      color: INK,
                      fontFamily: "inherit",
                    }}
                  />

                  {/* Page count badge */}
                  {!empty && (
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "3px 9px",
                        borderRadius: 6,
                        background: valid ? rowColor + "18" : "#fff0f1",
                        color: valid ? rowColor : "#c0392b",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {valid ? `${pages.length} page${pages.length !== 1 ? "s" : ""}` : "Invalid"}
                    </div>
                  )}

                  {/* Remove */}
                  <RemoveBtn onClick={() => removeRow(row.id)} disabled={rows.length === 1} />
                </div>
              );
            })}

            <button
              onClick={addRow}
              style={{
                border: `1.5px dashed ${LINE}`,
                borderRadius: 12,
                padding: "12px",
                background: "transparent",
                fontSize: 13,
                fontWeight: 600,
                color: MUTED,
                cursor: "pointer",
                textAlign: "center",
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = RED;
                (e.currentTarget as HTMLButtonElement).style.color = RED;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = LINE;
                (e.currentTarget as HTMLButtonElement).style.color = MUTED;
              }}
            >
              + Add range
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RemoveBtn({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title="Remove"
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28,
        height: 28,
        border: `1px solid ${hover ? RED : LINE}`,
        borderRadius: 7,
        background: "#fff",
        color: hover ? RED : disabled ? "#e0e2e8" : MUTED,
        fontSize: 16,
        display: "grid",
        placeItems: "center",
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
        padding: 0,
        transition: "border-color 0.12s, color 0.12s",
      }}
    >
      ×
    </button>
  );
}
