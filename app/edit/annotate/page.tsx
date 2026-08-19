"use client";

import dynamic from "next/dynamic";

const AnnotateClient = dynamic(() => import("./AnnotateClient"), { ssr: false });

export default function AnnotatePage() {
  return <AnnotateClient />;
}
