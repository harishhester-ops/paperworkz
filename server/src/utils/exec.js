const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

/**
 * Run a shell command with a configurable timeout.
 * Returns { stdout, stderr }.
 */
async function run(cmd, args = [], timeoutMs = 120_000) {
  return execFileAsync(cmd, args, {
    maxBuffer: 50 * 1024 * 1024, // 50 MB
    timeout: timeoutMs,
  });
}

module.exports = { run };
