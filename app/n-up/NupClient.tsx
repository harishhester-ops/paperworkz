"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PDFDocument, rgb } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdfSetup";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

const NUP_OPTIONS = [
  { n: 2, cols: 2, rows: 1, label: "2-up", desc: "2 pages per sheet, side by side" },
  { n: 4, cols: 2, rows: 2, label: "4-up", desc: "4 pages per sheet, 2×2 grid" },
  { n: 6, cols: 2, rows: 3, label: "6-up", desc: "6 pages per sheet, 2×3 grid" },
] as const;

function NupDiagram({ cols, rows, active }: { cols: number; rows: number; active: boolean }) {
  const W = 64, H = 84;
  const CW = W / cols, CH = H / rows;
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <rect x={0} y={0} width={W} height={H} fill={active ? "#fff5f6" : "#f7f8fa"} rx={3} />
      {Array.from({ length: cols * rows }).map((_, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        return (
          <rect key={i}
            x={c * CW + 2} y={r * CH + 2}
            width={CW - 4} height={CH - 4}
            fill={active ? "#fde8e9" : "#e8eaf0"}
            stroke={active ? RED : "#bfc4cd"}
            strokeWidth={1} rx={1}
          />
        );
      })}
    </svg>
  );
}

export default function NupClient() {
  const [stage, setStage] = useState<"upload" | "settings">("upload");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [origDims, setOrigDims] = useState({ w: 612, h: 792 });
  const [zoneOver, setZoneOver] = useState(false);
  const [applying, setApplying] = useState(false);
  const [nupIdx, setNupIdx] = useState(0); // 0=2-up, 1=4-up, 2=6-up
  const [showBorders, setShowBorders] = useState(true);

  const openFile = useCallback(async (file: File) => {
    const bytes = await file.arrayBuffer();
    setFileBytes(bytes);
    setFileName(file.name);
    const pjsDoc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    setNumPages(pjsDoc.numPages);
    const pg = await pjsDoc.getPage(1);
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

  const apply = async () => {
    if (!fileBytes) return;
    setApplying(true);
    try {
      const opt = NUP_OPTIONS[nupIdx];
      const { n, cols, rows } = opt;

      const srcDoc = await PDFDocument.load(fileBytes);
      const outDoc = await PDFDocument.create();
      const count = srcDoc.getPageCount();

      // Get output page size from first source page
      const { width: outW, height: outH } = srcDoc.getPage(0).getSize();
      const cellW = outW / cols;
      const cellH = outH / rows;

      // Embed all source pages at once
      const indices = Array.from({ length: count }, (_, i) => i);
      const embeds = await outDoc.embedPdf(fileBytes, indices);

      const numOutPages = Math.ceil(count / n);
      for (let outIdx = 0; outIdx < numOutPages; outIdx++) {
        const outPage = outDoc.addPage([outW, outH]);

        // Draw grid borders
        if (showBorders) {
          for (let c = 1; c < cols; c++) {
            outPage.drawLine({ start: { x: c * cellW, y: 0 }, end: { x: c * cellW, y: outH }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
          }
          for (let r = 1; r < rows; r++) {
            outPage.drawLine({ start: { x: 0, y: r * cellH }, end: { x: outW, y: r * cellH }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
          }
        }

        for (let slot = 0; slot < n; slot++) {
          const srcIdx = outIdx * n + slot;
          if (srcIdx >= count) break;

          const col = slot % cols;
          const row = Math.floor(slot / cols);
          const { width: srcW, height: srcH } = srcDoc.getPage(srcIdx).getSize();

          const scale = Math.min(cellW / srcW, cellH / srcH);
          const drawW = srcW * scale;
          const drawH = srcH * scale;

          // Center within cell; PDF Y origin is bottom-left
          const cellLeft = col * cellW;
          const cellBottom = outH - (row + 1) * cellH;
          const x = cellLeft + (cellW - drawW) / 2;
          const y = cellBottom + (cellH - drawH) / 2;

          outPage.drawPage(embeds[srcIdx], { x, y, width: drawW, height: drawH });
        }
      }

      const bytes = await outDoc.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + `-${NUP_OPTIONS[nupIdx].label}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } finally { setApplying(false); }
  };

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>N-up Layout</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Place 2, 4, or 6 pages onto a single sheet to save paper and create handouts.
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

  const opt = NUP_OPTIONS[nupIdx];
  const outputPages = Math.ceil(numPages / opt.n);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ height: 56, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 14, position: "sticky", top: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: 15, color: INK }}>Paper<span style={{ color: RED }}>Workz</span></Link>
        <div style={{ width: 1, height: 20, background: LINE }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>N-up Layout</span>
        <span style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{fileName}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: MUTED }}>{numPages} → {outputPages} page{outputPages !== 1 ? "s" : ""}</span>
        <button onClick={apply} disabled={applying} style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
          {applying ? "Applying…" : "Apply & Download"}
        </button>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, padding: "28px 24px", alignItems: "start", maxWidth: 960, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "22px 20px", background: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.5px" }}>Pages per sheet</div>
            <div style={{ display: "flex", gap: 10 }}>
              {NUP_OPTIONS.map((o, i) => (
                <button key={o.n} onClick={() => setNupIdx(i)} style={{ flex: 1, padding: "12px 8px", border: `2px solid ${nupIdx === i ? RED : LINE}`, borderRadius: 10, background: nupIdx === i ? "#fff5f6" : "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "border-color 0.12s" }}>
                  <NupDiagram cols={o.cols} rows={o.rows} active={nupIdx === i} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: nupIdx === i ? RED : INK }}>{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, padding: "10px 14px", background: "#f7f8fa", borderRadius: 8 }}>
            {opt.desc}. Pages fill left-to-right, top-to-bottom.
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={showBorders} onChange={e => setShowBorders(e.target.checked)} style={{ width: 16, height: 16, accentColor: RED, cursor: "pointer" }} />
            <span style={{ fontSize: 13, color: INK }}>Show cell border lines</span>
          </label>

          <div style={{ height: 1, background: LINE }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              ["Input pages", `${numPages}`],
              ["Output pages", `${outputPages}`],
              ["Pages per sheet", `${opt.n}`],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: MUTED }}>{label}</span>
                <span style={{ fontWeight: 700, color: INK }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Visual preview of the layout */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "22px 20px", background: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.5px" }}>Output sheet layout</div>
          <div style={{ display: "inline-block" }}>
            {(() => {
              const DIAG_W = 320, DIAG_H = Math.round(320 * origDims.h / origDims.w);
              const CW = DIAG_W / opt.cols, CH = DIAG_H / opt.rows;
              return (
                <svg width={DIAG_W} height={DIAG_H} style={{ border: `1px solid ${LINE}`, borderRadius: 4, background: "#fff" }}>
                  {Array.from({ length: opt.n }).map((_, i) => {
                    const c = i % opt.cols, r = Math.floor(i / opt.cols);
                    // Scale source page to cell
                    const srcAspect = origDims.w / origDims.h;
                    const cellAspect = CW / CH;
                    const s = srcAspect > cellAspect ? (CW - 8) / CW : (CH - 8) / CH;
                    const dW = (CW - 8) * Math.min(1, CH / (CW / srcAspect));
                    const dH = dW / srcAspect;
                    const finalW = Math.min(CW - 8, dW);
                    const finalH = Math.min(CH - 8, finalW / srcAspect);
                    const x = c * CW + (CW - finalW) / 2;
                    const y = r * CH + (CH - finalH) / 2;
                    return (
                      <g key={i}>
                        <rect x={x} y={y} width={finalW} height={finalH} fill="#f0f7ff" stroke="#93c5fd" strokeWidth={1} rx={1} />
                        <text x={x + finalW / 2} y={y + finalH / 2 + 5} textAnchor="middle" fontSize={12} fill="#3b82f6" fontWeight="700">{i + 1}</text>
                      </g>
                    );
                  })}
                  {showBorders && Array.from({ length: opt.cols - 1 }).map((_, c) => (
                    <line key={`v${c}`} x1={(c + 1) * CW} y1={0} x2={(c + 1) * CW} y2={DIAG_H} stroke="#d1d5db" strokeWidth={0.5} />
                  ))}
                  {showBorders && Array.from({ length: opt.rows - 1 }).map((_, r) => (
                    <line key={`h${r}`} x1={0} y1={(r + 1) * CH} x2={DIAG_W} y2={(r + 1) * CH} stroke="#d1d5db" strokeWidth={0.5} />
                  ))}
                </svg>
              );
            })()}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>
            Each numbered cell represents one source page, scaled to fit.
          </div>
        </div>
      </div>
    </div>
  );
}
