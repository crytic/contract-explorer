'use strict';
import * as vscode from 'vscode';
import * as config from './oldCode/config';
import * as explorer from './explorerTree';
import { Logger } from './utils/logger';
import * as slither from './oldCode/slither';
import { SlitherDetectorResult } from './types/slitherTypes';
import { SlitherDiagnosticProvider } from './oldCode/slitherDiagnostics';
import { SlitherLanguageClient } from './slitherLanguageClient'
import { SettingsViewProvider } from './views/settings/settingsViewProvider'
import { ProtocolNotificationType, StaticRegistrationOptions } from 'vscode-languageserver-protocol';
import * as state from './state'
import { OnAnalyzeAllProgress } from './types/analysisTypes';

// Properties
export let analysis_key: number | null = null;
export let analysisStatusBarItem: vscode.StatusBarItem;
export let slitherExplorerTree: vscode.TreeView<explorer.ExplorerNode>;
export let slitherExplorerTreeProvider: explorer.SlitherExplorer;

export let diagnosticsProvider: SlitherDiagnosticProvider;
export let finishedActivation: boolean = false;
export let analysisRunning: boolean = false;

let slitherSettingsProvider: SettingsViewProvider;

// Functions
export async function activate(context: vscode.ExtensionContext) {
    // Set our slither panel to visible
    vscode.commands.executeCommand("setContext", "slitherCompatibleWorkspace", true);

    // Log our introductory message.
    Logger.log("\u2E3B Slither: Solidity static analysis framework by Trail of Bits \u2E3B");
    
    // Initialize slither
    await slither.initialize();

    // Create a compilation status bar
    analysisStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000)
    context.subscriptions.push(analysisStatusBarItem);
    

    // Initialize the analysis explorer.
    slitherExplorerTreeProvider = new explorer.SlitherExplorer(context);
    slitherExplorerTree = vscode.window.createTreeView("slither-explorer", { treeDataProvider: slitherExplorerTreeProvider });

    // Determine if we want to use stdio or attach to an existing process over a network port for our language server.
    let port: number | null = null;
    if (process.env.EXISTING_LANGUAGE_SERVER_PORT !== undefined) {
        port = parseInt(process.env.EXISTING_LANGUAGE_SERVER_PORT);
    }

    // Initialize our project settings panel
    slitherSettingsProvider = new SettingsViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SettingsViewProvider.view_id, slitherSettingsProvider)
    );

    // Initialize the language server
    let slitherLanguageClient = new SlitherLanguageClient(port);

    // When the language server is ready, we'll want to start fetching some state variables.
    slitherLanguageClient.onReady(
        async () => {
            try {
                // Initialize our state, grabbing detectors
                await state.initialize(context, slitherLanguageClient);

                // Refresh our detectors in our settings pane.
                slitherSettingsProvider.refreshDetectors();

            } catch(err) {
                // Clear our state and log our error.
                await state.resetState();
                Logger.error(err, true);
            }
        }
    );

    // If we initialize our state, we'll want to add an event to update our status bar on analysis updates
    state.onInitialized(async() => {
        // Once our state is initialized, we'll want to track analysis updates.
        state.analyses?.onAnalyzeAllProgress(updateAnalysisStatusBar);

        // Trigger the first compilation when our state is initialized immediately.
        await state.analyses?.analyzeAll();
    });


    // Register our explorer button commands.
    context.subscriptions.push(vscode.commands.registerCommand("slither.analyze", async () => {
        if(!analysisRunning) {
            analysisRunning = true;
            let progressOptions : vscode.ProgressOptions = {
                title: "Slither: Please wait while analysis is performed...",
                location: vscode.ProgressLocation.Notification,
                cancellable: false
            };
            vscode.window.withProgress(progressOptions, async (progress, token) => {
                if (state.isInitialized()) {
                    state.analyses!.analyzeAll();
                    //await slither.analyze();
                    await slitherExplorerTreeProvider.refreshExplorer(false);
                    analysisRunning = false;
                }
            });
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("slither.refreshExplorer", async () => { 
        await slitherExplorerTreeProvider.refreshExplorer(); 
    }));
    context.subscriptions.push(vscode.commands.registerCommand("slither.toggleTreeMode", async () => {
        await slitherExplorerTreeProvider.toggleTreeMode(); 
    }));

    // Register our tree click commands.
    context.subscriptions.push(vscode.commands.registerCommand("slither.clickedExplorerNode", async (node : explorer.ExplorerNode) => { 
        await slitherExplorerTreeProvider.clickedNode(node); 
    }));

    // Register our tree goto result commands.
    context.subscriptions.push(vscode.commands.registerCommand("slither.gotoExplorerResult", async (result : SlitherDetectorResult) => {
        // Obtain the issue node
        let resultNode = slitherExplorerTreeProvider.getNodeFromResult(result);
        if (resultNode) {
            slitherExplorerTree.reveal(resultNode, { select: true, focus : true, expand : false});
        } else {
            Logger.error("Failed to select node for slither result.");
        }
    }));

    // Register context menu actions for the explorer
    context.subscriptions.push(vscode.commands.registerCommand("slither.printResultNodeDetails", async (node : explorer.CheckResultNode) => {
        await slitherExplorerTreeProvider.printDetailedDescription(node);
        Logger.show();
    }));

    // Register the diagnostics/code action provider
    let solidityDocumentSelector : vscode.DocumentSelector = { scheme: "file", language: "solidity" };
    diagnosticsProvider = new SlitherDiagnosticProvider(context, vscode.languages.createDiagnosticCollection("Slither"));
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider(solidityDocumentSelector, diagnosticsProvider));

    // Add our workspace change event handler
    vscode.workspace.onDidChangeWorkspaceFolders(async e => {
        await refreshWorkspace();
    });

    // Add our document event handlers
    vscode.workspace.onDidChangeTextDocument(async (e : vscode.TextDocumentChangeEvent) => {
        // Hide all diagnostics in all dirty files.
        if(e.document.isDirty) {
            diagnosticsProvider.hiddenFiles.add(e.document.fileName);
        } else {
            diagnosticsProvider.hiddenFiles.delete(e.document.fileName);
        }

        // Refresh diagnostics
        await diagnosticsProvider.refreshDiagnostics();
    });
    vscode.workspace.onDidSaveTextDocument(async (e : vscode.TextDocument) => {
        // Any saved document should no longer be hidden in diagnostics
        diagnosticsProvider.hiddenFiles.delete(e.fileName);

        // Update source mapping status, and refresh trees + diagnostics
        await slither.updateSourceMappingSyncStatus(false, e.fileName);
        await slitherExplorerTreeProvider.refreshIconsForCheckResults();
        await slitherExplorerTreeProvider.changeTreeEmitter.fire(null);
        await diagnosticsProvider.refreshDiagnostics();
    });

    // Add our configuration changed handler.
    vscode.workspace.onDidChangeConfiguration(async e => {
        // Changing detector filters will change configuration,
        // causing a double-reload. So we only reload if solcPath
        // was changed, and do not change UI components.
        if(e.affectsConfiguration("slither.solcPath")) {
            config.readConfiguration();
        }
    });

    // If we are in debug mode, log our activation message and focus on the output channel
	if(await isDebuggingExtension()) {
        Logger.log("Activated in debug mode");
	    Logger.show();
    }

    // Refresh the workspace.
    await refreshWorkspace();

    // Mark our activation as completed
    finishedActivation = true;
}

async function updateAnalysisStatusBar(e: OnAnalyzeAllProgress) {
    // Update our compilation status bar and show it.
    analysisStatusBarItem.text = `Slither: $(check) ${e.successfulCompilations} $(x) ${e.failedCompilations}`;
    let remainingCompilations = e.totalCompilations - (e.successfulCompilations + e.failedCompilations);
    if (remainingCompilations > 0) {
        analysisStatusBarItem.text += ` $(clock) ${remainingCompilations}`;
    }
    analysisStatusBarItem.show();
}

async function refreshWorkspace() {
    // Read any new configuration.
    config.readConfiguration();

    // Refresh the detector filters and slither analysis explorer tree (loads last results).
    await slitherExplorerTreeProvider.refreshExplorer();
}

async function isDebuggingExtension() : Promise<boolean> {
    const debugRegex = /^--inspect(-brk)?=?/;
    return process.execArgv ? process.execArgv.some(arg => debugRegex.test(arg)) : false;
}

export function deactivate() {
    // Stop the language client.
    if (state.client != null) {
        state.client.stop();
    }
}