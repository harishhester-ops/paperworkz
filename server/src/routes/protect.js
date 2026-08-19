const express = require("express");
const path = require("path");
const { unlink } = require("fs/promises");
const { upload } = require("../utils/upload");
const { run } = require("../utils/exec");
const { makeTmpDir, cleanTmpDir } = require("../utils/tmp");

const router = express.Router();

// POST /api/protect  — body: file, password, ownerPassword (optional)
// Uses AES-256 encryption via qpdf.
router.post("/protect", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const userPass = req.body.password || "";
  const ownerPass = req.body.ownerPassword || userPass + "_owner";

  if (!userPass) return res.status(400).json({ error: "password is required" });

  const tmp = await makeTmpDir();

  try {
    const outPath = path.join(tmp, "protected.pdf");

    await run("qpdf", [
      "--encrypt", userPass, ownerPass, "256",
      "--",
      req.file.path,
      outPath,
    ]);

    const baseName = path.basename(req.file.originalname, ".pdf");
    res.download(outPath, `${baseName}-protected.pdf`, async () => {
      await cleanTmpDir(tmp);
      await unlink(req.file.path).catch(() => {});
    });
  } catch (err) {
    await cleanTmpDir(tmp);
    await unlink(req.file.path).catch(() => {});
    console.error("protect error:", err.message);
    res.status(500).json({ error: "Protection failed", detail: err.message });
  }
});

// POST /api/protect/unlock  — body: file, password
router.post("/unlock", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const password = req.body.password || "";

  const tmp = await makeTmpDir();

  try {
    const outPath = path.join(tmp, "unlocked.pdf");
    const args = ["--decrypt"];
    if (password) args.push(`--password=${password}`);
    args.push("--", req.file.path, outPath);

    await run("qpdf", args);

    const baseName = path.basename(req.file.originalname, ".pdf");
    res.download(outPath, `${baseName}-unlocked.pdf`, async () => {
      await cleanTmpDir(tmp);
      await unlink(req.file.path).catch(() => {});
    });
  } catch (err) {
    await cleanTmpDir(tmp);
    await unlink(req.file.path).catch(() => {});
    const isWrongPass = err.message.includes("invalid password");
    const status = isWrongPass ? 422 : 500;
    res.status(status).json({
      error: isWrongPass ? "Invalid password" : "Unlock failed",
      detail: err.message,
    });
  }
});

module.exports = router;
