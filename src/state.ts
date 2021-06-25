import { SlitherDetector } from './types/slitherTypes';
import { SlitherLanguageClient } from './slitherLanguageClient'
import { Logger } from './utils/logger';
import { createDirectory, deepClone, deepMerge } from './utils/common';
import { Configuration } from './types/configTypes';
import * as vscode from 'vscode';
import { Emitter, Event } from 'vscode-languageclient';
import { SlitherAnalyses } from './analysis/slitherAnalyses';
import * as path from 'path';
import * as fs from 'fs';
import { CommandLineArgumentGroup, VersionData } from './types/languageServerTypes';

// Constants
const DEFAULT_CONFIGURATION: Configuration = {
    detectors: {
        hidden: []
    },
    compilations: []
};

// General
let context: vscode.ExtensionContext;
let _initialized: boolean = false;
export function isInitialized(): boolean { return _initialized; }
export let client: SlitherLanguageClient | null;
export let configuration: Configuration = deepClone(DEFAULT_CONFIGURATION);

// Slither specific
export let versionData: VersionData | null = null;
export let detectors: SlitherDetector[] = [];
export let detectorsByCheck : Map<string, SlitherDetector> = new Map<string, SlitherDetector>();
export let compilationArguments: CommandLineArgumentGroup[] = [];
export let analyses: SlitherAnalyses | null = null;

// Events
let  _initializedEmitter: Emitter<void> = new Emitter<void>();
export let onInitialized: Event<void> = _initializedEmitter.event;

let  _savingConfigurationEmitter: Emitter<Configuration> = new Emitter<Configuration>();
export let onSavingConfiguration: Event<Configuration> = _savingConfigurationEmitter.event;

let _savedConfigurationEmitter: Emitter<Configuration> = new Emitter<Configuration>();
export let onSavedConfiguration: Event<Configuration> = _savedConfigurationEmitter.event;

export async function initialize(extensionContext: vscode.ExtensionContext, languageClient: SlitherLanguageClient): Promise<void> {
    // If we're already initialized, stop
    if(isInitialized()) {
        return;
    }

    // Reset our state
    resetState();

    // Set our extension context
    context = extensionContext;

    // Read our configuration.
    readConfiguration();

    // Set our language client
    client = languageClient;

    // Obtain our versions
    versionData = await client.getVersionData();

    // Obtain our detectors list
    detectors = await client.getDetectorList();
    detectors.sort((a, b) => (a.check > b.check) ? 1 : -1);

    // Create a map of check->detector
    detectorsByCheck.clear();
    for (let detector of detectors) {
        detectorsByCheck.set(detector.check, detector);
    }

    // Obtain our compilation command line arguments
    compilationArguments = await client.getCompileCommandLineArguments();

    // Initialize our analyses class.
    analyses = new SlitherAnalyses(client);

    // Set our initialized state.
    _initialized = true;
    _initializedEmitter.fire();
}

export async function resetState(): Promise<void> {
    // Clear all state variables
    client = null;
    versionData = null;
    detectors = [];
    compilationArguments = [];
    analyses = null;

    // Perform a deep clone of the default configuration.
    configuration = deepClone(DEFAULT_CONFIGURATION);

    // Set our initialized state to false.
    _initialized = false;
}

export function readConfiguration() {
    // TODO: Re-enable storage in VSCode configuration if https://github.com/microsoft/vscode/issues/126972 is fixed. 
    /*
    // Obtain the workspace configuration
    let workspaceConfiguration = deepClone(vscode.workspace.getConfiguration("slither"));

    // Return a merged copy of the workspace configuration with the default.
    configuration = <Configuration>deepMerge({}, DEFAULT_CONFIGURATION, workspaceConfiguration);
    */
    if(vscode.workspace.workspaceFolders?.length) {
        let workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        let configPath = path.join(workspaceFolder, './.vscode/', 'slither-config.json');
        if(fs.existsSync(configPath)) {
            let data = fs.readFileSync(configPath, 'utf8');
            configuration = JSON.parse(data);
        }
    }
}

export function saveConfiguration(config: Configuration | null = null) {
    // If we have a configuration, set our config
    if (config != null) {
        configuration = config;
    }

    // Fire our saving event
    _savingConfigurationEmitter.fire(configuration);
    
    // TODO: Re-enable storage in VSCode configuration if https://github.com/microsoft/vscode/issues/126972 is fixed. 
    /*
    // Obtain every property of the configuration.
    let workspaceConfiguration = vscode.workspace.getConfiguration("slither");

    // Loop for each key in our configuration and set it.
    for (let key in configuration) {
        workspaceConfiguration.update(key, (<any>configuration)[key]);
    }
    */
    if(vscode.workspace.workspaceFolders?.length) {
        let workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        let storagePath = path.join(workspaceFolder, './.vscode/');
        createDirectory(storagePath);
        let configPath = path.join(storagePath, 'slither-config.json');
        fs.writeFileSync(configPath, JSON.stringify(configuration, null, "\t"));
    }

    // Fire our saved event
    _savedConfigurationEmitter.fire(configuration);
}