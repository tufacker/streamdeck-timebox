// The settings file: per model, the timers (top row) and blocks (second row).
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  blockLabel, configForDevice, configForModel, EXAMPLE_TIMERS, exampleBlock, loadSettings, normalizeSettings,
  resolveModelSettings, saveModelSettings, truncate
} from "../src/config.ts";
import { MODELS } from "../src/models.ts";

const folder = mkdtempSync(join(tmpdir(), "timebox-config-"));
const file = (name: string, content: unknown) => {
  const path = join(folder, name);
  writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content));
  return path;
};
const [plus, mk2] = MODELS;
const minutes = (config: { blocks: { minutes: number }[] }) => config.blocks.map((b) => b.minutes);

test("each model shows one timer and one block per column, with its own examples", () => {
  const plusConfig = configForModel({}, plus);
  assert.deepEqual(plusConfig.timers.map((t) => t.name), ["Focus", "Admin", "Meeting", "Break"]);
  assert.deepEqual(plusConfig.blocks.map((b) => b.label), ["15M", "30M", "1H", "2H"]);
  const mk2Config = configForModel({}, mk2);
  assert.deepEqual(mk2Config.timers.map((t) => t.name), ["Focus", "Admin", "Meeting", "Break", "Email"]);
  assert.deepEqual(minutes(mk2Config), [15, 30, 45, 60, 120]);
});

test("each model reads its own section of the settings", () => {
  const settings = normalizeSettings({
    "stream-deck-plus": { timers: [{ name: "Writing" }], blocks: [25] },
    "stream-deck-mk2": { timers: [{ name: "Calls" }, { name: "Email" }], blocks: [10, 20, 30, 40, 50] }
  });
  assert.equal(configForModel(settings, plus).timers[0].name, "Writing");
  assert.deepEqual(minutes(configForModel(settings, plus)), [25, 30, 60, 120]);
  assert.deepEqual(configForModel(settings, mk2).timers.slice(0, 2).map((t) => t.name), ["Calls", "Email"]);
  assert.deepEqual(minutes(configForModel(settings, mk2)), [10, 20, 30, 40, 50]);
});

test("a settings file from before models is the Stream Deck + section", () => {
  const settings = normalizeSettings({ timers: [{ name: "Writing" }], blocks: [15, 30, 60, 120] });
  assert.deepEqual(Object.keys(settings), ["stream-deck-plus"]);
  assert.equal(configForModel(settings, plus).timers[0].name, "Writing");
  assert.equal(configForModel(settings, mk2).timers[0].name, "Focus", "other models keep their examples");
});

test("missing or unusable entries keep that key's example", () => {
  const { timers, blocks } = resolveModelSettings(
    { timers: [{ name: "Deep Work" }, { color: "#000000" }, { name: "Calls", color: "red", accent: "#abcdef" }], blocks: [0, 481, "ten", { minutes: 12.6 }] },
    4, [15, 30, 60, 120]
  );
  assert.deepEqual(timers[0], { id: "deep-work", name: "Deep Work", color: EXAMPLE_TIMERS[0].color, accent: EXAMPLE_TIMERS[0].accent });
  assert.deepEqual(timers[1], EXAMPLE_TIMERS[1], "no name: example kept");
  assert.equal(timers[2].color, EXAMPLE_TIMERS[2].color, "bad colour falls back");
  assert.equal(timers[2].accent, "#abcdef");
  assert.deepEqual(blocks.map((b) => b.minutes), [15, 30, 60, 13], "out of range keeps the example; 12.6 rounds to 13");
});

test("blocks get labels worked out, or carry a custom one cut to fit", () => {
  const { blocks } = resolveModelSettings({ blocks: [5, 90, { minutes: 50, label: "Pomo" }, { minutes: 10, label: "Very long label" }] }, 4, [15, 30, 60, 120]);
  assert.deepEqual(blocks.map((b) => b.label), ["5M", "90M", "Pomo", "Very l"]);
  assert.equal(blockLabel(180), "3H");
});

test("more entries than columns: the first ones are used", () => {
  const config = resolveModelSettings({ timers: Array.from({ length: 6 }, (_, i) => ({ name: `T${i + 1}` })), blocks: [1, 2, 3, 4, 5, 6] }, 4, [15, 30, 60, 120]);
  assert.deepEqual(config.timers.map((t) => t.name), ["T1", "T2", "T3", "T4"]);
  assert.deepEqual(minutes(config), [1, 2, 3, 4]);
});

