"use client";

import dynamic from "next/dynamic";

const MergeClient = dynamic(() => import("./MergeClient"), { ssr: false });

export default function MergePage() {
  return <MergeClient />;
}
