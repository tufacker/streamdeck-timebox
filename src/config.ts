import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { MAX_SLOTS, modelForDeviceType, type Model } from "./models.js";

/** A timer on the top row: what it's for and its colours. */
export type TimerSlot = {
  id: string;
  name: string;
  color: string;
  accent: string;
};

/** A time-block key on the second row. */
export type Block = {
  minutes: number;
  label: string;
};

/** What one Stream Deck shows: one timer and one block per column. */
export type TimeboxConfig = {
  timers: TimerSlot[];
  blocks: Block[];
};

/** One model's part of the settings file, as written: `{ timers: [...], blocks: [...] }`. */
export type ModelSettings = { timers?: unknown; blocks?: unknown };
/** The settings file: one section per model id (see models.ts). */
export type Settings = Record<string, ModelSettings>;

/** Longest block a key can start. */
export const MAX_BLOCK_MINUTES = 480;
/** Longest label that fits on a key. */
const MAX_LABEL_LENGTH = 6;

/** `15` -> "15M", `60` -> "1H", `90` -> "90M". */
export function blockLabel(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}H` : `${minutes}M`;
}

/** Example timers, left to right; a model uses as many as it has columns. */
export const EXAMPLE_TIMERS: TimerSlot[] = [
  { id: "focus", name: "Focus", color: "#7a5a10", accent: "#d6a820" },
  { id: "admin", name: "Admin", color: "#6c315f", accent: "#d96ccf" },
  { id: "meeting", name: "Meeting", color: "#7a3828", accent: "#e27653" },
  { id: "break", name: "Break", color: "#2f7534", accent: "#56d35a" },
  { id: "email", name: "Email", color: "#155a7a", accent: "#35b9ff" },
  { id: "calls", name: "Calls", color: "#4b3f86", accent: "#a18cff" },
  { id: "learning", name: "Learning", color: "#1f6b63", accent: "#3fd8c5" },
  { id: "exercise", name: "Exercise", color: "#8a2a3a", accent: "#ff6b81" }
];

/** Example blocks for a device Timebox has no model entry for: the first one per column. */
const GENERIC_BLOCKS = [15, 30, 60, 120, 45, 90, 10, 240];
function genericBlocks(count: number): number[] {
  return GENERIC_BLOCKS.slice(0, count);
}

/** Where the user's settings live: next to the session log. */
export function configFilePath(): string {
  return process.env.TIMEBOX_CONFIG_FILE ?? join(homedir(), "Documents", "StreamDeck Timebox", "timebox.json");
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function readTimer(entry: unknown, example: TimerSlot): TimerSlot {
  const value = entry as Partial<TimerSlot> | undefined;
  if (!value || typeof value.name !== "string" || !value.name.trim()) return example;
  const name = value.name.trim();
  const color = typeof value.color === "string" && HEX_COLOR.test(value.color) ? value.color : example.color;
  const accent = typeof value.accent === "string" && HEX_COLOR.test(value.accent) ? value.accent : example.accent;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : slug || example.id;
  return { id, name, color, accent };
}

function readBlock(entry: unknown, exampleMinutes: number): Block {
  const value = typeof entry === "number" ? { minutes: entry } : (entry as Partial<Block> | undefined);
  const minutes = Math.round(Number(value?.minutes));
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > MAX_BLOCK_MINUTES) {
    return { minutes: exampleMinutes, label: blockLabel(exampleMinutes) };
  }
  const label = typeof value?.label === "string" && value.label.trim()
    ? truncate(value.label.trim(), MAX_LABEL_LENGTH)
    : blockLabel(minutes);
  return { minutes, label };
}

/**
 * Turns one model's settings into exactly `count` timers and blocks, left to
 * right. Anything missing or unusable keeps that key's example.
 */
export function resolveModelSettings(section: unknown, count: number, exampleBlocks: number[]): TimeboxConfig {
  const source = (section ?? {}) as ModelSettings;
  const timers = Array.isArray(source.timers) ? source.timers : [];
  const blocks = Array.isArray(source.blocks) ? source.blocks : [];
  const slots = Math.max(1, Math.min(MAX_SLOTS, count));
  return {
    timers: EXAMPLE_TIMERS.slice(0, slots).map((example, index) => readTimer(timers[index], example)),
    blocks: Array.from({ length: slots }, (_, index) => readBlock(blocks[index], exampleBlocks[index] ?? GENERIC_BLOCKS[index]))
  };
}

/** A model's config: its section of the settings, sized to its columns. */
export function configForModel(settings: Settings, model: Model): TimeboxConfig {
  return resolveModelSettings(settings[model.id], model.columns, model.exampleBlocks);
}

const resolved = new WeakMap<Settings, Map<string, TimeboxConfig>>();

/**
 * The config for a connected device: its model's settings, or examples sized
 * to its row for a device Timebox has no model entry for. Cached per settings.
 */
export function configForDevice(settings: Settings, deviceType: number | undefined, columns: number): TimeboxConfig {
  let cache = resolved.get(settings);
  if (!cache) resolved.set(settings, (cache = new Map()));
  const key = `${deviceType}:${columns}`;
  let config = cache.get(key);
  if (!config) {
    const model = modelForDeviceType(deviceType);
    config = model ? configForModel(settings, model) : resolveModelSettings(undefined, columns, genericBlocks(columns));
    cache.set(key, config);
  }
  return config;
}

/**
 * Accepts the settings file's contents. A file from before models existed
 * (`{ timers, blocks }` at the top level) is read as the Stream Deck + section,
 * the only model Timebox supported then.
 */
export function normalizeSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const settings: Settings = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "timers" || key === "blocks") continue;
    if (value && typeof value === "object" && !Array.isArray(value)) settings[key] = value as ModelSettings;
  }
  if ((Array.isArray(source.timers) || Array.isArray(source.blocks)) && !settings["stream-deck-plus"]) {
    settings["stream-deck-plus"] = { timers: source.timers, blocks: source.blocks };
  }
  return settings;
}

/**
 * Reads the settings file. A missing file gives no settings (every model shows
 * its examples); a broken one also gives a message for the log.
 */
export function loadSettings(path = configFilePath()): { settings: Settings; problem?: string } {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return { settings: {} };
  }
  try {
    return { settings: normalizeSettings(JSON.parse(text)) };
  } catch (error) {
    return { settings: {}, problem: `${path} is not valid JSON: ${(error as Error).message}` };
  }
}

/** A config as written to the settings file: plain minutes unless a label was customised. */
export function toModelSettings(config: TimeboxConfig): { timers: Omit<TimerSlot, "id">[]; blocks: (number | Block)[] } {
  return {
    timers: config.timers.map(({ name, color, accent }) => ({ name, color, accent })),
    blocks: config.blocks.map((block) => (block.label === blockLabel(block.minutes) ? block.minutes : block))
  };
}

function writeSettings(settings: Settings, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.saving`;
  writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  renameSync(temporary, path);
}

