"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdfSetup";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

interface Box { x1: number; y1: number; x2: number; y2: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const GAP = 5; // minimum % gap between opposite edges

function applyEdge(prev: Box, edge: string, px: number, py: number): Box {
  switch (edge) {
    case "top":    return { ...prev, y1: clamp(py, 0, prev.y2 - GAP) };
    case "bottom": return { ...prev, y2: clamp(py, prev.y1 + GAP, 100) };
    case "left":   return { ...prev, x1: clamp(px, 0, prev.x2 - GAP) };
    case "right":  return { ...prev, x2: clamp(px, prev.x1 + GAP, 100) };
    case "tl": return { x1: clamp(px, 0, prev.x2-GAP), y1: clamp(py, 0, prev.y2-GAP), x2: prev.x2, y2: prev.y2 };
    case "tr": return { x1: prev.x1, y1: clamp(py, 0, prev.y2-GAP), x2: clamp(px, prev.x1+GAP, 100), y2: prev.y2 };
    case "bl": return { x1: clamp(px, 0, prev.x2-GAP), y1: prev.y1, x2: prev.x2, y2: clamp(py, prev.y1+GAP, 100) };
    case "br": return { x1: prev.x1, y1: prev.y1, x2: clamp(px, prev.x1+GAP, 100), y2: clamp(py, prev.y1+GAP, 100) };
    default: return prev;
  }
}

const PT_TO_MM = 0.352778;

function marginsMM(box: Box, pdfW: number, pdfH: number) {
  return {
    left:   (box.x1 / 100 * pdfW * PT_TO_MM).toFixed(1),
    right:  ((1 - box.x2 / 100) * pdfW * PT_TO_MM).toFixed(1),
    top:    (box.y1 / 100 * pdfH * PT_TO_MM).toFixed(1),
    bottom: ((1 - box.y2 / 100) * pdfH * PT_TO_MM).toFixed(1),
  };
}

export default function CropClient() {
  const [stage, setStage] = useState<"upload" | "crop">("upload");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [previewSrc, setPreviewSrc] = useState("");
  const [previewW, setPreviewW] = useState(0);
  const [previewH, setPreviewH] = useState(0);
  const [pdfDims, setPdfDims] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState<Box>({ x1: 0, y1: 0, x2: 100, y2: 100 });
  const [zoneOver, setZoneOver] = useState(false);
  const [applying, setApplying] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const openFile = useCallback(async (file: File) => {
    const bytes = await file.arrayBuffer();
    setFileBytes(bytes);
    setFileName(file.name);
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    setNumPages(doc.numPages);
    const pg = await doc.getPage(1);
    const naturalVp = pg.getViewport({ scale: 1 });
    setPdfDims({ w: naturalVp.width, h: naturalVp.height });
    const scale = Math.min(520 / naturalVp.width, 1.4);
    const vp = pg.getViewport({ scale });
    const cv = document.createElement("canvas");
    cv.width = vp.width; cv.height = vp.height;
    await pg.render({ canvasContext: cv.getContext("2d")!, viewport: vp }).promise;
    setPreviewW(vp.width);
    setPreviewH(vp.height);
    setPreviewSrc(cv.toDataURL("image/jpeg", 0.92));
    setBox({ x1: 0, y1: 0, x2: 100, y2: 100 });
    setStage("crop");
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

  // Start dragging a handle. Uses document-level mousemove so the drag
  // keeps working even if the pointer moves fast outside the handle.
  const startDrag = useCallback((edge: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const onMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      const px = clamp((ev.clientX - r.left) / r.width * 100, 0, 100);
      const py = clamp((ev.clientY - r.top) / r.height * 100, 0, 100);
      setBox(prev => applyEdge(prev, edge, px, py));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const apply = async () => {
    if (!fileBytes) return;
    setApplying(true);
    try {
      const doc = await PDFDocument.load(fileBytes);
      // Convert % of page-1 preview to absolute PDF points
      const cropX = box.x1 / 100 * pdfDims.w;
      const cropY = (1 - box.y2 / 100) * pdfDims.h; // PDF origin is bottom-left
      const cropW = (box.x2 - box.x1) / 100 * pdfDims.w;
      const cropH = (box.y2 - box.y1) / 100 * pdfDims.h;
      for (let i = 0; i < numPages; i++) {
        doc.getPage(i).setCropBox(cropX, cropY, cropW, cropH);
      }
      const bytes = await doc.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + "-cropped.pdf";
      a.click(); URL.revokeObjectURL(url);
    } finally { setApplying(false); }
  };

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>Crop PDF</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Drag the crop handles on the page preview to trim margins, then download.
        </p>
        <label
          onDragOver={e => { e.preventDefault(); setZoneOver(true); }}
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

  const mm = marginsMM(box, pdfDims.w, pdfDims.h);
  const cropW_mm = ((box.x2 - box.x1) / 100 * pdfDims.w * PT_TO_MM).toFixed(1);
  const cropH_mm = ((box.y2 - box.y1) / 100 * pdfDims.h * PT_TO_MM).toFixed(1);

  // Shared handle style
  const hBase: React.CSSProperties = { position: "absolute", zIndex: 3, userSelect: "none" };

  // Edge handle bars
  const topHandle: React.CSSProperties = { ...hBase, top: `calc(${box.y1}% - 3px)`, left: `${box.x1}%`, right: `${100 - box.x2}%`, height: 6, background: "rgba(255,255,255,0.9)", cursor: "n-resize", boxShadow: "0 0 0 1px rgba(229,35,47,0.6)" };
  const bottomHandle: React.CSSProperties = { ...hBase, top: `calc(${box.y2}% - 3px)`, left: `${box.x1}%`, right: `${100 - box.x2}%`, height: 6, background: "rgba(255,255,255,0.9)", cursor: "s-resize", boxShadow: "0 0 0 1px rgba(229,35,47,0.6)" };
  const leftHandle: React.CSSProperties = { ...hBase, top: `${box.y1}%`, bottom: `${100 - box.y2}%`, left: `calc(${box.x1}% - 3px)`, width: 6, background: "rgba(255,255,255,0.9)", cursor: "w-resize", boxShadow: "0 0 0 1px rgba(229,35,47,0.6)" };
  const rightHandle: React.CSSProperties = { ...hBase, top: `${box.y1}%`, bottom: `${100 - box.y2}%`, left: `calc(${box.x2}% - 3px)`, width: 6, background: "rgba(255,255,255,0.9)", cursor: "e-resize", boxShadow: "0 0 0 1px rgba(229,35,47,0.6)" };

  // Corner handle squares
  function corner(edge: string, top: string, left: string, cursor: string): React.CSSProperties {
    return { ...hBase, top, left, width: 12, height: 12, transform: "translate(-50%,-50%)", background: "#fff", border: `2px solid ${RED}`, cursor, borderRadius: 2 };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Top bar */}
      <div style={{ height: 56, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 14, position: "sticky", top: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: 15, color: INK }}>Paper<span style={{ color: RED }}>Workz</span></Link>
        <div style={{ width: 1, height: 20, background: LINE }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Crop PDF</span>
        <span style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{fileName}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: MUTED }}>{numPages} page{numPages !== 1 ? "s" : ""}</span>
        <button onClick={() => setBox({ x1: 0, y1: 0, x2: 100, y2: 100 })} style={{ fontSize: 13, fontWeight: 600, padding: "7px 13px", border: `1px solid ${LINE}`, borderRadius: 8, background: "#fff", color: MUTED, cursor: "pointer" }}>Reset</button>
        <button onClick={apply} disabled={applying} style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
          {applying ? "Applying…" : "Apply & Download"}
        </button>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, padding: "28px 24px", alignItems: "start", maxWidth: 1080, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

        {/* Left panel: margin readout */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "20px 18px", background: "#fff", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px" }}>Crop margins</div>

          {(["top", "bottom", "left", "right"] as const).map(side => (
            <div key={side} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: MUTED, textTransform: "capitalize" }}>{side}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{mm[side]} mm</span>
            </div>
          ))}

          <div style={{ height: 1, background: LINE }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px" }}>Visible area</div>
            <div style={{ fontSize: 13, color: INK }}>{cropW_mm} mm wide</div>
            <div style={{ fontSize: 13, color: INK }}>{cropH_mm} mm tall</div>
          </div>

          <div style={{ height: 1, background: LINE }} />
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            Crop box applies to all {numPages} pages. Content outside the crop box is hidden but not deleted.
          </div>
        </div>

        {/* Right panel: visual crop editor */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "20px 18px", background: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.5px" }}>Drag to crop</div>

          <div style={{ display: "inline-block", position: "relative", userSelect: "none" }}>
            {/* Container that holds the preview and all handles */}
            <div
              ref={containerRef}
              style={{ position: "relative", width: previewW, height: previewH, flexShrink: 0, boxShadow: "0 4px 24px #11131814", lineHeight: 0 }}
            >
              <img src={previewSrc} alt="PDF preview" width={previewW} height={previewH} style={{ display: "block", userSelect: "none", pointerEvents: "none" }} draggable={false} />

              {/* Dark overlay strips outside the crop box */}
              {[
                { top: 0, left: 0, right: 0, height: `${box.y1}%` },
                { bottom: 0, left: 0, right: 0, height: `${100 - box.y2}%` },
                { top: `${box.y1}%`, left: 0, width: `${box.x1}%`, height: `${box.y2 - box.y1}%` },
                { top: `${box.y1}%`, right: 0, width: `${100 - box.x2}%`, height: `${box.y2 - box.y1}%` },
              ].map((s, i) => (
                <div key={i} style={{ position: "absolute", background: "rgba(0,0,0,0.48)", pointerEvents: "none", zIndex: 1, ...s as React.CSSProperties }} />
              ))}

              {/* Edge handles */}
              <div style={topHandle} onMouseDown={startDrag("top")} />
              <div style={bottomHandle} onMouseDown={startDrag("bottom")} />
              <div style={leftHandle} onMouseDown={startDrag("left")} />
              <div style={rightHandle} onMouseDown={startDrag("right")} />

              {/* Corner handles */}
              <div style={corner("tl", `${box.y1}%`, `${box.x1}%`, "nw-resize")} onMouseDown={startDrag("tl")} />
              <div style={corner("tr", `${box.y1}%`, `${box.x2}%`, "ne-resize")} onMouseDown={startDrag("tr")} />
              <div style={corner("bl", `${box.y2}%`, `${box.x1}%`, "sw-resize")} onMouseDown={startDrag("bl")} />
              <div style={corner("br", `${box.y2}%`, `${box.x2}%`, "se-resize")} onMouseDown={startDrag("br")} />
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>
            Showing page 1. The same crop box applies to all pages.
          </div>
        </div>
      </div>
    </div>
  );
}
