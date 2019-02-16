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
        const outputDir  = `${workspacePath}/.slither`;
        const outputFile = `${outputDir}/output.json`;

        shell.mkdir("-p", outputDir);

        let cmd = `slither ${workspacePath} --disable-solc-warnings --json ${outputFile}`;
        
        if(include.length > 0){
            const result = await checkDetectors(include, outputChannel);
            if(!result) {
                return;
            }
            cmd = `${cmd} --detect ${include.join(',')}`;
        }

        if(exclude.length > 0){
            const result = await checkDetectors(exclude, outputChannel);
            if(!result) {
                return;
            }
            cmd = `${cmd} --exclude ${exclude.join(',')}`;
        }


        let err = null;
        await exec(cmd).catch((e: Error) => err = e);

        if(err) {
            let data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
            data = sortError(data);

            data.forEach((item: any) => {
                const descriptions = item['description'].replace(/#/g, ":").replace(/\t/g, "").split("\n");

                descriptions.forEach( (description: any) => {
                    if(description === "") {
                        return;
                    }
                    if(!description.startsWith("-")){
                        outputChannel.appendLine("")
                    }
                    if(description.startsWith("-")){
                        outputChannel.appendLine(`\t${description}`);
                    } else {
                        outputChannel.appendLine(`${description}`);
                    }
                });
            });            
        }

        outputChannel.show();

        shell.rm(`${outputDir}/*`);
        // Display a message box to the user
    });

    context.subscriptions.push(slither);
}

async function checkDetectors(detectors: any, outputChannel: vscode.OutputChannel){
    detectors= detectors.filter( (item: string)=> item !== "" );
    const isValid = await validateDetectors(detectors);
    if(!isValid){
        outputChannel.appendLine(`Error: Invalid detectors present Detectors: ${detectors}`);
        outputChannel.show();
        return false;
    }
    return true;
}

// this method is called when your extension is deactivated
export function deactivate() {
    console.log('"vscode slither plugin" is now deactivated');
}