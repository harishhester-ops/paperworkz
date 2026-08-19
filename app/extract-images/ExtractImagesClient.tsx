"use client";
import { SimpleServerTool } from "@/app/components/SimpleServerTool";
export default function ExtractImagesClient() {
  return (
    <SimpleServerTool
      title="Extract Images"
      description="Pull every embedded image out of a PDF and download them all as a ZIP archive."
      endpoint="/api/extract-images"
      accept="application/pdf"
      acceptLabel="PDF files only"
      icon="🖼️"
    />
  );
}
