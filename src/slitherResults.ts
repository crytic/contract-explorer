import * as config from "./config"
import * as slither from "./slither";
import * as vscode from "vscode";
import { Logger } from "./logger";
import * as path from "path";

export interface SlitherDetector {
    check : string;
    confidence : string;
    impact : string;
    title : string;
    description : string;
}

export interface SlitherResult {
    check : string;
    confidence : string;
    impact : string;
    description : string;
    elements : SlitherResultElement[];
}

export interface SlitherResultElement { 
    name : string;
    source_mapping : SlitherSourceMapping;
    type : string;
}

export interface SlitherSourceMapping { 
    start : number;
    length : number;
    filename : string;
    lines : number[];
}

async function getSlitherResultRange(result : SlitherResult) : Promise<[number, number, number, number]> {
    // Obtain our result element.
    let resultElement : SlitherResultElement = result.elements[0];

    // If we don't have a sourcemapping line, skip
    if (!resultElement.source_mapping.lines[0]) {
        return [0, 0, 0, 0];
    }

    let startLine = resultElement.source_mapping.lines[0] - 1;
    let startColumn = 0;
    let endLine = resultElement.source_mapping.lines[resultElement.source_mapping.lines.length - 1] - 1;
    let documentsWithName = vscode.workspace.textDocuments.find(document => path.normalize(document.fileName) == path.normalize(resultElement.source_mapping.filename));
    if (documentsWithName) {
        let endColumn = documentsWithName.lineAt(endLine).text.length;
        return [startLine, startColumn, endLine, endColumn];
    } else {
        return [startLine, startColumn, endLine + 1, 0];
    }
}

export async function gotoResult(result : SlitherResult) {
    try {
        // If there are no elements for this check which map to source, we stop.
        if (result.elements.length == 0) {
            return;
        }

        // Obtain our result element.
        let resultElement : SlitherResultElement = result.elements[0];

        // Obtain the filename
        let fileUri : vscode.Uri = vscode.Uri.file(resultElement.source_mapping.filename);

        // Open the document, then select the appropriate range for source mapping. 
        vscode.workspace.openTextDocument(fileUri).then((doc) => {
            vscode.window.showTextDocument(doc).then(async (editor) => {
                if (vscode.window.activeTextEditor) {
                    // We define the selection from the element.
                    let [startLine, startColumn, endLine, endColumn] = await getSlitherResultRange(result);
                    const selection = new vscode.Selection(startLine, startColumn, endLine, endColumn);

                    // Set the selection.
                    vscode.window.activeTextEditor.selection = selection;
                    vscode.window.activeTextEditor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
                }
            });
        });
    } catch (r) {
        // Log our error.
        Logger.log(`Error: ${r.message}`);

        // Show an error message.
        vscode.window.showErrorMessage(r.message);
    }
}

export default class SlitherResultLensProvider implements vscode.CodeLensProvider {

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        // Loop through each slither result to build a list of codelens objects.
        let codeLensResults : vscode.CodeLens[] = [];
        let documentFilename = path.normalize(document.fileName);
        for(let [workspaceFolder, workspaceResults] of slither.results) {
            for (let workspaceResult of workspaceResults) {
                // Skip this result if it is not the correct filename.
                if (!workspaceResult.elements || path.normalize(workspaceResult.elements[0].source_mapping.filename) != documentFilename) {
                    continue;
                }
                // Skip this result if it is on the hidden detector list.
                if (config.userConfiguration.hiddenDetectors) {
                    if(config.userConfiguration.hiddenDetectors.indexOf(workspaceResult.check) >= 0) {
                        continue;
                    }
                }

                // Create the annotation for this code.
                let codeLensAnnotation: vscode.Command = {
                    command: "slither.TODO",
                    title: workspaceResult.description
                };
                let [startLine, startColumn, endLine, endColumn] = await getSlitherResultRange(workspaceResult);
                codeLensResults.push(new vscode.CodeLens(new vscode.Range(startLine, startColumn, endLine, endColumn), codeLensAnnotation));
            }
        }
        return codeLensResults;
    }
}