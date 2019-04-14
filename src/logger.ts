import * as vscode from "vscode";
import chalk from "chalk";

export class Logger {
    private static outputChannel : vscode.OutputChannel = vscode.window.createOutputChannel("Slither Extension");

    public static initialize() : void {
        // TODO: Initialization code.
   
    }

    public static show() : void {
        // Reveal this channel in the UI.
        this.outputChannel.show();
    }

    public static log(msg : string): void {
        // Output the base message.
        this.outputChannel.appendLine(msg);
    }

    public static info(msg : string): void {
        // Output the info in bright green.
        this.outputChannel.appendLine(chalk.greenBright(msg));
    }

    public static error(msg : string): void {
        // Output the error in bright red.
        this.outputChannel.appendLine(chalk.redBright(msg));
    }
}

// As soon as this class is included, we initialize it.
Logger.initialize();