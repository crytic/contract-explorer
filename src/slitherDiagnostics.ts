import * as vscode from "vscode";
import * as config from "./config";
import * as extension from "./extension";
import { Logger } from "./logger";
import * as path from "path";
import * as slither from "./slither";
import * as slitherResults from "./slitherResults";
import { stringify } from "querystring";

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

                // Skip this result if it is not the correct filename.
                if (!workspaceResult._ext_in_sync || !workspaceResult.elements) {
                    continue;
                }

                // Skip this result if it is on the hidden detector list.
                if (config.userConfiguration.hiddenDetectors) {
                    if(config.userConfiguration.hiddenDetectors.indexOf(workspaceResult.check) >= 0) {
                        continue;
                    }
                }

                // Obtain the absolute file path
                let filename_absolute = path.join(workspaceFolder, workspaceResult.elements[0].source_mapping.filename_relative);

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
                let diagnosticResult : vscode.Diagnostic = new vscode.Diagnostic(resultRange, workspaceResult.description, diagnosticSeverity);
                
                // If we don't have an item for this yet, set it
                let diagnosticArray = fileDiagnosticMap.get(filename_absolute);
                if(!diagnosticArray) {
                    diagnosticArray = [];
                    fileDiagnosticMap.set(filename_absolute, diagnosticArray);
                }

                diagnosticArray.push(diagnosticResult);
            }
        }
        
        // Populate the diagnostic collection with our results.
        for(let [filename_absolute, diagnosticArray] of fileDiagnosticMap) {
            let fileUri = vscode.Uri.file(filename_absolute);
            this.diagnosticCollection.set(fileUri, diagnosticArray);
        }
    }
}
