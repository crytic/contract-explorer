import * as state from "../state"
import * as vscode from "vscode"
import * as path from "path"
import { SlitherDetectorResult, SlitherDetectorResultElement } from "../types/slitherTypes";
import { Logger } from "../utils/logger";

export async function printResult(result : SlitherDetectorResult, filterDetectors : boolean = true) {
    // If this detector is hidden, skip it.
    if(filterDetectors && state.configuration.detectors.hidden.length > 0) {
      if (state.configuration.detectors.hidden.indexOf(result.check) >= 0) {
          return;
      }
  }

  // Define our output result
  let outputResult = "";

  // Obtain the description and reformat it line-by-line.
  const descriptions = result.description.replace("#", ":").replace("\t", "").split("\n");
  let outputLine : boolean = false;
  for (let i = 0; i < descriptions.length; i++) {
      // Trim the description
      let description = descriptions[i].trim();
      
      // If any issue doesn't have a description, it is not output.
      if (description === "") {
          continue;
      }
      
      // Print the line accordingly.
      if (!outputLine) {
          // The first line output should be prefixed with a red X icon.
          outputResult += `\u274C ${description}\n`;
          outputLine = true;
      }
      else if (description.startsWith("-")) {
          // Dashes which indicate a list are converted into bullets.
          outputResult += `\t\u2022${description.substring(1)}\n`;
      }
  }

  // Seperate issues (following lines with a dash are usually connected to the issue above)
  if(outputLine) {
      outputResult += "\n";
  }

  // Log our output result
  Logger.log(outputResult);
}

export async function printResults(detectorResults: SlitherDetectorResult[], filterDetectors : boolean = true) {
  detectorResults.forEach((result: SlitherDetectorResult) => {
      printResult(result, filterDetectors);
  });
}

export async function gotoResultCode(workspaceFolder : string, result : SlitherDetectorResult) {
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
        let fileUri : vscode.Uri = vscode.Uri.file(filename_absolute);

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
    } catch (r) {
        // Log our error.
        Logger.error(r.message);
    }
}

export async function getResultElementRange(result : SlitherDetectorResult, elementIndex : number = 0, cleanerOverrides : boolean = true) : Promise<[number, number, number, number]> {
    // Verify the index is correct
    if (result.elements.length <= elementIndex) {
        return [0, 0, 0, 0];
    }

    // Obtain our result element.
    let resultElement : SlitherDetectorResultElement = result.elements[elementIndex];

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
