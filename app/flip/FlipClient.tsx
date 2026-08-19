"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdfSetup";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

type FlipMode = "h" | "v";
type FlipState = { h?: boolean; v?: boolean };

export default function FlipClient() {
  const [stage, setStage] = useState<"upload" | "edit">("upload");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [flips, setFlips] = useState<Record<number, FlipState>>({});
  const [mode, setMode] = useState<FlipMode>("h");
  const [zoneOver, setZoneOver] = useState(false);
  const [saving, setSaving] = useState(false);

  const openFile = useCallback(async (file: File) => {
    const bytes = await file.arrayBuffer();
    setFileBytes(bytes);
    setFileName(file.name);
    setThumbs([]);
    setFlips({});
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    setNumPages(doc.numPages);
    setStage("edit");
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i);
      const vp = pg.getViewport({ scale: 0.28 });
      const cv = document.createElement("canvas");
      cv.width = vp.width; cv.height = vp.height;
      await pg.render({ canvasContext: cv.getContext("2d")!, viewport: vp }).promise;
      setThumbs((prev) => [...prev, cv.toDataURL("image/jpeg", 0.75)]);
    }
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setZoneOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f?.type === "application/pdf") openFile(f);
  }, [openFile]);

  const onPick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) openFile(f);
    e.target.value = "";
  }, [openFile]);

  const togglePage = (pageNum: number) => {
    setFlips((prev) => {
      const cur = prev[pageNum] ?? {};
      const next = { ...cur, [mode]: !cur[mode] };
      if (!next.h && !next.v) {
        const updated = { ...prev };
        delete updated[pageNum];
        return updated;
      }
      return { ...prev, [pageNum]: next };
    });
  };

  const flipAll = () => {
    setFlips((prev) => {
      const result: Record<number, FlipState> = {};
      for (let i = 1; i <= numPages; i++) {
        const cur = prev[i] ?? {};
        const next = { ...cur, [mode]: !cur[mode] };
        if (next.h || next.v) result[i] = next;
      }
      return result;
    });
  };

  const resetAll = () => setFlips({});

  const flippedCount = Object.keys(flips).length;
  const canSave = flippedCount > 0;

  const save = async () => {
    if (!fileBytes) return;
    setSaving(true);
    try {
      const src = await PDFDocument.load(fileBytes);
      const out = await PDFDocument.create();

      // Embed all pages that need flipping in one call
      const flipEntries = Object.entries(flips)
        .map(([k, v]) => ({ pageIdx: parseInt(k) - 1, flip: v }))
        .filter((e) => e.flip.h || e.flip.v);

      const embeddedMap = new Map<number, any>();
      if (flipEntries.length > 0) {
        const indices = flipEntries.map((e) => e.pageIdx);
        const embedded = await out.embedPdf(fileBytes, indices);
        indices.forEach((idx, i) => embeddedMap.set(idx, embedded[i]));
      }

      for (let i = 0; i < numPages; i++) {
        const srcPage = src.getPage(i);
        const { width, height } = srcPage.getSize();
        if (embeddedMap.has(i)) {
          const flip = flips[i + 1];
          const newPage = out.addPage([width, height]);
          // Negative xScale/yScale mirrors the content; translate to keep it in bounds
          newPage.drawPage(embeddedMap.get(i), {
            x: flip?.h ? width : 0,
            y: flip?.v ? height : 0,
            xScale: flip?.h ? -1 : 1,
            yScale: flip?.v ? -1 : 1,
          });
        } else {
          const [copied] = await out.copyPages(src, [i]);
          out.addPage(copied);
        }
      }

      const bytes = await out.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + "-flipped.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally { setSaving(false); }
  };

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>Flip PDF</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Click pages to flip them horizontally or vertically, then download.
        </p>
        <label
          onDragOver={(e) => { e.preventDefault(); setZoneOver(true); }}
          onDragLeave={() => setZoneOver(false)}
          onDrop={onDrop}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, border: `2px dashed ${zoneOver ? RED : LINE}`, borderRadius: 16, padding: "64px 24px", cursor: "pointer", background: zoneOver ? "#fff5f6" : "#fafafb", transition: "border-color 0.15s" }}
        >
          <div style={{ fontSize: 32 }}>📄</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Drop a PDF here or click to select</div>
          <div style={{ fontSize: 13, color: MUTED }}>One file at a time</div>
          <input type="file" accept="application/pdf" onChange={onPick} style={{ display: "none" }} />
        </label>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Top bar */}
      <div style={{ height: 56, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 12, position: "sticky", top: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: 15, color: INK }}>Paper<span style={{ color: RED }}>Workz</span></Link>
        <div style={{ width: 1, height: 20, background: LINE }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Flip PDF</span>
        <span style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{fileName}</span>
        <div style={{ flex: 1 }} />
        {flippedCount > 0 && (
          <span style={{ fontSize: 13, fontWeight: 600, color: RED }}>{flippedCount} page{flippedCount !== 1 ? "s" : ""} flipped</span>
        )}
        {/* Mode toggle */}
        <div style={{ display: "inline-flex", border: `1px solid ${LINE}`, borderRadius: 8, padding: 2, background: "#fafafa" }}>
          {(["h", "v"] as FlipMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{ padding: "6px 14px", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer", background: mode === m ? "#fff" : "transparent", color: mode === m ? INK : MUTED, boxShadow: mode === m ? "0 1px 4px #1113180f" : "none", transition: "background 0.12s" }}
            >
              {m === "h" ? "↔ Horizontal" : "↕ Vertical"}
            </button>
          ))}
        </div>
        <button onClick={flipAll} style={{ fontSize: 13, fontWeight: 600, padding: "7px 13px", border: `1px solid ${LINE}`, borderRadius: 8, background: "#fff", color: MUTED, cursor: "pointer", whiteSpace: "nowrap" }}>
          Flip all
        </button>
        {flippedCount > 0 && (
          <button onClick={resetAll} style={{ fontSize: 13, fontWeight: 600, padding: "7px 13px", border: `1px solid ${LINE}`, borderRadius: 8, background: "#fff", color: MUTED, cursor: "pointer" }}>
            Reset
          </button>
        )}
        <button onClick={save} disabled={saving || !canSave} style={{ background: canSave ? RED : "#f0c8cc", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: canSave ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>
          {saving ? "Saving…" : "Download PDF"}
        </button>
      </div>

      {/* Instruction strip */}
      <div style={{ padding: "10px 24px", borderBottom: `1px solid ${LINE}`, fontSize: 13, color: MUTED, background: "#fafafa" }}>
        Select <strong style={{ color: INK }}>{mode === "h" ? "Horizontal" : "Vertical"}</strong> flip mode above, then click pages to apply. Click again to remove.
        {thumbs.length < numPages && <span style={{ marginLeft: 12, color: "#aab" }}>Loading… ({thumbs.length}/{numPages})</span>}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 14, alignContent: "start" }}>
        {Array.from({ length: numPages }).map((_, i) => {
          const pageNum = i + 1;
          const flip = flips[pageNum];
          const hasH = flip?.h ?? false;
          const hasV = flip?.v ?? false;
          const isFlipped = hasH || hasV;
          const cssTransform = `scaleX(${hasH ? -1 : 1}) scaleY(${hasV ? -1 : 1})`;
          const badge = hasH && hasV ? "H+V" : hasH ? "↔" : hasV ? "↕" : null;
          return (
            <FlipCard
              key={i}
              pageNum={pageNum}
              thumb={thumbs[i]}
              isFlipped={isFlipped}
              cssTransform={cssTransform}
              badge={badge}
              modeLabel={mode === "h" ? "↔" : "↕"}
              onClick={() => togglePage(pageNum)}
            />
          );
        })}
      </div>
    </div>
  );
}

