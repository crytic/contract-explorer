import * as vscode from "vscode";
import * as config from "./config";
import * as extension from "./extension";
import { Logger } from "./logger";
import * as path from "path";
import * as slither from "./slither";
import * as slitherResults from "./slitherResults";

export class SlitherCodeLensProvider implements vscode.CodeLensProvider {

    public codeLensChangeEmitter: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this.codeLensChangeEmitter.event;

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        // Loop through each slither result to build a list of codelens objects.
        let codeLensResults : vscode.CodeLens[] = [];
        let documentFilename = path.normalize(document.fileName);
        for(let [workspaceFolder, workspaceResults] of slither.results) {
            for (let workspaceResult of workspaceResults) {
                // Loop for each workspace result element
                for(let workspaceResultElement of workspaceResult.elements) {
                    // If this result does not have an element with a source mapping, we skip it.
                    if(!workspaceResultElement.source_mapping) {
                        continue;
                    }

                    // Skip this result if it is not the correct filename.
                    let filename_absolute = path.join(workspaceFolder, workspaceResultElement.source_mapping.filename_relative);
                    if (!workspaceResult._ext_in_sync || !workspaceResult.elements || path.normalize(filename_absolute) != path.normalize(documentFilename)) {
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
                        title: this.getCodeLensDescription(workspaceResult),
                        arguments: [workspaceResult]
                    };
                    let [startLine, startColumn, endLine, endColumn] = await slitherResults.getResultElementRange(workspaceResult);
                    codeLensResults.push(new vscode.CodeLens(new vscode.Range(startLine, startColumn, endLine, endColumn), codeLensAnnotation));
                    break;
                }
            }
        }
        return codeLensResults;
    }

    private getCodeLensDescription(result : slitherResults.SlitherResult) : string {
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

    public async onCodeLensClick (result : slitherResults.SlitherResult) {
        // Obtain the issue node
        let resultNode = extension.slitherExplorerTreeProvider.getNodeFromResult(result);
        if (resultNode) {
            extension.slitherExplorerTree.reveal(resultNode, { select: true, focus : true, expand : false});
        } else {
            Logger.error("Failed to select node for slither result.");
        }

        // Print the result
        Logger.log(
`\u2E3B\u2E3B\u2E3B
Clicked issue annotation:`
            );
        slither.printResult(result);
        let resultDetector = slither.detectorsByCheck.get(result.check);
        if (resultDetector) {
            Logger.log(`Recommendation:\n ${resultDetector.recommendation}`);
        }
        Logger.log("\u2E3B\u2E3B\u2E3B");
    }    
}
