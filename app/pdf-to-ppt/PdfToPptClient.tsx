"use client";
import { SimpleServerTool } from "@/app/components/SimpleServerTool";
export default function PdfToPptClient() {
  return (
    <SimpleServerTool
      title="PDF to PowerPoint"
      description="Convert a PDF into an editable PPTX presentation using LibreOffice Impress."
      endpoint="/api/convert/ppt"
      accept="application/pdf"
      acceptLabel="PDF files only"
      icon="📑"
    />
  );
}
