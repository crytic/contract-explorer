'use strict';
import * as vscode from 'vscode';
import * as slither from "./slither";
import { Logger } from "./logger";
import * as config from "./config";


export function activate(context: vscode.ExtensionContext) {
    
    // Register the analyze command.
    context.subscriptions.push(vscode.commands.registerCommand('slither.analyze', () => {
        slither.analyze();
    }));

    // If we are in debug mode, log our activation message and focus on the output channel
	if(config.isDebuggingExtension()) {
        Logger.log("Activated Slither extension in debug mode.");
	    Logger.show();
    }
    else {
        Logger.log("Activated Slither extension.");
    }
}

export function deactivate() {
    
}