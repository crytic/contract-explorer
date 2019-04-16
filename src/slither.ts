import * as config from "./config";
import * as vscode from 'vscode';
import * as util from "util";
import * as fs from "fs";
import * as semver from 'semver';
import * as child_process from 'child_process';
import { Logger } from "./logger";
import { SlitherDetector, SlitherResult } from "./slitherResults";

export const results : Map<string, SlitherResult[]> = new Map<string, SlitherResult[]>();

async function checkVersion() : Promise<boolean> {
    try {
        // Invoke slither to obtain the current version.
        let version = (await exec_slither('--version')).output.replace(/\r?\n|\r/g, "");

        // Verify we meet the minimum requirement.
        if(!semver.gt(version, config.minimumSlitherVersion)){
            Logger.error(
`Error: Incompatible version of slither. 
Minimum Requirement: ${config.minimumSlitherVersion}
Current version ${version}
Please upgrade slither: "pip install slither-analyzer --upgrade"`
            );
            return false;
        }
    } catch(e){
        // An error occurred checking version, assume slither is not installed.
        Logger.error(
`Error: Slither Installation Required
Please install slither: "pip install slither-analyzer"`
        );
        
        return false;
    }
    return true;
}

export async function getDetectors() : Promise<SlitherDetector[]> {
    // Obtain our detectors in json format.
    let output = (await exec_slither("--list-detectors-json")).output;

    // Return our parsed detectors.
    return JSON.parse(output);
}

export async function analyze() : Promise<boolean> {
    // Verify there is a workspace folder open to run analysis on.
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length == 0) {
        vscode.window.showErrorMessage('Error: There are no open workspace folders to run slither analysis on.');
        return false;
    }
    
    // Verify the provided slither version is supported.
    if(!(await checkVersion())) {
        return false;
    }

    // Print our starting analysis message.
    Logger.log("\u2E3B Starting analysis \u2E3B");

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
        const resultsPath  = config.getStorageFilePath(workspacePath, config.storageResultsFileName);

        // Clear the results file if it exists.
        if(fs.existsSync(resultsPath)) {
            fs.unlinkSync(resultsPath);
        }

        // Execute slither on this workspace.
        let { output, error } = await exec_slither(`${workspacePath} --disable-solc-warnings --json ${resultsPath}`, false);

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

    // We completed analysis without error.
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
        const resultsPath  = config.getStorageFilePath(workspacePath, config.storageResultsFileName);

        // Clear the results file if it exists.
        if(fs.existsSync(resultsPath)) {
            fs.unlinkSync(resultsPath);
        }
    }
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
        const resultsPath  = config.getStorageFilePath(workspacePath, config.storageResultsFileName);

        // If the file exists, we read its contents into memory.
        if(fs.existsSync(resultsPath)) {
            let workspaceResults : SlitherResult[] = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
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

async function printResults(data: SlitherResult[]) {
    data.forEach((item: SlitherResult) => {
        const descriptions = item.description.replace("#", ":").replace("\t", "").split("\n");
        descriptions.forEach((description: any) => {

            // Trim the description
            description = description.trim();
            
            // If any issue doesn't have a description, it is not output.
            if (description === "") {
                return;
            }
            
            // Seperate issues (following lines with a dash are usually connected to the issue above)
            if (!description.startsWith("-")) {
                Logger.log("");
            }

            // If it looks like a list item (starts with "-"), we standardize indenting and prefix with a bullet.
            // If it doesn't, it probably starts a new issue, and we prefix it with a red X.
            if (description.startsWith("-")) {
                Logger.log(`\t\u2022${description.substring(1)}`);
            } else {
                Logger.log(`\u274C ${description}`);
            }
        });
    });
}

async function exec_slither(args : string[] | string, logError : boolean = true) : Promise<{output : string, error : string}> { 
    // If this is an array, make it into a single string.
    if (args instanceof Array) {
        args = args.join(' ');
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