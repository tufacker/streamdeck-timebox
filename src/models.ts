/**
 * The Stream Deck models Timebox supports. Everything that differs between
 * models lives here: the plugin reads it at runtime, and
 * scripts/build-profile.mjs builds one profile per model from it.
 *
 * Every model uses the same keys: the top row selects a timer, the second row
 * starts a block. The touch strip (Stream Deck +) or a third row of timeline
 * keys shows the running block.
 *
 * Adding a model: add an entry, add its profile to the manifest's `Profiles`,
 * and make sure the manifest has enough Timer and Block actions for its columns.
 */

/** Stream Deck device types, as numbered by the Stream Deck SDK. */
export const DeviceType = {
  StreamDeck: 0,
  StreamDeckMini: 1,
  StreamDeckXL: 2,
  StreamDeckPlus: 7
} as const;

export type Model = {
  /** Key for this model's section of the settings file. */
  id: string;
  /** Elgato's product name. */
  name: string;
  /** Stream Deck SDK device type. */
  deviceType: number;
  /** Elgato model number, used in the generated profile. */
  modelNumber: string;
  columns: number;
  rows: number;
  /** Dials with a touch strip (Stream Deck +). */
  encoders: number;
  /** Example block lengths, one per column, used until the user sets their own. */
  exampleBlocks: number[];
  /** Profile file (without extension) in the plugin folder and its display name. */
  profile: { file: string; name: string };
  /** Where the running block is shown. */
  timeline: "strip" | "keys";
};

export const MODELS: Model[] = [
  {
    id: "stream-deck-plus",
    name: "Stream Deck +",
    deviceType: DeviceType.StreamDeckPlus,
    modelNumber: "20GBD9901",
    columns: 4,
    rows: 2,
    encoders: 4,
    exampleBlocks: [15, 30, 60, 120],
    profile: { file: "Timebox", name: "Timebox" },
    timeline: "strip"
  },
  {
    id: "stream-deck-mk2",
    name: "Stream Deck MK.2",
    deviceType: DeviceType.StreamDeck,
    modelNumber: "20GBA9901",
    columns: 5,
    rows: 3,
    encoders: 0,
    exampleBlocks: [15, 30, 45, 60, 120],
    profile: { file: "timebox-mk2", name: "Timebox" },
    timeline: "keys"
  }
];

/** The most timers (or blocks) any model can show: the widest supported row. */
export const MAX_SLOTS = 8;

/** The supported model for a Stream Deck device type, if any. */
export function modelForDeviceType(deviceType: number | undefined): Model | undefined {
  return MODELS.find((model) => model.deviceType === deviceType);
}

const PLUGIN_UUID = "io.github.tufacker.timebox";

/** Action UUID of the timer key in a column (0-based). */
export function timerActionUuid(index: number): string {
  return `${PLUGIN_UUID}.timer-${index + 1}`;
}

/** Action UUID of the block key in a column (0-based). */
export function blockActionUuid(index: number): string {
  return `${PLUGIN_UUID}.block-${index + 1}`;
}

export const TIMELINE_ACTION_UUID = `${PLUGIN_UUID}.timeline`;
/** The four dials under the Stream Deck + strip, left to right. */
export const DIAL_ACTION_UUIDS = ["scrub-dial", "duration-dial", "type-dial", "marker-dial"].map((id) => `${PLUGIN_UUID}.${id}`);
export const DIAL_NAMES = ["Scrub Dial", "Duration Dial", "Session Type Dial", "Marker Dial"];
