'use strict';
import * as vscode from 'vscode';
import { checkSlitherVersion, sortError, validateDetectors } from "./slither";
import * as shell from "shelljs";
import * as fs from "fs";
import { exec } from './slither';
import { Logger } from "./logger";
import * as common from "./common";


export function activate(context: vscode.ExtensionContext) {
    let slither = vscode.commands.registerCommand('extension.slither', async () => {

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
    });

    context.subscriptions.push(slither);

    // If we are in debug mode, log our activation message and focus on the output channel
	if(common.isDebuggingExtension()) {
        Logger.log("Activated Slither extension in debug mode.");
	    Logger.show();
	}
}

async function addFlag(option: [], cmd: string, flag: string): Promise<string> {
    if (option.length > 0) {
        cmd = `${cmd} --${flag} ${option.join(',')}`;
    }
    return cmd;
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

// this method is called when your extension is deactivated
export function deactivate() {
    console.log('"vscode slither plugin" is now deactivated');
}