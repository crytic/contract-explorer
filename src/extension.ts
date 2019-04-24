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
let detectorFilterTree : detectorFilters.DetectorFilterTree;
let slitherExplorer : explorer.SlitherExplorer;

// Functions
export async function activate(context: vscode.ExtensionContext) {
    // Set our slither panel to visible
    vscode.commands.executeCommand('setContext', 'slitherCompatibleWorkspace', true);

    // Log our introductory message.
    Logger.log("\u2E3B Slither: Solidity static analysis framework by Trail of Bits \u2E3B");
    
    // Initialize slither
    await slither.initialize();

    // Initialize the detector filter tree
    detectorFilterTree = new detectorFilters.DetectorFilterTree(context);
    vscode.window.registerTreeDataProvider("slither-detector-filters", detectorFilterTree);

    // Initialize the analysis explorer.
    slitherExplorer = new explorer.SlitherExplorer(context, detectorFilterTree);
    vscode.window.registerTreeDataProvider("slither-explorer", slitherExplorer);

    // Register our explorer button commands.
    context.subscriptions.push(vscode.commands.registerCommand('slither.analyze', async () => {
        await slither.analyze();
        await slitherExplorer.refreshExplorer();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('slither.refreshExplorer', async () => { 
        await slitherExplorer.refreshExplorer(); 
    }));
    context.subscriptions.push(vscode.commands.registerCommand('slither.toggleTreeMode', async () => {
        await slitherExplorer.toggleTreeMode(); 
    }));
    context.subscriptions.push(vscode.commands.registerCommand('slither.clear', async () => {
        Logger.log("Clearing results...");
        await slither.clear();
        await slitherExplorer.refreshExplorer(); 
    }));
    context.subscriptions.push(vscode.commands.registerCommand('slither.toggleAllDetectors', async () => {
        await detectorFilterTree.toggleAll();
    }));

    // Register our tree click commands.
    context.subscriptions.push(vscode.commands.registerCommand('slither.clickedDetectorFilterNode', async (node : detectorFilters.DetectorFilterNode) => { 
        await detectorFilterTree.clickedNode(node); 
    }));
    context.subscriptions.push(vscode.commands.registerCommand('slither.clickedExplorerNode', async (node : explorer.ExplorerNode) => { 
        await slitherExplorer.clickedNode(node); 
    }));

    // Register our code lens provider for slither results
    let slitherLensDocumentSelector : vscode.DocumentSelector = { scheme: "file", language: "solidity" };
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(slitherLensDocumentSelector, new sourceHelper.SlitherResultLensProvider()));

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
    await detectorFilterTree.populateTree();
    await slitherExplorer.refreshExplorer();
}

async function isDebuggingExtension() : Promise<boolean> {
    const debugRegex = /^--inspect(-brk)?=?/;
    return process.execArgv ? process.execArgv.some(arg => debugRegex.test(arg)) : false;
}

export function deactivate() {
    
}