// The supported models, the manifest, and how keys find their device's settings.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { placeOf, selectedAccent, timelinePress, timerAt } from "../src/actions/place.ts";
import { normalizeSettings } from "../src/config.ts";
import {
  blockActionUuid, DIAL_ACTION_UUIDS, MAX_SLOTS, MODELS, modelForDeviceType, TIMELINE_ACTION_UUID, timerActionUuid
} from "../src/models.ts";
import { TimeboxStore } from "../src/state.ts";

const manifest = JSON.parse(readFileSync(new URL("../io.github.tufacker.timebox.sdPlugin/manifest.json", import.meta.url), "utf8"));
const manifestUuids = new Set(manifest.Actions.map((a: { UUID: string }) => a.UUID));

test("the manifest has every key action a model can need", () => {
  for (let index = 0; index < MAX_SLOTS; index += 1) {
    assert.ok(manifestUuids.has(timerActionUuid(index)), `timer ${index + 1}`);
    assert.ok(manifestUuids.has(blockActionUuid(index)), `block ${index + 1}`);
  }
  assert.ok(manifestUuids.has(TIMELINE_ACTION_UUID));
  for (const uuid of DIAL_ACTION_UUIDS) assert.ok(manifestUuids.has(uuid), uuid);
});

test("action UUIDs live under the plugin's ID and follow the key's column", () => {
  assert.equal(manifest.UUID, "io.github.tufacker.timebox");
  assert.deepEqual([0, 1, 7].map(timerActionUuid), [1, 2, 8].map((n) => `io.github.tufacker.timebox.timer-${n}`));
  assert.deepEqual([0, 1, 7].map(blockActionUuid), [1, 2, 8].map((n) => `io.github.tufacker.timebox.block-${n}`));
  for (const action of manifest.Actions) assert.ok(action.UUID.startsWith(`${manifest.UUID}.`), action.UUID);
});

test("every model has a profile in the manifest, an example block per column, and fits the slots", () => {
  for (const model of MODELS) {
    assert.ok(manifest.Profiles.some((p: { Name: string; DeviceType: number }) =>
      p.Name.toLowerCase() === model.profile.file.toLowerCase() && p.DeviceType === model.deviceType), model.name);
    assert.equal(model.exampleBlocks.length, model.columns, `${model.name} example blocks`);
    assert.ok(model.columns <= MAX_SLOTS);
    assert.equal(modelForDeviceType(model.deviceType), model);
  }
  assert.equal(new Set(MODELS.map((m) => m.id)).size, MODELS.length, "model ids are unique");
  assert.equal(new Set(MODELS.map((m) => m.deviceType)).size, MODELS.length, "one model per device type");
});

const device = (type: number, columns: number) => ({ type, size: { columns } });

test("keys draw from their own device's settings", () => {
  const store = new TimeboxStore(normalizeSettings({
    "stream-deck-plus": { timers: [{ name: "Writing", accent: "#111111" }] },
    "stream-deck-mk2": { timers: [{ name: "Calls", accent: "#222222" }] }
  }));
  const state = store.current;
  const plusKey = placeOf({ device: device(7, 4), coordinates: { column: 0, row: 0 } }, state);
  const mk2Key = placeOf({ device: device(0, 5), coordinates: { column: 4, row: 2 } }, state);
  assert.equal(timerAt(plusKey, 0).name, "Writing");
  assert.equal(timerAt(mk2Key, 0).name, "Calls");
  assert.equal(selectedAccent(plusKey, state), "#111111");
  assert.equal(selectedAccent(mk2Key, state), "#222222");
  assert.deepEqual([mk2Key.column, mk2Key.columns], [4, 5]);
  assert.equal(timerAt(plusKey, 6).name, "Learning", "a position beyond the device's row shows the example");
});

test("timeline keys: leftmost less, rightmost more, middle of an odd row resets", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((c) => timelinePress(c, 5)), ["less", undefined, "reset", undefined, "more"]);
  assert.deepEqual([0, 1, 2, 3].map((c) => timelinePress(c, 4)), ["less", undefined, undefined, "more"]);
  assert.equal(timelinePress(0, 1), "reset");
});
