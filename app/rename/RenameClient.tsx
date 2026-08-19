"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { pdfjsLib } from "@/lib/pdfSetup";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

export default function RenameClient() {
  const [stage, setStage] = useState<"upload" | "rename">("upload");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [customName, setCustomName] = useState("");
  const [zoneOver, setZoneOver] = useState(false);

  const openFile = useCallback(async (file: File) => {
    const bytes = await file.arrayBuffer();
    setFileBytes(bytes);
    setFileName(file.name);
    // Strip .pdf for the editable field
    const base = file.name.replace(/\.pdf$/i, "");
    setCustomName(base);
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    setNumPages(doc.numPages);
    setStage("rename");
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

  const download = () => {
    if (!fileBytes) return;
    const name = (customName.trim() || "document") + ".pdf";
    const url = URL.createObjectURL(new Blob([fileBytes], { type: "application/pdf" }));
    const a = document.createElement("a"); a.href = url; a.download = name;
    a.click(); URL.revokeObjectURL(url);
  };

  const canDownload = customName.trim().length > 0;

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>Rename PDF</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Upload a PDF, set a clean filename, and download with the new name.
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
        <span style={{ fontSize: 14, fontWeight: 600 }}>Rename PDF</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: MUTED }}>{numPages} page{numPages !== 1 ? "s" : ""}</span>
        <button onClick={download} disabled={!canDownload} style={{ background: canDownload ? RED : "#f0c8cc", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: canDownload ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>
          Download
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "72px 24px" }}>
        <div style={{ width: "100%", maxWidth: 520, border: `1px solid ${LINE}`, borderRadius: 16, padding: "32px 28px", background: "#fff" }}>

          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Original filename</div>
          <div style={{ fontSize: 14, color: MUTED, marginBottom: 28, fontFamily: "monospace", background: "#f7f8fa", padding: "8px 12px", borderRadius: 8, wordBreak: "break-all" }}>
            {fileName}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>New filename</div>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <input
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && canDownload && download()}
              placeholder="Enter new filename"
              autoFocus
              style={{ flex: 1, padding: "11px 14px", border: `1.5px solid ${LINE}`, borderRadius: "8px 0 0 8px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", borderRight: "none" }}
            />
            <div style={{ padding: "11px 14px", background: "#f7f8fa", border: `1.5px solid ${LINE}`, borderLeft: `1px solid ${LINE}`, borderRadius: "0 8px 8px 0", fontSize: 14, color: MUTED, fontWeight: 500, whiteSpace: "nowrap" }}>
              .pdf
            </div>
          </div>

          {customName.trim() && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "#f0fff4", border: "1px solid #c6f6d5", borderRadius: 8, fontSize: 13, color: "#276749" }}>
              Will download as <strong>{customName.trim()}.pdf</strong>
            </div>
          )}

          <button onClick={download} disabled={!canDownload} style={{ marginTop: 20, width: "100%", background: canDownload ? RED : "#f0c8cc", color: "#fff", border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: 15, cursor: canDownload ? "pointer" : "not-allowed", transition: "background 0.12s" }}>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
