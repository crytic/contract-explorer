import * as vscode from "vscode";
import { Logger } from "./utils/logger";
import { SlitherLanguageClient } from "./slitherLanguageClient";
import { SettingsViewProvider } from "./views/settings/settingsViewProvider";
import * as state from "./state";
import { Configuration } from "./types/configTypes";
import { isDebuggingExtension } from "./utils/common";

// Properties
export let analysis_key: number | null = null;
export let analysisStatusBarItem: vscode.StatusBarItem;

export let finishedActivation: boolean = false;

let slitherSettingsProvider: SettingsViewProvider;

// Functions
export async function activate(context: vscode.ExtensionContext) {
  // Set our slither panel to visible
  vscode.commands.executeCommand(
    "setContext",
    "slitherCompatibleWorkspace",
    true
  );

  // Log our introductory message.
  Logger.log(
    "\u2E3B Slither: Solidity static analysis framework by Trail of Bits \u2E3B"
  );

  // Create a compilation status bar
  analysisStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1000
  );
  context.subscriptions.push(analysisStatusBarItem);

  // Initialize our project settings panel
  slitherSettingsProvider = new SettingsViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SettingsViewProvider.view_id,
      slitherSettingsProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // Determine if we want to use stdio or attach to an existing process over a network port for our language server.
  let port: number | null = null;
  if (process.env.EXISTING_LANGUAGE_SERVER_PORT !== undefined) {
    port = parseInt(process.env.EXISTING_LANGUAGE_SERVER_PORT);
    Logger.debug("Started in network mode on port: " + port.toString());
  } else {
    Logger.debug("Started in console mode");
  }

  // Initialize the language server
  let slitherLanguageClient = new SlitherLanguageClient(port);

  // When the language server is ready, we'll want to start fetching some state variables.
  slitherLanguageClient.start(async () => {
    try {
      // Initialize our state, grabbing detectors
      await state.initialize(context, slitherLanguageClient);

      // Refresh our detectors in our settings pane.
      slitherSettingsProvider.refreshDetectorTypes();
    } catch (err: any) {
      // Clear our state and log our error.
      await state.resetState();
      Logger.error(err, true);
    }
  });

  // If we initialize our state, we'll want to add an event to update our status bar on analysis updates
  state.onInitialized(async () => {
    // Set our compilation targets
    await slitherLanguageClient.setDetectorSettings(
      state.configuration.detectors
    );
  });

  // When the configuration is updated, we also reset our compilation targets.
  state.onSavedConfiguration(async (e: Configuration) => {
    // Set our compilation targets
    await slitherLanguageClient.setDetectorSettings(
      state.configuration.detectors
    );
  });

  // If we are in debug mode, log our activation message and focus on the output channel
  if (isDebuggingExtension()) {
    Logger.show();
  }

  // Mark our activation as completed
  finishedActivation = true;
}

export function deactivate() {
  // Stop the language client.
  if (state.client != null) {
    state.client.stop();
  }
}
