"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./FlipClient"), { ssr: false });
export default function FlipPage() { return <C />; }
