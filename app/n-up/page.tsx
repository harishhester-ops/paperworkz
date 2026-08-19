"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./NupClient"), { ssr: false });
export default function NupPage() { return <C />; }
