"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { pdfjsLib } from "@/lib/pdfSetup";
import { zipSync } from "fflate";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

export default function PdfToJpgClient() {
  const [stage, setStage] = useState<"upload" | "converting" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [jpgBuffers, setJpgBuffers] = useState<Uint8Array[]>([]);
  const [progress, setProgress] = useState(0);
  const [zoneOver, setZoneOver] = useState(false);
  const [quality, setQuality] = useState(0.92);
  const [scale, setScale] = useState(2); // 2x = ~144 dpi equivalent

  const convert = useCallback(async (file: File) => {
    setFileName(file.name);
    setStage("converting");
    setThumbs([]);
    setJpgBuffers([]);
    setProgress(0);

    const bytes = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const total = doc.numPages;
    setNumPages(total);

    const bufs: Uint8Array[] = [];

    for (let i = 1; i <= total; i++) {
      const pg = await doc.getPage(i);
      const vp = pg.getViewport({ scale });
      const cv = document.createElement("canvas");
      cv.width = vp.width; cv.height = vp.height;
      const ctx = cv.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cv.width, cv.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;

      const blob: Blob = await new Promise(resolve => {
        cv.toBlob(b => resolve(b!), "image/jpeg", quality);
      });
      const buf = new Uint8Array(await blob.arrayBuffer());
      bufs.push(buf);

      // Show thumbnail at lower quality for speed
      const thumbDataUrl = cv.toDataURL("image/jpeg", 0.5);
      setThumbs(prev => [...prev, thumbDataUrl]);
      setProgress(Math.round(i / total * 100));
    }

    setJpgBuffers(bufs);
    setStage("done");
  }, [scale, quality]);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setZoneOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f?.type === "application/pdf") convert(f);
  }, [convert]);

  const onPick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) convert(f);
    e.target.value = "";
  }, [convert]);

  const downloadZip = async () => {
    const base = fileName.replace(/\.pdf$/i, "");
    const files: { [name: string]: Uint8Array } = {};
    jpgBuffers.forEach((buf, i) => {
      files[`${base}-page-${String(i + 1).padStart(3, "0")}.jpg`] = buf;
    });
    const zip = zipSync(files, { level: 0 });
    const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
    const a = document.createElement("a"); a.href = url;
    a.download = base + "-pages.zip";
    a.click(); URL.revokeObjectURL(url);
  };

  const downloadSingle = (idx: number) => {
    const buf = jpgBuffers[idx];
    const url = URL.createObjectURL(new Blob([buf], { type: "image/jpeg" }));
    const a = document.createElement("a"); a.href = url;
    a.download = `${fileName.replace(/\.pdf$/i, "")}-page-${String(idx + 1).padStart(3, "0")}.jpg`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>PDF to JPG</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Convert every page of a PDF into a high-quality JPG image, then download as a zip.
        </p>

        {/* Quality / scale options */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: "18px 18px 20px", marginBottom: 20, background: "#fff", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Resolution</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ s: 1, label: "72 dpi" }, { s: 2, label: "144 dpi" }, { s: 3, label: "216 dpi" }].map(({ s, label }) => (
                <button key={s} onClick={() => setScale(s)} style={{ flex: 1, padding: "8px 4px", border: `1.5px solid ${scale === s ? RED : LINE}`, borderRadius: 8, background: scale === s ? "#fff5f6" : "#fff", color: scale === s ? RED : MUTED, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>JPG quality</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ q: 0.7, label: "Good" }, { q: 0.88, label: "High" }, { q: 0.96, label: "Max" }].map(({ q, label }) => (
                <button key={q} onClick={() => setQuality(q)} style={{ flex: 1, padding: "8px 4px", border: `1.5px solid ${quality === q ? RED : LINE}`, borderRadius: 8, background: quality === q ? "#fff5f6" : "#fff", color: quality === q ? RED : MUTED, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label
          onDragOver={e => { e.preventDefault(); setZoneOver(true); }}
          onDragLeave={() => setZoneOver(false)}
          onDrop={onDrop}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, border: `2px dashed ${zoneOver ? RED : LINE}`, borderRadius: 16, padding: "64px 24px", cursor: "pointer", background: zoneOver ? "#fff5f6" : "#fafafb", transition: "border-color 0.15s" }}
        >
          <div style={{ fontSize: 32 }}>📄</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Drop a PDF here or click to select</div>
          <div style={{ fontSize: 13, color: MUTED }}>Conversion starts immediately after upload</div>
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
        <span style={{ fontSize: 14, fontWeight: 600 }}>PDF to JPG</span>
        <span style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{fileName}</span>
        <div style={{ flex: 1 }} />
        {stage === "converting" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 120, height: 6, background: LINE, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: RED, borderRadius: 3, transition: "width 0.2s" }} />
            </div>
            <span style={{ fontSize: 13, color: MUTED, whiteSpace: "nowrap" }}>{thumbs.length} / {numPages}</span>
          </div>
        )}
        {stage === "done" && (
          <>
            <span style={{ fontSize: 13, color: MUTED }}>{numPages} page{numPages !== 1 ? "s" : ""}</span>
            <button onClick={downloadZip} style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
              Download all as ZIP
            </button>
          </>
        )}
      </div>

      {stage === "converting" && thumbs.length === 0 && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, color: MUTED }}>
          <div style={{ fontSize: 32 }}>⏳</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Converting pages…</div>
        </div>
      )}

      {/* Thumbnail grid */}
      <div style={{ flex: 1, padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, alignContent: "start" }}>
        {thumbs.map((src, i) => (
          <div
            key={i}
            onClick={() => stage === "done" && downloadSingle(i)}
            style={{ border: `1.5px solid ${LINE}`, borderRadius: 8, overflow: "hidden", background: "#fff", cursor: stage === "done" ? "pointer" : "default", transition: "border-color 0.1s", position: "relative" }}
            onMouseEnter={e => { if (stage === "done") (e.currentTarget as HTMLDivElement).style.borderColor = RED; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = LINE; }}
          >
            <div style={{ background: "#f7f8fa", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <img src={src} alt={`Page ${i + 1}`} style={{ display: "block", width: "100%" }} />
            </div>
            <div style={{ padding: "6px 8px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>Page {i + 1}</span>
              {stage === "done" && (
                <span style={{ fontSize: 10, color: RED, fontWeight: 600 }}>↓ JPG</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
