# Notes for Claude

Stream Deck Timebox: a visual timeboxing timer plugin, one plugin for every
supported Stream Deck model (Stream Deck + and Stream Deck MK.2 so far).
Start with `README.md`, then `docs/DEVELOPMENT.md`. If a private
`CLAUDE_HANDOFF.md` exists in this folder, read it first: it has the owner's
standing rules and the current state.

## Working rules

- Change `src/`, `scripts/` or the files in `com.tuf.streamdeck-timebox.sdPlugin/`
  that aren't generated, then run `npm run verify` (type-check, tests, build).
  Never edit `bin/plugin.js`, the generated profile or anything in `dist/`.
- Never rename an action UUID: the Stream Deck app stores keys by UUID, so a
  rename empties that key on every existing deck. Add new actions instead.
- Keep every setting optional: `resolveModelSettings()` must turn any input
  into one timer and one block per column, falling back to the examples.
- Model differences belong in the `MODELS` table (`src/models.ts`), not in
  `if` statements on device types elsewhere. Settings are per model; never
  let saving one model's settings change another's section.
- Timer behaviour is pinned by `test/state.test.ts`. Change a test only when
  the behaviour change is intended, and say so in the changelog.
- Visual changes count as done only when the exact build has been seen on the
  hardware (or in the Stream Deck app's key previews), not from the SVG source.
- Installing (`./install.sh`) restarts the Stream Deck app, which interrupts
  the owner's deck. Ask first.

## Keep the changelog current

Every change a user could notice, or a maintainer needs to know, gets a
`CHANGELOG.md` entry in the same commit, under `## Unreleased` at the top:

- one bullet per change: a short bold phrase, then the effect for the user,
  then the technical detail if it matters later;
- say when existing decks, profiles or settings files are affected, and how;
- say what was verified (tests, build, in the Stream Deck app, on hardware)
  and what wasn't;
- never rewrite released sections except to correct them;
- at a release, rename `## Unreleased` to `## v<version> — <date>`, matching
  `package.json` and the manifest's `Version` (`x.y.z.0`).

Before finishing any task that changed the plugin, the build or the docs,
check that the changelog says so.
