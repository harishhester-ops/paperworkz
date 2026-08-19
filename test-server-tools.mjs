/**
 * End-to-end tests for all 14 server-backed tools.
 * Calls the live backend at https://paperworkz-server.onrender.com directly
 * AND verifies the frontend routes load and are linked from the homepage.
 */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = "https://paperworkz-server.onrender.com";
const FRONT = "http://localhost:3456";
const DL = path.join(__dirname, "test-downloads-server");
mkdirSync(DL, { recursive: true });

const PDF = path.join(__dirname, "public", "test.pdf");
const PDF_TEXT = path.join(__dirname, "public", "test-text.pdf"); // PDF with selectable text, for text/OCR tests

let pass = 0, fail = 0;
const ok  = (label) => { console.log(`  ✅ ${label}`); pass++; };
const no  = (label, d = "") => { console.log(`  ❌ ${label}${d ? " — " + d : ""}`); fail++; };

// ── API helper — uses curl subprocess to avoid Node.js HTTP/2 edge timeouts ──

function postFile(endpoint, filePath, extra = {}, outName) {
  const dest = path.join(DL, outName ?? path.basename(filePath));
  const args = [
    "-s", "-S", "--max-time", "180",
    "-X", "POST",
    "-F", `file=@${filePath}`,
  ];
  for (const [k, v] of Object.entries(extra)) args.push("-F", `${k}=${v}`);
  // Write response body to dest, capture headers separately
  const headersFile = dest + ".headers";
  args.push("-D", headersFile, "-o", dest, `${API}${endpoint}`);

  try {
    execFileSync("curl", args, { timeout: 190_000 });
  } catch (e) {
    throw new Error(e.stderr?.toString() || e.message);
  }

  // Read status from headers file
  const headers = existsSync(headersFile) ? readFileSync(headersFile, "utf8") : "";
  const statusMatch = headers.match(/HTTP\/[\d.]+ (\d+)/g);
  const lastStatus = statusMatch ? parseInt(statusMatch[statusMatch.length - 1].split(" ")[1]) : 200;

  const buf = existsSync(dest) ? readFileSync(dest) : Buffer.alloc(0);
  if (lastStatus >= 400) {
    throw new Error(`HTTP ${lastStatus}: ${buf.toString().slice(0, 200)}`);
  }
  const dispMatch = headers.match(/content-disposition:.*filename="([^"]+)"/i);
  const filename = dispMatch?.[1] ?? outName ?? path.basename(filePath);
  // Clean up headers file
  try { unlinkSync(headersFile); } catch {}
  return { buf, filename, dest, contentType: headers.match(/content-type:\s*([^\r\n]+)/i)?.[1] ?? "" };
}

function postHtml(endpoint, html, outName) {
  const tmpHtml = path.join(DL, "_tmp_input.html");
  writeFileSync(tmpHtml, html, "utf8");
  const result = postFile(endpoint, tmpHtml, {}, outName);
  try { unlinkSync(tmpHtml); } catch {}
  return result;
}

// ── Quick PDF validity check ──────────────────────────────────────────────────
function isPdf(buf) { return buf.slice(0, 5).toString() === "%PDF-"; }
function isZip(buf) { return buf[0] === 0x50 && buf[1] === 0x4b; }
function isOffice(buf) { return isZip(buf); } // docx/xlsx/pptx are zip-based

// ── Homepage card links ───────────────────────────────────────────────────────
async function testHomepageCards(browser) {
  console.log("\n── Homepage card links ─────────────────────────────────────────");
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(FRONT, { waitUntil: "networkidle" });
  const routes = [
    ["/compress", "Compress"], ["/ocr", "OCR"], ["/pdf-to-word", "PDF to Word"],
    ["/pdf-to-excel", "PDF to Excel"], ["/pdf-to-ppt", "PDF to PPT"],
    ["/pdf-to-text", "PDF to Text"], ["/office-to-pdf", "Office to PDF"],
    ["/html-to-pdf", "HTML to PDF"], ["/extract-images", "Extract Images"],
    ["/repair", "Repair"], ["/protect-pdf", "Protect PDF"],
    ["/unlock-pdf", "Unlock PDF"], ["/grayscale", "Grayscale"], ["/deskew", "Deskew"],
  ];
  for (const [href, label] of routes) {
    const count = await page.locator(`a[href="${href}"]`).count();
    count > 0 ? ok(`"${label}" card → ${href}`) : no(`"${label}" card not linked to ${href}`);
  }
  await ctx.close();
}

