import * as path from "path";
import * as shell from "shelljs";
import * as vscode from "vscode";

// Constants
const storagePath : string = "./.vscode"; // Directory relative to workspace to store files
export const slitherPath : string = "slither"; // Slither path
export const minimumSlitherVersion : string = "0.6.3"; // minimum supported slither version
export const storageFiles = {
    analysis: "slither-results.json" // file where analysis results will be stored
}

// User configuration definition
export interface UserConfiguration {
    solcPath : string;
    hiddenDetectors : string[];
}
const defaultConfiguration : UserConfiguration = {
    solcPath: "", // default solc path (if blank, no custom path)
    hiddenDetectors: [] // "check" properties to ignore in analysis results
}
export let userConfiguration : UserConfiguration = Object.assign({}, defaultConfiguration);

// Functions
export function createStorageDirectory(workspaceFolder : string) {
    let storageDirectory : string = getStorageDirectoryPath(workspaceFolder);
    shell.mkdir("-p", storageDirectory);
}

export function getStorageDirectoryPath(workspaceFolder : string) {
    return path.join(workspaceFolder, storagePath);
}

export function getStorageFilePath(workspaceFolder : string, fileName : string) {
    let storageDirectory : string = getStorageDirectoryPath(workspaceFolder);
    return path.join(storageDirectory, fileName);
}

export function readConfiguration() {
    // Start with the default configuration as a base to keep it clean
    userConfiguration = Object.assign({}, defaultConfiguration);

    // Dynamically copy every property which we define in.
    let workspaceConfiguration = Object.assign({}, vscode.workspace.getConfiguration("slither"));
    for (let key of Object.keys(userConfiguration)) {
        if(workspaceConfiguration.has(key)) {
            (<any>userConfiguration)[key] = workspaceConfiguration[key];
        }
    }
}

export function saveConfiguration() : boolean {
    // Obtain every property of the configuration.
    let workspaceConfiguration = vscode.workspace.getConfiguration("slither");
    for (let key of Object.keys(userConfiguration)) {
        workspaceConfiguration.update(key, (<any>userConfiguration)[key]);
    }
    return true;
}