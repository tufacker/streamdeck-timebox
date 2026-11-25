import { configForDevice, EXAMPLE_TIMERS, type TimeboxConfig, type TimerSlot } from "../config.js";
import type { TimeboxState } from "../state.js";

/** Where an action instance sits: its device's config, and its column in the row. */
export type Place = {
  config: TimeboxConfig;
  column: number;
  columns: number;
};

/** The parts of a Stream Deck action instance this needs (keeps it testable). */
export type Placed = {
  device: { type: number; size: { columns: number } };
  coordinates?: { column: number; row: number };
};

export function placeOf(instance: Placed, state: TimeboxState): Place {
  const columns = Math.max(1, instance.device.size.columns);
  return {
    config: configForDevice(state.settings, instance.device.type, columns),
    column: instance.coordinates?.column ?? 0,
    columns
  };
}

/** A timer of this device, or the example for a position the device has no column for. */
export function timerAt(place: Place, index: number): TimerSlot {
  return place.config.timers[index] ?? EXAMPLE_TIMERS[index] ?? EXAMPLE_TIMERS[0];
}

/** The colour of the selected timer on this device: the running block's colour. */
export function selectedAccent(place: Place, state: TimeboxState): string {
  return timerAt(place, state.timerIndex).accent;
}

/**
 * What pressing a timeline key does, by its column: the leftmost takes a
 * minute off the time left, the rightmost adds one, the middle key of an odd
 * row resets, and the others do nothing.
 */
export function timelinePress(column: number, columns: number): "less" | "more" | "reset" | undefined {
  if (columns > 1 && column === 0) return "less";
  if (columns > 1 && column === columns - 1) return "more";
  if (columns % 2 === 1 && column === (columns - 1) / 2) return "reset";
  return undefined;
}
