const express = require("express");
const path = require("path");
const { unlink } = require("fs/promises");
const { upload } = require("../utils/upload");
const { run } = require("../utils/exec");
const { makeTmpDir, cleanTmpDir } = require("../utils/tmp");

const router = express.Router();

// Quality presets map to Ghostscript PDFSETTINGS
const QUALITY = {
  screen: "/screen",     // ~72 dpi, smallest
  ebook: "/ebook",       // ~150 dpi, good for e-readers
  printer: "/printer",   // ~300 dpi, high quality
  prepress: "/prepress", // ~300 dpi, max quality, color-preserving
};

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const quality = QUALITY[req.body.quality] ?? QUALITY.ebook;
  const tmp = await makeTmpDir();

  try {
    const outPath = path.join(tmp, "compressed.pdf");

    await run("gs", [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=${quality}`,
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      "-dDetectDuplicateImages=true",
      "-dCompressFonts=true",
      `-sOutputFile=${outPath}`,
      req.file.path,
    ]);

    const baseName = path.basename(req.file.originalname, ".pdf");
    res.download(outPath, `${baseName}-compressed.pdf`, async () => {
      await cleanTmpDir(tmp);
      await unlink(req.file.path).catch(() => {});
    });
  } catch (err) {
    await cleanTmpDir(tmp);
    await unlink(req.file.path).catch(() => {});
    console.error("compress error:", err.message);
    res.status(500).json({ error: "Compression failed", detail: err.message });
  }
});

module.exports = router;
