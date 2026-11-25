// Timer behaviour, with time under the test's control (node:test mock timers).
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { TimeboxStore } from "../src/state.ts";

const MINUTE = 60_000;
let store: TimeboxStore;

beforeEach(() => {
  mock.timers.enable({ apis: ["Date", "setInterval"], now: 1_000_000 });
  store = new TimeboxStore();
});
afterEach(() => {
  store.reset();
  mock.timers.reset();
});

const later = (ms: number) => mock.timers.tick(ms);

test("starts idle", () => {
  const state = store.current;
  assert.equal(state.running, false);
  assert.equal(state.paused, false);
  assert.equal(state.startedAt, null);
  assert.equal(state.elapsedMs, 0);
});

test("a time key starts that block at once", () => {
  store.triggerPreset(15);
  later(2 * MINUTE);
  const state = store.current;
  assert.equal(state.plannedMinutes, 15);
  assert.equal(state.running, true);
  assert.equal(state.elapsedMs, 2 * MINUTE);
});

test("pressing the active time key pauses, and again resumes without counting the pause", () => {
  store.triggerPreset(30);
  later(5 * MINUTE);
  store.triggerPreset(30);
  assert.equal(store.current.paused, true);
  later(10 * MINUTE);
  assert.equal(store.current.elapsedMs, 5 * MINUTE, "paused time does not count");
  store.triggerPreset(30);
  later(MINUTE);
  const state = store.current;
  assert.equal(state.running, true);
  assert.equal(state.elapsedMs, 6 * MINUTE);
});

test("a different time key restarts with the new length", () => {
  store.triggerPreset(15);
  later(4 * MINUTE);
  store.triggerPreset(60);
  const state = store.current;
  assert.equal(state.plannedMinutes, 60);
  assert.equal(state.running, true);
  assert.equal(state.elapsedMs, 0);
});

test("the timer keeps counting past the planned time (overtime)", () => {
  store.triggerPreset(15);
  later(17 * MINUTE);
  assert.equal(store.current.elapsedMs, 17 * MINUTE);
  assert.equal(store.current.running, true);
});

test("dial 1 scrubs a minute per tick inside the block, clamped to the block", () => {
  store.triggerPreset(15);
  later(5 * MINUTE);
  store.scrubRemainingMinutes(2);   // clockwise: more time left
  assert.equal(store.current.elapsedMs, 3 * MINUTE);
  store.scrubRemainingMinutes(-4);  // counterclockwise: less time left
  assert.equal(store.current.elapsedMs, 7 * MINUTE);
  store.scrubRemainingMinutes(50);
  assert.equal(store.current.elapsedMs, 0);
  store.scrubRemainingMinutes(-50);
  assert.equal(store.current.elapsedMs, 15 * MINUTE);
  assert.equal(store.current.plannedMinutes, 15, "scrubbing never changes the block length");
});

test("scrubbing keeps working after the scrub, while running and while paused", () => {
  store.triggerPreset(30);
  later(10 * MINUTE);
  store.scrubRemainingMinutes(5);
  later(MINUTE);
  assert.equal(store.current.elapsedMs, 6 * MINUTE);
  store.triggerPreset(30);           // pause
  store.scrubRemainingMinutes(-2);
  assert.equal(store.current.elapsedMs, 8 * MINUTE);
  later(3 * MINUTE);
  assert.equal(store.current.elapsedMs, 8 * MINUTE, "still paused");
  store.triggerPreset(30);           // resume
  later(MINUTE);
  assert.equal(store.current.elapsedMs, 9 * MINUTE);
});

test("scrubbing does nothing when idle", () => {
  store.scrubRemainingMinutes(3);
  assert.equal(store.current.elapsedMs, 0);
  assert.equal(store.current.startedAt, null);
});

test("reset returns to idle", () => {
  store.triggerPreset(15);
  later(MINUTE);
  store.reset();
  const state = store.current;
  assert.equal(state.running, false);
  assert.equal(state.paused, false);
  assert.equal(state.startedAt, null);
  assert.equal(state.elapsedMs, 0);
  assert.equal(state.plannedMinutes, 15, "the last block stays selected");
});

test("a timer key selects that timer without starting it", () => {
  store.selectTimer(2);
  assert.equal(store.current.timerIndex, 2);
  assert.equal(store.current.running, false);
  store.selectTimer(4);
  assert.equal(store.current.timerIndex, 4, "the fifth timer, on wider decks");
});

test("listeners hear every change and a tick each second while running", () => {
  let calls = 0;
  store.subscribe(() => { calls += 1; });
  store.triggerPreset(15);
  const afterStart = calls;
  assert.ok(afterStart >= 1);
  later(3000);
  assert.equal(calls, afterStart + 3);
  store.triggerPreset(15); // pause stops the ticks
  const afterPause = calls;
  later(3000);
  assert.equal(calls, afterPause);
});

test("new settings apply without stopping the timer", () => {
  store.triggerPreset(50);
  later(MINUTE);
  store.setSettings({ "stream-deck-plus": { timers: [{ name: "Email" }] } });
  assert.equal(store.current.settings["stream-deck-plus"].timers !== undefined, true);
  assert.equal(store.current.running, true);
  assert.equal(store.current.elapsedMs, MINUTE);
});

test("blocks up to eight hours can start", () => {
  store.triggerPreset(480);
  assert.equal(store.current.plannedMinutes, 480);
  store.triggerPreset(600);
  assert.equal(store.current.plannedMinutes, 480, "longer is capped");
});

test("two block keys with the same length are separate keys", () => {
  store.triggerPreset(30, 0);
  later(MINUTE);
  store.triggerPreset(30, 1); // the other 30-minute key starts afresh
  assert.equal(store.current.running, true);
  assert.equal(store.current.elapsedMs, 0);
  assert.equal(store.current.blockSlot, 1);
  store.triggerPreset(30, 1); // the same key pauses
  assert.equal(store.current.paused, true);
});

test("scrubbing in overtime moves the overtime instead of snapping back to the block's end", () => {
  store.triggerPreset(15);
  later(19 * MINUTE);
  store.scrubRemainingMinutes(-1);
  assert.equal(store.current.elapsedMs, 20 * MINUTE, "a minute less: one more minute over");
  store.scrubRemainingMinutes(2);
  assert.equal(store.current.elapsedMs, 18 * MINUTE);
  store.scrubRemainingMinutes(10);
  assert.equal(store.current.elapsedMs, 8 * MINUTE, "back inside the block");
});
