"use client";
import { SimpleServerTool } from "@/app/components/SimpleServerTool";
export default function GrayscaleClient() {
  return (
    <SimpleServerTool
      title="Grayscale PDF"
      description="Convert all colors in a PDF to grayscale. Useful for printing and reducing ink usage."
      endpoint="/api/grayscale"
      accept="application/pdf"
      acceptLabel="PDF files only"
      icon="🩶"
    />
  );
}
