import * as vscode from "vscode";
import * as path from "path";
import { Logger } from "./logger";

export interface SlitherCommandOutput {
    success: boolean;
    error: string | null | undefined;
    results: SlitherCommandResults | undefined;
}

export interface SlitherCommandResults {
    detectors: SlitherResult[] | undefined;
}

export interface SlitherDetector {
    index: number;
    check: string;
    title: string;
    impact: string;
    confidence: string;
    wiki_url: string;
    description: string;
    exploit_scenario: string;
    recommendation: string;
}

export interface SlitherResult {
    check: string;
    confidence: string;
    impact: string;
    description: string;
    elements: SlitherResultElement[];
    additional_fields: any | undefined;

    _ext_in_sync: boolean | undefined; // Extension: Used to check if source mappings are still valid.
}

export interface SlitherResultElement {
    name: string;
    source_mapping: SlitherSourceMapping;
    type: string;
    type_specific_fields: SlitherTypeSpecificFields | undefined;
    additional_fields: any | undefined;
}

export interface SlitherTypeSpecificFields {
    parent: SlitherResultElement | undefined;
}

export interface SlitherSourceMapping {
    start: number;
    length: number;
    filename_absolute: string;
    filename_relative: string;
    filename_short: string;
    filename_used: string;
    lines: number[];
    starting_column: number;
    ending_column: number;

    _ext_source_hash: string | undefined; // Extension: Hash of mapped source code.
}

export function getSanitizedDescription(result: SlitherResult): string {
    // Remove all filenames in brackets from the description
    return result.description.replace(new RegExp(/\s{0,1}\(\S*\.sol(?:\#\d+\-\d+|\#\d+){0,1}\)/, 'gi'), "").replace("\r\n", "\n");
}

export async function getResultElementRange(result: SlitherResult, elementIndex: number = 0, cleanerOverrides: boolean = true): Promise<[number, number, number, number]> {
    // Verify the index is correct
    if (result.elements.length <= elementIndex) {
        return [0, 0, 0, 0];
    }

    // Obtain our result element.
    let resultElement: SlitherResultElement = result.elements[elementIndex];

    // If we don't have a sourcemapping line, skip
    if (resultElement.source_mapping.lines.length <= 0) {
        return [0, 0, 0, 0];
    }

    let startLine = resultElement.source_mapping.lines[0] - 1;
    let startColumn = resultElement.source_mapping.starting_column - 1;
    let endLine = resultElement.source_mapping.lines[resultElement.source_mapping.lines.length - 1] - 1;
    let endColumn = resultElement.source_mapping.ending_column - 1;

    // If the result is more than one line, we simply select the first line.
    if (cleanerOverrides && endLine != startLine) {
        endLine = startLine + 1;
        endColumn = 0;
    }

    return [startLine, startColumn, endLine, endColumn];
}

export async function gotoResultCode(workspaceFolder: string, result: SlitherResult) {
    try {
        // If there are no elements for this check which map to source, we stop.
        if (result.elements.length <= 0 || !result.elements[0].source_mapping) {
            Logger.error("Could not navigate to slither result. The result has no source mappings.");
            return;
        }

        // If this is out of sync, show an error.
        if (!result._ext_in_sync) {
            Logger.error("Could not navigate to slither result. The mapped source code has been modified.");
            return;
        }

        // Obtain the filename
        let filename_absolute = path.join(workspaceFolder, result.elements[0].source_mapping.filename_relative);
        let fileUri: vscode.Uri = vscode.Uri.file(filename_absolute);

        // Open the document, then select the appropriate range for source mapping. 
        vscode.workspace.openTextDocument(fileUri).then((doc) => {
            vscode.window.showTextDocument(doc).then(async (editor) => {
                if (vscode.window.activeTextEditor) {
                    // We define the selection from the element.
                    let [startLine, startColumn, endLine, endColumn] = await getResultElementRange(result);
                    const selection = new vscode.Selection(startLine, startColumn, endLine, endColumn);

                    // Set the selection.
                    vscode.window.activeTextEditor.selection = selection;
                    vscode.window.activeTextEditor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
                }
            });
        });
    } catch (r: any) {
        // Log our error.
        Logger.error(r.message);
    }
}