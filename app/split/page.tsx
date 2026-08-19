"use client";

import dynamic from "next/dynamic";

const SplitClient = dynamic(() => import("./SplitClient"), { ssr: false });

export default function SplitPage() {
  return <SplitClient />;
}