// ── Frontend route smoke tests ────────────────────────────────────────────────
async function testFrontendRoutes(browser) {
  console.log("\n── Frontend routes render upload zone ──────────────────────────");
  const routes = [
    "/compress", "/ocr", "/pdf-to-word", "/pdf-to-excel", "/pdf-to-ppt",
    "/pdf-to-text", "/office-to-pdf", "/html-to-pdf", "/extract-images",
    "/repair", "/protect-pdf", "/unlock-pdf", "/grayscale", "/deskew",
  ];
  for (const route of routes) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(`${FRONT}${route}`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(500);
      const hasInput = await page.locator('input[type="file"]').count() > 0;
      const hasH1    = await page.locator("h1").count() > 0;
      (hasInput && hasH1) ? ok(`${route} — upload zone and heading rendered`) : no(`${route} — missing UI elements`);
    } catch (e) {
      no(`${route} — ${e.message.split("\n")[0]}`);
    } finally { await ctx.close(); }
  }
}

// ── API: Compress ─────────────────────────────────────────────────────────────
async function testCompress() {
  console.log("\n── 1. Compress ─────────────────────────────────────────────────");
  for (const quality of ["screen", "ebook", "printer"]) {
    try {
      const { buf, filename } = await postFile("/api/compress", PDF, { quality }, `compressed-${quality}.pdf`);
      isPdf(buf) ? ok(`quality=${quality} → ${filename} (${(buf.length/1024).toFixed(0)} KB)`) : no(`quality=${quality} — not a PDF`);
    } catch (e) { no(`quality=${quality}`, e.message); }
  }
}

// ── API: Grayscale ────────────────────────────────────────────────────────────
async function testGrayscale() {
  console.log("\n── 2. Grayscale ────────────────────────────────────────────────");
  try {
    const { buf, filename } = await postFile("/api/grayscale", PDF, {}, "grayscale.pdf");
    isPdf(buf) ? ok(`Output is valid PDF → ${filename} (${(buf.length/1024).toFixed(0)} KB)`) : no("Not a PDF");
  } catch (e) { no("grayscale", e.message); }
}

// ── API: Repair ───────────────────────────────────────────────────────────────
async function testRepair() {
  console.log("\n── 3. Repair ───────────────────────────────────────────────────");
  try {
    const { buf, filename } = await postFile("/api/repair", PDF, {}, "repaired.pdf");
    isPdf(buf) ? ok(`Output is valid PDF → ${filename} (${(buf.length/1024).toFixed(0)} KB)`) : no("Not a PDF");
  } catch (e) { no("repair", e.message); }
}

// ── API: Protect + Unlock ─────────────────────────────────────────────────────
async function testProtectUnlock() {
  console.log("\n── 4. Protect & Unlock ─────────────────────────────────────────");
  try {
    const { buf: pBuf, dest: pDest } = await postFile("/api/protect/protect", PDF, { password: "test1234", ownerPassword: "owner5678" }, "protected.pdf");
    isPdf(pBuf) ? ok(`Protect → valid PDF (${(pBuf.length/1024).toFixed(0)} KB)`) : no("Protected output not a PDF");

    // Unlock it with the user password
    const { buf: uBuf, filename: uName } = await postFile("/api/protect/unlock", pDest, { password: "test1234" }, "unlocked.pdf");
    isPdf(uBuf) ? ok(`Unlock → valid PDF → ${uName} (${(uBuf.length/1024).toFixed(0)} KB)`) : no("Unlocked output not a PDF");

    // Wrong password should return 422
    try {
      postFile("/api/protect/unlock", pDest, { password: "wrongpass" }, "unlock-wrong.pdf");
      no("Wrong password — expected 422 error but got success");
    } catch (e) {
      e.message.includes("422") ? ok("Wrong password returns HTTP 422") : no(`Wrong password error unexpected: ${e.message.slice(0, 80)}`);
    }
  } catch (e) { no("protect/unlock", e.message); }
}

