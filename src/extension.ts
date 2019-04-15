'use strict';
import * as vscode from 'vscode';
import * as slither from "./slither";
import { Logger } from "./logger";
import * as config from "./config";
import { ExplorerNode } from './explorerNode';
import * as explorer from "./explorer";


export function activate(context: vscode.ExtensionContext) {
    // Log our introductory message.
    Logger.log("\u2E3B Slither: Solidity static analysis framework by Trail of Bits \u2E3B");

    // Initialize the analysis explorer.
    let slitherExplorer = new explorer.SlitherExplorer(context);
    vscode.window.registerTreeDataProvider("slither-explorer", slitherExplorer);

    // Register our commands.
    context.subscriptions.push(vscode.commands.registerCommand('slither.analyze', async () => {
        await slither.analyze();
        await slitherExplorer.refreshExplorer();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('slither.refreshExplorer', async () => { 
        await slitherExplorer.refreshExplorer(); 
    }));
    context.subscriptions.push(vscode.commands.registerCommand('slither.clear', async () => {
        Logger.log("Clearing results...");
        await slither.clear();
        await slitherExplorer.refreshExplorer(); 
    }));
    context.subscriptions.push(vscode.commands.registerCommand('slither.clickedExplorerNode', async (node : ExplorerNode) => { 
        await slitherExplorer.clickedNode(node); 
    }));

    // If we are in debug mode, log our activation message and focus on the output channel
	if(config.isDebuggingExtension()) {
        Logger.log("Activated in debug mode");
	    Logger.show();
    }

    // Refresh the analysis explorer (loads last results).
    slitherExplorer.refreshExplorer();
}

export function deactivate() {
    
}