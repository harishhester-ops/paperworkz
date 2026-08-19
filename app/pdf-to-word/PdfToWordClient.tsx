"use client";
import { SimpleServerTool } from "@/app/components/SimpleServerTool";
export default function PdfToWordClient() {
  return (
    <SimpleServerTool
      title="PDF to Word"
      description="Convert a PDF into an editable DOCX document using LibreOffice's PDF import engine."
      endpoint="/api/convert/word"
      accept="application/pdf"
      acceptLabel="PDF files only"
      icon="📄"
    />
  );
}
