import * as path from "path";
import * as fs from "fs";
import * as shell from "shelljs";
import * as vscode from "vscode";

// Constants
const storagePath : string = "./.slither"; // Directory relative to workspace to store files
export const slitherPath : string = "slither"; // Slither path
export const minimumSlitherVersion : string = '0.4.0'; // minimum supported slither version
export const storageFiles = {
    analysis: "analysis-results.json", // file where analysis results will be stored
    config: "config.json" // file where config properties will be saved
}

// User configuration definition
export interface Configuration {
    solcPath : string;
    ignoreDetectors : string[];
}
const defaultConfiguration : Configuration = {
    solcPath: "", // default solc path (if blank, no custom path)
    ignoreDetectors: [] // 'check' properties to ignore in analysis results
}
export const configurations : Map<string, Configuration> = new Map<string, Configuration>();

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

export function readAllConfigurations() {
    // Verify there is a workspace folder open
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length == 0) {
        return;
    }

    // Clear all configurations
    configurations.clear();

    // Loop through all workspaces
    for (let i = 0; i < vscode.workspace.workspaceFolders.length; i++) {
        // Read the configuration for this workspace
        let workspaceFolder : string = vscode.workspace.workspaceFolders[i].uri.fsPath;
        let configPath : string = getStorageFilePath(workspaceFolder, storageFiles.config);
        let config : Configuration;
        if(fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } else {
            config = Object.assign({}, defaultConfiguration);
        }

        // Set the configuration in the set.
        configurations.set(workspaceFolder, config);
    }
}

export function saveConfiguration(workspaceFolder : string) : boolean {
    // Check if this workspace is in our configurations.
    if (!configurations.has(workspaceFolder)) {
        return false;
    }

    // Write the configuration file.
    let configPath : string = getStorageFilePath(workspaceFolder, storageFiles.config);
    let config : Configuration = <Configuration>configurations.get(workspaceFolder);
    fs.writeFileSync(configPath, JSON.stringify(config, null, '\t'));

    return true;
}

export function saveAllConfigurations() : boolean { 
    // Loop through all workspaces and save each configuration
    let result : boolean = true;
    for (let [workspaceFolder, config] of configurations) {
        result = result && saveConfiguration(workspaceFolder);
    }
    return result;
}