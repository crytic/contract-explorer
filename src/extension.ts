'use strict';
import * as vscode from 'vscode';
import * as slither from "./slither";
import { Logger } from "./logger";
import * as common from "./common";


export function activate(context: vscode.ExtensionContext) {
    // Register the analyze command.
    context.subscriptions.push(vscode.commands.registerCommand('slither.analyze', () => {
        slither.analyze();
    }));

    // If we are in debug mode, log our activation message and focus on the output channel
	if(common.isDebuggingExtension()) {
        Logger.log("Activated Slither extension in debug mode.");
	    Logger.show();
	}
}

// this method is called when your extension is deactivated
export function deactivate() {
    console.log('"vscode slither plugin" is now deactivated');
}