import * as vscode from "vscode";

export function getWorkspaceFolders() : string[] {
    // If we have workspace folders, we return all the paths, otherwise we return a blank array.
    if(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        return vscode.workspace.workspaceFolders.map(a => a.uri.fsPath);
    }
    else {
        return [];
    }
}

export function isDebuggingExtension() : boolean {
    const debugRegex = /^--inspect(-brk)?=?/;
    return process.execArgv ? process.execArgv.some(arg => debugRegex.test(arg)) : false;
}