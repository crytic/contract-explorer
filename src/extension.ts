'use strict';
import * as vscode from 'vscode';
import * as slither from "./slither";
import { Logger } from "./logger";
import * as config from "./config";
import * as explorer from "./explorer";


export function activate(context: vscode.ExtensionContext) {
    // Log our introductory message.
    Logger.log("\u2E3B Slither: Solidity static analysis framework by Trail of Bits \u2E3B");

    // Register our commands.
    context.subscriptions.push(vscode.commands.registerCommand('slither.analyze', slither.analyze));
    context.subscriptions.push(vscode.commands.registerCommand('slither.refreshExplorer', explorer.refreshExplorer));

    // If we are in debug mode, log our activation message and focus on the output channel
	if(config.isDebuggingExtension()) {
        Logger.log("Activated in debug mode");
	    Logger.show();
    }
    Logger.log("");

    // Initialize all components.
    explorer.initialize();
}

export function deactivate() {
    
}