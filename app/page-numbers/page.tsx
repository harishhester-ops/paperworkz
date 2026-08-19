"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./PageNumbersClient"), { ssr: false });
export default function PageNumbersPage() { return <C />; }
