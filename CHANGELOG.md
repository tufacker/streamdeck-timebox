# Changelog

Changes by version, newest first. New entries go under `## Unreleased` in the
same commit as the change; see `CLAUDE.md`.

## Unreleased

## v2.1.0 — 2026-11-25

The plugin has a new ID, so the Stream Deck app sees it as a new plugin.

- **New plugin ID `io.github.tufacker.timebox`** (was `com.tuf.streamdeck-timebox`,
  which suggested a domain the project doesn't own). Key IDs are simpler too:
  `timer-1`…`timer-8`, `block-1`…`block-8`, `timeline` and `scrub-dial`
  replace the v1 names (`client-1`, `preset-15`, `client-dial`), and the
  plugin folder is `io.github.tufacker.timebox.sdPlugin`.
- **Upgrading from 2.0.0:** install this release, switch to its Timebox
  profile, then remove the old Timebox plugin in the Stream Deck app
  (Preferences › Plugins) and its old Timebox profile. Settings in
  `timebox.json` are untouched and carry over.
- The bundled profiles have new IDs, so they install next to the old ones
  instead of replacing them.
- **Package clean-up:** the 2.0.0 package contained two stray copies of the
  Stream Deck + profile, left by a file-sync tool after the profile file was
  renamed. They were unused (not listed in the manifest) and contained no
  personal data. The build now removes any profile file in the plugin folder
  that isn't a model's profile.

Verified: type-check, tests and build; installed from the package on a
Stream Deck + and a Stream Deck MK.2 (see the 2.1.0 release notes).


## v2.0.0 — 2026-11-25

First public release. Timers and block lengths are now yours to set, and one
Timebox plugin supports both the Stream Deck + and the Stream Deck MK.2, each
with its own settings. On a deck that already runs v1, nothing changes until
you edit the settings: the existing keys keep working.

- **Stream Deck MK.2 support in the same plugin.** The MK.2 had its own copied
  plugin (`com.tuf.streamdeck-timebox-mk2`); it is now a supported model of
  this one: five timers, five blocks and a bottom row of five timeline keys
  (leftmost a minute less, rightmost a minute more, middle resets), as in the
  copy. A deck moving from the old MK.2 plugin needs the new Timebox profile.
- **Supported models in one table** (`src/models.ts`): device type, model
  number, grid, dials, example blocks and profile. The build makes a profile
  per model; adding a model is mostly a new entry (see `docs/DEVELOPMENT.md`).
- **Settings per model.** `timebox.json` now has a section per model
  (`stream-deck-plus`, `stream-deck-mk2`), each with one timer and one block
  per column; the settings panel edits the model it is opened on. A file in
  the earlier format is read as the Stream Deck + section and rewritten on
  the next save.
- **Keys draw for their own device**, so the same actions work on any model;
  Timer and Block keys now go up to 8 (keys 1–4 keep their v1 UUIDs), plus a
  new Timeline key. Building needs Node 22.18 or later.
- **Four configurable timers.** The top keys were four fixed client names; they
  are now four timers you name and colour yourself, for anything you want to
  time. Examples: Focus, Admin, Meeting, Break.
- **Configurable block lengths.** The bottom keys were fixed at 15M, 30M, 1H
  and 2H; each is now any length from 1 to 480 minutes (the old cap was 240),
  with an automatic label (`25M`, `1H`) or a custom one of up to six
  characters.
- **Settings panel in the Stream Deck app.** Select any Timebox key or dial to
  edit the timers (name, key colour, strip colour) and blocks (minutes,
  label). Save updates the deck at once, even mid-block; Examples restores the
  defaults.
- **Settings file** `~/Documents/StreamDeck Timebox/timebox.json`, written by
  the panel and editable by hand. Missing or invalid entries fall back to the
  examples; a broken file is reported in the plugin log.
- **Compatibility:** action UUIDs are unchanged, so existing profiles and keys
  keep working. Only the names shown in the app changed: Timer 1–4, Block 1–4,
  Scrub Dial, Marker Dial.
- **Build:** the package and the spare profile copy are written to `dist/`.
  The generated profile no longer embeds the build machine's Stream Deck ID
  (`TIMEBOX_DEVICE_UUID` sets one if needed). Unused drawing code is removed.
- **Fixes from a code review:**
  - saving in the settings panel merges into the file as it is now, so hand
    edits made since the Stream Deck app started (for instance to another
    model's section) are kept;
  - a settings file that isn't valid JSON is never overwritten: the panel
    says to fix or remove it;
  - block keys are told apart by position as well as length, so two keys with
    the same length act separately, and no block key looks selected before
    one has been started (a 25-minute block used to);
  - turning dial 1 during overtime adjusts the overtime instead of snapping
    back to the end of the block;
  - long names and labels are cut by character, keeping emoji whole;
  - a block key placed beyond its device's row shows that position's example
    instead of 15M;
  - the Stream Deck + profile file is named exactly as the manifest lists it
    (`Timebox`), which case-sensitive volumes need;
  - `install.sh` no longer deletes the installed plugin's logs.
- **Tests:** 46 `node:test` tests cover the timer (start, pause, resume,
  scrub, overtime, reset, block keys), the key and timeline drawing for both
  models, reading and saving settings per model, and that the models table
  matches the manifest (`npm test`, part of `npm run verify`).
- **Docs:** README rewritten for configurable timers and models; developer
  notes in `docs/DEVELOPMENT.md`; MIT `LICENSE`. The manifest's author and URL
  point at the GitHub repository.

Verified for configurable timers (before multi-model support): installed on a
Stream Deck + (firmware 2.0.3.7), the plugin connected, read the settings,
the keys looked as in v1, the panel loaded and saved, and timers ran as in v1
in daily use. Verified for multi-model support: type-check, tests, build,
and the settings panel for both models against a simulated Stream Deck
connection. Installed on both decks: on the Stream Deck + the plugin
connects and reads the existing settings; on a Stream Deck MK.2 (alongside
the old MK.2 plugin) it connects, reads its `stream-deck-mk2` settings, the
imported profile shows the five timers, five blocks and timeline row as
before, and the settings panel opens for the MK.2. Copying the plugin folder
does not install its bundled profiles; importing the profile file (or
installing the package) does, after the app asks which device to use. Not
yet verified: pressing the MK.2 timeline keys on the hardware.

## v1.0.0 — 2026-09-29

First working Stream Deck + version.

### Added

- Four timer keys (fixed names and colours at the time) and four duration
  keys: 15M, 30M, 1H and 2H.
- A duration key starts its timer at once; pressing the active one pauses and
  resumes; it counts down the time left.
- Timer keys select without starting, so you can choose before choosing a
  length.
- A Time Timer-style strip: the timer's colour for time left, warm brown for
  time used, a white boundary, no text. Blank when idle; a centred pause mark
  when paused; solid brown when finished.
- Overtime: the active duration key pulses green and counts up.
- Other keys dim while a timer runs.
- Dial 1 scrubs the playhead within the current block without changing its
  length; pressing any dial resets to idle.
- Build, profile, package and install scripts; a generated Stream Deck +
  profile.
- A local JSONL logging stub for later use.

### Changed during v1

- Removed the strip countdown text: the colour-only bar worked better.
- The active key counts down instead of up.
- Removed early dial legends and placeholder knob functions.
- A finished block turns solid brown instead of red.
- Dial 1 scrubs within the block instead of resizing it.
