import * as config from "./config";
import * as vscode from 'vscode';
import * as util from "util";
import * as fs from "fs";
import * as semver from 'semver';
import { Logger } from "./logger";

const checkVersion = async () => {
    try {
        // Invoke slither to obtain the current version.
        let version = (await exec('--version')).output.replace(/\r?\n|\r/g, "");

        // Verify we meet the minimum requirement.
        if(!semver.gt(version, config.minimumSlitherVersion)){
            Logger.error(
`Incompatible version of slither. 
Minimum Requirement: ${config.minimumSlitherVersion}
Current version ${version}
Please upgrade slither: "pip install slither-analyzer --upgrade"`
            );
            return false;
        }
    } catch(e){
        // An error occurred checking version, assume slither is not installed.
        Logger.error(
`Slither Installation Required
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

export const sortError = (error: []) => {
    const order: any = {
      "Informational": 0,
      "Low": 1,
      "Medium": 2,
      "High": 3,
    }
  
    return error.sort(function(x: any, y: any) {
      if(order[x.impact] < order[y.impact]){
        return -1
      } else if (order[x.impact] > order[y.impact]) {
        return 1
      }
      return 0
    })
  }

export async function analyze() {

    // Verify there is a workspace folder open to run analysis on.
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length == 0) {
        vscode.window.showErrorMessage('Error: There are no open workspace folders to run slither analysis on.');
        return;
    }

    // Print our starting analysis message.
    Logger.log("Starting slither analysis... \u2705");

    // Verify the provided slither version is supported.
    await checkVersion();

    // Loop for every workspace to run analysis on.
    for (let i = 0; i < vscode.workspace.workspaceFolders.length; i++) {

        // TODO: Add ability to filter workspace folders out here.

        // Obtain our workspace path.
        const workspacePath = vscode.workspace.workspaceFolders[i].uri.fsPath;

        // Create the storage directory if it does not exist.
        config.createStorageDirectory(workspacePath);

        // Determine the path where results will be stored.
        const outputFile  = config.getStorageFilePath(workspacePath, config.storageResultsFileName);

        // Execute slither on this workspace.
        let {output, error} = await exec(`${workspacePath} --disable-solc-warnings --json ${outputFile}`);

        // If an error occurred, it likely signifies slither ran scans.
        if (error) {
            if (fs.existsSync(outputFile)) {
                let data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
                data = sortError(data);
                parseResponse(data);
            } else {
                Logger.log(error!.toString());
            }
        } else {
            Logger.log("No issues detected :D");
        }
    }
}

async function parseResponse(data: []) {
    data.forEach((item: any) => {
        const descriptions = item['description'].replace(/#/g, ":").replace(/\t/g, "").split("\n");
        descriptions.forEach((description: any) => {

            if (description === "") {
                return;
            }

            description = formatDescription(description)
            
            if (!description.startsWith("-")) {
                Logger.log("");
            }
            if (description.startsWith("-")) {
                Logger.log(`\t${description}`);
            } else {
                Logger.log(`\u274C ${description}`);
            }

        });
    });
}

function formatDescription(description: string){
    // Formats a description such that any file references can be clicked in the output.
    const index = description.indexOf("/");
    description = description.replace(":","#");
    if(index > 0){
        description = description.slice(0, index-1) + "(file://" +  description.slice(index)
    }
    return description
}

async function checkDetectors(detectors: any) {
    detectors = detectors.filter((item: string) => item !== "");
    const isValid = await validateDetectors(detectors);
    if (!isValid) {
        Logger.log(`Error: Invalid detectors present in configuration Detectors: ${detectors}`);
        return false;
    }
    return true;
}

async function exec(args : string[] | string, logError : boolean = true) : Promise<{output : string, error : string}> { 
    // If this is an array, make it into a single string.
    if (args instanceof Array) {
        args = args.join(' ');
    }

    // Now we can invoke slither.
    let stderr;
    let cmd = util.promisify(require("child_process").exec);
    let { stdout } = await cmd(`${config.slitherPath} ${args}`).catch((e: any) => stderr = e);

    // If we encountered an error, log it
    if (stderr && logError) { 
        Logger.error(String(stderr));
    }

    // Return stdout/stderr.
    return { output : String(stdout), error : String(stderr)};
}