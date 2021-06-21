import { SlitherDetector, SlitherVersionData } from './types/detectorOutputTypes';
import { SlitherLanguageClient } from './slitherLanguageClient'
import { Logger } from './utils/logger';
import { deepClone, deepMerge } from './utils/common';
import { Configuration } from './types/configTypes';
import * as vscode from 'vscode';
import { Emitter, Event } from 'vscode-languageclient';

// Constants
const DEFAULT_CONFIGURATION: Configuration = {
    detectors: {
        hidden: []
    },
    compilations: []
};

// General
let _initialized: boolean = false;
export function isInitialized(): boolean { return _initialized; }
export let slitherLanguageClient: SlitherLanguageClient | null;
export let configuration!: Configuration;

// Slither specific
export let versionData: SlitherVersionData | null = null;
export let detectors!: SlitherDetector[];

// Events
let  _initializedEmitter: Emitter<void> = new Emitter<void>();
export let onInitialized: vscode.Event<void> = _initializedEmitter.event;

let  _savingConfigurationEmitter: Emitter<Configuration> = new Emitter<Configuration>();
export let onSavingConfiguration: vscode.Event<Configuration> = _savingConfigurationEmitter.event;

let _savedConfigurationEmitter: Emitter<Configuration> = new Emitter<Configuration>();
export let onSavedConfiguration: vscode.Event<Configuration> = _savedConfigurationEmitter.event;

export async function initialize(client: SlitherLanguageClient): Promise<void> {
    // If we're already initialized, stop
    if(isInitialized()) {
        return;
    }

    // Reset our state
    resetState();

    // Read our configuration.
    readConfiguration();

    // Set our language client
    slitherLanguageClient = client;

    // Obtain our versions
    versionData = await slitherLanguageClient.getVersionData();

    // Obtain our detectors list
    detectors = await slitherLanguageClient.getDetectorList();

    // Set our initialized state.
    _initialized = true;
    _initializedEmitter.fire();
}

export async function resetState(): Promise<void> {
    // Clear all state variables
    slitherLanguageClient = null;
    detectors = [];
    versionData = null;

    // Perform a deep clone of the default configuration.
    configuration = deepClone(DEFAULT_CONFIGURATION);

    // Set our initialized state to false.
    _initialized = false;
}

export function readConfiguration() {
    // Obtain the workspace configuration
    let workspaceConfiguration = deepClone(vscode.workspace.getConfiguration("slither"));
    
    // Return a merged copy of the workspace configuration with the default.
    configuration = <Configuration>deepMerge({}, DEFAULT_CONFIGURATION, workspaceConfiguration);
}

export function saveConfiguration(config: Configuration | null = null) {
    // If we have a configuration, set our config
    if (config != null) {
        configuration = config;
    }

    // Fire our saving event
    _savingConfigurationEmitter.fire(configuration);
    
    // Obtain every property of the configuration.
    let workspaceConfiguration = vscode.workspace.getConfiguration("slither");

    // Loop for each key in our configuration and set it.
    for (let key in configuration) {
        workspaceConfiguration.update(key, (<any>configuration)[key]);
    }

    // Fire our saved event
    _savedConfigurationEmitter.fire(configuration);
}