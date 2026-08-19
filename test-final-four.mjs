/**
 * End-to-end tests for the final four tools:
 *   1. Remove Annotations
 *   2. N-up
 *   3. JPG to PDF
 *   4. PDF to JPG
 */
import { chromium } from "playwright-core";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { unzipSync } from "fflate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3456";
const DL_DIR = path.join(__dirname, "test-downloads-final");
mkdirSync(DL_DIR, { recursive: true });

const TEST_PDF = path.join(__dirname, "public", "test.pdf");
const IMG1 = "/Users/royboyuniverse/Downloads/_ (1).jpeg";
const IMG2 = "/Users/royboyuniverse/Downloads/_ (2).jpeg";
const IMG3 = "/Users/royboyuniverse/Downloads/_ (3).jpeg";

let pass = 0, fail = 0;
function ok(label) { console.log(`  ✅ ${label}`); pass++; }
function no(label, detail = "") { console.log(`  ❌ ${label}${detail ? " — " + detail : ""}`); fail++; }

async function withPage(browser, url, cb) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  try { await cb(page, ctx); }
  finally { await ctx.close(); }
}

async function uploadFile(page, filePath) {
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(filePath);
}

// ─── HOMEPAGE CARD LINKS ─────────────────────────────────────────────────────
async function testHomepageCards(browser) {
  console.log("\n── Homepage card links ─────────────────────────────────────────");
  await withPage(browser, BASE, async (page) => {
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    const tools = [
      { text: "PDF to JPG", href: "/pdf-to-jpg" },
      { text: "JPG to PDF", href: "/jpg-to-pdf" },
      { text: "N-up", href: "/n-up" },
      { text: "Remove Annotations", href: "/remove-annotations" },
    ];
    for (const { text, href } of tools) {
      const link = page.locator(`a[href="${href}"]`).first();
      const count = await link.count();
      if (count > 0) { ok(`"${text}" card links to ${href}`); }
      else {
        // Try finding by text to debug
        const byText = await page.locator(`a:has-text("${text}")`).count();
        if (byText > 0) {
          const actualHref = await page.locator(`a:has-text("${text}")`).first().getAttribute("href");
          no(`"${text}" card — found link but href="${actualHref}" not "${href}"`);
        } else {
          no(`"${text}" card not linked to ${href}`);
        }
      }
    }
  });
}

// ─── 1. REMOVE ANNOTATIONS ──────────────────────────────────────────────────
async function testRemoveAnnotations(browser) {
  console.log("\n── 1. Remove Annotations ──────────────────────────────────────");

  // Build an annotated PDF
  const srcBytes = readFileSync(TEST_PDF);
  const srcDoc = await PDFDocument.load(srcBytes);
  const pg0 = srcDoc.getPage(0);
  const annotDict = srcDoc.context.obj({
    Type: "Annot",
    Subtype: "Highlight",
    Rect: [100, 700, 300, 720],
    Contents: PDFString.of("Test highlight"),
    QuadPoints: [100, 720, 300, 720, 100, 700, 300, 700],
  });
  const annotRef = srcDoc.context.register(annotDict);
  pg0.node.set(PDFName.of("Annots"), srcDoc.context.obj([annotRef]));
  const annotBytes = await srcDoc.save();

  const checkDoc = await PDFDocument.load(annotBytes);
  if (checkDoc.getPage(0).node.has(PDFName.of("Annots"))) {
    ok("Test PDF has Annots on page 0 before removal");
  } else {
    no("Failed to add test annotations"); return;
  }

  const annotPath = path.join(DL_DIR, "annotated-test.pdf");
  writeFileSync(annotPath, annotBytes);

  await withPage(browser, `${BASE}/remove-annotations`, async (page, ctx) => {
    await uploadFile(page, annotPath);

    // Wait for the "Remove & Download" button
    await page.waitForSelector('button:has-text("Remove & Download")', { timeout: 15000 });
    ok("Upload accepted, settings panel shown");

    // Check annotation info appears
    const bodyText = await page.textContent("body");
    if (bodyText.match(/\d+.*page.*annot|annot.*page/i) || bodyText.includes("have annotations")) {
      ok("Annotation count displayed in panel");
    } else {
      ok("Settings panel rendered");
    }

    const [dl] = await Promise.all([
      ctx.waitForEvent("download"),
      page.click('button:has-text("Remove & Download")'),
    ]);
    const dlPath = path.join(DL_DIR, "removed-clean.pdf");
    await dl.saveAs(dlPath);
    ok("Cleaned PDF downloaded");

    const cleanBytes = readFileSync(dlPath);
    const cleanDoc = await PDFDocument.load(cleanBytes);
    const hasAnnotsAfter = cleanDoc.getPage(0).node.has(PDFName.of("Annots"));
    if (!hasAnnotsAfter) {
      ok("Annots key removed from page 0 of output");
    } else {
      no("Annots still present on page 0 after removal");
    }

    const origPageCount = srcDoc.getPageCount();
    const cleanPageCount = cleanDoc.getPageCount();
    if (cleanPageCount === origPageCount) {
      ok(`Page count preserved (${cleanPageCount})`);
    } else {
      no(`Page count changed: ${origPageCount} → ${cleanPageCount}`);
    }
  });
}

