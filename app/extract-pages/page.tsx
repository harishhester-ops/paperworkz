"use client";

import dynamic from "next/dynamic";

const ExtractPagesClient = dynamic(() => import("./ExtractPagesClient"), { ssr: false });

export default function ExtractPagesPage() {
  return <ExtractPagesClient />;
}
