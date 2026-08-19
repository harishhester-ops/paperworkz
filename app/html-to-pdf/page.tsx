"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./HtmlToPdfClient"), { ssr: false });
export default function Page() { return <C />; }
