const express = require("express");
const path = require("path");
const { readdir, unlink } = require("fs/promises");
const { upload } = require("../utils/upload");
const { run } = require("../utils/exec");
const { makeTmpDir, cleanTmpDir } = require("../utils/tmp");

const router = express.Router();

// POST /api/ocr
// Body params:
//   lang     - Tesseract language code(s), e.g. "eng" or "eng+fra" (default: eng)
//   dpi      - Render resolution for pdftoppm (default: 300)
// Returns a searchable PDF with OCR text layer.
router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const lang = /^[a-z+]+$/i.test(req.body.lang || "") ? req.body.lang : "eng";
  const dpi = parseInt(req.body.dpi, 10) || 300;
  const tmp = await makeTmpDir();

  try {
    // Step 1: Rasterize PDF pages to PPM images
    const pagePrefix = path.join(tmp, "page");
    await run("pdftoppm", ["-r", String(dpi), req.file.path, pagePrefix], 180_000);

    // Step 2: Collect page images (pdftoppm outputs page-001.ppm, page-002.ppm, ...)
    const allFiles = await readdir(tmp);
    const pageFiles = allFiles
      .filter(f => f.startsWith("page-") && f.endsWith(".ppm"))
      .sort()
      .map(f => path.join(tmp, f));

    if (pageFiles.length === 0) {
      return res.status(422).json({ error: "Could not rasterize PDF pages" });
    }

    // Step 3: Run Tesseract on each page, producing a per-page PDF
    const ocrPdfs = [];
    for (let i = 0; i < pageFiles.length; i++) {
      const outBase = path.join(tmp, `ocr-page-${String(i + 1).padStart(4, "0")}`);
      await run("tesseract", [pageFiles[i], outBase, "-l", lang, "pdf"], 120_000);
      ocrPdfs.push(outBase + ".pdf");
    }

    // Step 4: Merge all per-page PDFs into one with Ghostscript
    const outPath = path.join(tmp, "ocr-output.pdf");
    await run("gs", [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${outPath}`,
      ...ocrPdfs,
    ]);

    const baseName = path.basename(req.file.originalname, ".pdf");
    res.download(outPath, `${baseName}-ocr.pdf`, async () => {
      await cleanTmpDir(tmp);
      await unlink(req.file.path).catch(() => {});
    });
  } catch (err) {
    await cleanTmpDir(tmp);
    await unlink(req.file.path).catch(() => {});
    console.error("ocr error:", err.message);
    res.status(500).json({ error: "OCR failed", detail: err.message });
  }
});

module.exports = router;
