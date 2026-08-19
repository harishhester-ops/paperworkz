"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PDFDocument, PDFName } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdfSetup";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

export default function RemoveAnnotationsClient() {
  const [stage, setStage] = useState<"upload" | "ready">("upload");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [pagesWithAnnots, setPagesWithAnnots] = useState(0);
  const [previewSrc, setPreviewSrc] = useState("");
  const [zoneOver, setZoneOver] = useState(false);
  const [removing, setRemoving] = useState(false);

  const openFile = useCallback(async (file: File) => {
    const bytes = await file.arrayBuffer();
    setFileBytes(bytes);
    setFileName(file.name);

    // Count annotations using pdf-lib before we show the UI
    const doc = await PDFDocument.load(bytes);
    const n = doc.getPageCount();
    setNumPages(n);
    let annotPages = 0;
    for (let i = 0; i < n; i++) {
      if (doc.getPage(i).node.has(PDFName.of("Annots"))) annotPages++;
    }
    setPagesWithAnnots(annotPages);

    // Render first page preview
    const pjsDoc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const pg = await pjsDoc.getPage(1);
    const vp = pg.getViewport({ scale: 0.5 });
    const cv = document.createElement("canvas");
    cv.width = vp.width; cv.height = vp.height;
    await pg.render({ canvasContext: cv.getContext("2d")!, viewport: vp }).promise;
    setPreviewSrc(cv.toDataURL("image/jpeg", 0.85));
    setStage("ready");
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
    setRemoving(true);
    try {
      const doc = await PDFDocument.load(fileBytes);
      for (let i = 0; i < doc.getPageCount(); i++) {
        const page = doc.getPage(i);
        if (page.node.has(PDFName.of("Annots"))) {
          page.node.delete(PDFName.of("Annots"));
        }
      }
      const bytes = await doc.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + "-clean.pdf";
      a.click(); URL.revokeObjectURL(url);
    } finally { setRemoving(false); }
  };

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>Remove Annotations</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Strip all highlights, comments, stamps, and markup from a PDF and download the clean version.
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
        <span style={{ fontSize: 14, fontWeight: 600 }}>Remove Annotations</span>
        <span style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{fileName}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: MUTED }}>{numPages} page{numPages !== 1 ? "s" : ""}</span>
        <button onClick={apply} disabled={removing} style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
          {removing ? "Removing…" : "Remove & Download"}
        </button>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "280px 1fr", gap: 24, padding: "28px 24px", alignItems: "start", maxWidth: 960, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "22px 20px", background: "#fff", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>What will be removed</div>

          {(["Highlights and underlines", "Sticky note comments", "Stamps and watermarks", "Freehand ink drawings", "Shapes and markup", "Text boxes and callouts"] as const).map(item => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff0f0", border: `1.5px solid ${RED}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <div style={{ width: 8, height: 2, background: RED, borderRadius: 1 }} />
              </div>
              <span style={{ fontSize: 13, color: INK }}>{item}</span>
            </div>
          ))}

          <div style={{ height: 1, background: LINE }} />

          <div style={{
            padding: "12px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.6,
            background: pagesWithAnnots > 0 ? "#fff8f0" : "#f0fdf4",
            border: `1px solid ${pagesWithAnnots > 0 ? "#fde68a" : "#bbf7d0"}`,
            color: pagesWithAnnots > 0 ? "#92400e" : "#166534",
          }}>
            {pagesWithAnnots > 0
              ? `${pagesWithAnnots} of ${numPages} pages have annotations.`
              : `No annotations detected across ${numPages} pages.`}
          </div>

          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            Hyperlinks and form fields are preserved. Only visual markup annotations are removed.
          </div>
        </div>

        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "22px 20px", background: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.5px" }}>Page 1 preview</div>
          {previewSrc && (
            <img src={previewSrc} alt="Page 1" style={{ display: "block", maxWidth: "100%", maxHeight: 520, boxShadow: "0 4px 20px #1113180f", borderRadius: 3 }} />
          )}
          <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>
            Annotations may not be visible in this preview. The tool scans each page's annotation dictionary directly.
          </div>
        </div>
      </div>
    </div>
  );
}
