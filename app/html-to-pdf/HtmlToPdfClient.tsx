"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { callApi, triggerDownload } from "@/lib/serverApi";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

type Mode = "file" | "text";
type Stage = "idle" | "processing" | "done";

export default function HtmlToPdfClient() {
  const [mode, setMode] = useState<Mode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [htmlText, setHtmlText] = useState("");
  const [zoneOver, setZoneOver] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [resultName, setResultName] = useState("");

  const pickFile = useCallback((f: File) => { setFile(f); setError(""); }, []);
  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setZoneOver(false); const f = e.dataTransfer.files?.[0]; if (f) { setMode("file"); pickFile(f); } }, [pickFile]);
  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ""; }, [pickFile]);
  const reset = () => { setFile(null); setHtmlText(""); setStage("idle"); setError(""); setResultName(""); };

  const isReady = mode === "file" ? !!file : htmlText.trim().length > 0;

  const process = async () => {
    if (!isReady) return;
    setStage("processing"); setError("");
    try {
      const fd = new FormData();
      if (mode === "file" && file) {
        fd.append("file", file);
      } else {
        const blob = new Blob([htmlText], { type: "text/html" });
        fd.append("file", blob, "document.html");
      }
      const result = await callApi("/api/to-pdf/html", fd);
      triggerDownload(result.blob, result.filename);
      setResultName(result.filename);
      setStage("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Conversion failed");
      setStage("idle");
    }
  };

  const canProcess = isReady && stage !== "processing";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ height: 56, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 14, position: "sticky", top: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: 15, color: INK }}>Paper<span style={{ color: RED }}>Workz</span></Link>
        <div style={{ width: 1, height: 20, background: LINE }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>HTML to PDF</span>
        <div style={{ flex: 1 }} />
        {stage === "done"
          ? <button onClick={reset} style={{ background: "#f7f8fa", color: INK, border: `1px solid ${LINE}`, borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Convert another</button>
          : <button onClick={process} disabled={!canProcess} style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: canProcess ? "pointer" : "default", opacity: canProcess ? 1 : 0.5 }}>
              {stage === "processing" ? "Converting…" : "Convert & Download"}
            </button>}
      </div>

      <div style={{ flex: 1, padding: "40px 24px", maxWidth: 720, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, letterSpacing: "-0.8px", margin: "0 0 6px" }}>HTML to PDF</h1>
          <p style={{ color: MUTED, margin: 0, fontSize: 14, lineHeight: 1.6 }}>Upload an HTML file or paste HTML directly. Rendered by LibreOffice.</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden", width: "fit-content" }}>
          {(["file", "text"] as Mode[]).map((m, i) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ padding: "9px 20px", border: "none", borderRight: i === 0 ? `1px solid ${LINE}` : "none", background: mode === m ? RED : "#fff", color: mode === m ? "#fff" : MUTED, fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "background 0.12s" }}>
              {m === "file" ? "Upload HTML file" : "Paste HTML"}
            </button>
          ))}
        </div>

        {mode === "file" ? (
          <label onDragOver={e => { e.preventDefault(); setZoneOver(true); }} onDragLeave={() => setZoneOver(false)} onDrop={onDrop}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, border: `2px dashed ${zoneOver ? RED : file ? "#22c55e" : LINE}`, borderRadius: 14, padding: "48px 24px", cursor: "pointer", background: file ? "#f0fdf4" : zoneOver ? "#fff5f6" : "#fafafb", transition: "all 0.15s" }}>
            <div style={{ fontSize: 28 }}>{file ? "✅" : "🌐"}</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{file ? file.name : "Drop an HTML file here or click to select"}</div>
            {file && <div style={{ fontSize: 12, color: MUTED }}>{(file.size / 1024).toFixed(1)} KB — <span onClick={e => { e.preventDefault(); setFile(null); }} style={{ color: RED, cursor: "pointer" }}>Remove</span></div>}
            {!file && <div style={{ fontSize: 13, color: MUTED }}>.html and .htm files</div>}
            <input type="file" accept=".html,.htm,text/html" onChange={onPick} style={{ display: "none" }} />
          </label>
        ) : (
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "#f7f8fa", borderBottom: `1px solid ${LINE}`, fontSize: 12, fontWeight: 600, color: MUTED }}>Paste your HTML below</div>
            <textarea value={htmlText} onChange={e => setHtmlText(e.target.value)} placeholder={"<!DOCTYPE html>\n<html>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>"}
              style={{ width: "100%", minHeight: 280, padding: "16px", border: "none", outline: "none", resize: "vertical", fontFamily: "'Fira Code', 'Courier New', monospace", fontSize: 13, lineHeight: 1.6, color: INK, background: "#fff", boxSizing: "border-box" }} />
          </div>
        )}

        {error && <div style={{ marginTop: 16, padding: "12px 16px", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 13 }}>{error}</div>}
        {stage === "processing" && (
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
            <div style={{ width: 20, height: 20, border: "2.5px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 600 }}>Converting with LibreOffice…</span>
          </div>
        )}
        {stage === "done" && (
          <div style={{ marginTop: 16, padding: "16px 20px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
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
