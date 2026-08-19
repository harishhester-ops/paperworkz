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

type HAlign = "left" | "center" | "right";

function computeX(align: HAlign, pageW: number, textW: number) {
  if (align === "left") return MARGIN;
  if (align === "right") return pageW - MARGIN - textW;
  return (pageW - textW) / 2;
}

function AlignPicker({ value, onChange }: { value: HAlign; onChange: (v: HAlign) => void }) {
  const opts: { v: HAlign; label: string }[] = [
    { v: "left", label: "Left" },
    { v: "center", label: "Center" },
    { v: "right", label: "Right" },
  ];
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {opts.map(({ v, label }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            padding: "6px 12px",
            border: `1.5px solid ${value === v ? RED : LINE}`,
            borderRadius: 6,
            background: value === v ? "#fff5f6" : "#fff",
            color: value === v ? RED : MUTED,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.12s",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function previewTextStyle(
  vEdge: "top" | "bottom",
  align: HAlign,
  text: string
): React.CSSProperties | null {
  if (!text.trim()) return null;
  const base: React.CSSProperties = {
    position: "absolute",
    fontSize: 10,
    fontWeight: 700,
    color: RED,
    whiteSpace: "nowrap",
    maxWidth: "80%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1,
  };
  const v = vEdge === "top" ? { top: "4%" } : { bottom: "4%" };
  const h =
    align === "left"
      ? { left: "5%" }
      : align === "right"
      ? { right: "5%" }
      : { left: "50%", transform: "translateX(-50%)" };
  return { ...base, ...v, ...h };
}

export default function HeaderFooterClient() {
  const [stage, setStage] = useState<"upload" | "settings">("upload");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [previewThumb, setPreviewThumb] = useState("");
  const [zoneOver, setZoneOver] = useState(false);
  const [applying, setApplying] = useState(false);

  const [headerText, setHeaderText] = useState("");
  const [headerAlign, setHeaderAlign] = useState<HAlign>("center");
  const [footerText, setFooterText] = useState("");
  const [footerAlign, setFooterAlign] = useState<HAlign>("center");
  const [fontSize, setFontSize] = useState(10);

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
    if (!fileBytes || (!headerText.trim() && !footerText.trim())) return;
    setApplying(true);
    try {
      const doc = await PDFDocument.load(fileBytes);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      for (let i = 0; i < numPages; i++) {
        const page = doc.getPage(i);
        const { width, height } = page.getSize();
        if (headerText.trim()) {
          const tw = font.widthOfTextAtSize(headerText, fontSize);
          page.drawText(headerText, {
            x: computeX(headerAlign, width, tw),
            y: height - MARGIN - fontSize,
            size: fontSize, font, color: rgb(0, 0, 0),
          });
        }
        if (footerText.trim()) {
          const tw = font.widthOfTextAtSize(footerText, fontSize);
          page.drawText(footerText, {
            x: computeX(footerAlign, width, tw),
            y: MARGIN,
            size: fontSize, font, color: rgb(0, 0, 0),
          });
        }
      }
      const bytes = await doc.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + "-stamped.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally { setApplying(false); }
  };

  const canApply = headerText.trim().length > 0 || footerText.trim().length > 0;

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>Header & Footer</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Add text to the top and bottom of every page, then download.
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

  const headerStyle = previewTextStyle("top", headerAlign, headerText);
  const footerStyle = previewTextStyle("bottom", footerAlign, footerText);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Top bar */}
      <div style={{ height: 56, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 14, position: "sticky", top: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: 15, color: INK }}>Paper<span style={{ color: RED }}>Workz</span></Link>
        <div style={{ width: 1, height: 20, background: LINE }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Header & Footer</span>
        <span style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{fileName}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: MUTED }}>{numPages} page{numPages !== 1 ? "s" : ""}</span>
        <button
          onClick={apply}
          disabled={applying || !canApply}
          style={{ background: canApply ? RED : "#f0c8cc", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: canApply ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
        >
          {applying ? "Applying…" : "Apply & Download"}
        </button>
      </div>

      {/* Two-column layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, padding: "28px 24px", alignItems: "start", maxWidth: 1000, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

        {/* Settings */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "22px 20px", background: "#fff", display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Header */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>Header text</div>
            <input
              type="text"
              placeholder="e.g. Company Name — Confidential"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
            />
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Alignment</div>
            <AlignPicker value={headerAlign} onChange={setHeaderAlign} />
          </div>

          <div style={{ height: 1, background: LINE }} />

          {/* Footer */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>Footer text</div>
            <input
              type="text"
              placeholder="e.g. Page 1 of 12 — Draft"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
            />
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Alignment</div>
            <AlignPicker value={footerAlign} onChange={setFooterAlign} />
          </div>

          <div style={{ height: 1, background: LINE }} />

          {/* Font size */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Font size (pt)</div>
            <input
              type="number" min={6} max={24} value={fontSize}
              onChange={(e) => setFontSize(Math.min(24, Math.max(6, parseInt(e.target.value) || 10)))}
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {!canApply && (
            <div style={{ padding: "10px 12px", background: "#fafafa", borderRadius: 8, fontSize: 12, color: MUTED }}>
              Enter at least a header or footer text to continue.
            </div>
          )}
        </div>

        {/* Preview */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "22px 20px", background: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.5px" }}>Preview</div>
          <div style={{ position: "relative", display: "inline-block", boxShadow: "0 4px 20px #1113180f", borderRadius: 4, overflow: "hidden", maxWidth: "100%" }}>
            {previewThumb && (
              <img src={previewThumb} alt="Page 1" style={{ display: "block", maxWidth: "100%", maxHeight: 480 }} />
            )}
            {headerStyle && <div style={headerStyle}>{headerText}</div>}
            {footerStyle && <div style={footerStyle}>{footerText}</div>}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>
            Showing page 1 of {numPages}. Header and footer apply to all pages.
          </div>
        </div>
      </div>
    </div>
  );
}
