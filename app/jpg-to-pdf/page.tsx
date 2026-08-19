"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./JpgToPdfClient"), { ssr: false });
export default function JpgToPdfPage() { return <C />; }
