"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./BatesClient"), { ssr: false });
export default function BatesPage() { return <C />; }
