"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { callApi, triggerDownload } from "@/lib/serverApi";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

const LANGUAGES = [
  { code: "eng", label: "English" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "spa", label: "Spanish" },
  { code: "ita", label: "Italian" },
  { code: "por", label: "Portuguese" },
  { code: "rus", label: "Russian" },
  { code: "chi_sim", label: "Chinese (Simplified)" },
  { code: "jpn", label: "Japanese" },
  { code: "ara", label: "Arabic" },
];

const DPI_OPTIONS = [150, 200, 300, 400];
type Stage = "upload" | "ready" | "processing" | "done";

export default function OcrClient() {
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState("eng");
  const [dpi, setDpi] = useState(300);
  const [zoneOver, setZoneOver] = useState(false);
  const [error, setError] = useState("");
  const [resultName, setResultName] = useState("");

  const pickFile = useCallback((f: File) => { setFile(f); setError(""); setStage("ready"); }, []);
  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setZoneOver(false); const f = e.dataTransfer.files?.[0]; if (f) pickFile(f); }, [pickFile]);
  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ""; }, [pickFile]);
  const reset = () => { setFile(null); setStage("upload"); setError(""); setResultName(""); };

  const process = async () => {
    if (!file) return;
    setStage("processing"); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("lang", lang);
      fd.append("dpi", String(dpi));
      const result = await callApi("/api/ocr", fd, 300_000);
      triggerDownload(result.blob, result.filename);
      setResultName(result.filename);
      setStage("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "OCR failed");
      setStage("ready");
    }
  };

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>OCR</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>Convert a scanned PDF into a fully searchable PDF with a hidden text layer, powered by Tesseract.</p>
        <label onDragOver={e => { e.preventDefault(); setZoneOver(true); }} onDragLeave={() => setZoneOver(false)} onDrop={onDrop}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, border: `2px dashed ${zoneOver ? RED : LINE}`, borderRadius: 16, padding: "64px 24px", cursor: "pointer", background: zoneOver ? "#fff5f6" : "#fafafb", transition: "border-color 0.15s" }}>
          <div style={{ fontSize: 32 }}>🔍</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Drop a scanned PDF here or click to select</div>
          <div style={{ fontSize: 13, color: MUTED }}>PDF files only</div>
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
        <span style={{ fontSize: 14, fontWeight: 600 }}>OCR</span>
        <span style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{file?.name}</span>
        <div style={{ flex: 1 }} />
        {stage === "done"
          ? <button onClick={reset} style={{ background: "#f7f8fa", color: INK, border: `1px solid ${LINE}`, borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>New file</button>
          : <button onClick={process} disabled={stage === "processing"} style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: stage === "processing" ? "default" : "pointer", opacity: stage === "processing" ? 0.7 : 1 }}>
              {stage === "processing" ? "Running OCR…" : "Run OCR & Download"}
            </button>}
      </div>

      <div style={{ flex: 1, padding: "32px 24px", maxWidth: 720, margin: "0 auto", width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: "18px 20px", background: "#fff", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 48, background: "#fff0f1", borderRadius: 6, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 12, fontWeight: 800, color: RED }}>PDF</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file?.name}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ""}</div>
          </div>
          <button onClick={reset} style={{ border: "none", background: "none", fontSize: 18, color: MUTED, cursor: "pointer", padding: "4px 8px" }}>×</button>
        </div>

        <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: "20px", background: "#fff", display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 8 }}>Document language</label>
            <select value={lang} onChange={e => setLang(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "#fff", color: INK, outline: "none" }}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>The server must have this Tesseract language pack installed. English is always available.</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>Render resolution</div>
            <div style={{ display: "flex", gap: 8 }}>
              {DPI_OPTIONS.map(d => (
                <button key={d} onClick={() => setDpi(d)}
                  style={{ flex: 1, padding: "9px 4px", border: `1.5px solid ${dpi === d ? RED : LINE}`, borderRadius: 8, background: dpi === d ? "#fff5f6" : "#fff", color: dpi === d ? RED : MUTED, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {d} dpi
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Higher DPI = better accuracy, slower processing. 300 is the standard for most documents.</div>
          </div>
        </div>

        {error && <div style={{ padding: "12px 16px", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 13 }}>{error}</div>}
        {stage === "processing" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
            <div style={{ width: 20, height: 20, border: "2.5px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 600 }}>Running Tesseract OCR — may take several minutes for large documents…</span>
          </div>
        )}
        {stage === "done" && (
          <div style={{ padding: "16px 20px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 20 }}>✅</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#166534" }}>Done! Download started.</div>
              <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>{resultName}</div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
