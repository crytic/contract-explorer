import { ResponseError } from "vscode-languageclient";
import { CompilationSettings } from "./configTypes";
import { SlitherDetectorResult } from "./slitherTypes";

//#region Events
export interface OnAnalysisSuccessEventArgs {
    compilationIndex: number;
    compilationSettings: CompilationSettings;
    analysis: SlitherAnalysis
}
export interface OnAnalysisFailedEventArgs {
    compilationIndex: number;
    error: ResponseError<any>;
}

export interface OnAnalyzeAllProgress {
    totalCompilations: number;
    successfulCompilations: number;
    failedCompilations: number;
}
//#endregion

export interface SlitherAnalysis {
    id: number;
    detectorResults: SlitherDetectorResult[];
}