import config from "./config";
import chalk from "chalk";
import * as vscode from 'vscode';
import * as util from "util";
import * as shell from "shelljs";
import * as fs from "fs";
import { Logger } from "./logger";

export const { slitherVersion } = config;
export const exec = util.promisify(require("child_process").exec);

// const isValid = (obj) => !isEmpty(obj) && !isUndefined(obj) && !isNull(obj)
export const logInfo = (message: string) => console.log(chalk.greenBright(message));
export const logError = (message: string) => console.log(chalk.redBright(message));

export const compareSlitherVersion = ([majorVesion, minorVersion, patch]: any) => (
                                            (majorVesion > slitherVersion.majorVersion)
                                            ||
                                            (majorVesion === slitherVersion.majorVersion &&
                                                minorVersion > slitherVersion.minorVersion
                                            ) 
                                            || 
                                            (
                                                majorVesion === slitherVersion.majorVersion &&
                                                minorVersion === slitherVersion.minorVersion &&
                                                patch >= slitherVersion.patch
                                            )
);


export const checkSlitherVersion = async () => {
    try {
        let { stdout } = await exec(`slither --version`);
        let version:[] = (stdout.replace(/\r?\n|\r/g, "")
                        .split('.'))
                        .map( 
                            (item: string) => parseInt(item) 
                        );
        let checkVersion = compareSlitherVersion(version);
        if(!checkVersion){
            logError(
                `
                    Slither Version required >= ${slitherVersion.majorVersion}.${slitherVersion.minorVersion}.${slitherVersion.patch}\n
                    Version Present: ${version.join(".")} \n
                    Please upgrade your slither "pip install slither-analyzer --upgrade"
                `
            );
            return false;
        }
    } catch(e){
        logError(
            `
                Slither Installation Required
                Please install slither ${chalk.greenBright("pip install slither-analyzer")}
            `
        );
        
        return false;
    }
    return true;
}


export const validateDetectors = async(input: []) => {
    let err;
    const cmd       = `slither --list-detectors-json`;
    let { stdout }  = await exec(cmd).catch((e: any)=>err=e);
    if(err) console.log({err})
    let detectors   = (JSON.parse(stdout)).map((item: any) => item['check']);
    let difference  = input.filter(x => !detectors.includes(x));
    
    return difference.length === 0;
}

export const getDetectors = async() => {
    let err;
    const cmd       = `slither --list-detectors-json`;
    let { stdout }  = await exec(cmd).catch((e: any) => err = e);
    if(err) console.log({err})
    return JSON.parse(stdout);
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

    const { workspace: { workspaceFolders, getConfiguration }, window, } = vscode;
    Logger.log("\u2705 ... Slither ... \u2705")

    if (!workspaceFolders) {
        vscode.window.showErrorMessage('Please run command in a valid project');
        return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;

    await checkSlitherVersion();

    const { include, exclude } = getConfiguration('slither');
    const result = await isValidDetectors({ include, exclude });

    if (!result) {
        Logger.show();
        return;
    }

    const outputDir = `${workspacePath}/.slither`;
    const outputFile = `${outputDir}/output.json`;

    shell.mkdir("-p", outputDir);

    let cmd: string = `slither ${workspacePath} --disable-solc-warnings --json ${outputFile}`;
    cmd = await addFlag(include, cmd, `detect`);
    cmd = await addFlag(exclude, cmd, `exclude`);

    let err: Error | null = null;
    await exec(cmd).catch((e: Error) => err = e);

    if (err) {
        if (fs.existsSync(outputFile)) {
            let data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
            data = sortError(data);
            parseResponse(data);
        } else {
            Logger.log(err!.toString());
        }
    } else {
        Logger.log("No issues detected :D");
    }

    Logger.show();

    shell.rm(`${outputDir}/*`);
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


async function addFlag(option: [], cmd: string, flag: string): Promise<string> {
    if (option.length > 0) {
        cmd = `${cmd} --${flag} ${option.join(',')}`;
    }
    return cmd;
}

function formatDescription(description: string){
    const index = description.indexOf("/");
    description = description.replace(":","#");
    if(index > 0){
        description = description.slice(0, index-1) + "(file://" +  description.slice(index)
    }
    return description
}

async function isValidDetectors(options: { 'exclude': [], 'include': [] }) {
    let isValid = true;

    if (options.include.length > 0) {
        isValid = await checkDetectors(options.include);
    }

    if (!isValid) {
        return isValid;
    }

    if (options.exclude.length > 0) {
        isValid = await checkDetectors(options.exclude);
    }

    return isValid;
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