// ── API: Extract Images ───────────────────────────────────────────────────────
async function testExtractImages() {
  console.log("\n── 5. Extract Images ───────────────────────────────────────────");
  try {
    const { buf, filename } = await postFile("/api/extract-images", PDF, {}, "images.zip");
    isZip(buf) ? ok(`Output is ZIP → ${filename} (${(buf.length/1024).toFixed(0)} KB)`) : no("Not a ZIP");
    if (isZip(buf)) {
      const { unzipSync } = await import("fflate");
      const files = Object.keys(unzipSync(new Uint8Array(buf)));
      files.length > 0 ? ok(`ZIP contains ${files.length} file(s): ${files.slice(0,3).join(", ")}`) : no("ZIP is empty");
    }
  } catch (e) {
    // PDF may have no embedded images — 422 is acceptable
    if (e.message.includes("422") || e.message.toLowerCase().includes("no images")) {
      ok("No embedded images in test PDF — server returned 422 (correct)");
    } else { no("extract-images", e.message); }
  }
}

// ── API: OCR ──────────────────────────────────────────────────────────────────
function postFileLong(endpoint, filePath, extra = {}, outName) {
  const dest = path.join(DL, outName ?? path.basename(filePath));
  const args = ["-s", "-S", "--max-time", "360", "-X", "POST", "-F", `file=@${filePath}`];
  for (const [k, v] of Object.entries(extra)) args.push("-F", `${k}=${v}`);
  const headersFile = dest + ".headers";
  args.push("-D", headersFile, "-o", dest, `${API}${endpoint}`);
  try { execFileSync("curl", args, { timeout: 370_000 }); } catch (e) { throw new Error(e.stderr?.toString() || e.message); }
  const headers = existsSync(headersFile) ? readFileSync(headersFile, "utf8") : "";
  const statusMatch = headers.match(/HTTP\/[\d.]+ (\d+)/g);
  const lastStatus = statusMatch ? parseInt(statusMatch[statusMatch.length - 1].split(" ")[1]) : 200;
  const buf = existsSync(dest) ? readFileSync(dest) : Buffer.alloc(0);
  if (lastStatus >= 400) throw new Error(`HTTP ${lastStatus}: ${buf.toString().slice(0, 200)}`);
  try { unlinkSync(headersFile); } catch {}
  const dispMatch = headers.match(/content-disposition:.*filename="([^"]+)"/i);
  return { buf, filename: dispMatch?.[1] ?? outName ?? path.basename(filePath), dest, contentType: headers.match(/content-type:\s*([^\r\n]+)/i)?.[1] ?? "" };
}

async function testOcr() {
  console.log("\n── 6. OCR ──────────────────────────────────────────────────────");
  try {
    const { buf, filename } = await postFileLong("/api/ocr", PDF_TEXT, { lang: "eng", dpi: "150" }, "ocr.pdf");
    isPdf(buf) ? ok(`Output is searchable PDF → ${filename} (${(buf.length/1024).toFixed(0)} KB)`) : no("Not a PDF");
  } catch (e) { no("ocr", e.message); }
}

// ── API: PDF to Word/Excel/PPT/Text ──────────────────────────────────────────
async function testPdfConvert() {
  console.log("\n── 7. PDF → Word / Excel / PPT / Text ─────────────────────────");
  const cases = [
    { ep: "/api/convert/word", out: "output.docx", check: isOffice, label: "PDF to Word" },
    { ep: "/api/convert/excel", out: "output.xlsx", check: isOffice, label: "PDF to Excel" },
    { ep: "/api/convert/ppt",  out: "output.pptx", check: isOffice, label: "PDF to PPT" },
    { ep: "/api/convert/text", out: "output.txt",  file: PDF_TEXT, check: (b) => b.length > 0, label: "PDF to Text" },
  ];
  for (const { ep, out, file: testFile, check, label } of cases) {
    try {
      const { buf, filename } = await postFile(ep, testFile ?? PDF, {}, out);
      check(buf) ? ok(`${label} → ${filename} (${(buf.length/1024).toFixed(0)} KB)`) : no(`${label} — unexpected output format`);
    } catch (e) { no(label, e.message); }
  }
}

