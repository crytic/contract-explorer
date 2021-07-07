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

    compilations: CompilationTarget[];
}

enum CompilationTargetType {
    Basic = 'basic',
    SolcStandardJson = 'solc_standard_json'
}

export interface CompilationTarget {
    // The type of compilation target this is targetting.
    targetType: CompilationTargetType;

    // Settings for a basic compilation target.
    targetBasic: {
        target: string;
    };

    // Settings for solc_standard_json compilation target.
    targetStandardJson: {};
}