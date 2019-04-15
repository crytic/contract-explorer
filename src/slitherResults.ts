import * as vscode from 'vscode';
import { Logger } from "./logger";

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
            vscode.window.showTextDocument(doc).then((editor) => {
                if (vscode.window.activeTextEditor) {
                    // We define the selection from the element.
                    let startLine = resultElement.source_mapping.lines[0] - 1;
                    let endLine = resultElement.source_mapping.lines[resultElement.source_mapping.lines.length - 1] - 1;
                    let lastLineLength = vscode.window.activeTextEditor.document.lineAt(endLine).text.length;
                    const selection = new vscode.Selection(startLine, 0, endLine, lastLineLength);

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