import * as vscode from "vscode";
import { Logger } from "./utils/logger";
import { SlitherLanguageClient } from "./slitherLanguageClient";
import { SettingsViewProvider } from "./views/settings/settingsViewProvider";
import * as state from "./state";
import { Configuration } from "./types/configTypes";
import { isDebuggingExtension } from "./utils/common";
import { IntervalAnalysisResult, VariableResult, NodeResult } from "./types/analysisTypes";

// Properties
export let analysis_key: number | null = null;
export let analysisStatusBarItem: vscode.StatusBarItem;

export let finishedActivation: boolean = false;

let slitherSettingsProvider: SettingsViewProvider;

// Slice decorations parameters
const style_forward_slice = { backgroundColor: "green", }
const style_backward_slice = { backgroundColor: "blue", }
let forward_slice_deco = vscode.window.createTextEditorDecorationType(style_forward_slice)
let backward_slice_deco = vscode.window.createTextEditorDecorationType(style_backward_slice)

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
    } catch (err: unknown) {
      // Clear our state and log our error.
      await state.resetState();
      if (err instanceof Error) {
        Logger.error(err, true);
      } else {
        Logger.error(String(err), true);
      }
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

  // Store interval analysis results for hover functionality
  let intervalAnalysisResults: IntervalAnalysisResult | null = null;

  // Hover provider for interval analysis results
  const intervalHoverProvider = vscode.languages.registerHoverProvider('solidity', {
    provideHover(document, position, token) {
      if (!intervalAnalysisResults) {
        return null;
      }
      
      // Normalize paths for comparison
      const resultPath = intervalAnalysisResults.file_path;
      const documentPath = document.uri.fsPath;
      
      // Try different path comparisons
      const pathsMatch = resultPath === documentPath || 
                        resultPath === documentPath.replace(/\\/g, '/') ||
                        resultPath.replace(/\\/g, '/') === documentPath;
      
      if (!pathsMatch) {
        return null;
      }

      const wordRange = document.getWordRangeAtPosition(position);
      if (!wordRange) {
        return null;
      }

      const variableName = document.getText(wordRange);
      const currentLine = position.line + 1; // Convert to 1-based line number
      
      // Search for the variable in our analysis results
      let bestMatch: VariableResult | null = null;
      let bestNode: NodeResult | null = null;
      
      for (const func of intervalAnalysisResults.functions) {
        for (const node of func.nodes) {
          for (const variable of node.variables) {
            // Try multiple ways to match the variable
            const matches = variable.name === variableName ||
                           variable.canonical_name === variableName ||
                           variable.display_name === variableName ||
                           variable.name.includes(variableName) ||
                           variable.canonical_name.includes(variableName);
            
            if (matches) {
              // Check if this node is at the current line or close to it
              if (node.location && node.location.line === currentLine) {
                // Exact line match - this is the best match
                bestMatch = variable;
                bestNode = node;
                break;
              } else if (!bestMatch) {
                // Fallback to first match if no exact line match
                bestMatch = variable;
                bestNode = node;
              }
            }
          }
          if (bestMatch && bestNode && bestNode.location && bestNode.location.line === currentLine) {
            break;
          }
        }
        if (bestMatch && bestNode && bestNode.location && bestNode.location.line === currentLine) {
          break;
        }
      }
      
      if (bestMatch) {
        // Create hover content
        const ranges = bestMatch.interval_ranges.map((range, index: number) => 
          `Range ${index + 1}: [${range.lower_bound}, ${range.upper_bound}]`
        ).join('\n');

        const validValues = bestMatch.valid_values.values.length > 0 
          ? `Valid values: {${bestMatch.valid_values.values.join(', ')}}`
          : '';

        const invalidValues = bestMatch.invalid_values.values.length > 0 
          ? `Invalid values: {${bestMatch.invalid_values.values.join(', ')}}`
          : '';

        const overflowWarning = bestMatch.has_overflow ? '⚠️ **OVERFLOW DETECTED**' : '';
        const underflowWarning = bestMatch.has_underflow ? '⚠️ **UNDERFLOW DETECTED**' : '';

        const typeInfo = bestMatch.var_type ? `Type: ${bestMatch.var_type}` : '';
        const nodeInfo = bestNode ? `**Node:** ${bestNode.expression} (${bestNode.node_type})` : '';

        const content = new vscode.MarkdownString();
        content.appendMarkdown(`### Variable: \`${variableName}\`\n\n`);
        
        if (nodeInfo) {
          content.appendMarkdown(`${nodeInfo}\n\n`);
        }
        
        if (typeInfo) {
          content.appendMarkdown(`${typeInfo}\n\n`);
        }
        
        if (ranges) {
          content.appendMarkdown(`**Ranges:**\n${ranges}\n\n`);
        }
        
        if (validValues) {
          content.appendMarkdown(`**${validValues}**\n\n`);
        }
        
        if (invalidValues) {
          content.appendMarkdown(`**${invalidValues}**\n\n`);
        }
        
        if (overflowWarning) {
          content.appendMarkdown(`${overflowWarning}\n\n`);
        }
        
        if (underflowWarning) {
          content.appendMarkdown(`${underflowWarning}\n\n`);
        }

        return new vscode.Hover(content);
      }

      return null;
    }
  });

  context.subscriptions.push(intervalHoverProvider);

  context.subscriptions.push(vscode.commands.registerCommand("slither.interval_analysis", async () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage("No active editor found. Please open a Solidity file.");
      return;
    }

    const document = activeEditor.document;
    if (document.languageId !== 'solidity') {
      vscode.window.showErrorMessage("Current file is not a Solidity file.");
      return;
    }
    
    try {
      vscode.window.showInformationMessage("Running interval analysis for integer overflow...");
      const result = await slitherLanguageClient.intervalAnalysis({ uri: document.uri.toString() });
      
      // Store results for hover functionality
      intervalAnalysisResults = result;
      
      // Display results in a new document
      const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(result, null, 2),
        language: 'json'
      });
      await vscode.window.showTextDocument(doc, { preview: false });
      
      vscode.window.showInformationMessage("Interval analysis completed! Hover over variables to see ranges.");
    } catch (error) {
      vscode.window.showErrorMessage(`Interval analysis failed: ${error}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand("slither.clear_interval_analysis", async () => {
    intervalAnalysisResults = null;
    vscode.window.showInformationMessage("Interval analysis results cleared.");
  }));

  context.subscriptions.push(vscode.commands.registerCommand("slither.forward_slice", async () => {
    let activeTextEditor = vscode.window.activeTextEditor;
    if (activeTextEditor === undefined) {
      return;
    }
    backward_slice_deco.dispose();
    backward_slice_deco = vscode.window.createTextEditorDecorationType(style_backward_slice);
    let activeSelection = activeTextEditor.selection.active;
    let uri = activeTextEditor.document.uri;
    let slice = await slitherLanguageClient.forward_slice({ uri: uri.toString(), position: activeSelection, forward: true});
    let ranges: vscode.Range[] = [];
    for (const location of slice) {
      ranges.push(location.range);
    }
    activeTextEditor.setDecorations(forward_slice_deco, ranges);
  }));

  context.subscriptions.push(vscode.commands.registerCommand("slither.backward_slice", async () => {
    let activeTextEditor = vscode.window.activeTextEditor;
    if (activeTextEditor === undefined) {
      return;
    }
    forward_slice_deco.dispose();
    forward_slice_deco = vscode.window.createTextEditorDecorationType(style_forward_slice);
    let activeSelection = activeTextEditor.selection.active;
    let uri = activeTextEditor.document.uri;
    let slice = await slitherLanguageClient.backward_slice({ uri: uri.toString(), position: activeSelection, forward: false });
    let ranges: vscode.Range[] = [];
    for (const location of slice) {
      ranges.push(location.range);
    }
    activeTextEditor.setDecorations(backward_slice_deco, ranges);
}));

context.subscriptions.push(vscode.commands.registerCommand("slither.clean_slice_decorations", async () => {
  forward_slice_deco.dispose();
  forward_slice_deco = vscode.window.createTextEditorDecorationType(style_forward_slice);
  backward_slice_deco.dispose();
  backward_slice_deco = vscode.window.createTextEditorDecorationType(style_backward_slice);
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
