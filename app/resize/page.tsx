"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./ResizeClient"), { ssr: false });
export default function ResizePage() { return <C />; }
