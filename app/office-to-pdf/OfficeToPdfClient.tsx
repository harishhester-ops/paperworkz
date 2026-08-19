"use client";
import { SimpleServerTool } from "@/app/components/SimpleServerTool";

export default function OfficeToPdfClient() {
  return (
    <SimpleServerTool
      title="Office to PDF"
      description="Convert Word, Excel, or PowerPoint documents into a polished PDF. Upload any .docx, .xlsx, .pptx, .odt, .ods, .odp, or .rtf file."
      endpoint="/api/to-pdf"
      accept=".docx,.doc,.xlsx,.xls,.pptx,.ppt,.odt,.ods,.odp,.rtf"
      acceptLabel="Word, Excel, PowerPoint, ODT, ODS, ODP, RTF"
      icon="📋"
    />
  );
}
