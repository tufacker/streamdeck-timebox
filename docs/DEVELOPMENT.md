# Development notes

How Timebox is put together, the Stream Deck details that took time to learn,
and ideas for later. Read with the [README](../README.md) and the
[changelog](../CHANGELOG.md).

- Plugin UUID: `com.tuf.streamdeck-timebox` (one plugin for every supported model)
- Manifest: `com.tuf.streamdeck-timebox.sdPlugin/manifest.json`
- Installed copy: `~/Library/Application Support/com.elgato.StreamDeck/Plugins/com.tuf.streamdeck-timebox.sdPlugin`
- User settings: `~/Documents/StreamDeck Timebox/timebox.json`

## Models

Everything that differs between Stream Deck models is in the `MODELS` table
in `src/models.ts`: device type (as the SDK numbers it), Elgato model number,
columns and rows, dials, example blocks, profile file and name, and whether
the timeline is the touch strip or a row of keys. The plugin reads it at
runtime; `scripts/build-profile.mjs` builds one profile per entry.

Every model uses the same rows: timers on top, blocks second, and on
keypad-only models with three or more rows, Timeline keys on the third. Each
model shows one timer and one block per column.

| Model | `id` (settings section) | Device type | Model number | Grid | Timeline |
|---|---|---|---|---|---|
| Stream Deck + | `stream-deck-plus` | 7 | 20GBD9901 | 4 × 2, 4 dials | touch strip |
| Stream Deck MK.2 | `stream-deck-mk2` | 0 | 20GBA9901 | 5 × 3 | third row of keys |

The SDK's device type 0 covers every 15-key Stream Deck (the original, MK.2
and Scissor Keys), so they all use the MK.2 entry.

### Adding a model

1. Add an entry to `MODELS` in `src/models.ts`, with one example block per
   column.
2. Add its profile to the manifest's `Profiles` (`Name` = the entry's
   `profile.file`, `DeviceType` = its device type) and fixed profile IDs to
   `PROFILE_IDS` in `scripts/build-profile.mjs`. Both checks fail the build or
   the tests if they are missing.
3. Rows wider than eight columns need more Timer and Block actions
   (`MAX_SLOTS`, the manifest, `src/actions/keys.ts`).
4. A model without dials and with only two rows (Stream Deck Mini) has no
   place for the timeline yet: decide where it goes first.
5. `npm run verify`, then try it on the hardware.

A device without a model entry still works with keys placed by hand: it gets
examples sized to its row, but no settings section or profile.

## Controls

| Control | Action UUID | Press | Rotate |
|---|---|---|---|
| Timer keys 1–4 | `client-1` … `client-4` | select that timer | |
| Timer keys 5–8 | `timer-5` … `timer-8` | select that timer | |
| Block keys 1–4 | `preset-15`, `preset-30`, `preset-60`, `preset-120` | start that block, or pause/resume it while it is active | |
| Block keys 5–8 | `block-5` … `block-8` | as above | |
| Timeline key | `timeline` | leftmost: a minute less; rightmost: a minute more; middle of an odd row: reset | |
| Dial 1 (Stream Deck +) | `client-dial` | reset to idle | scrub the time left by a minute per tick |
| Dials 2–4 (Stream Deck +) | `duration-dial`, `type-dial`, `marker-dial` | reset to idle | reserved |

UUIDs of keys 1–4 and the dials come from v1, when the top keys were clients
and each block key had a fixed length. They stay as they are because the
Stream Deck app stores keys by UUID: renaming one would empty that key on
every existing deck. `timerActionUuid()` and `blockActionUuid()` in
`src/models.ts` map a column to its UUID, and a test checks the manifest has
them all.

## Source map

- `src/models.ts`: the supported models and the action UUIDs per column.
- `src/config.ts`: the settings. The file has one section per model id;
  `normalizeSettings()` also reads the pre-model format as the Stream Deck +
  section. `resolveModelSettings()` turns a section into exactly one timer and
  one block per column, keeping the example for anything missing or invalid;
  `configForDevice()` picks (and caches) the config for a connected device;
  `loadSettings()` and `saveModelSettings()` read and write `timebox.json`.
- `src/state.ts`: `TimeboxStore`, the timer. It holds the settings, the
  selected timer, the planned length, and running, paused and elapsed time.
  - `triggerPreset(minutes)` starts a block, or pauses/resumes it when that
    length is already active.
  - `scrubRemainingMinutes(ticks)` moves the playhead inside the block.
  - `reset()` returns to idle; `setSettings()` applies new settings without
    stopping the timer.
  - The module creates the one store the plugin uses, from `loadSettings()`.
- `src/render.ts`: SVG data URLs for the keys, and `timelineSlice()`, which
  draws one slice of the timeline bar for either shape (`DIAL_SLICE` for the
  Stream Deck + strip, `KEY_SLICE` for a row of keys).
- `src/actions/place.ts`: where an action instance sits (its device's config,
  its column) and what a timeline key press does.
- `src/actions/keys.ts`: Timer keys 1–8, Block keys 1–8 and the Timeline key.
  Each instance draws for its own device and column.
