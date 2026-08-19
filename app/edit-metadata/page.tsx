"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./EditMetadataClient"), { ssr: false });
export default function EditMetadataPage() { return <C />; }
