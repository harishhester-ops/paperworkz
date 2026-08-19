const express = require("express");
const path = require("path");
const { readdir, unlink } = require("fs/promises");
const archiver = require("archiver");
const { upload } = require("../utils/upload");
const { run } = require("../utils/exec");
const { makeTmpDir, cleanTmpDir } = require("../utils/tmp");

const router = express.Router();

// POST /api/extract-images
// Uses pdfimages (poppler-utils) to extract all embedded images from a PDF.
// Returns a zip archive of all extracted images.
router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const tmp = await makeTmpDir();

  try {
    const prefix = path.join(tmp, "img");

    // -all extracts as-is (jpeg, png, etc.) rather than converting to ppm
    await run("pdfimages", ["-all", req.file.path, prefix]);

    const files = (await readdir(tmp)).filter(f => f.startsWith("img-"));
    if (files.length === 0) {
      return res.status(422).json({ error: "No images found in this PDF" });
    }

    const baseName = path.basename(req.file.originalname, ".pdf");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}-images.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", err => { throw err; });
    archive.pipe(res);

    for (const file of files) {
      archive.file(path.join(tmp, file), { name: file });
    }

    await archive.finalize();

    res.on("finish", async () => {
      await cleanTmpDir(tmp);
      await unlink(req.file.path).catch(() => {});
    });
  } catch (err) {
    await cleanTmpDir(tmp);
    await unlink(req.file.path).catch(() => {});
    console.error("extract-images error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Image extraction failed", detail: err.message });
    }
  }
});

module.exports = router;
