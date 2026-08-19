"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./OfficeToPdfClient"), { ssr: false });
export default function Page() { return <C />; }
