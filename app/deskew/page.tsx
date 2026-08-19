"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./DeskewClient"), { ssr: false });
export default function Page() { return <C />; }
