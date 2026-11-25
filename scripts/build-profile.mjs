// Builds one Stream Deck profile per supported model (src/models.ts) into the
// plugin folder, plus spare copies in dist/. Each profile lays out the model's
// keys: timers on the top row, blocks on the second, timeline keys on the third
// (keypad-only models) and the four dials (Stream Deck +).
import { randomUUID } from "node:crypto";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  blockActionUuid, DIAL_ACTION_UUIDS, DIAL_NAMES, MODELS, TIMELINE_ACTION_UUID, timerActionUuid
} from "../src/models.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(projectRoot, "com.tuf.streamdeck-timebox.sdPlugin");
const manifest = JSON.parse(readFileSync(join(pluginRoot, "manifest.json"), "utf8"));
const plugin = { Name: manifest.Name, UUID: manifest.UUID, Version: manifest.Version };

// Fixed IDs, so a rebuilt profile is the same profile to the Stream Deck app.
const PROFILE_IDS = {
  "stream-deck-plus": { profile: "A79B4F58-9C48-4D26-A6E2-89F2351F6261", main: "E571BEF2-A080-435C-A756-C57D0116A335", blank: "C58E5805-3206-459B-A1AC-3E11863B78CB" },
  "stream-deck-mk2": { profile: "B4F4F240-03B8-44F6-83CF-1CE95B3DF246", main: "B6A13F64-F5B2-4F7E-ACD6-EA7A498FC7A2", blank: "6FC03AB8-CFE0-475C-9B61-99A5A2B9A29B" }
};

// The profile is installed onto whichever device of the model the app picks,
// so it carries no device ID. TIMEBOX_DEVICE_UUID ties a build to one device.
const deviceUuid = process.env.TIMEBOX_DEVICE_UUID ?? "";

const keyAction = (name, uuid) => ({
  ActionID: randomUUID(), LinkedTitle: true, Name: name, Plugin: plugin, Resources: null, Settings: {}, State: 0,
  States: [{ FontFamily: "", FontSize: 12, FontStyle: "", FontUnderline: false, OutlineThickness: 2, ShowTitle: false, TitleAlignment: "bottom", TitleColor: "#ffffff" }],
  UUID: uuid
});
const encoderAction = (name, uuid) => ({
  ActionID: randomUUID(), LinkedTitle: true, Name: name, Plugin: plugin, Resources: null, Settings: {}, State: 0, States: [{}], UUID: uuid
});

function pageFor(model) {
  const keys = {};
  for (let column = 0; column < model.columns; column += 1) {
    keys[`${column},0`] = keyAction(`Timer ${column + 1}`, timerActionUuid(column));
    keys[`${column},1`] = keyAction(`Block ${column + 1}`, blockActionUuid(column));
    if (model.timeline === "keys" && model.rows >= 3) keys[`${column},2`] = keyAction("Timeline", TIMELINE_ACTION_UUID);
  }
  const controllers = [{ Actions: keys, Type: "Keypad" }];
  if (model.encoders > 0) {
    const dials = {};
    for (let index = 0; index < model.encoders; index += 1) dials[`${index},0`] = encoderAction(DIAL_NAMES[index], DIAL_ACTION_UUIDS[index]);
    controllers.push({ Actions: dials, Type: "Encoder" });
  }
  return { Controllers: controllers, Icon: "", Name: model.profile.name };
}

function blankPage(model) {
  const controllers = [{ Actions: {}, Type: "Keypad" }];
  if (model.encoders > 0) controllers.push({ Actions: {}, Type: "Encoder" });
  return { Controllers: controllers, Icon: "", Name: "" };
}

for (const model of MODELS) {
  const ids = PROFILE_IDS[model.id];
  if (!ids) throw new Error(`Add fixed profile IDs for ${model.id} to scripts/build-profile.mjs`);
  if (!manifest.Profiles?.some((entry) => entry.Name.toLowerCase() === model.profile.file.toLowerCase() && entry.DeviceType === model.deviceType)) {
    throw new Error(`The manifest's Profiles needs { "Name": "${model.profile.file}", "DeviceType": ${model.deviceType} } for ${model.name}`);
  }
  const temporaryRoot = mkdtempSync(join(tmpdir(), "streamdeck-timebox-profile-"));
  const profileDirectory = join(temporaryRoot, `${ids.profile}.sdProfile`);
  const mainPage = join(profileDirectory, "Profiles", ids.main);
  const defaultPage = join(profileDirectory, "Profiles", ids.blank);
  const output = join(pluginRoot, `${model.profile.file}.streamDeckProfile`);
  const spare = join(projectRoot, "dist", `${model.profile.name} (${model.name}).streamDeckProfile`);
  const root = {
    AppIdentifier: "*",
    Device: { Model: model.modelNumber, UUID: deviceUuid },
    Name: model.profile.name,
    Pages: { Current: ids.main.toLowerCase(), Default: ids.blank.toLowerCase(), Pages: [ids.main.toLowerCase()] },
    Version: "3.0"
  };
  try {
    mkdirSync(join(mainPage, "Images"), { recursive: true });
    mkdirSync(join(defaultPage, "Images"), { recursive: true });
    writeFileSync(join(profileDirectory, "manifest.json"), JSON.stringify(root));
    writeFileSync(join(mainPage, "manifest.json"), JSON.stringify(pageFor(model)));
    writeFileSync(join(defaultPage, "manifest.json"), JSON.stringify(blankPage(model)));
    rmSync(output, { force: true });
    const result = spawnSync("/usr/bin/zip", ["-X", "-q", "-r", output, "."], { cwd: temporaryRoot, encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr || "zip failed");
    mkdirSync(dirname(spare), { recursive: true });
    copyFileSync(output, spare);
    console.log(`Built ${model.name} profile: ${output}`);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
