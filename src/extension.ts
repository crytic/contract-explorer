'use strict';
import * as vscode from "vscode";
import * as config from "./config";
import * as detectorFilters from "./detectorFilterTree";
import * as explorer from "./explorerTree";
import { Logger } from "./logger";
import * as slither from "./slither";
import * as slitherResults from "./slitherResults";
import * as sourceHelper from "./sourceHelper";

// Properties
export let detectorFilterTree : vscode.TreeView<detectorFilters.DetectorFilterNode>;
export let detectorFilterTreeProvider : detectorFilters.DetectorFilterTreeProvider;
export let slitherExplorerTree : vscode.TreeView<explorer.ExplorerNode>;
export let slitherExplorerTreeProvider : explorer.SlitherExplorer;
export let codeLensProvider : sourceHelper.SlitherResultLensProvider;

// Functions
export async function activate(context: vscode.ExtensionContext) {
    // Set our slither panel to visible
    vscode.commands.executeCommand('setContext', 'slitherCompatibleWorkspace', true);

    // Log our introductory message.
    Logger.log("\u2E3B Slither: Solidity static analysis framework by Trail of Bits \u2E3B");
    
    // Initialize slither
    await slither.initialize();

    // Initialize the detector filter tree
    detectorFilterTreeProvider = new detectorFilters.DetectorFilterTreeProvider(context);
    detectorFilterTree = vscode.window.createTreeView("slither-detector-filters", { treeDataProvider: detectorFilterTreeProvider });

    // Initialize the analysis explorer.
    slitherExplorerTreeProvider = new explorer.SlitherExplorer(context);
    slitherExplorerTree = vscode.window.createTreeView("slither-explorer", { treeDataProvider: slitherExplorerTreeProvider });

    // Register our explorer button commands.
    context.subscriptions.push(vscode.commands.registerCommand('slither.analyze', async () => {
        await slither.analyze();
        await slitherExplorerTreeProvider.refreshExplorer(false);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('slither.refreshExplorer', async () => { 
        await slitherExplorerTreeProvider.refreshExplorer(); 
    }));
    context.subscriptions.push(vscode.commands.registerCommand('slither.toggleTreeMode', async () => {
        await slitherExplorerTreeProvider.toggleTreeMode(); 
    }));
    context.subscriptions.push(vscode.commands.registerCommand('slither.clear', async () => {
        Logger.log("Clearing results...");
        await slither.clear();
        await slitherExplorerTreeProvider.refreshExplorer(); 
    }));
    context.subscriptions.push(vscode.commands.registerCommand('slither.toggleAllDetectors', async () => {
        await detectorFilterTreeProvider.toggleAll();
    }));

    // Register our tree click commands.
    context.subscriptions.push(vscode.commands.registerCommand('slither.clickedDetectorFilterNode', async (node : detectorFilters.DetectorFilterNode) => { 
        await detectorFilterTreeProvider.clickedNode(node); 
    }));
    context.subscriptions.push(vscode.commands.registerCommand('slither.clickedExplorerNode', async (node : explorer.ExplorerNode) => { 
        await slitherExplorerTreeProvider.clickedNode(node); 
    }));

    // Register our code lens provider for slither results
    let slitherLensDocumentSelector : vscode.DocumentSelector = { scheme: "file", language: "solidity" };
    codeLensProvider = new sourceHelper.SlitherResultLensProvider();
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(slitherLensDocumentSelector, codeLensProvider));

    // Register our code lens click commands.
    context.subscriptions.push(vscode.commands.registerCommand('slither.onCodeLensClick', async (checkResult : slitherResults.SlitherResult) => { 
        await sourceHelper.SlitherResultLensProvider.onCodeLensClick(checkResult);
    }));

    // Add our workspace change event handler
    vscode.workspace.onDidChangeWorkspaceFolders(async e => {
        await refreshWorkspace();
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
}

async function refreshWorkspace() {
    // Read any new configuration.
    config.readConfiguration();

    // Refresh the detector filters and slither analysis explorer tree (loads last results).
    await detectorFilterTreeProvider.populateTree();
    await slitherExplorerTreeProvider.refreshExplorer();
}

async function isDebuggingExtension() : Promise<boolean> {
    const debugRegex = /^--inspect(-brk)?=?/;
    return process.execArgv ? process.execArgv.some(arg => debugRegex.test(arg)) : false;
}

export function deactivate() {
    
}