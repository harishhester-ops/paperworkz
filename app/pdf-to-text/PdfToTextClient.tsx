"use client";
import { SimpleServerTool } from "@/app/components/SimpleServerTool";
export default function PdfToTextClient() {
  return (
    <SimpleServerTool
      title="PDF to Text"
      description="Extract all text from a PDF into a plain .txt file."
      endpoint="/api/convert/text"
      accept="application/pdf"
      acceptLabel="PDF files only"
      icon="📝"
    />
  );
}
