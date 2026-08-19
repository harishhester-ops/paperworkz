"use client";

import dynamic from "next/dynamic";

const DeletePagesClient = dynamic(() => import("./DeletePagesClient"), { ssr: false });

export default function DeletePagesPage() {
  return <DeletePagesClient />;
}
