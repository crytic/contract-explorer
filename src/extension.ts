'use strict';
import * as vscode from 'vscode';
import { checkSlitherVersion, sortError, validateDetectors } from "./helper";
import * as shell from "shelljs";
import * as fs from "fs";
import { exec } from './helper';


export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode slither plugin" is now active!');

    let slither = vscode.commands.registerCommand('extension.slither', async () => {

        const { workspace : { workspaceFolders, getConfiguration }, window, } = vscode;
        const outputChannel = window.createOutputChannel("Slither");
        outputChannel.appendLine("Slither...")

        if(!workspaceFolders){
            vscode.window.showErrorMessage('Please run command in a valid project');
            return;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;

        await checkSlitherVersion();

        const { include, exclude } = getConfiguration('slither');
        const result = isValidDetectors({ include, exclude }, outputChannel);

        if(!result) {
            console.log("processing")
            outputChannel.show();
            return;
        }
        
        const outputDir  = `${workspacePath}/.slither`;
        const outputFile = `${outputDir}/output.json`;

        shell.mkdir("-p", outputDir);

        let cmd : string = `slither ${workspacePath} --disable-solc-warnings --json ${outputFile}`;
        cmd = await addFlag(include, cmd, `detect`);
        cmd = await addFlag(exclude, cmd, `exclude`);

        let err : Error | null = null;
        await exec(cmd).catch((e: Error) => err = e);

        if(err) {
            if(fs.existsSync(outputFile)){
                let data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
                data = sortError(data);
                parseResponse(data, outputChannel);
            } else {
                outputChannel.appendLine(err!.toString());
            }
        } else {
            outputChannel.appendLine("No issues detected :D");
        }

        outputChannel.show();

        shell.rm(`${outputDir}/*`);
    });

    context.subscriptions.push(slither);
}

async function addFlag(option: [], cmd: string, flag: string) : Promise<string> {
    if(option.length > 0){
        cmd = `${cmd} --${flag} ${option.join(',')}`;
    }
    return cmd;
}

async function parseResponse(data: [], outputChannel: vscode.OutputChannel){
    data.forEach((item: any) => {
        const descriptions = item['description'].replace(/#/g, ":").replace(/\t/g, "").split("\n");

        descriptions.forEach( (description: any) => {
            if(description === "") {
                return;
            }
            if(!description.startsWith("-")){
                outputChannel.appendLine("");
            }
            if(description.startsWith("-")){
                outputChannel.appendLine(`\t${description}`);
            } else {
                outputChannel.appendLine(`${description}`);
            }
        });
    });            
}

async function isValidDetectors(options: {'exclude':[], 'include': []}, outputChannel: vscode.OutputChannel){
    let isValid = false;

    if(options.include.length > 0){
        isValid = await checkDetectors(options.include, outputChannel);
        if(!isValid) {
            return isValid;
        }
    }

    if(options.exclude.length > 0){
        isValid = await checkDetectors(options.exclude, outputChannel);
        if(!isValid) {
            return isValid;
        }
    }

    return isValid;
}

async function checkDetectors(detectors: any, outputChannel: vscode.OutputChannel){
    detectors = detectors.filter( (item: string)=> item !== "" );
    const isValid = await validateDetectors(detectors);
    if(!isValid){
        outputChannel.appendLine(`Error: Invalid detectors present Detectors: ${detectors}`);
        return false;
    }
    return true;
}

// this method is called when your extension is deactivated
export function deactivate() {
    console.log('"vscode slither plugin" is now deactivated');
}