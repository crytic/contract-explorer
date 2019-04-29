import * as vscode from 'vscode';
import * as config from "./config";
import * as child_process from 'child_process';
import * as fs from "fs";
import { Logger } from "./logger";
import * as semver from 'semver';
import { SlitherDetector, SlitherResult } from "./slitherResults";
import * as util from "util";

// Properties
export let initialized : boolean = false;
export let version : string;
export let detectors : SlitherDetector[];
export const results : Map<string, SlitherResult[]> = new Map<string, SlitherResult[]>();

// Functions
export async function initialize() : Promise<boolean> {
    // Set our initialized flag to false in case of re-initialization.
    initialized = false;

    try {
        // Obtain our slither detectors
        let output = (await exec_slither("--list-detectors-json")).output;
        detectors = JSON.parse(output);

        // Obtain a list of detectors and sort them by check name.
        detectors.sort((a, b) => (a.check > b.check) ? 1 : -1);

        // Obtain our slither version
        version = (await exec_slither('--version')).output.replace(/\r?\n|\r/g, "");

        // Verify we meet the minimum version requirement.
        if(!semver.gte(version, config.minimumSlitherVersion)){
            Logger.error(
`Error: Incompatible version of slither
Minimum Requirement: ${config.minimumSlitherVersion}
Current version ${version}
Please upgrade slither: "pip install slither-analyzer --upgrade"`
            );
        } else {
            // Initialization succeeded.
            initialized = true;
        }
    } catch (e) {
        // Print our error and return a null array.
        Logger.error(
`Error: Slither initialization failed 
Please verify slither is installed: "pip install slither-analyzer"`
        );
    }

    return initialized;
}

export async function analyze() : Promise<boolean> {
    // Verify there is a workspace folder open to run analysis on.
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length == 0) {
        vscode.window.showErrorMessage('Error: There are no open workspace folders to run slither analysis on.');
        return false;
    }

    // Print our starting analysis message.
    Logger.log("\u2E3B Starting analysis \u2E3B");

    // If we have not initialized slither, try to do so now.
    if (!initialized) {
        if(!await initialize()) {
            return false;
        }
    }

    // Setup our state
    results.clear();

    // Loop for every workspace to run analysis on.
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < vscode.workspace.workspaceFolders.length; i++) {

        // TODO: Add ability to filter workspace folders out here.

        // Obtain our workspace path.
        const workspacePath = vscode.workspace.workspaceFolders[i].uri.fsPath;

        // Create the storage directory if it does not exist.
        config.createStorageDirectory(workspacePath);

        // Obtain our results storage path.
        const resultsPath  = config.getStorageFilePath(workspacePath, config.storageFiles.analysis);

        // Clear the results file if it exists.
        if(fs.existsSync(resultsPath)) {
            fs.unlinkSync(resultsPath);
        }

        // Execute slither on this workspace.
        let { output, error } = await exec_slither(`${workspacePath} --solc-disable-warnings --disable-color --json "${resultsPath}"`, false);

        // Errors are thrown when slither succeeds. We should also have a results file.
        if (error && !fs.existsSync(resultsPath)) {
            // We couldn't find a results file, this is probably a real error.
            Logger.error(`Error in workspace "${workspacePath}":`);
            Logger.error(error!.toString());
            failCount++;
            continue;
        }

        // Add to the success count
        successCount++;
    }

    // Print our results.
    readResults(true);

    // Print our analysis results.
    Logger.log("");
    Logger.log(`\u2E3B Analysis: ${successCount} succeeded, ${failCount} failed, ${vscode.workspace.workspaceFolders.length - (successCount + failCount)} skipped \u2E3B`);

    // Save all configurations
    config.saveConfiguration();

    // We completed analysis without error.
    return true;
}

