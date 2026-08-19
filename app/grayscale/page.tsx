"use client";
import dynamic from "next/dynamic";
const C = dynamic(() => import("./GrayscaleClient"), { ssr: false });
export default function Page() { return <C />; }
