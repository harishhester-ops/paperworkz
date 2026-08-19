"use client";

import { useCallback, useState } from "react";
import {
  PdfViewerComponent,
  Toolbar,
  Magnification,
  Navigation,
  LinkAnnotation,
  BookmarkView,
  ThumbnailView,
  Print,
  TextSelection,
  Annotation,
  TextSearch,
  FormFields,
  FormDesigner,
  PageOrganizer,
  Inject,
} from "@syncfusion/ej2-react-pdfviewer";
import { ensureSyncfusionLicense } from "@/lib/syncfusionLicense";

const RED = "#e5232f";
const LINE = "#e8eaf0";
const MUTED = "#68707d";

export default function AnnotateClient() {
  ensureSyncfusionLicense();

  const [stage, setStage] = useState<"upload" | "editor">("upload");
  const [documentPath, setDocumentPath] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);

  const openFile = useCallback((file: File) => {
    setLoading(true);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setDocumentPath(reader.result as string); // base64 data URL
      setStage("editor");
      setLoading(false);
    };
    reader.readAsDataURL(file);
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

  if (stage === "upload") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "80px 20px" }}>
        <h1 style={{ fontSize: 30, letterSpacing: "-1px", marginBottom: 8 }}>
          Annotate, Fill &amp; Sign
        </h1>
        <p style={{ color: MUTED, marginBottom: 28 }}>
          Upload a PDF to highlight, fill forms, and add your signature.
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
      </div>
      <div style={{ flex: 1 }}>
        <PdfViewerComponent
          id="paperworkz-pdf-viewer"
          documentPath={documentPath}
          resourceUrl="https://cdn.syncfusion.com/ej2/34.2.4/dist/ej2-pdfviewer-lib"
          style={{ height: "100%" }}
        >
          <Inject
            services={[
              Toolbar,
              Magnification,
              Navigation,
              Annotation,
              LinkAnnotation,
              BookmarkView,
              ThumbnailView,
              Print,
              TextSelection,
              TextSearch,
              FormFields,
              FormDesigner,
              PageOrganizer,
            ]}
          />
        </PdfViewerComponent>
      </div>
    </div>
  );
}
