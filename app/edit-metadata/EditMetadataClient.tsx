"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdfSetup";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

function Field({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; hint?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 13px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
      />
      {hint && <div style={{ fontSize: 11, color: MUTED }}>{hint}</div>}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: 12, color: INK, fontFamily: "monospace", padding: "6px 10px", background: "#f7f8fa", borderRadius: 6, wordBreak: "break-all" }}>{value || "(not set)"}</div>
    </div>
  );
}

export default function EditMetadataClient() {
  const [stage, setStage] = useState<"upload" | "edit">("upload");
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [zoneOver, setZoneOver] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subject, setSubject] = useState("");
  const [keywords, setKeywords] = useState("");

  // Read-only info
  const [creationDate, setCreationDate] = useState("");
  const [producer, setProducer] = useState("");
  const [creator, setCreator] = useState("");

  const openFile = useCallback(async (file: File) => {
    const bytes = await file.arrayBuffer();
    setFileBytes(bytes);
    setFileName(file.name);
    const doc = await PDFDocument.load(bytes);
    const pjsDoc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    setNumPages(pjsDoc.numPages);

    setTitle(doc.getTitle() ?? "");
    setAuthor(doc.getAuthor() ?? "");
    setSubject(doc.getSubject() ?? "");
    const kws = doc.getKeywords() ?? "";
    setKeywords(typeof kws === "string" ? kws : (kws as string[]).join(", "));

    const cd = doc.getCreationDate();
    setCreationDate(cd ? cd.toLocaleString() : "");
    setProducer(doc.getProducer() ?? "");
    setCreator(doc.getCreator() ?? "");

    setStage("edit");
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

  const save = async () => {
    if (!fileBytes) return;
    setSaving(true);
    try {
      const doc = await PDFDocument.load(fileBytes);
      if (title.trim()) doc.setTitle(title.trim());
      if (author.trim()) doc.setAuthor(author.trim());
      if (subject.trim()) doc.setSubject(subject.trim());
      doc.setKeywords(keywords.split(",").map(k => k.trim()).filter(Boolean));
      const bytes = await doc.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + "-meta.pdf";
      a.click(); URL.revokeObjectURL(url);
    } finally { setSaving(false); }
  };

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>Edit Metadata</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Edit Title, Author, Subject, and Keywords stored in the PDF document properties.
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
        <span style={{ fontSize: 14, fontWeight: 600 }}>Edit Metadata</span>
        <span style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{fileName}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: MUTED }}>{numPages} page{numPages !== 1 ? "s" : ""}</span>
        <button onClick={save} disabled={saving} style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
          {saving ? "Saving…" : "Save & Download"}
        </button>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: "28px 24px", alignItems: "start", maxWidth: 960, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

        {/* Editable fields */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "24px 22px", background: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Document properties</div>

          <Field label="Title" value={title} onChange={setTitle} placeholder="e.g. Q4 Financial Report" />
          <Field label="Author" value={author} onChange={setAuthor} placeholder="e.g. Jane Smith" />
          <Field label="Subject" value={subject} onChange={setSubject} placeholder="e.g. Annual Review" />
          <Field
            label="Keywords"
            value={keywords}
            onChange={setKeywords}
            placeholder="e.g. finance, Q4, 2025"
            hint="Separate keywords with commas"
          />
        </div>

        {/* Read-only info */}
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "24px 22px", background: "#fff", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Document info (read-only)</div>

          <ReadonlyField label="Created" value={creationDate} />
          <ReadonlyField label="Producer" value={producer} />
          <ReadonlyField label="Creator" value={creator} />
          <ReadonlyField label="Pages" value={String(numPages)} />

          <div style={{ marginTop: 8, padding: "12px 14px", background: "#f7f8fa", borderRadius: 8, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            Title, Author, Subject, and Keywords are written into the PDF document properties. These fields are read by PDF viewers, search engines, and document management systems.
          </div>
        </div>
      </div>
    </div>
  );
}