function FlipCard({ pageNum, thumb, isFlipped, cssTransform, badge, modeLabel, onClick }: {
  pageNum: number; thumb: string | undefined; isFlipped: boolean;
  cssTransform: string; badge: string | null; modeLabel: string;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ border: `2px solid ${isFlipped ? RED : hover ? "#f0c8cc" : LINE}`, borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "#fff", userSelect: "none", transition: "border-color 0.12s", position: "relative" }}
    >
      <div style={{ position: "relative", overflow: "hidden", aspectRatio: "0.773", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f8fa" }}>
        {thumb ? (
          <img
            src={thumb} alt={`Page ${pageNum}`} draggable={false}
            style={{ width: "100%", display: "block", transform: cssTransform, transition: "transform 0.2s ease" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#f3f4f6" }} />
        )}
        {hover && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(229,35,47,0.07)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(229,35,47,0.88)", display: "grid", placeItems: "center", color: "#fff", fontSize: 16 }}>{modeLabel}</div>
          </div>
        )}
        {badge && (
          <div style={{ position: "absolute", top: 5, right: 5, background: RED, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 5px", borderRadius: 4, lineHeight: 1.4, pointerEvents: "none" }}>{badge}</div>
        )}
      </div>
      <div style={{ padding: "5px 0", textAlign: "center", fontSize: 11, fontWeight: isFlipped ? 700 : 400, color: isFlipped ? RED : MUTED, background: isFlipped ? "#fff5f6" : "#fff", transition: "color 0.12s, background 0.12s" }}>
        {pageNum}
      </div>
    </div>
  );
}
