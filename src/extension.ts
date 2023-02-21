"use strict";
import * as vscode from "vscode";
import * as config from "./config";
import * as detectorFilters from "./slither/detectorFilterTree";
import * as explorer from "./slither/explorerTree";
import { Logger } from "./logger";
import * as slither from "./slither/slither";
import { SlitherResult } from "./slither/slitherResults";
import { SlitherDiagnosticProvider } from "./slither/slitherDiagnostics";

// Properties
export let detectorFilterTree: vscode.TreeView<detectorFilters.DetectorFilterNode>;
export let detectorFilterTreeProvider: detectorFilters.DetectorFilterTreeProvider;
export let slitherExplorerTree: vscode.TreeView<explorer.ExplorerNode>;
export let slitherExplorerTreeProvider: explorer.SlitherExplorer;
export let diagnosticsProvider: SlitherDiagnosticProvider;
export let finishedActivation: boolean = false;
export let analysisRunning: boolean = false;

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

  // Initialize slither
  await slither.initialize();

  // Initialize the detector filter tree
  detectorFilterTreeProvider = new detectorFilters.DetectorFilterTreeProvider(
    context
  );
  detectorFilterTree = vscode.window.createTreeView(
    "slither-detector-filters",
    { treeDataProvider: detectorFilterTreeProvider }
  );

  // Initialize the analysis explorer.
  slitherExplorerTreeProvider = new explorer.SlitherExplorer(context);
  slitherExplorerTree = vscode.window.createTreeView("slither-explorer", {
    treeDataProvider: slitherExplorerTreeProvider,
  });

  // Register our explorer button commands.
  context.subscriptions.push(
    vscode.commands.registerCommand("slither.analyze", async () => {
      if (!analysisRunning) {
        analysisRunning = true;
        let progressOptions: vscode.ProgressOptions = {
          title: "Slither: Please wait while analysis is performed...",
          location: vscode.ProgressLocation.Notification,
          cancellable: false,
        };
        vscode.window.withProgress(progressOptions, async (progress, token) => {
          await slither.analyze();
          await slitherExplorerTreeProvider.refreshExplorer(false);
          analysisRunning = false;
        });
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("slither.refreshExplorer", async () => {
      await slitherExplorerTreeProvider.refreshExplorer();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("slither.toggleTreeMode", async () => {
      await slitherExplorerTreeProvider.toggleTreeMode();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("slither.clear", async () => {
      Logger.log("Clearing results...");
      await slither.clear();
      await slitherExplorerTreeProvider.refreshExplorer();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("slither.toggleAllDetectors", async () => {
      await detectorFilterTreeProvider.toggleAll();
    })
  );

  // Register our tree click commands.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "slither.clickedDetectorFilterNode",
      async (node: detectorFilters.DetectorFilterNode) => {
        await detectorFilterTreeProvider.clickedNode(node);
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "slither.clickedExplorerNode",
      async (node: explorer.ExplorerNode) => {
        await slitherExplorerTreeProvider.clickedNode(node);
      }
    )
  );

  // Register our tree goto result commands.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "slither.gotoExplorerResult",
      async (result: SlitherResult) => {
        // Obtain the issue node
        let resultNode = slitherExplorerTreeProvider.getNodeFromResult(result);
        if (resultNode) {
          slitherExplorerTree.reveal(resultNode, {
            select: true,
            focus: true,
            expand: false,
          });
        } else {
          Logger.error("Failed to select node for slither result.");
        }
      }
    )
  );

  // Register context menu actions for the explorer
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "slither.printResultNodeDetails",
      async (node: explorer.CheckResultNode) => {
        await slitherExplorerTreeProvider.printDetailedDescription(node);
        Logger.show();
      }
    )
  );

  // Register the diagnostics/code action provider
  let solidityDocumentSelector: vscode.DocumentSelector = {
    scheme: "file",
    language: "solidity",
  };
  diagnosticsProvider = new SlitherDiagnosticProvider(
    context,
    vscode.languages.createDiagnosticCollection("Slither")
  );
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      solidityDocumentSelector,
      diagnosticsProvider
    )
  );

  // Add our workspace change event handler
  vscode.workspace.onDidChangeWorkspaceFolders(async (e) => {
    await refreshWorkspace();
  });

  // Add our document event handlers
  vscode.workspace.onDidChangeTextDocument(
    async (e: vscode.TextDocumentChangeEvent) => {
      // Hide all diagnostics in all dirty files.
      if (e.document.isDirty) {
        diagnosticsProvider.hiddenFiles.add(e.document.fileName);
      } else {
        diagnosticsProvider.hiddenFiles.delete(e.document.fileName);
      }

      // Refresh diagnostics
      await diagnosticsProvider.refreshDiagnostics();
    }
  );
  vscode.workspace.onDidSaveTextDocument(async (e: vscode.TextDocument) => {
    // Any saved document should no longer be hidden in diagnostics
    diagnosticsProvider.hiddenFiles.delete(e.fileName);

    // Update source mapping status, and refresh trees + diagnostics
    await slither.updateSourceMappingSyncStatus(false, e.fileName);
    await slitherExplorerTreeProvider.refreshIconsForCheckResults();
    await slitherExplorerTreeProvider.changeTreeEmitter.fire("");
    await diagnosticsProvider.refreshDiagnostics();
  });

  // Add our configuration changed handler.
  vscode.workspace.onDidChangeConfiguration(async (e) => {
    // Changing detector filters will change configuration,
    // causing a double-reload. So we only reload if solcPath
    // was changed, and do not change UI components.
    if (e.affectsConfiguration("slither.solcPath")) {
      config.readConfiguration();
    }
  });

  // If we are in debug mode, log our activation message and focus on the output channel
  if (await isDebuggingExtension()) {
    Logger.log("Activated in debug mode");
    Logger.show();
  }

  // Refresh the workspace.
  await refreshWorkspace();

  // Mark our activation as completed
  finishedActivation = true;
}

async function refreshWorkspace() {
  // Read any new configuration.
  config.readConfiguration();

  // Refresh the detector filters and slither analysis explorer tree (loads last results).
  await detectorFilterTreeProvider.populateTree();
  await slitherExplorerTreeProvider.refreshExplorer();
}

async function isDebuggingExtension(): Promise<boolean> {
  const debugRegex = /^--inspect(-brk)?=?/;
  return process.execArgv
    ? process.execArgv.some((arg) => debugRegex.test(arg))
    : false;
}

export function deactivate() {}
