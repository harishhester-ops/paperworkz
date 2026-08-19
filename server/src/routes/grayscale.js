const express = require("express");
const path = require("path");
const { unlink } = require("fs/promises");
const { upload } = require("../utils/upload");
const { run } = require("../utils/exec");
const { makeTmpDir, cleanTmpDir } = require("../utils/tmp");

const router = express.Router();

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const tmp = await makeTmpDir();

  try {
    const outPath = path.join(tmp, "grayscale.pdf");

    await run("gs", [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      "-sColorConversionStrategy=Gray",
      "-dProcessColorModel=/DeviceGray",
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${outPath}`,
      req.file.path,
    ]);

    const baseName = path.basename(req.file.originalname, ".pdf");
    res.download(outPath, `${baseName}-grayscale.pdf`, async () => {
      await cleanTmpDir(tmp);
      await unlink(req.file.path).catch(() => {});
    });
  } catch (err) {
    await cleanTmpDir(tmp);
    await unlink(req.file.path).catch(() => {});
    console.error("grayscale error:", err.message);
    res.status(500).json({ error: "Grayscale conversion failed", detail: err.message });
  }
});

module.exports = router;
