import sharp from "sharp";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const iconRoot = resolve(projectRoot, "com.tuf.streamdeck-timebox.sdPlugin/imgs/plugin");
const source = resolve(iconRoot, "marketplace-source.svg");

await Promise.all([
  sharp(source).resize(256, 256).png().toFile(resolve(iconRoot, "marketplace.png")),
  sharp(source).resize(512, 512).png().toFile(resolve(iconRoot, "marketplace@2x.png"))
]);

console.log("Built Stream Deck plugin icons");
