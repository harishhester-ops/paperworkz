"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./HeaderFooterClient"), { ssr: false });
export default function HeaderFooterPage() { return <C />; }
