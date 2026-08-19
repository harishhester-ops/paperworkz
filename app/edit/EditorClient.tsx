"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  pdfjsLib,
  guessFontChoice,
  FontChoice,
  FONT_LABELS,
  FONT_CSS_STACK,
} from "@/lib/pdfSetup";

type TextItem = {
  id: string;
  str: string;
  // Raw PDF user-space values (bottom-left origin), used for export via pdf-lib
  pdfX: number;
  pdfY: number; // baseline
  pdfFontSize: number;
  pdfWidth: number;
  // Screen-space box for the overlay (top-left origin), used for click UI
  screenLeft: number;
  screenTop: number;
  screenWidth: number;
  screenHeight: number;
  fontChoice: FontChoice;
  bgColor: [number, number, number]; // sampled from the page, 0-1 range
};

type EditState = {
  text: string;
  fontChoice: FontChoice;
};

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

// Sample the true background behind a text run instead of assuming white.
// We check a ring of points just outside the glyph box (above, below, left,
// right) and take the lightest one, since the lightest sample is the least
// likely to have landed on actual ink.
function sampleBackgroundColor(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  fontHeight: number
): [number, number, number] {
  const candidates: [number, number][] = [
    [left + width / 2, top - 3],
    [left - 3, top + fontHeight / 2],
    [left + width + 3, top + fontHeight / 2],
    [left + width / 2, top + fontHeight + 3],
  ];

  let best: [number, number, number] = [1, 1, 1];
  let bestLightness = -1;

  for (const [x, y] of candidates) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= ctx.canvas.width || py >= ctx.canvas.height) continue;
    try {
      const data = ctx.getImageData(px, py, 1, 1).data;
      const r = data[0] / 255;
      const g = data[1] / 255;
      const b = data[2] / 255;
      const lightness = r + g + b;
      if (lightness > bestLightness) {
        bestLightness = lightness;
        best = [r, g, b];
      }
    } catch {
      // getImageData can throw on tainted canvases; fall back to white
    }
  }

  return best;
}

