const express = require("express");
const path = require("path");
const { readdir, unlink } = require("fs/promises");
const { upload } = require("../utils/upload");
const { run } = require("../utils/exec");
const { makeTmpDir, cleanTmpDir } = require("../utils/tmp");

const router = express.Router();

// LibreOffice PDF import filters and output formats
const TARGETS = {
  word:  { filter: "writer_pdf_import",  ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  excel: { filter: "writer_pdf_import",  ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  ppt:   { filter: "impress_pdf_import", ext: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
};

async function convertPdf(req, res, targetKey) {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const target = TARGETS[targetKey];
  const tmp = await makeTmpDir();

  try {
    // LibreOffice writes the output next to the input file, so copy input into tmp first
    const inputPath = path.join(tmp, "input.pdf");
    await run("cp", [req.file.path, inputPath]);

    // For Excel: first produce an ODS via writer, then re-export to xlsx so we get a valid
    // spreadsheet container even if the layout is text-based (calc_pdf_import is unreliable)
    if (targetKey === "excel") {
      await run("soffice", ["--headless", "--infilter=writer_pdf_import", "--convert-to", "odt", "--outdir", tmp, inputPath], 180_000);
      const odtFiles = (await readdir(tmp)).filter(f => f.endsWith(".odt"));
      if (!odtFiles.length) throw new Error("LibreOffice did not produce an .odt intermediate file");
      const odtPath = path.join(tmp, odtFiles[0]);
      await run("soffice", ["--headless", "--convert-to", "xlsx", "--outdir", tmp, odtPath], 90_000);
    } else {
      await run("soffice", ["--headless", `--infilter=${target.filter}`, "--convert-to", target.ext, "--outdir", tmp, inputPath], 180_000);
    }

    // Find the output file LibreOffice created
    const files = await readdir(tmp);
    const outFile = files.find(f => f.endsWith(`.${target.ext}`));

    if (!outFile) {
      throw new Error(`LibreOffice did not produce a .${target.ext} file`);
    }

    const baseName = path.basename(req.file.originalname, ".pdf");
    res.download(
      path.join(tmp, outFile),
      `${baseName}.${target.ext}`,
      async () => {
        await cleanTmpDir(tmp);
        await unlink(req.file.path).catch(() => {});
      }
    );
  } catch (err) {
    await cleanTmpDir(tmp);
    await unlink(req.file.path).catch(() => {});
    console.error(`pdf-to-${targetKey} error:`, err.message);
    res.status(500).json({ error: `PDF to ${targetKey} conversion failed`, detail: err.message });
  }
}

// PDF to Text: use pdftotext (poppler) — faster and more reliable than LibreOffice for text extraction
router.post("/text", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const tmp = await makeTmpDir();
  try {
    const outPath = path.join(tmp, "output.txt");
    await run("pdftotext", ["-enc", "UTF-8", "-layout", req.file.path, outPath], 60_000);
    const baseName = path.basename(req.file.originalname, ".pdf");
    res.download(outPath, `${baseName}.txt`, async () => {
      await cleanTmpDir(tmp);
      await unlink(req.file.path).catch(() => {});
    });
  } catch (err) {
    await cleanTmpDir(tmp);
    await unlink(req.file.path).catch(() => {});
    console.error("pdf-to-text error:", err.message);
    res.status(500).json({ error: "PDF to text conversion failed", detail: err.message });
  }
});

router.post("/word",  upload.single("file"), (req, res) => convertPdf(req, res, "word"));
router.post("/excel", upload.single("file"), (req, res) => convertPdf(req, res, "excel"));
router.post("/ppt",   upload.single("file"), (req, res) => convertPdf(req, res, "ppt"));

module.exports = router;