// ── API: Office → PDF ─────────────────────────────────────────────────────────
async function testOfficeToPdf() {
  console.log("\n── 8. Office → PDF ─────────────────────────────────────────────");
  // Create a minimal valid DOCX (Word XML in a zip)
  const docxPath = path.join(DL, "test.docx");

  // Use a real small docx from the Downloads folder if available
  const sampleDocx = "/Users/royboyuniverse/Downloads/Harish_Karkaria_Resume_2026-04-14 .pdf";
  // Actually we need a real .docx — generate via LibreOffice on server by sending plain text
  // Fallback: send an RTF (LibreOffice handles it fine)
  const rtfPath = path.join(DL, "test.rtf");
  writeFileSync(rtfPath, "{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}} \\f0\\fs24 Hello from PaperWorkz RTF test document. This is a paragraph of text to confirm LibreOffice can render it.\\par}");

  try {
    const { buf, filename } = await postFile("/api/to-pdf", rtfPath, {}, "rtf-to-pdf.pdf");
    isPdf(buf) ? ok(`RTF → PDF → ${filename} (${(buf.length/1024).toFixed(0)} KB)`) : no("RTF to PDF output not a PDF");
  } catch (e) { no("office-to-pdf (RTF)", e.message); }
}

// ── API: HTML → PDF ───────────────────────────────────────────────────────────
async function testHtmlToPdf() {
  console.log("\n── 9. HTML → PDF ───────────────────────────────────────────────");
  const html = `<!DOCTYPE html>
<html><head><style>body{font-family:sans-serif;padding:40px}h1{color:#e5232f}</style></head>
<body><h1>PaperWorkz Test</h1><p>This HTML document was converted to PDF by the server.</p>
<ul><li>LibreOffice headless rendering</li><li>End-to-end verified</li></ul></body></html>`;
  try {
    const { buf, dest } = await postHtml("/api/to-pdf/html", html, "html-to-pdf.pdf");
    isPdf(buf) ? ok(`HTML → PDF (${(buf.length/1024).toFixed(0)} KB)`) : no("Not a PDF");
  } catch (e) { no("html-to-pdf", e.message); }
}

// ── API: Deskew ───────────────────────────────────────────────────────────────
async function testDeskew() {
  console.log("\n── 10. Deskew ──────────────────────────────────────────────────");
  try {
    const { buf, filename } = await postFileLong("/api/deskew", PDF, { dpi: "150", threshold: "40" }, "deskewed.pdf");
    isPdf(buf) ? ok(`Output is valid PDF → ${filename} (${(buf.length/1024).toFixed(0)} KB)`) : no("Not a PDF");
  } catch (e) { no("deskew", e.message); }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log("Connecting to backend…");
  const health = await fetch(`${API}/health`).then(r => r.json()).catch(() => null);
  if (!health?.ok) { console.error("Backend not reachable"); process.exit(1); }
  console.log(`Backend OK — ${health.endpoints.length} endpoints registered\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    await testHomepageCards(browser);
    await testFrontendRoutes(browser);
  } finally { await browser.close(); }

  // API tests run directly against the server (no browser needed)
  await testCompress();
  await testGrayscale();
  await testRepair();
  await testProtectUnlock();
  await testExtractImages();
  await testOcr();
  await testPdfConvert();
  await testOfficeToPdf();
  await testHtmlToPdf();
  await testDeskew();

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Total: ${pass + fail}   ✅ ${pass} passed   ❌ ${fail} failed`);
  console.log(`${"─".repeat(60)}\n`);
  process.exit(fail > 0 ? 1 : 0);
})();
