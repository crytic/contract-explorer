import * as vscode from 'vscode';
import * as config from "./config";
import * as child_process from 'child_process';
import * as fs from "fs";
import * as sparkmd5 from "spark-md5";
import * as path from "path";
import { Logger } from "./logger";
import * as semver from 'semver';
import { SlitherDetector, SlitherResult } from "./slitherResults";
import * as util from "util";

// Properties
export let initialized : boolean = false;
export let version : string;
export let detectors : SlitherDetector[];
export let detectorsByCheck : Map<string, SlitherDetector> = new Map<string, SlitherDetector>();
export const results : Map<string, SlitherResult[]> = new Map<string, SlitherResult[]>();
export const out_of_sync_results : Set<SlitherResult[]> = new Set<SlitherResult[]>();

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

        // Create a map of check->detector
        detectorsByCheck.clear();
        for (let detector of detectors) {
            detectorsByCheck.set(detector.check, detector);
        }

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

            // Log the current version of slither.
            Logger.log(`Using slither version: ${version}`);
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

export async function analyze(print : boolean = true) : Promise<boolean> {
    // Verify there is a workspace folder open to run analysis on.
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length == 0) {
        Logger.log('There are no open workspace folders to run slither analysis on.');
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

    // Clear any existing results
    clear(true);

    // Loop for every workspace to run analysis on.
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < vscode.workspace.workspaceFolders.length; i++) {

        // Obtain our workspace path.
        const workspaceFolder = vscode.workspace.workspaceFolders[i].uri.fsPath;

        // Create the storage directory if it does not exist.
        config.createStorageDirectory(workspaceFolder);

        // Execute slither on this workspace.
        let { output, error } = await exec_slither(". --json -", false, workspaceFolder);

        // Try to parse output as json, filter duplicates, and set in map.
        let workspaceResults : SlitherResult[] | undefined;
        if (!error) {
            try {
                workspaceResults = <SlitherResult[]>JSON.parse(output);
                workspaceResults = await filterDuplicateResults(workspaceResults);
                results.set(workspaceFolder, workspaceResults);
            } catch(e) {
                error = output;
            }
        }

        // If an error was encountered, log it.
        if (error) {
            // We couldn't find a results file, this is probably a real error.
            Logger.error(
`Error in workspace "${workspaceFolder}":
${error!.toString()}`);
            failCount++;
            continue;
        }

        // Add to the success count
        successCount++;
    }

    // Recalculate hash sourcemappings
    updateSourceMappingSyncStatus(true);

    // Loop for each result to write and print
    for (let [workspaceFolder, workspaceResults] of results) {
        // If we succeeded in parsing results for this workspace
        if(workspaceResults) {

            // Obtain our results storage path.
            const resultsPath  = config.getStorageFilePath(workspaceFolder, config.storageFiles.analysis);

            // Cache the results
            fs.writeFileSync(resultsPath, JSON.stringify(workspaceResults, null, "\t"));

            // Loop for every result and set its sync status to valid
            for (let workspaceResult of workspaceResults) {
                workspaceResult._ext_in_sync = true;
            }

            // Print the results
            if (print) {
                printResults(workspaceResults);
            }
        }
    }

    // Print our analysis results.
    Logger.log("");
    Logger.log(`\u2E3B Analysis: ${successCount} succeeded, ${failCount} failed, ${vscode.workspace.workspaceFolders.length - (successCount + failCount)} skipped \u2E3B`);

    // Save all configurations
    config.saveConfiguration();

    // We completed analysis without error.
    return true;
}

