import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { loadSettings, MAX_BLOCK_MINUTES, type Settings } from "./config.js";
import { MAX_SLOTS } from "./models.js";

export type { Block, Settings, TimerSlot } from "./config.js";

export type TimeboxState = {
  /** Every model's timers and blocks; see configForDevice(). */
  settings: Settings;
  timerIndex: number;
  sessionTypes: string[];
  sessionTypeIndex: number;
  plannedMinutes: number;
  /** Which block key (position in its row) started the current block, if any. */
  blockSlot: number | null;
  billable: boolean;
  running: boolean;
  paused: boolean;
  startedAt: number | null;
  pausedStartedAt: number | null;
  pausedAccumulatedMs: number;
  elapsedMs: number;
  markerCount: number;
  lastLoggedPath: string;
};

type Listener = (state: TimeboxState) => void;

const DEFAULT_SESSION_TYPES = ["Focus", "Admin", "Meeting", "Break"];

function clone(state: TimeboxState): TimeboxState {
  return { ...state, sessionTypes: [...state.sessionTypes] };
}

export class TimeboxStore {
  #listeners = new Set<Listener>();
  #tick: NodeJS.Timeout | undefined;
  #state: TimeboxState;

  constructor(settings: Settings = {}) {
    this.#state = {
      settings,
      timerIndex: 0,
      sessionTypes: DEFAULT_SESSION_TYPES,
      sessionTypeIndex: 0,
      plannedMinutes: 25,
      blockSlot: null,
      billable: true,
      running: false,
      paused: false,
      startedAt: null,
      pausedStartedAt: null,
      pausedAccumulatedMs: 0,
      elapsedMs: 0,
      markerCount: 0,
      lastLoggedPath: join(homedir(), "Documents", "StreamDeck Timebox", "timebox-log.jsonl")
    };
  }

  get current(): TimeboxState {
    this.refreshElapsed();
    return clone(this.#state);
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** New settings (timer names, colours and blocks); a running timer carries on. */
  setSettings(settings: Settings): void {
    this.#state.settings = settings;
    this.emit();
  }

  startPause(): void {
    const now = Date.now();
    if (!this.#state.running && this.#state.startedAt === null) {
      this.#state.running = true;
      this.#state.paused = false;
      this.#state.startedAt = now;
      this.#state.pausedStartedAt = null;
      this.#state.pausedAccumulatedMs = 0;
      this.#state.elapsedMs = 0;
      this.ensureTicking();
      this.emit();
      return;
    }
    if (this.#state.running) {
      this.refreshElapsed();
      this.#state.running = false;
      this.#state.paused = true;
      this.#state.pausedStartedAt = now;
      this.stopTicking();
      this.emit();
      return;
    }
    if (this.#state.paused) {
      if (this.#state.pausedStartedAt !== null) {
        this.#state.pausedAccumulatedMs += now - this.#state.pausedStartedAt;
      }
      this.#state.running = true;
      this.#state.paused = false;
      this.#state.pausedStartedAt = null;
      this.ensureTicking();
      this.emit();
    }
  }

  stopAndLog(): void {
    this.refreshElapsed();
    if (this.#state.startedAt !== null && this.#state.elapsedMs >= 1000) {
      this.writeLog();
    }
    this.reset(false);
  }

  reset(emit = true): void {
    this.#state.running = false;
    this.#state.paused = false;
    this.#state.startedAt = null;
    this.#state.pausedStartedAt = null;
    this.#state.pausedAccumulatedMs = 0;
    this.#state.elapsedMs = 0;
    this.#state.markerCount = 0;
    this.stopTicking();
    if (emit) this.emit();
  }

  toggleBillable(): void {
    this.#state.billable = !this.#state.billable;
    this.emit();
  }

  selectTimer(index: number): void {
    this.#state.timerIndex = ((index % MAX_SLOTS) + MAX_SLOTS) % MAX_SLOTS;
    this.emit();
  }

  rotateTimer(ticks: number): void {
    this.selectTimer(this.#state.timerIndex + ticks);
  }

  rotateDuration(ticks: number): void {
    const step = Math.abs(ticks) > 2 ? 5 : 1;
    this.#state.plannedMinutes = Math.max(5, Math.min(MAX_BLOCK_MINUTES, this.#state.plannedMinutes + ticks * step));
    this.emit();
  }

  scrubRemainingMinutes(ticks: number): void {
    if (this.#state.startedAt === null) return;
    this.refreshElapsed();
    const plannedMs = this.#state.plannedMinutes * 60_000;
    // Inside the block, scrubbing stays inside it; in overtime it moves the overtime.
    const upper = this.#state.elapsedMs > plannedMs ? Number.POSITIVE_INFINITY : plannedMs;
    const nextElapsedMs = Math.max(0, Math.min(upper, this.#state.elapsedMs - ticks * 60_000));
    this.#state.elapsedMs = nextElapsedMs;
    if (this.#state.running) {
      this.#state.startedAt = Date.now() - this.#state.pausedAccumulatedMs - nextElapsedMs;
    } else if (this.#state.pausedStartedAt !== null) {
      this.#state.startedAt = this.#state.pausedStartedAt - this.#state.pausedAccumulatedMs - nextElapsedMs;
    }
    this.emit();
  }

  setDuration(minutes: number): void {
    this.#state.plannedMinutes = Math.max(1, Math.min(MAX_BLOCK_MINUTES, Math.round(minutes)));
    this.emit();
  }

  startBlock(minutes: number, slot: number | null = null): void {
    this.#state.plannedMinutes = Math.max(1, Math.min(MAX_BLOCK_MINUTES, Math.round(minutes)));
    this.#state.blockSlot = slot;
    this.#state.running = false;
    this.#state.paused = false;
    this.#state.startedAt = null;
    this.#state.pausedStartedAt = null;
    this.#state.pausedAccumulatedMs = 0;
    this.#state.elapsedMs = 0;
    this.#state.markerCount = 0;
    this.stopTicking();
    this.startPause();
  }

  /**
   * A block key was pressed: start its block, or pause/resume when it is the
   * active block. `slot` (the key's position) tells apart two keys with the
   * same length.
   */
  triggerPreset(minutes: number, slot: number | null = null): void {
    const normalized = Math.max(1, Math.min(MAX_BLOCK_MINUTES, Math.round(minutes)));
    if (this.#state.plannedMinutes === normalized && this.#state.blockSlot === slot && this.#state.startedAt !== null) {
      this.startPause();
      return;
    }
    this.startBlock(normalized, slot);
  }

  resetDuration(): void {
    this.#state.plannedMinutes = 25;
    this.emit();
  }

  rotateSessionType(ticks: number): void {
    const length = this.#state.sessionTypes.length;
    this.#state.sessionTypeIndex = ((this.#state.sessionTypeIndex + ticks) % length + length) % length;
    this.emit();
  }

  addMarker(): void {
    this.#state.markerCount += 1;
    this.emit();
  }

  private refreshElapsed(): void {
    if (!this.#state.running || this.#state.startedAt === null) return;
    this.#state.elapsedMs = Math.max(0, Date.now() - this.#state.startedAt - this.#state.pausedAccumulatedMs);
  }

  private writeLog(): void {
    const sessionType = this.#state.sessionTypes[this.#state.sessionTypeIndex] ?? "Focus";
    const started = this.#state.startedAt ?? Date.now();
    const ended = Date.now();
    const record = {
      startedAt: new Date(started).toISOString(),
      endedAt: new Date(ended).toISOString(),
      timer: this.#state.timerIndex + 1,
      sessionType,
      plannedMinutes: this.#state.plannedMinutes,
      elapsedMinutes: Math.round((this.#state.elapsedMs / 60_000) * 100) / 100,
      billable: this.#state.billable,
      markers: this.#state.markerCount
    };
    mkdirSync(dirname(this.#state.lastLoggedPath), { recursive: true });
    appendFileSync(this.#state.lastLoggedPath, `${JSON.stringify(record)}\n`, "utf8");
  }

  private ensureTicking(): void {
    if (this.#tick) return;
    this.#tick = setInterval(() => {
      this.refreshElapsed();
      this.emit();
    }, 1000);
    this.#tick.unref();
  }

  private stopTicking(): void {
    if (!this.#tick) return;
    clearInterval(this.#tick);
    this.#tick = undefined;
  }

  private emit(): void {
    const snapshot = this.current;
    for (const listener of this.#listeners) listener(snapshot);
  }
}

/** The settings file is read once, when the plugin starts. */
export const settingsLoad = loadSettings();
export const timeboxStore = new TimeboxStore(settingsLoad.settings);