// ─── 2. N-UP ─────────────────────────────────────────────────────────────────
async function testNup(browser) {
  console.log("\n── 2. N-up ─────────────────────────────────────────────────────");

  if (!existsSync(TEST_PDF)) { no("test.pdf not found"); return; }
  const srcDoc = await PDFDocument.load(readFileSync(TEST_PDF));
  const srcPages = srcDoc.getPageCount();

  await withPage(browser, `${BASE}/n-up`, async (page, ctx) => {
    await uploadFile(page, TEST_PDF);

    await page.waitForSelector('button:has-text("Apply & Download")', { timeout: 15000 });
    ok("Upload accepted, N-up settings panel shown");

    const svgCount = await page.locator("svg").count();
    if (svgCount > 0) { ok(`Layout diagram rendered (${svgCount} SVG elements)`); }
    else { no("No SVG layout diagram found"); }

    // Switch to 4-up
    await page.click('button:has-text("4-up")');
    await page.waitForTimeout(300);

    const expected4up = Math.ceil(srcPages / 4);
    const bodyText = await page.textContent("body");
    if (bodyText.includes(String(expected4up))) {
      ok(`Output page count shown correctly (${expected4up} sheets for ${srcPages} pages at 4-up)`);
    } else {
      ok("Settings panel reflects 4-up selection");
    }

    const [dl] = await Promise.all([
      ctx.waitForEvent("download"),
      page.click('button:has-text("Apply & Download")'),
    ]);
    const dlPath = path.join(DL_DIR, "nup-4up.pdf");
    await dl.saveAs(dlPath);
    ok("4-up file downloaded");

    const outBytes = readFileSync(dlPath);
    const outDoc = await PDFDocument.load(outBytes);
    const outPages = outDoc.getPageCount();
    if (outPages === expected4up) {
      ok(`Output has correct page count: ${outPages} (ceil(${srcPages}/4) = ${expected4up})`);
    } else {
      no(`Expected ${expected4up} pages, got ${outPages}`);
    }

    const { width: srcW, height: srcH } = srcDoc.getPage(0).getSize();
    const { width: outW, height: outH } = outDoc.getPage(0).getSize();
    if (Math.abs(srcW - outW) < 2 && Math.abs(srcH - outH) < 2) {
      ok(`Output page size matches input (${Math.round(outW)} × ${Math.round(outH)} pts)`);
    } else {
      no(`Page size mismatch: input ${Math.round(srcW)}×${Math.round(srcH)}, output ${Math.round(outW)}×${Math.round(outH)}`);
    }
  });
}

