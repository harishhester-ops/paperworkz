"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";

const RED = "#e5232f";
const INK = "#111318";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
}

export default function JpgToPdfClient() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [zoneOver, setZoneOver] = useState(false);
  const [creating, setCreating] = useState(false);
  const [outputName, setOutputName] = useState("images");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragSrcIdx = useRef<number | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: ImageItem[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.match(/image\/(jpeg|jpg|png)/i)) continue;
      newItems.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
      });
    }
    setImages(prev => [...prev, ...newItems]);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setZoneOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  }, [addFiles]);

  const remove = (id: string) => {
    setImages(prev => {
      const item = prev.find(x => x.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(x => x.id !== id);
    });
  };

  // Drag-to-reorder
  const onCardDragStart = (e: React.DragEvent, idx: number, id: string) => {
    dragSrcIdx.current = idx;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onCardDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(id);
  };
  const onCardDrop = (e: React.DragEvent, dstIdx: number) => {
    e.preventDefault();
    if (dragSrcIdx.current === null || dragSrcIdx.current === dstIdx) return;
    setImages(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragSrcIdx.current!, 1);
      arr.splice(dstIdx, 0, moved);
      return arr;
    });
    dragSrcIdx.current = null; setDraggingId(null); setDropTarget(null);
  };
  const onCardDragEnd = () => { setDraggingId(null); setDropTarget(null); };

  const create = async () => {
    if (images.length === 0) return;
    setCreating(true);
    try {
      const doc = await PDFDocument.create();
      for (const item of images) {
        const bytes = await item.file.arrayBuffer();
        let img;
        if (item.file.type.includes("png")) {
          img = await doc.embedPng(bytes);
        } else {
          img = await doc.embedJpg(bytes);
        }
        const { width, height } = img.size();
        const page = doc.addPage([width, height]);
        page.drawImage(img, { x: 0, y: 0, width, height });
      }
      const pdfBytes = await doc.save();
      const url = URL.createObjectURL(new Blob([pdfBytes], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url;
      a.download = (outputName.trim() || "images") + ".pdf";
      a.click(); URL.revokeObjectURL(url);
    } finally { setCreating(false); }
  };

  if (images.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "72px 24px" }}>
        <Link href="/" style={{ fontSize: 13, color: MUTED, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36 }}>← All tools</Link>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", margin: "0 0 8px" }}>JPG to PDF</h1>
        <p style={{ color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
          Upload images — each becomes a page. Drag to reorder before downloading.
        </p>
        <label
          onDragOver={e => { e.preventDefault(); setZoneOver(true); }}
          onDragLeave={() => setZoneOver(false)}
          onDrop={onDrop}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, border: `2px dashed ${zoneOver ? RED : LINE}`, borderRadius: 16, padding: "64px 24px", cursor: "pointer", background: zoneOver ? "#fff5f6" : "#fafafb", transition: "border-color 0.15s" }}
        >
          <div style={{ fontSize: 32 }}>🖼️</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Drop images here or click to select</div>
          <div style={{ fontSize: 13, color: MUTED }}>JPG and PNG supported. Multiple files OK.</div>
          <input ref={addInputRef} type="file" accept="image/jpeg,image/png" multiple onChange={onPick} style={{ display: "none" }} />
        </label>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ height: 56, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 12, position: "sticky", top: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: 15, color: INK }}>Paper<span style={{ color: RED }}>Workz</span></Link>
        <div style={{ width: 1, height: 20, background: LINE }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>JPG to PDF</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: MUTED }}>{images.length} image{images.length !== 1 ? "s" : ""}</span>

        {/* Output filename */}
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <input
            type="text"
            value={outputName}
            onChange={e => setOutputName(e.target.value)}
            style={{ padding: "7px 10px", border: `1px solid ${LINE}`, borderRadius: "6px 0 0 6px", fontSize: 13, fontFamily: "inherit", outline: "none", width: 160, borderRight: "none" }}
          />
          <div style={{ padding: "7px 8px", border: `1px solid ${LINE}`, borderRadius: "0 6px 6px 0", fontSize: 13, color: MUTED, background: "#f7f8fa" }}>.pdf</div>
        </div>

        <label style={{ fontSize: 13, fontWeight: 600, padding: "7px 13px", border: `1px solid ${LINE}`, borderRadius: 8, background: "#fff", color: MUTED, cursor: "pointer", whiteSpace: "nowrap" }}>
          + Add more
          <input ref={addInputRef} type="file" accept="image/jpeg,image/png" multiple onChange={onPick} style={{ display: "none" }} />
        </label>
        <button onClick={create} disabled={creating || images.length === 0} style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
          {creating ? "Creating…" : "Create PDF"}
        </button>
      </div>

      {/* Instruction strip */}
      <div style={{ padding: "10px 24px", borderBottom: `1px solid ${LINE}`, fontSize: 13, color: MUTED, background: "#fafafa" }}>
        Drag cards to reorder pages. Each image becomes one page at its natural size.
      </div>

      {/* Image grid */}
      <div
        style={{ flex: 1, padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14, alignContent: "start" }}
        onDragOver={e => e.preventDefault()}
      >
        {images.map((item, idx) => (
          <div
            key={item.id}
            draggable
            onDragStart={e => onCardDragStart(e, idx, item.id)}
            onDragOver={e => onCardDragOver(e, item.id)}
            onDrop={e => onCardDrop(e, idx)}
            onDragEnd={onCardDragEnd}
            style={{
              border: `2px solid ${dropTarget === item.id ? RED : draggingId === item.id ? "#f0c8cc" : LINE}`,
              borderRadius: 8, overflow: "hidden", cursor: "grab", background: "#fff",
              opacity: draggingId === item.id ? 0.5 : 1,
              transition: "border-color 0.1s, opacity 0.1s",
              position: "relative",
            }}
          >
            <div style={{ aspectRatio: "1", overflow: "hidden", background: "#f7f8fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={item.previewUrl} alt={item.name} draggable={false} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
            </div>
            <div style={{ padding: "6px 8px 6px 8px", background: "#fff" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>Page {idx + 1}</div>
              <div style={{ fontSize: 10, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
            </div>
            <button
              onClick={() => remove(item.id)}
              style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: "50%", background: "rgba(229,35,47,0.85)", border: "none", color: "#fff", fontSize: 12, cursor: "pointer", display: "grid", placeItems: "center", lineHeight: 1 }}
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
