"use client";
import { SimpleServerTool } from "@/app/components/SimpleServerTool";
export default function PdfToExcelClient() {
  return (
    <SimpleServerTool
      title="PDF to Excel"
      description="Extract tables and data from a PDF into an editable XLSX spreadsheet."
      endpoint="/api/convert/excel"
      accept="application/pdf"
      acceptLabel="PDF files only"
      icon="📊"
    />
  );
}
