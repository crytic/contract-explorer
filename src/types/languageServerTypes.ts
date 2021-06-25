export interface VersionData {
    slither: string;
    crytic_compile: string;
    slither_lsp: string;
}

export interface CommandLineArgumentGroup {
    title: string;
    args: CommandLineArgument[];
}

export interface CommandLineArgument {
    names: string[];
    help: string;
    default: string;
    dest: string;
}

export interface CreateAnalysisResult {
    analysisId: number;
}