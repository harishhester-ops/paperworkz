"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./PdfToTextClient"), { ssr: false });
export default function Page() { return <C />; }
