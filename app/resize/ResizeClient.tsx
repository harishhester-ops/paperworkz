"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdfSetup";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

// Standard page sizes in PDF points (72pt = 1 inch)
const PRESETS = [
  { label: "Letter",  w: 612,    h: 792    },
  { label: "A4",      w: 595.28, h: 841.89 },
  { label: "Legal",   w: 612,    h: 1008   },
  { label: "A3",      w: 841.89, h: 1190.55 },
  { label: "A5",      w: 419.53, h: 595.28 },
  { label: "Custom",  w: 0,      h: 0      },
] as const;

const MM_TO_PT = 2.83465;
const PT_TO_MM = 0.352778;

function DiagramPreview({ origW, origH, targetW, targetH }: { origW: number; origH: number; targetW: number; targetH: number }) {
  if (!origW || !targetW) return null;
  const DIM = 100;
  const tAspect = targetW / targetH;
  const boxW = tAspect >= 1 ? DIM : DIM * tAspect;
  const boxH = tAspect >= 1 ? DIM / tAspect : DIM;
  const scale = Math.min(boxW / origW, boxH / origH);
  const innerW = origW * scale;
  const innerH = origH * scale;
  const innerX = (boxW - innerW) / 2;
  const innerY = (boxH - innerH) / 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 0" }}>
      <div style={{ position: "relative", width: boxW, height: boxH, border: `2px solid ${LINE}`, borderRadius: 3, background: "#f7f8fa", flexShrink: 0 }}>
        <div style={{ position: "absolute", left: innerX, top: innerY, width: innerW, height: innerH, background: "rgba(229,35,47,0.12)", border: `1.5px dashed ${RED}`, borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 1.5 }}>
        Red area = scaled original content<br />on target page (gray)
      </div>
    </div>
  );
}

export default function ResizeClient() {
  const [stage, setStage] = useState<"upload" | "settings">("upload");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [origDims, setOrigDims] = useState({ w: 0, h: 0 });
  const [zoneOver, setZoneOver] = useState(false);
  const [applying, setApplying] = useState(false);

  const [presetIdx, setPresetIdx] = useState(0); // Letter default
  const [customW, setCustomW] = useState("210"); // mm
  const [customH, setCustomH] = useState("297"); // mm
  const [matchOrientation, setMatchOrientation] = useState(true);

  const openFile = useCallback(async (file: File) => {
    const bytes = await file.arrayBuffer();
    setFileBytes(bytes);
    setFileName(file.name);
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    setNumPages(doc.numPages);
    const pg = await doc.getPage(1);
    const vp = pg.getViewport({ scale: 1 });
    setOrigDims({ w: vp.width, h: vp.height });
    setStage("settings");
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

  const isCustom = PRESETS[presetIdx].label === "Custom";
  const targetW = isCustom ? parseFloat(customW) * MM_TO_PT : PRESETS[presetIdx].w;
  const targetH = isCustom ? parseFloat(customH) * MM_TO_PT : PRESETS[presetIdx].h;

  const apply = async () => {
    if (!fileBytes || !targetW || !targetH) return;
    setApplying(true);
    try {
      const srcDoc = await PDFDocument.load(fileBytes);
      const outDoc = await PDFDocument.create();
      const indices = Array.from({ length: numPages }, (_, i) => i);
      const embeds = await outDoc.embedPdf(fileBytes, indices);

      for (let i = 0; i < numPages; i++) {
        const { width: origW, height: origH } = srcDoc.getPage(i).getSize();
        let tW = targetW;
        let tH = targetH;
        // Match the orientation of the original page
        if (matchOrientation) {
          const origIsLandscape = origW > origH;
          const targetIsLandscape = tW > tH;
          if (origIsLandscape !== targetIsLandscape) [tW, tH] = [tH, tW];
        }
        const scale = Math.min(tW / origW, tH / origH);
        const dW = origW * scale;
        const dH = origH * scale;
        const x = (tW - dW) / 2;
        const y = (tH - dH) / 2;
        const newPage = outDoc.addPage([tW, tH]);
        newPage.drawPage(embeds[i], { x, y, width: dW, height: dH });
      }

      const bytes = await outDoc.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + "-resized.pdf";
      a.click(); URL.revokeObjectURL(url);
    } finally { setApplying(false); }
  };

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>Resize PDF</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Scale all page content to a new paper size, then download.
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

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ height: 56, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 14, position: "sticky", top: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: 15, color: INK }}>Paper<span style={{ color: RED }}>Workz</span></Link>
        <div style={{ width: 1, height: 20, background: LINE }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Resize PDF</span>
        <span style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{fileName}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: MUTED }}>{numPages} page{numPages !== 1 ? "s" : ""}</span>
        <button onClick={apply} disabled={applying || !targetW || !targetH} style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
          {applying ? "Resizing…" : "Apply & Download"}
        </button>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, padding: "28px 24px", alignItems: "start", maxWidth: 1000, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "22px 20px", background: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Original info */}
          <div style={{ padding: "10px 14px", background: "#f7f8fa", borderRadius: 8, fontSize: 13, color: MUTED }}>
            Original: <strong style={{ color: INK }}>{(origDims.w * PT_TO_MM).toFixed(0)} x {(origDims.h * PT_TO_MM).toFixed(0)} mm</strong>
          </div>

          {/* Preset grid */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>Target size</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {PRESETS.map((p, i) => (
                <button key={p.label} onClick={() => setPresetIdx(i)} style={{ padding: "9px 12px", border: `1.5px solid ${presetIdx === i ? RED : LINE}`, borderRadius: 8, background: presetIdx === i ? "#fff5f6" : "#fff", color: presetIdx === i ? RED : INK, fontWeight: presetIdx === i ? 700 : 400, fontSize: 13, cursor: "pointer", textAlign: "left", transition: "all 0.1s" }}>
                  {p.label}
                  {p.label !== "Custom" && (
                    <div style={{ fontSize: 10, color: presetIdx === i ? RED : MUTED, marginTop: 2 }}>
                      {(p.w * PT_TO_MM).toFixed(0)} x {(p.h * PT_TO_MM).toFixed(0)} mm
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom dimensions */}
          {isCustom && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Width (mm)</label>
                <input type="number" min={10} max={2000} value={customW} onChange={e => setCustomW(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Height (mm)</label>
                <input type="number" min={10} max={2000} value={customH} onChange={e => setCustomH(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
          )}

          {/* Match orientation toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={matchOrientation} onChange={e => setMatchOrientation(e.target.checked)} style={{ width: 16, height: 16, accentColor: RED, cursor: "pointer" }} />
            <span style={{ fontSize: 13, color: INK }}>Match page orientation per page</span>
          </label>

          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            Content is scaled to fit the new size, maintaining aspect ratio. Letterboxed if proportions differ.
          </div>
        </div>

        {/* Preview diagram */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "22px 20px", background: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.5px" }}>Layout preview</div>
          <DiagramPreview origW={origDims.w} origH={origDims.h} targetW={targetW} targetH={targetH} />
          {targetW > 0 && (
            <div style={{ marginTop: 14, fontSize: 13, color: MUTED }}>
              Target: <strong style={{ color: INK }}>{(targetW * PT_TO_MM).toFixed(1)} x {(targetH * PT_TO_MM).toFixed(1)} mm</strong>
              {" "}({targetW.toFixed(0)} x {targetH.toFixed(0)} pt)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
