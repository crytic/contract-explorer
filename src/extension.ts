import * as vscode from "vscode";
import { Logger } from "./utils/logger";
import { SlitherLanguageClient } from "./slitherLanguageClient";
import { SettingsViewProvider } from "./views/settings/settingsViewProvider";
import * as state from "./state";
import { Configuration } from "./types/configTypes";
import { isDebuggingExtension } from "./utils/common";
import * as cp from "child_process"

// Properties
export let analysis_key: number | null = null;
export let analysisStatusBarItem: vscode.StatusBarItem;

export let finishedActivation: boolean = false;

let slitherSettingsProvider: SettingsViewProvider;

const slitherLspRegex = /^\s*usage:\s+slither-lsp/gm;

function checkSlitherLsp(path: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const data: Buffer[] = [];

    const child = cp.spawn(path, ["--help"]);
    child.stdout.on("data", chunk => {
      data.push(chunk)
    })

    child.on("error", err => {
      reject(err);
    })

    child.on("close", code => {
      const stdout = Buffer.concat(data).toString("utf-8").trim();

      if (code) {
        reject(`Invalid \`slither-lsp\` executable. Process terminated with code ${code}`);
        Logger.error(`slither-lsp output: ${stdout}`);
        return;
      }

      if (!slitherLspRegex.test(stdout)) {
        reject(`The specified executable was not recognized as a valid \`slither-lsp\` executable`);
        return;
      }

      resolve();
    });
  });
}

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

  const slitherLspPath = vscode.workspace.getConfiguration("slither").get("slitherLspPath", "slither-lsp");

  vscode.workspace.onDidChangeConfiguration(async event => {
    let affected = event.affectsConfiguration("slither.slitherLspPath");
    if (!affected) {
      return;
    }

    const action = await vscode.window
      .showInformationMessage(
        `Reload window in order for changes in the configuration of Contract Explorer to take effect.`,
        "Reload"
      );
    if (action === "Reload") {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  });

  try {
    await checkSlitherLsp(slitherLspPath);
  } catch (err) {
    let msg = "";
    if (typeof (err) === "string") {
      msg = err;
    } else if (err instanceof Error) {
      msg = err.toString();
    }
    const action = await vscode.window.showErrorMessage(msg, "Edit path");

    if (action === "Edit path") {
      await vscode.commands.executeCommand("workbench.action.openSettings", "slither.slitherLspPath");
    }
    return;
  }

  // Initialize the language server
  let slitherLanguageClient = new SlitherLanguageClient(slitherLspPath, port);

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

  context.subscriptions.push(vscode.commands.registerCommand("slither.analyze_all", async () => {
    await slitherLanguageClient.analyze({});
  }));

  context.subscriptions.push(vscode.commands.registerCommand("slither.analyze_single", async () => {
    if (!vscode.workspace.workspaceFolders) {
      return;
    }
    const workspace_folders = vscode.workspace.workspaceFolders.map(folder => ({
      label: folder.name,
      uri: folder.uri,
    }));
    const qp = await vscode.window.showQuickPick(workspace_folders);
    if (!qp) {
      return;
    }
    await slitherLanguageClient.analyze({ uris: [qp.uri.toString()] });
  }));

  const slithirProvider = new (class implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): string {
      return uri.path;
    }
  })();

  vscode.workspace.registerTextDocumentContentProvider("slithir", slithirProvider);

  context.subscriptions.push(vscode.commands.registerCommand("slither.show_slithir", async (name, text) => {
    let uri = vscode.Uri.from({ scheme: "slithir", path: text, query: name });
    let doc = await vscode.workspace.openTextDocument(uri); // calls back into the provider
    await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
  }));

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
