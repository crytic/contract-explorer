'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { checkSlitherVersion, sortError } from "./helper";
import chalk from "chalk";
import * as shell from "shelljs";
import * as fs from "fs"
import { exec } from './helper';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "vscode-slither" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let slither = vscode.commands.registerCommand('extension.slither', async () => {

        // The code you place here will be executed every time your command is executed
        const { workspace : { workspaceFolders, getConfiguration}, window, DocumentHighlight, Range } = vscode;
        const { activeTextEditor } = window;
        const outputChannel = window.createOutputChannel("Slither");
        outputChannel.appendLine("Running Slither ...")


        if(!workspaceFolders){
            vscode.window.showErrorMessage('Please run command in a valid project');
            return;
        }
        const workspacePath = workspaceFolders[0].uri.fsPath;

        console.log({workspaceFolders});
        console.log({workspacePath});

        const config = getConfiguration('slither');

        console.log(config);
        console.log(JSON.stringify(config));

        await checkSlitherVersion();

        const outputDir  = `${workspacePath}/.slither`;
        const outputFile = `${outputDir}/output.json`;

        shell.mkdir("-p", outputDir);

        let cmd = `slither ${workspacePath} --disable-solc-warnings --json ${outputFile}`;

        let err = null;
        const result = await exec(cmd).catch((e: Error) => err = e);
        console.log({ result });

        outputChannel.appendLine("Results")

        if(err) {
            let data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
            data = sortError(data);
            
            data.forEach((item: any) => {
                outputChannel.appendLine(chalk.greenBright(`\t ${item['description'].replace(/#/g, ":")}`));
            });            
        }

        outputChannel.show()

        shell.rm(`${outputDir}/*`)
        // Display a message box to the user
    });

    context.subscriptions.push(slither);
}


// this method is called when your extension is deactivated
export function deactivate() {
}