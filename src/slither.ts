import * as config from "./config";
import * as vscode from 'vscode';
import * as util from "util";
import * as fs from "fs";
import * as semver from 'semver';
import * as child_process from 'child_process';
import { Logger } from "./logger";

export const results : Map<string, []> = new Map<string, []>();

const checkVersion = async () => {
    try {
        // Invoke slither to obtain the current version.
        let version = (await exec('--version')).output.replace(/\r?\n|\r/g, "");

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

export async function getDetectors() : Promise<any> {
    // Obtain our detectors in json format.
    let output = (await exec("--list-detectors-json")).output;

    // Return our parsed detectors.
    return JSON.parse(output);
}

export const validateDetectors = async(input: []) => {
    // Parse supported detectors
    let detectors = (await getDetectors()).map((item: any) => item['check']);

    // Verify no detectors were provided which are unsupported.
    let unsupported  = input.filter(x => !detectors.includes(x));
    return unsupported.length === 0;
}

export async function analyze() {
    // Verify there is a workspace folder open to run analysis on.
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length == 0) {
        vscode.window.showErrorMessage('Error: There are no open workspace folders to run slither analysis on.');
        return;
    }
    
    // Verify the provided slither version is supported.
    if(!(await checkVersion())) {
        return;
    }

    // Print our starting analysis message.
    Logger.log("Starting slither analysis... \u2705");

    // Setup our state
    results.clear();

    // Loop for every workspace to run analysis on.
    for (let i = 0; i < vscode.workspace.workspaceFolders.length; i++) {

        // TODO: Add ability to filter workspace folders out here.

        // Obtain our workspace path.
        const workspacePath = vscode.workspace.workspaceFolders[i].uri.fsPath;

        // Create the storage directory if it does not exist.
        config.createStorageDirectory(workspacePath);

        // At first we will output to a temporary directory, then we will move the file.
        // This lets us keep our results in the same location but know if new results have been generated reliably.
        const tempResultsPath  = config.getStorageFilePath(workspacePath, config.storageResultsTempFileName);
        const resultsPath  = config.getStorageFilePath(workspacePath, config.storageResultsFileName);

        // Delete the temp results file if it exists.
        if(fs.existsSync(tempResultsPath)) {
            fs.unlinkSync(tempResultsPath);
        }

        // Execute slither on this workspace.
        let {output, error} = await exec(`${workspacePath} --disable-solc-warnings --json ${tempResultsPath}`);

        // Errors are thrown when slither succeeds.
        if (error) {
            // If we can find a generated results file, we assume we succeeded
            if (fs.existsSync(tempResultsPath)) {

                // Delete the old final results file if it exists.
                if(fs.existsSync(resultsPath)) {
                    fs.unlinkSync(resultsPath);
                }

                // Move the newly generated results to the final path.
                fs.renameSync(tempResultsPath, resultsPath);

                // Parse the underlying for the console.
                let workspaceResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
                results.set(workspacePath, workspaceResults);
                printResults(workspaceResults);

            } else {
                // We couldn't find a results file, this is probably a real error.
                Logger.error(error!.toString());
            }
        } else {
            // No error occurred, likely no issues were detected.
            Logger.log("No issues detected.");
        }
    }
}

async function printResults(data: []) {
    data.forEach((item: any) => {
        const descriptions = item['description'].replace(/#/g, ":").replace(/\t/g, "").split("\n");
        descriptions.forEach((description: any) => {

            // If any issue doesn't have a description, it is not output.
            if (description === "") {
                return;
            }
            
            // Seperate issues (following lines with a dash are usually connected to the issue above)
            if (!description.startsWith("-")) {
                Logger.log("");
            }

            // If the line starts with a dash, it's part of a list so we indent it. 
            // If it doesn't, it starts a new issue, and we add a special icon to it.
            if (description.startsWith("-")) {
                Logger.log(`\t${description}`);
            } else {
                Logger.log(`\u274C ${description}`);
            }

        });
    });
}

async function exec(args : string[] | string, logError : boolean = true) : Promise<{output : string, error : string}> { 
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