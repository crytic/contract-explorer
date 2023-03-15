import * as vscode from "vscode";
import * as path from "path";
import { Logger } from "../utils/logger";

export interface Configuration {
  // Filters to enable/disable detectors
  detectors: DetectorSettings;
  compilations: CompilationTarget[];
}

enum CompilationTargetType {
  Basic = "basic",
  StandardJson = "standard_json",
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

  // The name of a workspace which should be used as the working directory for compilation and analysis.
  cwdWorkspace: string;
}

export interface DetectorSettings {
  // Signifies whether the detector output will be used in diagnostics, etc.
  enabled: boolean;

  // A set of detector.check identifiers which we will hide.
  hiddenChecks: string[];
}
