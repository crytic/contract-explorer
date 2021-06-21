import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../utils/logger';

export interface Configuration {
    // Filters to enable/disable detectors
    detectors: {
        // Global detector filters
        hidden: string[]; // List of detector.check's that are disabled.

        // TODO: Per-compilation detector filters can be added in the future, if desired.
    };

    compilations: CompilationSettings[];
}

enum CompilationTargetType {
    Basic = 'basic',
    SolcStandardJson = 'solc_standard_json'
}

export interface CompilationSettings {
    // The type of compilation target this is targetting.
    type: CompilationTargetType;

    // Settings for a basic compilation target.
    basic: {
        target: string;
    };

    // Settings for solc_standard_json compilation target.
    solc_standard_json: {
        targets: string[]  
    };

    // Settings shared between all compilation target types.
    shared: {
        remappings: Map<string, string>;
    }
}