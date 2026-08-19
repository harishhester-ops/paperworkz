"use client";
import { SimpleServerTool } from "@/app/components/SimpleServerTool";
export default function RepairClient() {
  return (
    <SimpleServerTool
      title="Repair PDF"
      description="Recover data from corrupted or damaged PDFs. Fixes broken cross-reference tables and rewrites the file structure using qpdf and Ghostscript."
      endpoint="/api/repair"
      accept="application/pdf"
      acceptLabel="PDF files only"
      icon="🔧"
    />
  );
}