export default function EditorClient() {
  const [stage, setStage] = useState<"upload" | "editor">("upload");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [items, setItems] = useState<TextItem[]>([]);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const openFile = useCallback(async (file: File) => {
    setLoading(true);
    const buf = await file.arrayBuffer();
    setFileBytes(buf);
    setFileName(file.name);
    const doc = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
    setPdfDoc(doc);
    setNumPages(doc.numPages);
    setPageIndex(0);
    setEdits({});
    setStage("editor");
    setLoading(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f && f.type === "application/pdf") openFile(f);
    },
    [openFile]
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) openFile(f);
    },
    [openFile]
  );

  // Render current page to canvas + compute overlay boxes for each text run
  useEffect(() => {
    if (!pdfDoc || stage !== "editor") return;
    let cancelled = false;

    (async () => {
      const page = await pdfDoc.getPage(pageIndex + 1);
      const containerWidth = wrapRef.current?.clientWidth || 800;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(1.6, (containerWidth - 40) / baseViewport.width);
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      await page.render({ canvasContext: ctx, viewport }).promise;
      if (cancelled) return;

      const textContent = await page.getTextContent();
      const built: TextItem[] = textContent.items.map((raw: any, i: number) => {
        const tx = pdfjsLib.Util.transform(viewport.transform, raw.transform);
        const screenFontHeight = Math.hypot(tx[2], tx[3]);
        const screenLeft = tx[4];
        const screenTop = tx[5] - screenFontHeight;

        const pdfFontSize = Math.hypot(raw.transform[2], raw.transform[3]);
        const style = textContent.styles?.[raw.fontName];
        const fontChoice = guessFontChoice(style?.fontFamily);
        const bgColor = sampleBackgroundColor(
          ctx,
          screenLeft,
          screenTop,
          raw.width * scale,
          screenFontHeight
        );

        return {
          id: `${pageIndex}-${i}`,
          str: raw.str,
          pdfX: raw.transform[4],
          pdfY: raw.transform[5],
          pdfFontSize,
          pdfWidth: raw.width,
          screenLeft,
          screenTop,
          screenWidth: raw.width * scale,
          screenHeight: screenFontHeight * 1.15,
          fontChoice,
          bgColor,
        };
      });

      if (!cancelled) setItems(built.filter((it) => it.str.trim().length > 0));
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageIndex, stage]);

  const startEdit = (item: TextItem) => {
    setActiveId(item.id);
    setDraftText(edits[item.id]?.text ?? item.str);
  };

  const commitEdit = (item: TextItem) => {
    setEdits((prev) => ({
      ...prev,
      [item.id]: {
        text: draftText,
        fontChoice: prev[item.id]?.fontChoice ?? item.fontChoice,
      },
    }));
    setActiveId(null);
  };

  const setFontOverride = (item: TextItem, choice: FontChoice) => {
    setEdits((prev) => ({
      ...prev,
      [item.id]: {
        text: prev[item.id]?.text ?? item.str,
        fontChoice: choice,
      },
    }));
  };

  const editedCount = Object.keys(edits).length;

  const download = async () => {
    if (!fileBytes) return;
    setExporting(true);
    try {
      const pdfDocLib = await PDFDocument.load(fileBytes);
      const fontCache: Partial<Record<FontChoice, any>> = {};
      const getFont = async (choice: FontChoice) => {
        if (fontCache[choice]) return fontCache[choice];
        const map = {
          helvetica: StandardFonts.Helvetica,
          times: StandardFonts.TimesRoman,
          courier: StandardFonts.Courier,
        };
        const f = await pdfDocLib.embedFont(map[choice]);
        fontCache[choice] = f;
        return f;
      };

      // Group edited items by page so we only touch pages that changed
      const byPage: Record<number, TextItem[]> = {};
      for (const it of items) {
        if (edits[it.id]) {
          const pIdx = Number(it.id.split("-")[0]);
          byPage[pIdx] = byPage[pIdx] || [];
          byPage[pIdx].push(it);
        }
      }

      for (const pIdxStr of Object.keys(byPage)) {
        const pIdx = Number(pIdxStr);
        const page = pdfDocLib.getPage(pIdx);
        for (const it of byPage[pIdx]) {
          const edit = edits[it.id];
          // Cover the original text with its real background color (sampled
          // from the page, not assumed white), sized to fully swallow
          // ascenders and descenders so no old ink peeks out. Then draw the
          // edited text in the closest matching standard font.
          const estWidth = Math.max(
            it.pdfWidth,
            it.pdfFontSize * edit.text.length * 0.52
          );
          page.drawRectangle({
            x: it.pdfX - 2,
            y: it.pdfY - it.pdfFontSize * 0.35,
            width: estWidth + 4,
            height: it.pdfFontSize * 1.5,
            color: rgb(it.bgColor[0], it.bgColor[1], it.bgColor[2]),
          });
          const font = await getFont(edit.fontChoice);
          page.drawText(edit.text, {
            x: it.pdfX,
            y: it.pdfY,
            size: it.pdfFontSize,
            font,
            color: rgb(0.07, 0.07, 0.09),
          });
        }
      }

      const outBytes = await pdfDocLib.save();
      const blob = new Blob([outBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + "-edited.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "80px 20px" }}>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", marginBottom: 8 }}>
          Edit PDF
        </h1>
        <p style={{ color: MUTED, marginBottom: 28 }}>
          Upload a PDF to start editing. Click any sentence to change it.
        </p>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            border: `2px dashed ${dragOver ? RED : LINE}`,
            borderRadius: 16,
            padding: "60px 20px",
            cursor: "pointer",
            background: dragOver ? "#fff5f6" : "#fafafb",
          }}
        >
          <div style={{ fontWeight: 700 }}>
            {loading ? "Loading your PDF…" : "Drop a PDF here or click to upload"}
          </div>
          <div style={{ fontSize: 13, color: MUTED }}>PDF files only</div>
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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Slim top toolbar, Sejda style */}
      <div
        style={{
          height: 56,
          borderBottom: `1px solid ${LINE}`,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 16,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 15 }}>
          Paper<span style={{ color: RED }}>Workz</span>
        </div>
        <div style={{ fontSize: 13, color: MUTED }}>{fileName}</div>
        <div style={{ flex: 1 }} />
        {numPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <button
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
              style={navBtnStyle}
            >
              ←
            </button>
            <span>
              Page {pageIndex + 1} of {numPages}
            </span>
            <button
              onClick={() => setPageIndex((p) => Math.min(numPages - 1, p + 1))}
              disabled={pageIndex === numPages - 1}
              style={navBtnStyle}
            >
              →
            </button>
          </div>
        )}
        <div style={{ fontSize: 12, color: MUTED }}>
          {editedCount > 0 ? `${editedCount} edit${editedCount > 1 ? "s" : ""}` : ""}
        </div>
        <button
          onClick={download}
          disabled={exporting || editedCount === 0}
          style={{
            background: editedCount === 0 ? "#f0c8cc" : RED,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 16px",
            fontWeight: 700,
            fontSize: 13,
            opacity: exporting ? 0.7 : 1,
          }}
        >
          {exporting ? "Exporting…" : "Download PDF"}
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={wrapRef}
        style={{
          flex: 1,
          overflow: "auto",
          background: "#f3f4f6",
          display: "flex",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ position: "relative" }}>
          <canvas
            ref={canvasRef}
            style={{ boxShadow: "0 8px 24px rgba(17,19,24,0.12)", display: "block" }}
          />
          {items.map((item) => {
            const edit = edits[item.id];
            const isActive = activeId === item.id;
            const displayText = isActive ? draftText : edit?.text ?? item.str;
            const fontChoice = edit?.fontChoice ?? item.fontChoice;

            if (isActive) {
              return (
                <div
                  key={item.id}
                  style={{
                    position: "absolute",
                    left: item.screenLeft,
                    top: item.screenTop,
                    minWidth: item.screenWidth + 20,
                  }}
                >
                  <input
                    autoFocus
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onBlur={() => commitEdit(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(item);
                      if (e.key === "Escape") setActiveId(null);
                    }}
                    style={{
                      font: `${item.screenHeight * 0.82}px ${FONT_CSS_STACK[fontChoice]}`,
                      border: `1px solid ${RED}`,
                      borderRadius: 3,
                      padding: "0 2px",
                      background: "#fff",
                      boxShadow: "0 2px 8px rgba(229,35,47,0.25)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      marginTop: 4,
                      display: "flex",
                      gap: 4,
                      background: "#fff",
                      border: `1px solid ${LINE}`,
                      borderRadius: 6,
                      padding: 4,
                      boxShadow: "0 6px 16px rgba(17,19,24,0.1)",
                      zIndex: 10,
                    }}
                  >
                    {(Object.keys(FONT_LABELS) as FontChoice[]).map((fc) => (
                      <button
                        key={fc}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFontOverride(item, fc);
                        }}
                        style={{
                          fontSize: 11,
                          padding: "4px 7px",
                          borderRadius: 4,
                          border: `1px solid ${fc === fontChoice ? RED : LINE}`,
                          background: fc === fontChoice ? "#fff5f6" : "#fff",
                          color: fc === fontChoice ? RED : INK,
                        }}
                      >
                        {FONT_LABELS[fc]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                onClick={() => startEdit(item)}
                title="Click to edit"
                style={{
                  position: "absolute",
                  left: item.screenLeft,
                  top: item.screenTop,
                  width: item.screenWidth,
                  height: item.screenHeight,
                  cursor: "text",
                  background: edit ? "#fff" : "transparent",
                  outline: edit ? `1px solid ${RED}22` : "none",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "rgba(229,35,47,0.06)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = edit
                    ? "#fff"
                    : "transparent";
                }}
              >
                {edit && (
                  <span
                    style={{
                      font: `${item.screenHeight * 0.82}px ${FONT_CSS_STACK[fontChoice]}`,
                      color: INK,
                      whiteSpace: "pre",
                    }}
                  >
                    {displayText}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  border: `1px solid ${LINE}`,
  background: "#fff",
  borderRadius: 6,
  width: 26,
  height: 26,
};
