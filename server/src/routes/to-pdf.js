const express = require("express");
const path = require("path");
const { readdir, writeFile, unlink } = require("fs/promises");
const { upload } = require("../utils/upload");
const { run } = require("../utils/exec");
const { makeTmpDir, cleanTmpDir } = require("../utils/tmp");

const router = express.Router();

// Accepted source formats for office-to-pdf
const OFFICE_EXTS = new Set([".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".odt", ".ods", ".odp", ".rtf"]);

// POST /api/to-pdf  — Office document → PDF via LibreOffice
router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!OFFICE_EXTS.has(ext)) {
    await unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: `Unsupported format: ${ext}`, supported: [...OFFICE_EXTS] });
  }

  const tmp = await makeTmpDir();

  try {
    // Copy input with its original extension so LibreOffice recognises the format
    const inputPath = path.join(tmp, `input${ext}`);
    await run("cp", [req.file.path, inputPath]);

    await run("soffice", [
      "--headless",
      "--convert-to", "pdf",
      "--outdir", tmp,
      inputPath,
    ], 180_000);

    const files = await readdir(tmp);
    const outFile = files.find(f => f.endsWith(".pdf"));
    if (!outFile) throw new Error("LibreOffice did not produce a PDF");

    const baseName = path.basename(req.file.originalname, ext);
    res.download(path.join(tmp, outFile), `${baseName}.pdf`, async () => {
      await cleanTmpDir(tmp);
      await unlink(req.file.path).catch(() => {});
    });
  } catch (err) {
    await cleanTmpDir(tmp);
    await unlink(req.file.path).catch(() => {});
    console.error("to-pdf error:", err.message);
    res.status(500).json({ error: "Conversion to PDF failed", detail: err.message });
  }
});

// POST /api/to-pdf/html  — HTML file or raw HTML string → PDF via LibreOffice
router.post("/html", upload.single("file"), async (req, res) => {
  const tmp = await makeTmpDir();
  let uploadPath = null;

  try {
    let inputPath;

    if (req.file) {
      // Uploaded HTML file
      uploadPath = req.file.path;
      inputPath = path.join(tmp, "input.html");
      await run("cp", [req.file.path, inputPath]);
    } else if (req.body && req.body.html) {
      // Raw HTML in request body (requires express.text() middleware upstream)
      inputPath = path.join(tmp, "input.html");
      await writeFile(inputPath, req.body.html, "utf8");
    } else {
      return res.status(400).json({ error: "Provide an HTML file or html body field" });
    }

    await run("soffice", [
      "--headless",
      "--convert-to", "pdf",
      "--outdir", tmp,
      inputPath,
    ], 120_000);

    const files = await readdir(tmp);
    const outFile = files.find(f => f.endsWith(".pdf"));
    if (!outFile) throw new Error("LibreOffice did not produce a PDF from HTML");

    const baseName = req.file
      ? path.basename(req.file.originalname, path.extname(req.file.originalname))
      : "document";

    res.download(path.join(tmp, outFile), `${baseName}.pdf`, async () => {
      await cleanTmpDir(tmp);
      if (uploadPath) await unlink(uploadPath).catch(() => {});
    });
  } catch (err) {
    await cleanTmpDir(tmp);
    if (uploadPath) await unlink(uploadPath).catch(() => {});
    console.error("html-to-pdf error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "HTML to PDF failed", detail: err.message });
    }
  }
});

module.exports = router;