test("a device without a model entry gets examples sized to its row", () => {
  const mini = configForDevice({}, 1, 3);
  assert.equal(mini.timers.length, 3);
  assert.deepEqual(minutes(mini), [15, 30, 60]);
  const xl = configForDevice({}, 2, 8);
  assert.equal(xl.timers.length, 8);
  assert.equal(new Set(minutes(xl)).size, 8, "eight different blocks");
});

test("configForDevice picks the model by device type and caches per settings", () => {
  const settings = normalizeSettings({ "stream-deck-mk2": { timers: [{ name: "Calls" }] } });
  const a = configForDevice(settings, 0, 5);
  assert.equal(a.timers[0].name, "Calls");
  assert.equal(configForDevice(settings, 0, 5), a, "same object while the settings are unchanged");
  assert.equal(configForDevice(settings, 7, 4).timers[0].name, "Focus");
});

test("no file: no settings, every model on its examples; a broken file says why", () => {
  assert.deepEqual(loadSettings(join(folder, "missing.json")), { settings: {} });
  const broken = loadSettings(file("broken.json", "{ timers: ["));
  assert.deepEqual(broken.settings, {});
  assert.match(broken.problem ?? "", /not valid JSON/);
});

test("saving one model keeps the others and rewrites an old file in the new form", () => {
  const path = file("timebox.json", { timers: [{ name: "Writing" }], blocks: [15, 30, 60, 120] });
  const { settings, config } = saveModelSettings(mk2,
    { timers: [{ name: "Calls", color: "#112233", accent: "#445566" }], blocks: [15, 30, { minutes: 45, label: "Pomo" }, 60, 120] }, path);
  const written = JSON.parse(readFileSync(path, "utf8"));
  assert.deepEqual(Object.keys(written), ["stream-deck-plus", "stream-deck-mk2"]);
  assert.equal(written["stream-deck-plus"].timers[0].name, "Writing", "the Stream Deck + section is kept");
  assert.equal(written["stream-deck-mk2"].timers.length, 5, "the MK.2 section is complete");
  assert.deepEqual(written["stream-deck-mk2"].blocks, [15, 30, { minutes: 45, label: "Pomo" }, 60, 120], "plain minutes unless the label is custom");
  assert.deepEqual(configForModel(loadSettings(path).settings, mk2), config);
  assert.deepEqual(configForModel(settings, mk2), config);
});

test("saving keeps hand edits made to the file since the plugin started", () => {
  const path = file("edited.json", { "stream-deck-plus": { timers: [{ name: "Old" }] } });
  writeFileSync(path, JSON.stringify({ "stream-deck-plus": { timers: [{ name: "Old" }] }, "stream-deck-mk2": { timers: [{ name: "Hand-edited" }] } }));
  saveModelSettings(plus, { timers: [{ name: "New" }] }, path);
  const written = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(written["stream-deck-mk2"].timers[0].name, "Hand-edited");
  assert.equal(written["stream-deck-plus"].timers[0].name, "New");
});

test("saving refuses to replace a settings file that isn't valid JSON", () => {
  const path = file("broken-save.json", "{ \"stream-deck-plus\": { \"timers\": [ ,");
  assert.throws(() => saveModelSettings(plus, { timers: [{ name: "New" }] }, path), /not valid JSON.*Fix or remove it/);
  assert.equal(readFileSync(path, "utf8"), "{ \"stream-deck-plus\": { \"timers\": [ ,", "the broken file is untouched");
});

test("custom labels are cut by character, keeping emoji whole", () => {
  assert.equal(truncate("Deep🔥🔥🔥", 6), "Deep🔥🔥");
  const { blocks } = resolveModelSettings({ blocks: [{ minutes: 20, label: "Write🔥!" }] }, 4, [15, 30, 60, 120]);
  assert.equal(blocks[0].label, "Write🔥");
});

test("a block key beyond its device's row shows that position's example", () => {
  assert.deepEqual(exampleBlock(4), { minutes: 45, label: "45M" });
  assert.deepEqual(exampleBlock(0), { minutes: 15, label: "15M" });
});
