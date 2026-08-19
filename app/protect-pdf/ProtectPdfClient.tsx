"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { callApi, triggerDownload } from "@/lib/serverApi";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

type Stage = "upload" | "ready" | "processing" | "done";

export default function ProtectPdfClient() {
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [zoneOver, setZoneOver] = useState(false);
  const [error, setError] = useState("");
  const [resultName, setResultName] = useState("");

  const pickFile = useCallback((f: File) => { setFile(f); setError(""); setStage("ready"); }, []);
  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setZoneOver(false); const f = e.dataTransfer.files?.[0]; if (f) pickFile(f); }, [pickFile]);
  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ""; }, [pickFile]);
  const reset = () => { setFile(null); setStage("upload"); setError(""); setResultName(""); setPassword(""); setOwnerPassword(""); };

  const process = async () => {
    if (!file || !password.trim()) return;
    setStage("processing"); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("password", password);
      if (ownerPassword.trim()) fd.append("ownerPassword", ownerPassword);
      const result = await callApi("/api/protect/protect", fd);
      triggerDownload(result.blob, result.filename);
      setResultName(result.filename);
      setStage("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Protection failed");
      setStage("ready");
    }
  };

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>Protect PDF</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>Add AES-256 password encryption to a PDF. Users will need the password to open or print the document.</p>
        <label onDragOver={e => { e.preventDefault(); setZoneOver(true); }} onDragLeave={() => setZoneOver(false)} onDrop={onDrop}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, border: `2px dashed ${zoneOver ? RED : LINE}`, borderRadius: 16, padding: "64px 24px", cursor: "pointer", background: zoneOver ? "#fff5f6" : "#fafafb", transition: "border-color 0.15s" }}>
          <div style={{ fontSize: 32 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Drop a PDF here or click to select</div>
          <div style={{ fontSize: 13, color: MUTED }}>PDF files only</div>
          <input type="file" accept="application/pdf" onChange={onPick} style={{ display: "none" }} />
        </label>
      </div>
    );
  }

  const canProcess = !!password.trim() && stage !== "processing";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ height: 56, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 14, position: "sticky", top: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: 15, color: INK }}>Paper<span style={{ color: RED }}>Workz</span></Link>
        <div style={{ width: 1, height: 20, background: LINE }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Protect PDF</span>
        <span style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{file?.name}</span>
        <div style={{ flex: 1 }} />
        {stage === "done"
          ? <button onClick={reset} style={{ background: "#f7f8fa", color: INK, border: `1px solid ${LINE}`, borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>New file</button>
          : <button onClick={process} disabled={!canProcess} style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: canProcess ? "pointer" : "default", opacity: canProcess ? 1 : 0.5 }}>
              {stage === "processing" ? "Encrypting…" : "Encrypt & Download"}
            </button>}
      </div>

      <div style={{ flex: 1, padding: "32px 24px", maxWidth: 720, margin: "0 auto", width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: "18px 20px", background: "#fff", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 48, background: "#fff0f1", borderRadius: 6, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 12, fontWeight: 800, color: RED }}>PDF</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file?.name}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{file ? (file.size < 1048576 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`) : ""}</div>
          </div>
          <button onClick={reset} style={{ border: "none", background: "none", fontSize: 18, color: MUTED, cursor: "pointer", padding: "4px 8px" }}>×</button>
        </div>

        <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: "20px", background: "#fff", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 8 }}>
              User password <span style={{ color: RED }}>*</span>
            </label>
            <div style={{ display: "flex", gap: 0 }}>
              <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Required — users need this to open the file"
                style={{ flex: 1, padding: "10px 12px", border: `1.5px solid ${password ? "#22c55e" : LINE}`, borderRight: "none", borderRadius: "8px 0 0 8px", fontSize: 13, fontFamily: "inherit", outline: "none", color: INK }} />
              <button onClick={() => setShowPass(v => !v)} style={{ padding: "10px 14px", border: `1.5px solid ${password ? "#22c55e" : LINE}`, borderLeft: "none", borderRadius: "0 8px 8px 0", background: "#f7f8fa", color: MUTED, fontSize: 13, cursor: "pointer" }}>
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 8 }}>
              Owner password <span style={{ color: MUTED, fontWeight: 400, fontSize: 11, textTransform: "none" }}>(optional)</span>
            </label>
            <input type={showPass ? "text" : "password"} value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} placeholder="Controls printing and editing permissions"
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", color: INK, boxSizing: "border-box" }} />
          </div>

          <div style={{ padding: "10px 14px", background: "#f7f8fa", borderRadius: 8, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            Uses AES-256 encryption. The owner password controls document permissions (printing, copying, editing). If omitted, the user password is used for both.
          </div>
        </div>

        {error && <div style={{ padding: "12px 16px", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 13 }}>{error}</div>}
        {stage === "processing" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
            <div style={{ width: 20, height: 20, border: "2.5px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 600 }}>Encrypting with AES-256…</span>
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
