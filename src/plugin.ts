import streamDeck from "@elgato/streamdeck";
import { ScrubDialAction, DurationDialAction, MarkerDialAction, TypeDialAction } from "./actions/dials.js";
import { KEY_ACTIONS } from "./actions/keys.js";
import { configFilePath, configForModel, saveModelSettings, toModelSettings } from "./config.js";
import { MODELS, modelForDeviceType } from "./models.js";
import { settingsLoad, timeboxStore } from "./state.js";

streamDeck.logger.setLevel("info");
if (settingsLoad.problem) streamDeck.logger.warn(`Using the example settings: ${settingsLoad.problem}`);
else streamDeck.logger.info(`Settings file: ${configFilePath()}`);

for (const Action of KEY_ACTIONS) streamDeck.actions.registerAction(new Action());
streamDeck.actions.registerAction(new ScrubDialAction());
streamDeck.actions.registerAction(new DurationDialAction());
streamDeck.actions.registerAction(new TypeDialAction());
streamDeck.actions.registerAction(new MarkerDialAction());

// The settings panel (ui/settings.html) edits the settings of the model it was
// opened on: it asks for them, and sends edited ones back to be saved.
type PanelMessage = { event?: string; settings?: unknown };

streamDeck.ui.onSendToPlugin(async (ev) => {
  const message = ev.payload as PanelMessage;
  const reply = (payload: object) => streamDeck.ui.sendToPropertyInspector(JSON.parse(JSON.stringify(payload)));
  const model = modelForDeviceType(ev.action.device.type);
  if (!model) {
    await reply({ event: "unsupported", device: ev.action.device.name, supported: MODELS.map((m) => m.name) });
    return;
  }
  if (message?.event === "load") {
    const config = configForModel(timeboxStore.current.settings, model);
    const examples = configForModel({}, model);
    await reply({
      event: "settings",
      model: { id: model.id, name: model.name, columns: model.columns },
      settings: toModelSettings(config),
      examples: toModelSettings(examples),
      path: configFilePath()
    });
  } else if (message?.event === "save") {
    try {
      const { settings, config } = saveModelSettings(model, message.settings);
      timeboxStore.setSettings(settings);
      streamDeck.logger.info(`Saved ${model.name} settings to ${configFilePath()}`);
      await reply({ event: "saved", settings: toModelSettings(config) });
    } catch (error) {
      streamDeck.logger.error(`Could not save settings: ${(error as Error).message}`);
      await reply({ event: "error", message: (error as Error).message });
    }
  }
});

streamDeck.connect();