export async function updateSourceMappingSyncStatus(firstTimeCalculation : boolean = false, fileNameFilter : string | undefined = undefined) {
    // Create a mapping of filename -> source
    let sourceContentMap : Map<string, string> = new Map<string, string>();

    // Loop for every workspace
    for(let [workspaceFolder, workspaceResults] of results) {
        // Loop through each result element
        for (let workspaceResult of workspaceResults) {
            let workspaceResultValidity : boolean | undefined = undefined;
            for(let workspaceResultElement of workspaceResult.elements) {

                // If this workspace element has no source mapping, we skip to the next
                if (!workspaceResultElement.source_mapping) {
                    // If we are verifying, this element is considered valid.
                    if (!firstTimeCalculation) {
                        workspaceResultValidity = true;
                    }
                    continue;
                }
                
                // Try to obtain any cached source content
                let sourceMappingFile = path.join(workspaceFolder, workspaceResultElement.source_mapping.filename_relative);
                let sourceContent = sourceContentMap.get(workspaceResultElement.source_mapping.filename_relative);

                // If we are trying to only refresh results for a certain filename, we skip if our filename doesnt match.
                if (fileNameFilter && path.normalize(sourceMappingFile) != path.normalize(fileNameFilter)) {
                    continue;
                }

                // If we have no source content cached, we read it.
                if(!sourceContent) {
                    sourceContent = fs.readFileSync(sourceMappingFile, 'utf8');
                    sourceContentMap.set(workspaceResultElement.source_mapping.filename_relative, sourceContent);
                }

                // Copy out the source mapped data
                let mappedSource = sourceContent.substring(workspaceResultElement.source_mapping.start, workspaceResultElement.source_mapping.start + workspaceResultElement.source_mapping.length);

                // Hash the data
                let mappedSourceHash = sparkmd5.hash(mappedSource);

                // Determine if we're calculating hash for the first time, or verifying.
                if(firstTimeCalculation) {
                    workspaceResultElement.source_mapping._ext_source_hash = mappedSourceHash;
                } else {
                    // If our hash doesn't match, set our result as "out of sync", and skip to the next result.
                    workspaceResultValidity = workspaceResultElement.source_mapping._ext_source_hash == mappedSourceHash;

                    // If our result is out of sync, we don't need to check other elements, break the loop
                    if(workspaceResultValidity == false) {
                        break;
                    }
                }
            }

            // If we determined a new result validity, set it
            if(workspaceResultValidity != undefined) {
                workspaceResult._ext_in_sync = workspaceResultValidity;
            }
        }
    }
}

async function filterDuplicateResults(results : SlitherResult[]) : Promise<SlitherResult[]> {
    // Create a set and resulting array for filtered results.
    let processedResults : Set<string> = new Set<string>();
    let filteredResults : SlitherResult[] = [];

    // Compile a filtered, final array (free of duplicates).
    for(let i = 0; i < results.length; i++) {
        let jsonStringResult = JSON.stringify(results[i]);
        if(!processedResults.has(jsonStringResult)) {
            filteredResults.push(results[i]);
            processedResults.add(jsonStringResult);
        }
    }

    return filteredResults;
}

export async function readResults(print : boolean = false) : Promise<boolean> {
    // Verify there is a workspace folder open to run analysis on.
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length == 0) {
        Logger.error('There are no open workspace folders to run slither analysis on.');
        return false;
    }

    // Setup our state
    results.clear();

    // Loop for every workspace to read results from.
    for (let i = 0; i < vscode.workspace.workspaceFolders.length; i++) {

        // Obtain our workspace results path.
        const workspacePath = vscode.workspace.workspaceFolders[i].uri.fsPath;
        const resultsPath  = config.getStorageFilePath(workspacePath, config.storageFiles.analysis);

        // If the file exists, we read its contents into memory.
        if(fs.existsSync(resultsPath)) {
            // Read our cached results
            let workspaceResults : SlitherResult[] = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

            // Set the results and print them.
            results.set(workspacePath, workspaceResults);
        }
        else {
            // The file did not exist, so we simply use an empty array of results.
            results.set(workspacePath, []);
        }
    }

    // Verify the integrity of source mapping
    updateSourceMappingSyncStatus(false);

    // Loop for each result to print
    for (let [workspaceFolder, workspaceResults] of results) {
        if (print) {
            printResults(workspaceResults);
        }
    }

    // We succeeded without error.
    return true;
}

export async function clear(clearCurrentResults : boolean = true) {
    // Verify there is a workspace folder open to clear results for.
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length == 0) {
        return;
    }

    // Clear the current known results
    if (clearCurrentResults) {
        results.clear();
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

async function exec_slither(args : string[] | string, logError : boolean = true, workingDirectory : string | undefined = undefined) : Promise<{output : string, error : string}> { 
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
    let maxBufferSize : number = 1024 * 1024 * 20; // 20MB stdout limit
    let error : any;
    let stderr;
    let cmd = util.promisify(child_process.exec);
    let { stdout } = await cmd(`${config.slitherPath} ${args}`, { cwd : workingDirectory, maxBuffer: maxBufferSize}).catch((e: any) => error = e);
    
    // If we caught an error, copy our data from it.
    if(error) {
        stdout = error.stdout;
        stderr = error.stderr;
    }

    // If we encountered an error, log it
    if (stderr && logError) { 
        Logger.error(String(stderr));
    }

    // Return stdout/stderr.
    return { output : String(stdout), error : String(stderr)};
}