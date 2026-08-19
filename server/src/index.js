const express = require("express");
const app = express();

// ── CORS — must come before all routes and body parsers ───────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Parse raw HTML bodies for the html-to-pdf text input path
app.use(express.text({ type: "text/html", limit: "10mb" }));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/compress", require("./routes/compress"));
app.use("/api/grayscale", require("./routes/grayscale"));
app.use("/api/repair", require("./routes/repair"));
app.use("/api/protect", require("./routes/protect"));
app.use("/api/extract-images", require("./routes/extract-images"));
app.use("/api/ocr", require("./routes/ocr"));
app.use("/api/convert", require("./routes/convert"));
app.use("/api/to-pdf", require("./routes/to-pdf"));
app.use("/api/deskew", require("./routes/deskew"));

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "paperworkz-server",
    version: "1.0.0",
    endpoints: [
      "POST /api/compress           — PDF compression (screen|ebook|printer|prepress)",
      "POST /api/grayscale          — Convert PDF to grayscale",
      "POST /api/repair             — Repair corrupted PDF",
      "POST /api/protect/protect    — Password-protect a PDF (AES-256)",
      "POST /api/protect/unlock     — Remove PDF password",
      "POST /api/extract-images     — Extract all embedded images → ZIP",
      "POST /api/ocr                — OCR scanned PDF → searchable PDF",
      "POST /api/convert/word       — PDF → DOCX",
      "POST /api/convert/excel      — PDF → XLSX",
      "POST /api/convert/ppt        — PDF → PPTX",
      "POST /api/convert/text       — PDF → TXT",
      "POST /api/to-pdf             — Office document → PDF (docx/xlsx/pptx/odt/...)",
      "POST /api/to-pdf/html        — HTML → PDF",
      "POST /api/deskew             — Deskew scanned PDF pages",
    ],
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large (max 200 MB)" });
  }
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`PaperWorkz server listening on port ${PORT}`);
});
