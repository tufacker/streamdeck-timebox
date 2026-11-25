// What the keys and the touch strip show for a given timer state.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  blankSlice,
  DIAL_SLICE,
  KEY_SLICE,
  overtimeText,
  presetKeyImage,
  remainingText,
  timelineSlice,
  timerKeyImage
} from "../src/render.ts";
import type { TimeboxState } from "../src/state.ts";

const MINUTE = 60_000;

function state(overrides: Partial<TimeboxState> = {}): TimeboxState {
  return {
    settings: {},
    timerIndex: 0,
    sessionTypes: ["Focus"],
    sessionTypeIndex: 0,
    plannedMinutes: 15,
    blockSlot: null,
    billable: true,
    running: false,
    paused: false,
    startedAt: null,
    pausedStartedAt: null,
    pausedAccumulatedMs: 0,
    elapsedMs: 0,
    markerCount: 0,
    lastLoggedPath: "",
    ...overrides
  };
}

const svg = (dataUrl: string) => decodeURIComponent(dataUrl.replace(/^data:image\/svg\+xml;charset=utf8,/, ""));

test("remaining time counts down in mm:ss, rounding up", () => {
  assert.equal(remainingText(state({ elapsedMs: 0 })), "15:00");
  assert.equal(remainingText(state({ elapsedMs: 61_500 })), "13:59");
  assert.equal(remainingText(state({ elapsedMs: 20 * MINUTE })), "00:00");
});

test("overtime counts up after the block", () => {
  assert.equal(overtimeText(state({ elapsedMs: 15 * MINUTE + 75_000 })), "+01:15");
});

test("the active time key shows the countdown, then overtime", () => {
  const running = state({ running: true, startedAt: 1, elapsedMs: 5 * MINUTE });
  assert.match(svg(presetKeyImage("15M", 15, running)), />10:00</);
  const overtime = state({ running: true, startedAt: 1, elapsedMs: 16 * MINUTE });
  assert.match(svg(presetKeyImage("15M", 15, overtime)), />\+01:00</);
  assert.doesNotMatch(svg(presetKeyImage("30M", 30, running)), />10:00</, "other keys show no countdown");
});

test("timer keys show the name in capitals, up to eight letters", () => {
  assert.match(svg(timerKeyImage("Alphabetical", true, "#112233")), />ALPHABET</);
});

const ACCENT = "#445566";

test("the strip's remaining slab shrinks as time passes, in the timer's accent", () => {
  const half = svg(timelineSlice(state({ running: true, startedAt: 1, elapsedMs: 7.5 * MINUTE }), ACCENT, 0, 4, DIAL_SLICE));
  assert.match(half, /<rect x="0" y="0" width="400" height="100" fill="#445566"/);
  const full = svg(timelineSlice(state({ running: true, startedAt: 1, elapsedMs: 0 }), ACCENT, 0, 4, DIAL_SLICE));
  assert.match(full, /width="800" height="100" fill="#445566"/);
});

test("each dial shows its quarter of one 800-wide strip", () => {
  const s = state({ running: true, startedAt: 1, elapsedMs: MINUTE });
  for (let index = 0; index < 4; index += 1) {
    assert.match(svg(timelineSlice(s, ACCENT, index, 4, DIAL_SLICE)), new RegExp(`viewBox="${index * 200} 0 200 100"`));
  }
});

test("a row of keys shows its fifths of one 720-wide bar", () => {
  const s = state({ running: true, startedAt: 1, elapsedMs: 3 * MINUTE });
  for (let index = 0; index < 5; index += 1) {
    assert.match(svg(timelineSlice(s, ACCENT, index, 5, KEY_SLICE)), new RegExp(`viewBox="${index * 144} 0 144 144"`));
  }
  assert.match(svg(timelineSlice(s, ACCENT, 0, 5, KEY_SLICE)), /width="576" height="144" fill="#445566"/, "12 of 15 minutes left");
});

test("the pause mark sits in the middle of the bar, as in v1 on both decks", () => {
  const paused = state({ paused: true, startedAt: 1, elapsedMs: MINUTE });
  const strip = svg(timelineSlice(paused, ACCENT, 1, 4, DIAL_SLICE));
  assert.match(strip, /<rect x="371" y="24" width="20" height="52"/);
  assert.match(strip, /<rect x="409" y="24" width="20" height="52"/);
  const keys = svg(timelineSlice(paused, ACCENT, 2, 5, KEY_SLICE));
  assert.match(keys, /<rect x="334" y="37" width="18" height="70"/);
  assert.match(keys, /<rect x="368" y="37" width="18" height="70"/);
});

test("idle slices are blank black", () => {
  assert.match(svg(blankSlice(DIAL_SLICE)), /width="200" height="100" fill="#000000"/);
  assert.match(svg(blankSlice(KEY_SLICE)), /width="144" height="144" fill="#000000"/);
});

test("with a key position, only the key that started the block is selected", () => {
  const running = state({ running: true, startedAt: 1, elapsedMs: MINUTE, plannedMinutes: 30, blockSlot: 1 });
  assert.match(svg(presetKeyImage("30M", 30, running, 1)), />29:00</);
  assert.doesNotMatch(svg(presetKeyImage("Email", 30, running, 0)), />29:00</, "another 30-minute key stays unselected");
});

test("before any block has started, no block key looks selected", () => {
  const idle = state({ plannedMinutes: 25, blockSlot: null });
  assert.match(svg(presetKeyImage("25M", 25, idle, 0)), /fill="#1b2833"/, "the normal, unselected key colour");
});

test("long names and labels are cut by character, keeping emoji whole", () => {
  assert.match(svg(timerKeyImage("Focus🔥🔥🔥🔥", true, "#112233")), />FOCUS🔥🔥🔥</);
});
