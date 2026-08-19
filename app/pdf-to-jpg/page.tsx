"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./PdfToJpgClient"), { ssr: false });
export default function PdfToJpgPage() { return <C />; }