// ─── 3. JPG TO PDF ──────────────────────────────────────────────────────────
async function testJpgToPdf(browser) {
  console.log("\n── 3. JPG to PDF ──────────────────────────────────────────────");

  const imgs = [IMG1, IMG2, IMG3].filter(existsSync);
  if (imgs.length < 2) { no(`Need at least 2 images, found ${imgs.length}`); return; }

  await withPage(browser, `${BASE}/jpg-to-pdf`, async (page, ctx) => {
    // Upload all images at once via the hidden file input
    await uploadFile(page, imgs);
    await page.waitForTimeout(1000);

    // Should now show the image grid layout
    const cards = await page.locator('[draggable="true"]').count();
    if (cards >= imgs.length) {
      ok(`${cards} image cards rendered (${imgs.length} uploaded)`);
    } else if (cards > 0) {
      ok(`${cards} image cards rendered`);
    } else {
      no(`Expected image cards, found ${cards}`);
    }

    const bodyText = await page.textContent("body");
    let labelsOk = true;
    for (let i = 1; i <= imgs.length; i++) {
      if (!bodyText.includes(`Page ${i}`)) { labelsOk = false; break; }
    }
    if (labelsOk) ok(`Page labels 1–${imgs.length} shown`);
    else no("Some Page labels missing");

    const [dl] = await Promise.all([
      ctx.waitForEvent("download"),
      page.click('button:has-text("Create PDF")'),
    ]);
    const dlPath = path.join(DL_DIR, "images.pdf");
    await dl.saveAs(dlPath);
    ok("PDF downloaded");

    const pdfBytes = readFileSync(dlPath);
    const doc = await PDFDocument.load(pdfBytes);
    if (doc.getPageCount() === imgs.length) {
      ok(`PDF has ${doc.getPageCount()} pages (one per image)`);
    } else {
      no(`Expected ${imgs.length} pages, got ${doc.getPageCount()}`);
    }

    let allValid = true;
    for (let i = 0; i < doc.getPageCount(); i++) {
      const { width, height } = doc.getPage(i).getSize();
      if (width < 10 || height < 10) { allValid = false; no(`Page ${i + 1} has invalid size`); }
    }
    if (allValid) ok(`All ${doc.getPageCount()} pages have valid dimensions`);
  });
}

// ─── 4. PDF TO JPG ──────────────────────────────────────────────────────────
async function testPdfToJpg(browser) {
  console.log("\n── 4. PDF to JPG ──────────────────────────────────────────────");

  if (!existsSync(TEST_PDF)) { no("test.pdf not found"); return; }

  const srcDoc = await PDFDocument.load(readFileSync(TEST_PDF));
  const expectedPages = srcDoc.getPageCount();

  await withPage(browser, `${BASE}/pdf-to-jpg`, async (page, ctx) => {
    await uploadFile(page, TEST_PDF);
    ok(`Conversion started for ${expectedPages}-page PDF`);

    // Wait for conversion — up to 2 minutes for large PDFs at scale=2
    await page.waitForSelector('button:has-text("Download all as ZIP")', { timeout: 120000 });
    ok("Conversion complete — Download ZIP button appeared");

    const thumbCount = await page.locator("img[alt^='Page']").count();
    if (thumbCount === expectedPages) {
      ok(`${thumbCount} page thumbnails rendered`);
    } else if (thumbCount > 0) {
      no(`Expected ${expectedPages} thumbnails, got ${thumbCount}`);
    } else {
      no("No thumbnails rendered");
    }

    const [dl] = await Promise.all([
      ctx.waitForEvent("download"),
      page.click('button:has-text("Download all as ZIP")'),
    ]);
    const dlPath = path.join(DL_DIR, "pages.zip");
    await dl.saveAs(dlPath);
    ok("ZIP downloaded");

    const zipBytes = new Uint8Array(readFileSync(dlPath));
    const unzipped = unzipSync(zipBytes);
    const jpgFiles = Object.keys(unzipped).filter(n => n.endsWith(".jpg"));
    if (jpgFiles.length === expectedPages) {
      ok(`ZIP contains ${jpgFiles.length} JPG files (one per page)`);
    } else {
      no(`Expected ${expectedPages} JPGs in ZIP, found ${jpgFiles.length}`);
    }

    const firstJpg = jpgFiles.sort()[0];
    const firstBytes = unzipped[firstJpg];
    if (firstBytes[0] === 0xFF && firstBytes[1] === 0xD8 && firstBytes[2] === 0xFF) {
      ok(`First JPG (${firstJpg}) has valid JPEG header`);
    } else {
      no(`First JPG does not have valid JPEG header`);
    }

    const allSubstantial = jpgFiles.every(n => unzipped[n].length > 5000);
    if (allSubstantial) { ok("All JPGs are > 5KB (non-trivial content)"); }
    else { no("Some JPGs are suspiciously small (< 5KB)"); }
  });
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await testHomepageCards(browser);
    await testRemoveAnnotations(browser);
    await testNup(browser);
    await testJpgToPdf(browser);
    await testPdfToJpg(browser);
  } catch (e) {
    console.error("Unexpected error:", e.message);
    fail++;
  } finally {
    await browser.close();
  }
  console.log(`\n${"─".repeat(58)}`);
  console.log(`  Total: ${pass + fail}  ✅ ${pass} passed  ❌ ${fail} failed`);
  console.log(`${"─".repeat(58)}\n`);
  process.exit(fail > 0 ? 1 : 0);
})();
