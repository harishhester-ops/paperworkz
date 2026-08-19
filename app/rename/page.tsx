"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./RenameClient"), { ssr: false });
export default function RenamePage() { return <C />; }
