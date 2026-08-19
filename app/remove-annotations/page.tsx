"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./RemoveAnnotationsClient"), { ssr: false });
export default function RemoveAnnotationsPage() { return <C />; }
