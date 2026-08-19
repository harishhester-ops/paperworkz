"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./PdfToWordClient"), { ssr: false });
export default function Page() { return <C />; }
