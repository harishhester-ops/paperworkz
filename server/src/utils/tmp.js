const { mkdtemp, rm } = require("fs/promises");
const path = require("path");
const os = require("os");

/** Create a fresh temp directory under /tmp/work and return its path. */
async function makeTmpDir() {
  return mkdtemp(path.join(os.tmpdir(), "pw-"));
}

/** Remove a temp directory and all its contents (best-effort). */
async function cleanTmpDir(dir) {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

module.exports = { makeTmpDir, cleanTmpDir };
