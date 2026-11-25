import { mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDirectory = "io.github.tufacker.timebox.sdPlugin";
const output = join(projectRoot, "dist", "StreamDeck-Timebox.streamDeckPlugin");

mkdirSync(dirname(output), { recursive: true });
rmSync(output, { force: true });

const result = spawnSync("/usr/bin/zip", ["-X", "-q", "-r", output, pluginDirectory, "-x", "*.DS_Store"], {
  cwd: projectRoot,
  encoding: "utf8"
});

if (result.status !== 0) {
  throw new Error(result.stderr || "Plugin archive build failed");
}

console.log(`Built ${output}`);