- `src/actions/dials.ts`: the four Stream Deck + dials; they draw the strip.
- `src/plugin.ts`: registers the actions and answers the settings panel.
- `com.tuf.streamdeck-timebox.sdPlugin/ui/settings.html`: the settings panel
  (the manifest's `PropertyInspectorPath`), plain HTML and JavaScript.
- `scripts/`: icon, bundle, profile and package builds, and
  `build-screenshots.mjs` (`npm run screenshots`), which draws the README
  images of each model with the example timers. The profile builder imports
  `src/models.ts` directly, so building needs Node 22.18 or later.
- `test/`: `node:test` tests for the timer, the drawing, the settings and the
  models. `test/ts-resolve.mjs` lets Node run the TypeScript sources directly,
  mapping their `./x.js` imports to `./x.ts`.

## Settings panel protocol

The panel talks to the plugin with `sendToPlugin` / `sendToPropertyInspector`.
It always edits the model of the device its action is on:

| From | Payload | Meaning |
|---|---|---|
| panel | `{ event: "load" }` | send this model's settings |
| plugin | `{ event: "settings", model, settings, examples, path }` | the model (`id`, `name`, `columns`), its settings and examples, and the file path |
| plugin | `{ event: "unsupported", device, supported }` | the device has no model entry |
| panel | `{ event: "save", settings }` | check, write this model's section of `timebox.json`, apply |
| plugin | `{ event: "saved", settings }` or `{ event: "error", message }` | the result |

`settings` uses the file's format for one model: `timers` as
`{ name, color, accent }` and `blocks` as minutes, or `{ minutes, label }`
when the label is custom.

## Things learned the hard way

### State subscription

`TimeboxStore.subscribe()` only registers the listener; it must not call it
straight away. The Stream Deck SDK action constructors subscribe before the
subclass fields are set, so an immediate call renders with undefined fields.
The first render happens in `onWillAppear`.

### Timer accuracy and display updates

Elapsed time is always computed from the clock: `Date.now() - startedAt -
pausedAccumulatedMs`. A once-a-second interval only refreshes the display, so
jitter delays a repaint but never drifts the time. Scrubbing moves
`startedAt`. Remaining time rounds up to whole seconds; overtime rounds down.

In v1 a 15-minute block once seemed to take about 20 minutes on the display.
The suspected cause was queued SVG updates, so the keys and dials now coalesce
renders (a pending render uses the latest state) and refresh every 1,000 ms
instead of 250 ms. No timed follow-up was recorded. If it comes back, time a
full block against an independent stopwatch and log the store's timestamps
next to what the device shows before changing the clock maths.

### The timeline

The Stream Deck + strip is four encoder feedback canvases. Each dial draws a
200×100 SVG whose viewBox is shifted into one imagined 800×100 strip
(`viewBox="${index * 200} 0 200 100"`), so the four look continuous. A row of
timeline keys works the same way with 144×144 keys (five make a 720-wide bar
on the MK.2). `timelineSlice()` does both; its output matches v1 and the old
MK.2 port exactly.

The Stream Deck app handles page swiping on the strip itself; avoid touch
gestures that would fight it.

### Install and update loop

```zsh
npm run verify
./install.sh
tail -n 200 "$HOME/Library/Logs/ElgatoStreamDeck/StreamDeck.log" | grep -i -E 'com.tuf.streamdeck-timebox|Plugin connected|Problem with connecting|Device connected'
```

Expect `[com.tuf.streamdeck-timebox] Plugin connected` and `Device
connected`. If reopening the app fails with Launch Services errors such as
`-600` or `-609`, run `open -a "Elgato Stream Deck"`.

### Hardware reconnects

Sometimes the plugin and profile load but the hardware doesn't update, and
the log shows `Read serial number: FAILED`, `Problem with connecting HID
device ... -1` and `device purged`. Unplug and reconnect the Stream Deck +,
then restart the Stream Deck app.

### Profile copies

The profiles are installed with the plugin, one per model. Repeated installs
during development can leave copies such as `Timebox copy` in the Stream Deck
app; delete them there and keep `Timebox`. The generated profiles carry no
device ID (set `TIMEBOX_DEVICE_UUID` to build them for a specific device).

### Colours

Example timers use deck-friendly colours, deliberately stronger than typical
pastel tab colours. Elapsed time is always `#6b4328`.

## Ideas for later

- **Completion alert:** a sound once when a block first reaches zero, keeping
  the brown strip and green overtime count; maybe repeat reminders in overtime.
- **Activity history:** local JSONL events for timer selection, start, pause,
  resume, completion and reset, with a session ID, timer ID, timestamp and
  planned length. `stopAndLog()` in `src/state.ts` already writes a session
  summary, but nothing calls it yet. Scrubbing rewrites `startedAt`, so keep a
  separate real start time for reporting. Record completion once, at the move
  into overtime.
- **Status board:** a local web page showing the running block and overtime,
  filtered by timer key, possibly sending task choices back over HTTP or
  WebSocket.
- **Task context:** attach a task (from a board or a to-do app) to a block,
  stored by a stable ID plus its label and source.
- **Rabbit-hole guard:** at expiry, a light prompt to continue, extend or
  switch.
- Use dial 2 for fine/coarse scrubbing, or to choose a length before starting.
- A visible stop-and-log control, perhaps on a second page so page 1 stays
  simple; daily Markdown or CSV export.
- Decide whether dial-press reset needs a confirmation or a long press.
