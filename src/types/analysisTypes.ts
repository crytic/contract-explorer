import { CompilationSettings } from "./configTypes";
import { SlitherDetectorResult } from "./slitherTypes";

export interface OnAnalyzedEventArgs {
    compilationIndex: number,
    compilationSettings: CompilationSettings,
    analysis: SlitherAnalysis
}

export interface SlitherAnalysis {
    id: number;
    detectorResults: SlitherDetectorResult[];
}