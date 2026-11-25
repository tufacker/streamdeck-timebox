import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import path from "node:path";
import url from "node:url";

const isWatching = Boolean(process.env.ROLLUP_WATCH);
const pluginDirectory = "io.github.tufacker.timebox.sdPlugin";

export default {
  input: "src/plugin.ts",
  output: {
    file: `${pluginDirectory}/bin/plugin.js`,
    sourcemap: isWatching,
    sourcemapPathTransform: (relativeSourcePath, sourcemapPath) =>
      url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href
  },
  plugins: [
    {
      name: "watch-static-assets",
      buildStart() {
        this.addWatchFile(`${pluginDirectory}/manifest.json`);
        this.addWatchFile(`${pluginDirectory}/layouts/dial.json`);
      }
    },
    typescript({ mapRoot: isWatching ? "./" : undefined }),
    nodeResolve({ browser: false, exportConditions: ["node"], preferBuiltins: true }),
    commonjs(),
    {
      name: "emit-module-package-file",
      generateBundle() {
        this.emitFile({ fileName: "package.json", source: "{ \"type\": \"module\" }", type: "asset" });
      }
    }
  ]
};