export async function readResults(print : boolean = false) : Promise<boolean> {
    // Verify there is a workspace folder open to run analysis on.
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length == 0) {
        vscode.window.showErrorMessage('Error: There are no open workspace folders to run slither analysis on.');
        return false;
    }

    // Setup our state
    results.clear();

    // Loop for every workspace to read results from.
    for (let i = 0; i < vscode.workspace.workspaceFolders.length; i++) {

        // TODO: Add ability to filter workspace folders out here.

        // Obtain our workspace results path.
        const workspacePath = vscode.workspace.workspaceFolders[i].uri.fsPath;
        const resultsPath  = config.getStorageFilePath(workspacePath, config.storageFiles.analysis);

        // If the file exists, we read its contents into memory.
        if(fs.existsSync(resultsPath)) {
            // Read our results to a temporary array
            let tempWorkspaceResults : SlitherResult[] = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
            let processedResults : Set<string> = new Set<string>();
            let workspaceResults : SlitherResult[] = [];
        
            // Compile a filtered, final array (free of duplicates).
            for(let i = 0; i < tempWorkspaceResults.length; i++) {
                let jsonStringResult = JSON.stringify(tempWorkspaceResults[i]);
                if(!processedResults.has(jsonStringResult)) {
                    workspaceResults.push(tempWorkspaceResults[i]);
                    processedResults.add(jsonStringResult);
                }
            }

            // Set the results and print them.
            results.set(workspacePath, workspaceResults);
            if (print) {
                printResults(workspaceResults);
            }
        }
        else {
            // The file did not exist, so we simply use an empty array of results.
            results.set(workspacePath, []);
        }
    }

    // We succeeded without error.
    return true;
}

export async function clear() {
    // Verify there is a workspace folder open to clear results for.
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length == 0) {
        return;
    }

    // Loop for every workspace to remove
    for (let i = 0; i < vscode.workspace.workspaceFolders.length; i++) {
        
        // Obtain our workspace path.
        const workspacePath = vscode.workspace.workspaceFolders[i].uri.fsPath;

        // Obtain our results storage path.
        const resultsPath  = config.getStorageFilePath(workspacePath, config.storageFiles.analysis);

        // Clear the results file if it exists.
        if(fs.existsSync(resultsPath)) {
            fs.unlinkSync(resultsPath);
        }
    }
}

export async function printResult(item : SlitherResult, filterDetectors : boolean = true) {
      // If this detector is hidden, skip it.
      if(filterDetectors && config.userConfiguration.hiddenDetectors.length > 0) {
        if (config.userConfiguration.hiddenDetectors.indexOf(item.check) >= 0) {
            return;
        }
    }

    // Obtain the description and reformat it line-by-line.
    const descriptions = item.description.replace("#", ":").replace("\t", "").split("\n");
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
            Logger.log(`\u274C ${description}`);
            outputLine = true;
        }
        else if (description.startsWith("-")) {
            // Dashes which indicate a list are converted into bullets.
            Logger.log(`\t\u2022${description.substring(1)}`);
        }
    }

    // Seperate issues (following lines with a dash are usually connected to the issue above)
    if(outputLine) {
        Logger.log("");
    }
}
export async function printResults(data: SlitherResult[], filterDetectors : boolean = true) {
    data.forEach((item: SlitherResult) => {
        printResult(item, filterDetectors);
    });
}

async function exec_slither(args : string[] | string, logError : boolean = true) : Promise<{output : string, error : string}> { 
    // If this is an array, make it into a single string.
    if (args instanceof Array) {
        args = args.join(' ');
    }

    // If we have a custom defined solc path, prefix our arguments with that.
    if(config.userConfiguration.solcPath) {
        args = `--solc "${config.userConfiguration.solcPath}" ${args}`;
        Logger.log(`Invoking slither with custom solc path: "${config.userConfiguration.solcPath}"`);
    }

    // Now we can invoke slither.
    let stderr;
    let cmd = util.promisify(child_process.exec);
    let { stdout } = await cmd(`${config.slitherPath} ${args}`).catch((e: any) => stderr = e);

    // If we encountered an error, log it
    if (stderr && logError) { 
        Logger.error(String(stderr));
    }

    // Return stdout/stderr.
    return { output : String(stdout), error : String(stderr)};
}