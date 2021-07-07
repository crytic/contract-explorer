import { ResponseError } from "vscode-languageclient";
import { CompilationTarget } from "./configTypes";

/*
Data structure which represents parameters used to set compilation targets
*/
export interface SetCompilationTargetsParams {
    // Represents the list of compilation targets to compile and analyze. If empty, auto-compilation will be used.
    targets: CompilationTarget[];
}

export interface AnalysisResultProgress {
    succeeded: boolean | null;
    compilationTarget: CompilationTarget
    error?: string;
}

export interface AnalysisProgressParams {
    results: AnalysisResultProgress[];
}