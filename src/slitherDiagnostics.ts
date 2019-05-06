import * as vscode from "vscode";
import * as config from "./config";
import * as path from "path";
import * as slither from "./slither";
import * as slitherResults from "./slitherResults";

export class SlitherDiagnosticProvider {
    public diagnosticCollection : vscode.DiagnosticCollection;

    constructor(diagnosticCollection : vscode.DiagnosticCollection) {
        // Set the diagnostic collection for this provider.
        this.diagnosticCollection = diagnosticCollection;
    } 

    public async refreshDiagnostics() {
        // Clear the diagnostic collection.
        this.diagnosticCollection.clear();

        // Create a map of filename->diagnostics
        let fileDiagnosticMap : Map<string, vscode.Diagnostic[]> = new Map<string, vscode.Diagnostic[]>();

        // Loop through all workspace results
        for(let [workspaceFolder, workspaceResults] of slither.results) {
            for (let workspaceResult of workspaceResults) {

                // If the workspace result is out of sync, skip it
                if(!workspaceResult._ext_in_sync) {
                    continue;
                }

                // Loop for each element to try and find a source mapping
                for (let workspaceResultElement of workspaceResult.elements) {

                    // Skip this element if it has no source mapping
                    if (!workspaceResultElement.source_mapping) {
                        continue;
                    }

                    // Skip this result if it is on the hidden detector list.
                    if (config.userConfiguration.hiddenDetectors) {
                        if(config.userConfiguration.hiddenDetectors.indexOf(workspaceResult.check) >= 0) {
                            continue;
                        }
                    }

                    // Obtain the range of our source mapping.
                    let [startLine, startColumn, endLine, endColumn] = await slitherResults.getResultElementRange(workspaceResult);
                    let resultRange : vscode.Range = new vscode.Range(startLine, startColumn, endLine, endColumn);

                    // Determine the diagnostic severity
                    let diagnosticSeverity : vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Information;
                    switch(workspaceResult.impact) {
                        case "High":
                            diagnosticSeverity = vscode.DiagnosticSeverity.Error;
                            break;
                        case "Medium":
                        case "Low":
                            diagnosticSeverity = vscode.DiagnosticSeverity.Warning;
                            break;
                        default:
                            diagnosticSeverity = vscode.DiagnosticSeverity.Information;
                            break;
                    }

                    // Create a diagnostic
                    let diagnosticResult : vscode.Diagnostic = new vscode.Diagnostic(resultRange, workspaceResult.description.replace(/^\s+|\s+$/g, ''), diagnosticSeverity);

                    // Obtain the absolute file path
                    let filename_absolute = path.join(workspaceFolder, workspaceResultElement.source_mapping.filename_relative);

                    // If we don't have a diagnostic list for this file yet, create one.
                    let diagnosticArray = fileDiagnosticMap.get(filename_absolute);
                    if(!diagnosticArray) {
                        diagnosticArray = [];
                        fileDiagnosticMap.set(filename_absolute, diagnosticArray);
                    }

                    // Push the diagnostic and break out of looping elements to move onto the next result.
                    diagnosticArray.push(diagnosticResult);
                    break;
                }
            }
        }
        
        // Populate the diagnostic collection with our results.
        for(let [filename_absolute, diagnosticArray] of fileDiagnosticMap) {
            let fileUri = vscode.Uri.file(filename_absolute);
            this.diagnosticCollection.set(fileUri, diagnosticArray);
        }
    }
}
