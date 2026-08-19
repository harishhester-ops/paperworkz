"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdfSetup";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";
const MARGIN = 20;

type PosKey =
  | "top-left" | "top-center" | "top-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

function computeXY(pos: PosKey, pw: number, ph: number, tw: number, fs: number) {
  const x =
    pos.endsWith("left") ? MARGIN :
    pos.endsWith("right") ? pw - MARGIN - tw :
    (pw - tw) / 2;
  const y = pos.startsWith("top") ? ph - MARGIN - fs : MARGIN;
  return { x, y };
}

function previewCSS(pos: PosKey, text: string): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute", fontSize: 10, fontWeight: 700,
    color: RED, whiteSpace: "nowrap", lineHeight: 1,
    fontFamily: "monospace",
  };
  if (!text) return { ...base, display: "none" };
  if (pos === "top-left")      return { ...base, top: "4%", left: "5%" };
  if (pos === "top-center")    return { ...base, top: "4%", left: "50%", transform: "translateX(-50%)" };
  if (pos === "top-right")     return { ...base, top: "4%", right: "5%" };
  if (pos === "bottom-left")   return { ...base, bottom: "4%", left: "5%" };
  if (pos === "bottom-center") return { ...base, bottom: "4%", left: "50%", transform: "translateX(-50%)" };
  return { ...base, bottom: "4%", right: "5%" };
}

const DOT_COORDS: { id: PosKey; x: number; y: number }[] = [
  { id: "top-left",      x: 8,  y: 8  },
  { id: "top-center",    x: 36, y: 8  },
  { id: "top-right",     x: 63, y: 8  },
  { id: "bottom-left",   x: 8,  y: 88 },
  { id: "bottom-center", x: 36, y: 88 },
  { id: "bottom-right",  x: 63, y: 88 },
];

function PositionPicker({ value, onChange }: { value: PosKey; onChange: (v: PosKey) => void }) {
  return (
    <div style={{ position: "relative", width: 84, height: 108, border: `1.5px solid ${LINE}`, borderRadius: 5, background: "#fafafa", flexShrink: 0 }}>
      {DOT_COORDS.map(({ id, x, y }) => (
        <div
          key={id}
          onClick={() => onChange(id)}
          title={id.replace("-", " ")}
          style={{ position: "absolute", left: x, top: y, width: 13, height: 13, borderRadius: "50%", border: `2px solid ${value === id ? RED : "#bfc4cd"}`, background: value === id ? RED : "#fff", cursor: "pointer", transition: "all 0.12s" }}
        />
      ))}
    </div>
  );
}

function formatBates(prefix: string, num: number, digits: number) {
  return prefix + String(num).padStart(digits, "0");
}

export default function BatesClient() {
  const [stage, setStage] = useState<"upload" | "settings">("upload");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [previewThumb, setPreviewThumb] = useState("");
  const [zoneOver, setZoneOver] = useState(false);
  const [applying, setApplying] = useState(false);

  const [prefix, setPrefix] = useState("");
  const [startNum, setStartNum] = useState(1);
  const [digits, setDigits] = useState(4);
  const [position, setPosition] = useState<PosKey>("bottom-right");
  const [fontSize, setFontSize] = useState(9);

  const openFile = useCallback(async (file: File) => {
    const bytes = await file.arrayBuffer();
    setFileBytes(bytes);
    setFileName(file.name);
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    setNumPages(doc.numPages);
    const pg = await doc.getPage(1);
    const vp = pg.getViewport({ scale: 0.5 });
    const cv = document.createElement("canvas");
    cv.width = vp.width; cv.height = vp.height;
    await pg.render({ canvasContext: cv.getContext("2d")!, viewport: vp }).promise;
    setPreviewThumb(cv.toDataURL("image/jpeg", 0.8));
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

  const apply = async () => {
    if (!fileBytes) return;
    setApplying(true);
    try {
      const doc = await PDFDocument.load(fileBytes);
      const font = await doc.embedFont(StandardFonts.Courier);
      for (let i = 0; i < numPages; i++) {
        const page = doc.getPage(i);
        const { width, height } = page.getSize();
        const text = formatBates(prefix, startNum + i, digits);
        const tw = font.widthOfTextAtSize(text, fontSize);
        const { x, y } = computeXY(position, width, height, tw, fontSize);
        page.drawText(text, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
      }
      const bytes = await doc.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + "-bates.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally { setApplying(false); }
  };

  const previewLabel = formatBates(prefix, startNum, digits);
  const lastLabel = formatBates(prefix, startNum + numPages - 1, digits);

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>Bates Numbering</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Stamp sequential identifiers on every page. Standard for legal and compliance documents.
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
      <div style={{ height: 56, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 14, position: "sticky", top: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: 15, color: INK }}>Paper<span style={{ color: RED }}>Workz</span></Link>
        <div style={{ width: 1, height: 20, background: LINE }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Bates Numbering</span>
        <span style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{fileName}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: MUTED }}>{numPages} page{numPages !== 1 ? "s" : ""}</span>
        <button onClick={apply} disabled={applying} style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
          {applying ? "Applying…" : "Apply & Download"}
        </button>
      </div>

      {/* Two-column layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, padding: "28px 24px", alignItems: "start", maxWidth: 1000, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

        {/* Settings */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "22px 20px", background: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Prefix</label>
            <input
              type="text"
              placeholder="e.g. DOC- or SMITH-"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Start number</label>
              <input
                type="number" min={0} value={startNum}
                onChange={(e) => setStartNum(Math.max(0, parseInt(e.target.value) || 1))}
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Digits</label>
              <input
                type="number" min={1} max={10} value={digits}
                onChange={(e) => setDigits(Math.min(10, Math.max(1, parseInt(e.target.value) || 4)))}
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {/* Format preview */}
          <div style={{ padding: "10px 14px", background: "#f7f8fa", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: MUTED }}>First page:</span>
            <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: INK }}>{previewLabel}</span>
            <span style={{ fontSize: 12, color: MUTED, marginLeft: "auto" }}>Last:</span>
            <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: INK }}>{lastLabel}</span>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, display: "block", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>Position</label>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <PositionPicker value={position} onChange={setPosition} />
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
                {position.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Font size (pt)</label>
            <input
              type="number" min={6} max={18} value={fontSize}
              onChange={(e) => setFontSize(Math.min(18, Math.max(6, parseInt(e.target.value) || 9)))}
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* Preview */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "22px 20px", background: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.5px" }}>Preview</div>
          <div style={{ position: "relative", display: "inline-block", boxShadow: "0 4px 20px #1113180f", borderRadius: 4, overflow: "hidden", maxWidth: "100%" }}>
            {previewThumb && (
              <img src={previewThumb} alt="Page 1" style={{ display: "block", maxWidth: "100%", maxHeight: 480 }} />
            )}
            <div style={previewCSS(position, previewLabel)}>{previewLabel}</div>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>
            Showing page 1. Label will increment on each subsequent page using Courier font.
          </div>
        </div>
      </div>
    </div>
  );
}
