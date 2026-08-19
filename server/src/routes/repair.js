const express = require("express");
const path = require("path");
const { unlink } = require("fs/promises");
const { upload } = require("../utils/upload");
const { run } = require("../utils/exec");
const { makeTmpDir, cleanTmpDir } = require("../utils/tmp");

const router = express.Router();

// Ghostscript rewrites the PDF, which repairs most structural corruption.
// qpdf --recover handles cross-reference table damage.
router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const tmp = await makeTmpDir();

  try {
    const qpdfOut = path.join(tmp, "qpdf-repaired.pdf");
    const gsOut = path.join(tmp, "repaired.pdf");

    // Step 1: qpdf --recover to fix xref issues
    try {
      await run("qpdf", ["--recover", "--replace-input", "--", req.file.path, qpdfOut]);
    } catch {
      // qpdf may fail on severely corrupted files; fall through to gs
      await run("cp", [req.file.path, qpdfOut]).catch(() => {});
    }

    // Step 2: Ghostscript rewrite to normalize the structure
    const src = require("fs").existsSync(qpdfOut) ? qpdfOut : req.file.path;
    await run("gs", [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${gsOut}`,
      src,
    ]);

    const baseName = path.basename(req.file.originalname, ".pdf");
    res.download(gsOut, `${baseName}-repaired.pdf`, async () => {
      await cleanTmpDir(tmp);
      await unlink(req.file.path).catch(() => {});
    });
  } catch (err) {
    await cleanTmpDir(tmp);
    await unlink(req.file.path).catch(() => {});
    console.error("repair error:", err.message);
    res.status(500).json({ error: "Repair failed", detail: err.message });
  }
});

module.exports = router;
