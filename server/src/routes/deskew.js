const express = require("express");
const path = require("path");
const { readdir, unlink } = require("fs/promises");
const { upload } = require("../utils/upload");
const { run } = require("../utils/exec");
const { makeTmpDir, cleanTmpDir } = require("../utils/tmp");

const router = express.Router();

// POST /api/deskew
// Body params:
//   dpi      - render resolution (default: 300)
//   threshold - ImageMagick deskew threshold 0–100% (default: 40)
// Workflow: PDF → PPM pages → ImageMagick deskew → Ghostscript → PDF
router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const dpi = parseInt(req.body.dpi, 10) || 300;
  const threshold = parseInt(req.body.threshold, 10) || 40;
  const tmp = await makeTmpDir();

  try {
    // Step 1: Rasterize PDF to PPM pages
    const pagePrefix = path.join(tmp, "page");
    await run("pdftoppm", ["-r", String(dpi), req.file.path, pagePrefix], 180_000);

    const allFiles = await readdir(tmp);
    const pageFiles = allFiles
      .filter(f => f.startsWith("page-") && f.endsWith(".ppm"))
      .sort();

    if (pageFiles.length === 0) {
      return res.status(422).json({ error: "Could not rasterize PDF pages" });
    }

    // Step 2: Deskew each page with ImageMagick
    const deskewedFiles = [];
    for (const pageFile of pageFiles) {
      const inPath = path.join(tmp, pageFile);
      const outPath = path.join(tmp, pageFile.replace(".ppm", "-deskewed.ppm"));
      await run("convert", [
        inPath,
        "-deskew", `${threshold}%`,
        "-auto-orient",
        outPath,
      ], 60_000);
      deskewedFiles.push(outPath);
    }

    // Step 3: Combine deskewed images into a PDF with ImageMagick
    // (Ghostscript cannot read raw PPM files produced by pdftoppm)
    const outPath = path.join(tmp, "deskewed.pdf");
    await run("convert", [
      "-density", String(dpi),
      "-compress", "jpeg",
      "-quality", "92",
      ...deskewedFiles,
      outPath,
    ], 180_000);

    const baseName = path.basename(req.file.originalname, ".pdf");
    res.download(outPath, `${baseName}-deskewed.pdf`, async () => {
      await cleanTmpDir(tmp);
      await unlink(req.file.path).catch(() => {});
    });
  } catch (err) {
    await cleanTmpDir(tmp);
    await unlink(req.file.path).catch(() => {});
    console.error("deskew error:", err.message);
    res.status(500).json({ error: "Deskew failed", detail: err.message });
  }
});

module.exports = router;
