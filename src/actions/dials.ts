import {
  action,
  SingletonAction,
  type DialDownEvent,
  type DialRotateEvent,
  type WillAppearEvent
} from "@elgato/streamdeck";
import { blankSlice, DIAL_SLICE, timelineActive, timelineSlice } from "../render.js";
import { timeboxStore, type TimeboxState } from "../state.js";
import { placeOf, selectedAccent, type Place } from "./place.js";

/** The Stream Deck + touch strip: four dial screens drawing one bar. */
const STRIP_SLICES = 4;

abstract class TimeboxDialAction extends SingletonAction {
  protected abstract readonly stripIndex: number;
  #rendering = false;
  #renderAgain = false;

  constructor() {
    super();
    timeboxStore.subscribe(() => void this.renderAll());
  }

  override async onWillAppear(event: WillAppearEvent): Promise<void> {
    if (!event.action.isDial()) return;
    await event.action.setFeedbackLayout("layouts/dial.json");
    const state = timeboxStore.current;
    await event.action.setFeedback({ canvas: this.render(state, placeOf(event.action, state)) });
  }

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
          if (instance.isDial()) updates.push(instance.setFeedback({ canvas: this.render(state, placeOf(instance, state)) }));
        }
        await Promise.all(updates);
      } while (this.#renderAgain);
    } finally {
      this.#rendering = false;
    }
  }

  protected render(state: TimeboxState, place: Place): string {
    if (!timelineActive(state)) return blankSlice(DIAL_SLICE);
    return timelineSlice(state, selectedAccent(place, state), this.stripIndex, STRIP_SLICES, DIAL_SLICE);
  }

  override onDialDown(_event: DialDownEvent): void {
    timeboxStore.reset();
  }
}

@action({ UUID: "io.github.tufacker.timebox.scrub-dial" })
export class ScrubDialAction extends TimeboxDialAction {
  protected readonly stripIndex = 0;

  override onDialRotate(event: DialRotateEvent): void {
    timeboxStore.scrubRemainingMinutes(event.payload.ticks);
  }
}

@action({ UUID: "io.github.tufacker.timebox.duration-dial" })
export class DurationDialAction extends TimeboxDialAction {
  protected readonly stripIndex = 1;

  override onDialRotate(_event: DialRotateEvent): void {
    // Reserved for future timer controls.
  }
}

@action({ UUID: "io.github.tufacker.timebox.type-dial" })
export class TypeDialAction extends TimeboxDialAction {
  protected readonly stripIndex = 2;

  override onDialRotate(_event: DialRotateEvent): void {
    // Reserved for future timer controls.
  }
}

@action({ UUID: "io.github.tufacker.timebox.marker-dial" })
export class MarkerDialAction extends TimeboxDialAction {
  protected readonly stripIndex = 3;

  override onDialRotate(_event: DialRotateEvent): void {
    // Reserved for future timer controls.
  }
}
