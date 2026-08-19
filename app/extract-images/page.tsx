"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./ExtractImagesClient"), { ssr: false });
export default function Page() { return <C />; }
