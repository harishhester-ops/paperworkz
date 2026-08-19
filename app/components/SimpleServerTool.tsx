"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { callApi, triggerDownload } from "@/lib/serverApi";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

export interface SimpleServerToolProps {
  title: string;
  description: string;
  endpoint: string;
  accept: string;
  acceptLabel: string;
  icon: string;
  /** Extra form fields to include in the POST */
  extraFields?: Record<string, string>;
  /** Children are rendered as a settings panel between the file info and the button */
  settingsPanel?: React.ReactNode;
}

type Stage = "upload" | "ready" | "processing" | "done";

export function SimpleServerTool({
  title,
  description,
  endpoint,
  accept,
  acceptLabel,
  icon,
  extraFields = {},
  settingsPanel,
}: SimpleServerToolProps) {
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [zoneOver, setZoneOver] = useState(false);
  const [error, setError] = useState("");
  const [resultFilename, setResultFilename] = useState("");

  const pickFile = useCallback((f: File) => {
    setFile(f);
    setError("");
    setStage("ready");
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setZoneOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  }, [pickFile]);

  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
    e.target.value = "";
  }, [pickFile]);

  const process = async () => {
    if (!file) return;
    setStage("processing");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      for (const [k, v] of Object.entries(extraFields)) fd.append(k, v);
      const result = await callApi(endpoint, fd);
      triggerDownload(result.blob, result.filename);
      setResultFilename(result.filename);
      setStage("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
      setStage("ready");
    }
  };

  const reset = () => { setFile(null); setStage("upload"); setError(""); setResultFilename(""); };

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>{title}</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>{description}</p>
        <label
          onDragOver={e => { e.preventDefault(); setZoneOver(true); }}
          onDragLeave={() => setZoneOver(false)}
          onDrop={onDrop}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, border: `2px dashed ${zoneOver ? RED : LINE}`, borderRadius: 16, padding: "64px 24px", cursor: "pointer", background: zoneOver ? "#fff5f6" : "#fafafb", transition: "border-color 0.15s" }}
        >
          <div style={{ fontSize: 32 }}>{icon}</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Drop a file here or click to select</div>
          <div style={{ fontSize: 13, color: MUTED }}>{acceptLabel}</div>
          <input type="file" accept={accept} onChange={onPick} style={{ display: "none" }} />
        </label>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Topbar */}
      <div style={{ height: 56, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 14, position: "sticky", top: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: 15, color: INK }}>Paper<span style={{ color: RED }}>Workz</span></Link>
        <div style={{ width: 1, height: 20, background: LINE }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{file?.name}</span>
        <div style={{ flex: 1 }} />
        {stage === "done"
          ? <button onClick={reset} style={{ background: "#f7f8fa", color: INK, border: `1px solid ${LINE}`, borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>New file</button>
          : <button onClick={process} disabled={stage === "processing"} style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: stage === "processing" ? "default" : "pointer", opacity: stage === "processing" ? 0.7 : 1 }}>
              {stage === "processing" ? "Processing…" : "Process & Download"}
            </button>
        }
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: "32px 24px", maxWidth: 720, margin: "0 auto", width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* File card */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: "18px 20px", background: "#fff", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 48, background: "#f0f4ff", borderRadius: 6, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 12, fontWeight: 800, color: "#3b5bdb" }}>
            {file?.name.split(".").pop()?.toUpperCase().slice(0, 4)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file?.name}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ""}</div>
          </div>
          <button onClick={reset} style={{ border: "none", background: "none", fontSize: 18, color: MUTED, cursor: "pointer", padding: "4px 8px" }}>×</button>
        </div>

        {/* Settings panel (injected by parent) */}
        {settingsPanel && (
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: "18px 20px", background: "#fff" }}>
            {settingsPanel}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: "12px 16px", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Processing indicator */}
        {stage === "processing" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
            <div style={{ width: 20, height: 20, border: "2.5px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 600 }}>Sending to server — this may take a moment for large files…</span>
          </div>
        )}

        {/* Done state */}
        {stage === "done" && (
          <div style={{ padding: "16px 20px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 20 }}>✅</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#166534" }}>Done! Download started.</div>
              <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>{resultFilename}</div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
