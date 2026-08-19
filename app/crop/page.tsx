"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./CropClient"), { ssr: false });
export default function CropPage() { return <C />; }