/**
 * Checks one model's settings (e.g. from the settings panel) and writes them
 * into the settings file, keeping the other models' sections as they are in
 * the file now (it may have been edited by hand since the plugin started).
 * Refuses to touch a file that exists but isn't valid JSON, so nothing in it
 * is lost. Returns the new settings and that model's config.
 */
export function saveModelSettings(model: Model, section: unknown, path = configFilePath()): { settings: Settings; config: TimeboxConfig } {
  let current: Settings = {};
  let text: string | undefined;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    // No file yet: start one.
  }
  if (text !== undefined) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      throw new Error(`${path} is not valid JSON (${(error as Error).message}). Fix or remove it, then save again.`);
    }
    current = normalizeSettings(raw);
  }
  const config = resolveModelSettings(section, model.columns, model.exampleBlocks);
  const settings: Settings = { ...current, [model.id]: toModelSettings(config) };
  writeSettings(settings, path);
  return { settings, config };
}

/** The example block for a key position on a device with no block there. */
export function exampleBlock(index: number): Block {
  const minutes = GENERIC_BLOCKS[index] ?? GENERIC_BLOCKS[0];
  return { minutes, label: blockLabel(minutes) };
}

/** The first `length` characters of a text, counting emoji as one. */
export function truncate(text: string, length: number): string {
  return Array.from(text).slice(0, length).join("");
}
