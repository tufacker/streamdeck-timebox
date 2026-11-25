// Draws README images of each supported model mid-block, using the plugin's
// own key and timeline drawing and the example timers (no personal settings).
//   node scripts/build-screenshots.mjs   ->   docs/images/<model>.png
import "../test/ts-resolve.mjs";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const { configForModel } = await import("../src/config.ts");
const { MODELS } = await import("../src/models.ts");
const { DIAL_SLICE, KEY_SLICE, presetKeyImage, timelineSlice, timerKeyImage } = await import("../src/render.ts");

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(projectRoot, "docs", "images");
mkdirSync(output, { recursive: true });

const MINUTE = 60_000;
const KEY = 144;
const GAP = 24;
const MARGIN = 48;

// Timer 1 selected, block 2 running with a third of it used.
function stateFor(config) {
  const block = config.blocks[1];
  return {
    settings: {}, timerIndex: 0, sessionTypes: ["Focus"], sessionTypeIndex: 0,
    plannedMinutes: block.minutes, blockSlot: 1, billable: true, running: true, paused: false,
    startedAt: 1, pausedStartedAt: null, pausedAccumulatedMs: 0,
    elapsedMs: Math.round(block.minutes / 3) * MINUTE, markerCount: 0, lastLoggedPath: ""
  };
}

const image = (href, x, y, width, height) => `<image href="${href}" x="${x}" y="${y}" width="${width}" height="${height}"/>`;

for (const model of MODELS) {
  const config = configForModel({}, model);
  const state = stateFor(config);
  const accent = config.timers[0].accent;
  const parts = [];
  const rowWidth = model.columns * KEY + (model.columns - 1) * GAP;
  let y = MARGIN;
  const keyRow = (render) => {
    for (let column = 0; column < model.columns; column += 1) parts.push(image(render(column), MARGIN + column * (KEY + GAP), y, KEY, KEY));
    y += KEY + GAP;
  };
  keyRow((column) => {
    const timer = config.timers[column];
    return timerKeyImage(timer.name, column === 0, timer.color, timer.accent, column !== 0);
  });
  keyRow((column) => presetKeyImage(config.blocks[column].label, config.blocks[column].minutes, state, column));
  if (model.timeline === "keys") {
    keyRow((column) => timelineSlice(state, accent, column, model.columns, KEY_SLICE));
  } else {
    const height = rowWidth / (DIAL_SLICE.width * model.encoders) * DIAL_SLICE.height;
    const width = rowWidth / model.encoders;
    for (let index = 0; index < model.encoders; index += 1) {
      parts.push(image(timelineSlice(state, accent, index, model.encoders, DIAL_SLICE), MARGIN + index * width, y, width, height));
    }
    y += height + GAP;
    const radius = 46;
    for (let index = 0; index < model.encoders; index += 1) {
      const cx = MARGIN + width * index + width / 2;
      parts.push(`<circle cx="${cx}" cy="${y + radius}" r="${radius}" fill="#1c232b" stroke="#2f3a45" stroke-width="4"/>`);
      parts.push(`<rect x="${cx - 3}" y="${y + 14}" width="6" height="22" rx="3" fill="#5b6b7a"/>`);
    }
    y += radius * 2 + GAP;
  }
  const width = rowWidth + MARGIN * 2;
  const height = y - GAP + MARGIN;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="36" fill="#0d1116"/>
  ${parts.join("\n  ")}
</svg>`;
  const file = join(output, `${model.id}.png`);
  await sharp(Buffer.from(svg)).png().toFile(file);
  console.log(`Built ${file}`);
}
