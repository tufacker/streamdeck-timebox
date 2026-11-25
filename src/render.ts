import { truncate } from "./config.js";
import type { TimeboxState } from "./state.js";

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}

function formatDuration(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatRemainingDuration(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function remainingText(state: TimeboxState): string {
  return formatRemainingDuration(Math.max(0, state.plannedMinutes * 60_000 - state.elapsedMs));
}

export function overtimeText(state: TimeboxState): string {
  return `+${formatDuration(Math.max(0, state.elapsedMs - state.plannedMinutes * 60_000))}`;
}

export function progress(state: TimeboxState): number {
  return Math.max(0, Math.min(1, state.elapsedMs / Math.max(1, state.plannedMinutes * 60_000)));
}

export function remainingRatio(state: TimeboxState): number {
  return 1 - progress(state);
}

export function keyImage(title: string, subtitle: string, color: string, accent = "#47c7ff", dimmed = false): string {
  const bodyOpacity = dimmed ? "0.42" : "0.9";
  const accentOpacity = dimmed ? "0.32" : "1";
  const titleOpacity = dimmed ? "0.38" : "1";
  const subtitleOpacity = dimmed ? "0.32" : "1";
  return svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <rect width="144" height="144" rx="20" fill="#0b1118"/>
  <rect x="5" y="5" width="134" height="134" rx="18" fill="${color}" opacity="${bodyOpacity}"/>
  <rect x="5" y="5" width="134" height="17" rx="9" fill="${accent}" opacity="${accentOpacity}"/>
  <text x="72" y="65" text-anchor="middle" font-family="Avenir, Helvetica, Arial, sans-serif" font-size="22" font-weight="850" fill="#eaffff" opacity="${titleOpacity}">${escapeXml(title)}</text>
  <text x="72" y="96" text-anchor="middle" font-family="Avenir, Helvetica, Arial, sans-serif" font-size="15" font-weight="750" fill="#d9ffff" opacity="${subtitleOpacity}">${escapeXml(subtitle)}</text>
</svg>`);
}

export function timerKeyImage(name: string, selected: boolean, color: string, accent = color, dimmed = false): string {
  if (!selected) {
    const bodyOpacity = dimmed ? "0.36" : "0.9";
    const accentOpacity = dimmed ? "0.34" : "1";
    const textOpacity = dimmed ? "0.42" : "1";
    return svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <rect width="144" height="144" rx="20" fill="#0b1118"/>
  <rect x="5" y="5" width="134" height="134" rx="18" fill="#1b2833" opacity="${bodyOpacity}"/>
  <rect x="5" y="5" width="134" height="17" rx="9" fill="${accent}" opacity="${accentOpacity}"/>
  <text x="72" y="77" text-anchor="middle" font-family="Avenir, Helvetica, Arial, sans-serif" font-size="20" font-weight="900" fill="#eaffff" opacity="${textOpacity}">${escapeXml(truncate(name.toUpperCase(), 8))}</text>
</svg>`);
  }
  return svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <rect width="144" height="144" rx="20" fill="#0b1118"/>
  <rect x="5" y="5" width="134" height="134" rx="18" fill="${color}"/>
  <rect x="5" y="5" width="134" height="17" rx="9" fill="${accent}"/>
  <text x="72" y="77" text-anchor="middle" font-family="Avenir, Helvetica, Arial, sans-serif" font-size="20" font-weight="900" fill="#eaffff">${escapeXml(truncate(name.toUpperCase(), 8))}</text>
</svg>`);
}

/**
 * A block key. It is the selected block when its length is the planned one and,
 * if `slot` is given, the block was started from that key position.
 */
export function presetKeyImage(label: string, minutes: number, state: TimeboxState, slot?: number): string {
  const selected = state.plannedMinutes === minutes && (slot === undefined || state.blockSlot === slot);
  const running = selected && state.running;
  const paused = selected && state.paused;
  const focusMode = state.running || state.paused;
  const overtime = selected && state.elapsedMs >= state.plannedMinutes * 60_000;
  const subtitle = selected && state.elapsedMs > 0 ? (overtime ? overtimeText(state) : remainingText(state)) : "";
  if (running && overtime) {
    const pulse = 0.16 + 0.3 * ((Math.sin(Date.now() / 520) + 1) / 2);
    return svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <rect width="144" height="144" rx="20" fill="#0b1118"/>
  <rect x="5" y="5" width="134" height="134" rx="18" fill="#17693f"/>
  <rect x="5" y="5" width="134" height="17" rx="9" fill="#1fd27a"/>
  <rect x="5" y="5" width="134" height="134" rx="18" fill="#6dffad" opacity="${pulse.toFixed(3)}"/>
  <text x="72" y="65" text-anchor="middle" font-family="Avenir, Helvetica, Arial, sans-serif" font-size="22" font-weight="850" fill="#ecfff4">${escapeXml(label)}</text>
  <text x="72" y="96" text-anchor="middle" font-family="Avenir, Helvetica, Arial, sans-serif" font-size="18" font-weight="800" fill="#d8ffe6">${escapeXml(subtitle)}</text>
</svg>`);
  }
  if (paused) {
    const pulse = 0.18 + 0.28 * ((Math.sin(Date.now() / 520) + 1) / 2);
    return svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <rect width="144" height="144" rx="20" fill="#0b1118"/>
  <rect x="5" y="5" width="134" height="134" rx="18" fill="#7a4f12"/>
  <rect x="5" y="5" width="134" height="17" rx="9" fill="#f6b84b"/>
  <rect x="5" y="5" width="134" height="134" rx="18" fill="#ffd37a" opacity="${pulse.toFixed(3)}"/>
  <text x="72" y="65" text-anchor="middle" font-family="Avenir, Helvetica, Arial, sans-serif" font-size="22" font-weight="850" fill="#fff6df">${escapeXml(label)}</text>
  <text x="72" y="96" text-anchor="middle" font-family="Avenir, Helvetica, Arial, sans-serif" font-size="18" font-weight="800" fill="#fff0c8">${escapeXml(subtitle)}</text>
</svg>`);
  }
  const dimmed = focusMode && !selected;
  const accent = running ? "#1fd27a" : selected ? "#47c7ff" : dimmed ? "#1a2832" : "#344c5f";
  const body = running ? "#17693f" : selected ? "#18445a" : dimmed ? "#0d151c" : "#1b2833";
  return keyImage(label, subtitle, body, accent, dimmed);
}

/** The shape of one slice of the timeline: a Stream Deck + dial screen, or a key. */
export type SliceShape = {
  width: number;
  height: number;
  boundary: number;
  pause: { width: number; height: number; y: number; gap: number; shadow: { dy: number; blur: number; opacity: number } };
};

/** One dial screen of the Stream Deck + touch strip. */
export const DIAL_SLICE: SliceShape = {
  width: 200, height: 100, boundary: 6,
  pause: { width: 20, height: 52, y: 24, gap: 18, shadow: { dy: 2, blur: 3, opacity: 0.55 } }
};

/** One key in a row of timeline keys. */
export const KEY_SLICE: SliceShape = {
  width: 144, height: 144, boundary: 8,
  pause: { width: 18, height: 70, y: 37, gap: 16, shadow: { dy: 3, blur: 4, opacity: 0.6 } }
};

const ELAPSED_COLOR = "#6b4328";

/**
 * One slice of the timeline bar: `count` slices side by side make one bar
 * whose accent-coloured part (time left) shrinks towards the left, with brown
 * for time used and a white line between them. Each slice is the same SVG with
 * its viewBox moved to its part of the bar.
 */
export function timelineSlice(state: TimeboxState, accent: string, index: number, count: number, shape: SliceShape): string {
  const { width, height } = shape;
  const total = width * count;
  const remainingWidth = Math.max(0, Math.min(total, total * remainingRatio(state)));
  const elapsedWidth = total - remainingWidth;
  const half = shape.boundary / 2;
  const boundary = remainingWidth <= 0 ? "" : `
       <rect x="${Math.max(0, remainingWidth - half)}" y="0" width="${shape.boundary}" height="${height}" fill="#ffffff" opacity="0.75"/>`;
  const { pause } = shape;
  const center = total / 2;
  const pauseIcon = state.paused ? `
  <g filter="url(#pauseShadow)">
    <rect x="${center - pause.gap / 2 - pause.width}" y="${pause.y}" width="${pause.width}" height="${pause.height}" rx="5" fill="#fff6df"/>
    <rect x="${center + pause.gap / 2}" y="${pause.y}" width="${pause.width}" height="${pause.height}" rx="5" fill="#fff6df"/>
  </g>` : "";
  return svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${index * width} 0 ${width} ${height}">
  <defs>
    <filter id="pauseShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${pause.shadow.dy}" stdDeviation="${pause.shadow.blur}" flood-color="#000000" flood-opacity="${pause.shadow.opacity}"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="${total}" height="${height}" fill="${ELAPSED_COLOR}"/>
  <rect x="0" y="0" width="${remainingWidth}" height="${height}" fill="${accent}" opacity="0.94"/>
       <rect x="${remainingWidth}" y="0" width="${elapsedWidth}" height="${height}" fill="${ELAPSED_COLOR}"/>
       ${boundary}
  ${pauseIcon}
</svg>`);
}

/** An idle slice: plain black. */
export function blankSlice(shape: SliceShape): string {
  return svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">
  <rect width="${shape.width}" height="${shape.height}" fill="#000000"/>
</svg>`);
}

/** Whether the timeline has anything to show (otherwise it is blank). */
export function timelineActive(state: TimeboxState): boolean {
  return state.running || state.paused || state.elapsedMs > 0;
}
