import * as vscode from "vscode";
import * as config from "./config";
import { Logger } from "./logger";
import * as path from "path";
import * as slither from "./slither";
import * as slitherResults from "./slitherResults";

function getCodeLensDescription(result : slitherResults.SlitherResult) : string {
    // Only obtain the first line of sanitized output
    let lines = slitherResults.getSanitizedDescription(result).split('\n');
    let codeLensDescription = lines[0];

    // Remove any colon leading to other lines we have removed
    if(codeLensDescription[codeLensDescription.length - 1] == ':') {
        codeLensDescription = codeLensDescription.substring(0, codeLensDescription.length - 1);
    }

    // Add a symbol which denotes multi-line response.
    if(lines.length > 1) {
        codeLensDescription += " [...]";
    }
    return codeLensDescription;
}

async function getSlitherResultRange(result : slitherResults.SlitherResult) : Promise<[number, number, number, number]> {
    // Obtain our result element.
    let resultElement : slitherResults.SlitherResultElement = result.elements[0];

    // If we don't have a sourcemapping line, skip
    if (!resultElement.source_mapping.lines[0]) {
        return [0, 0, 0, 0];
    }

    let startLine = resultElement.source_mapping.lines[0] - 1;
    let startColumn = resultElement.source_mapping.starting_column - 1;
    let endLine = resultElement.source_mapping.lines[resultElement.source_mapping.lines.length - 1] - 1;
    let endColumn = resultElement.source_mapping.ending_column - 1;
    return [startLine, startColumn, endLine, endColumn];
}

export async function gotoResult(result : slitherResults.SlitherResult) {
    try {
        // If there are no elements for this check which map to source, we stop.
        if (result.elements.length == 0) {
            return;
        }

        // Obtain our result element.
        let resultElement : slitherResults.SlitherResultElement = result.elements[0];

        // Obtain the filename
        let fileUri : vscode.Uri = vscode.Uri.file(resultElement.source_mapping.filename_absolute);

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

export class SlitherResultLensProvider implements vscode.CodeLensProvider {

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        // Loop through each slither result to build a list of codelens objects.
        let codeLensResults : vscode.CodeLens[] = [];
        let documentFilename = path.normalize(document.fileName);
        for(let [workspaceFolder, workspaceResults] of slither.results) {
            for (let workspaceResult of workspaceResults) {
                // Skip this result if it is not the correct filename.
                if (!workspaceResult.elements || path.normalize(workspaceResult.elements[0].source_mapping.filename_absolute) != documentFilename) {
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
                    command: "slither.onCodeLensClick",
                    title: getCodeLensDescription(workspaceResult),
                    arguments: [workspaceResult]
                };
                let [startLine, startColumn, endLine, endColumn] = await getSlitherResultRange(workspaceResult);
                codeLensResults.push(new vscode.CodeLens(new vscode.Range(startLine, startColumn, endLine, endColumn), codeLensAnnotation));
            }
        }
        return codeLensResults;
    }

    public static async onCodeLensClick (result : slitherResults.SlitherResult) {
        // Print the result
        slither.printResult(result);
    }    
}