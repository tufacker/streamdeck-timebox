import { action, SingletonAction, type KeyAction, type KeyDownEvent, type WillAppearEvent } from "@elgato/streamdeck";
import { exampleBlock } from "../config.js";
import { blankSlice, KEY_SLICE, presetKeyImage, timelineActive, timelineSlice, timerKeyImage } from "../render.js";
import { timeboxStore, type TimeboxState } from "../state.js";
import { placeOf, selectedAccent, timelinePress, timerAt, type Place } from "./place.js";

/**
 * A Timebox key. Each instance draws for its own device and position, so the
 * same action can sit on a Stream Deck + and a Stream Deck MK.2 at once.
 */
abstract class TimeboxKeyAction extends SingletonAction {
  #pulseClock: NodeJS.Timeout | undefined;
  #rendering = false;
  #renderAgain = false;

  constructor() {
    super();
    timeboxStore.subscribe(() => void this.renderAll());
    this.#pulseClock = setInterval(() => {
      if (timeboxStore.current.paused) void this.renderAll();
    }, 1000);
    this.#pulseClock.unref();
  }

  override async onWillAppear(event: WillAppearEvent): Promise<void> {
    if (!event.action.isKey()) return;
    const state = timeboxStore.current;
    await event.action.setImage(this.render(state, placeOf(event.action, state)));
  }

  protected abstract render(state: TimeboxState, place: Place): string;

  protected async renderAll(): Promise<void> {
    if (this.#rendering) {
      this.#renderAgain = true;
      return;
    }
    this.#rendering = true;
    try {
      do {
        this.#renderAgain = false;
        const state = timeboxStore.current;
        const updates = [];
        for (const instance of this.actions) {
          if (instance.isKey()) updates.push(instance.setImage(this.render(state, placeOf(instance, state))));
        }
        await Promise.all(updates);
      } while (this.#renderAgain);
    } finally {
      this.#rendering = false;
    }
  }

  protected placeOfKey(key: KeyAction): Place {
    return placeOf(key, timeboxStore.current);
  }
}

/** Top row: selects a timer without starting anything. */
abstract class TimerKeyAction extends TimeboxKeyAction {
  protected abstract readonly timerIndex: number;

  override onKeyDown(_event: KeyDownEvent): void {
    timeboxStore.selectTimer(this.timerIndex);
  }

  protected render(state: TimeboxState, place: Place): string {
    const timer = timerAt(place, this.timerIndex);
    return timerKeyImage(
      timer.name,
      state.timerIndex === this.timerIndex,
      timer.color,
      timer.accent,
      (state.running || state.paused) && state.timerIndex !== this.timerIndex
    );
  }
}

/** Second row: starts its block, or pauses/resumes it while it is the active one. */
abstract class BlockKeyAction extends TimeboxKeyAction {
  protected abstract readonly slot: number;

  override onKeyDown(event: KeyDownEvent): void {
    if (!event.action.isKey()) return;
    timeboxStore.triggerPreset(this.blockAt(this.placeOfKey(event.action)).minutes, this.slot);
  }

  protected render(state: TimeboxState, place: Place): string {
    const block = this.blockAt(place);
    return presetKeyImage(block.label, block.minutes, state, this.slot);
  }

  private blockAt(place: Place) {
    return place.config.blocks[this.slot] ?? exampleBlock(this.slot);
  }
}

/**
 * Third row on keypad-only models: each key shows its slice of the timeline
 * bar, so a row of them reads as one bar. The leftmost key takes a minute off
 * the time left, the rightmost adds one, and the middle key of an odd row
 * resets.
 */
@action({ UUID: "io.github.tufacker.timebox.timeline" })
export class TimelineKeyAction extends TimeboxKeyAction {
  override onKeyDown(event: KeyDownEvent): void {
    if (!event.action.isKey()) return;
    const { column, columns } = this.placeOfKey(event.action);
    const press = timelinePress(column, columns);
    if (press === "less") timeboxStore.scrubRemainingMinutes(-1);
    else if (press === "more") timeboxStore.scrubRemainingMinutes(1);
    else if (press === "reset") timeboxStore.reset();
  }

  protected render(state: TimeboxState, place: Place): string {
    if (!timelineActive(state)) return blankSlice(KEY_SLICE);
    return timelineSlice(state, selectedAccent(place, state), place.column, place.columns, KEY_SLICE);
  }
}

// The Stream Deck app stores keys by UUID: never rename these, or every
// deck using the key loses it. Add new actions instead.
@action({ UUID: "io.github.tufacker.timebox.timer-1" })
export class Timer1Action extends TimerKeyAction { protected readonly timerIndex = 0; }
@action({ UUID: "io.github.tufacker.timebox.timer-2" })
export class Timer2Action extends TimerKeyAction { protected readonly timerIndex = 1; }
@action({ UUID: "io.github.tufacker.timebox.timer-3" })
export class Timer3Action extends TimerKeyAction { protected readonly timerIndex = 2; }
@action({ UUID: "io.github.tufacker.timebox.timer-4" })
export class Timer4Action extends TimerKeyAction { protected readonly timerIndex = 3; }
@action({ UUID: "io.github.tufacker.timebox.timer-5" })
export class Timer5Action extends TimerKeyAction { protected readonly timerIndex = 4; }
@action({ UUID: "io.github.tufacker.timebox.timer-6" })
export class Timer6Action extends TimerKeyAction { protected readonly timerIndex = 5; }
@action({ UUID: "io.github.tufacker.timebox.timer-7" })
export class Timer7Action extends TimerKeyAction { protected readonly timerIndex = 6; }
@action({ UUID: "io.github.tufacker.timebox.timer-8" })
export class Timer8Action extends TimerKeyAction { protected readonly timerIndex = 7; }

@action({ UUID: "io.github.tufacker.timebox.block-1" })
export class Block1Action extends BlockKeyAction { protected readonly slot = 0; }
@action({ UUID: "io.github.tufacker.timebox.block-2" })
export class Block2Action extends BlockKeyAction { protected readonly slot = 1; }
@action({ UUID: "io.github.tufacker.timebox.block-3" })
export class Block3Action extends BlockKeyAction { protected readonly slot = 2; }
@action({ UUID: "io.github.tufacker.timebox.block-4" })
export class Block4Action extends BlockKeyAction { protected readonly slot = 3; }
@action({ UUID: "io.github.tufacker.timebox.block-5" })
export class Block5Action extends BlockKeyAction { protected readonly slot = 4; }
@action({ UUID: "io.github.tufacker.timebox.block-6" })
export class Block6Action extends BlockKeyAction { protected readonly slot = 5; }
@action({ UUID: "io.github.tufacker.timebox.block-7" })
export class Block7Action extends BlockKeyAction { protected readonly slot = 6; }
@action({ UUID: "io.github.tufacker.timebox.block-8" })
export class Block8Action extends BlockKeyAction { protected readonly slot = 7; }

export const KEY_ACTIONS = [
  Timer1Action, Timer2Action, Timer3Action, Timer4Action, Timer5Action, Timer6Action, Timer7Action, Timer8Action,
  Block1Action, Block2Action, Block3Action, Block4Action, Block5Action, Block6Action, Block7Action, Block8Action,
  TimelineKeyAction
];
