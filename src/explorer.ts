import * as vscode from 'vscode';
import * as slither from "./slither";
import { Logger } from "./logger";
import * as config from "./config";

export async function initialize() {
    // TODO: Create the tree view

    // Refresh the explorer.
    await refreshExplorer();
}
export async function refreshExplorer() {
    // Read our last slither results 
    let success : boolean = await slither.readResults(false);
    if (!success) {
        return;
    }

    // Loop for each result.
    for (let [workspaceFolder, workspaceResults] of slither.results) {
        // TODO: Process each result into a tree.
    }

    Logger.log("Refreshing explorer");
}