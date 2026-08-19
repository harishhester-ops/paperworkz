import * as pdfjsLib from "pdfjs-dist";

// pdf.js needs its worker script. We point it at the matching version on a
// public CDN so the app doesn't have to ship/serve the worker file itself.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export { pdfjsLib };

// pdf.js already collapses embedded font names down to a generic CSS family
// (sans-serif / serif / monospace) per text run. We reuse that as our first
// guess, then let the user override it from a small picker if the match
// looks wrong, same as Sejda's "pick a close font" fallback.
export type FontChoice = "helvetica" | "times" | "courier";

export function guessFontChoice(cssFontFamily: string | undefined): FontChoice {
  const f = (cssFontFamily || "").toLowerCase();
  if (f.includes("monospace") || f.includes("courier")) return "courier";
  if (f.includes("serif") && !f.includes("sans-serif")) return "times";
  return "helvetica";
}

export const FONT_LABELS: Record<FontChoice, string> = {
  helvetica: "Helvetica (sans-serif)",
  times: "Times New Roman (serif)",
  courier: "Courier (monospace)",
};

export const FONT_CSS_STACK: Record<FontChoice, string> = {
  helvetica: "Helvetica, Arial, sans-serif",
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
};
