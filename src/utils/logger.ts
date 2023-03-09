import * as vscode from 'vscode';
import { ErrorCodes, ResponseError } from 'vscode-languageclient';
import { isDebuggingExtension } from './common';

export class Logger {
    private static outputChannel : vscode.OutputChannel = vscode.window.createOutputChannel("Slither Extension");

    public static initialize(): void {
        this.show();
    }

    public static show(): void {
        // Reveal this channel in the UI.
        this.outputChannel.show();
    }

    public static log(msg: string): void {
        // Output the base message.
        this.outputChannel.appendLine(msg);
    }

    public static info(msg: string): void {
        // Output the info to console
        this.outputChannel.appendLine(msg);
    }

    public static error(msg: string | Error | ResponseError<any>, showErrorDialog: boolean=true): void {
        // Format the message
        if (msg instanceof ResponseError) {
            let codeStr: string;
            if (msg.code == ErrorCodes.InternalError) codeStr = "InternalError";
            else if (msg.code == ErrorCodes.InvalidParams) codeStr = "InvalidParams";
            else if (msg.code == ErrorCodes.InvalidRequest) codeStr = "InvalidRequest";
            else if (msg.code == ErrorCodes.ParseError) codeStr = "ParseError";
            else if (msg.code == ErrorCodes.MethodNotFound) codeStr = "MethodNotFound";
            else if (msg.code == ErrorCodes.MessageReadError) codeStr = "MessageReadError";
            else if (msg.code == ErrorCodes.MessageWriteError) codeStr = "MessageWriteError";
            else if (msg.code == ErrorCodes.ServerNotInitialized) codeStr = "ServerNotInitialized";
            else if (msg.code == ErrorCodes.UnknownErrorCode) codeStr = "UnknownErrorCode";
            else codeStr = msg.code.toString();
            msg = `Error [${codeStr}]: ${msg.message}`;
        } else if(msg instanceof Error) {
            msg = `Error: ${msg.message}`;
        } else {
            msg = `Error: ${msg}`;
        }

        // Output the error to console
        this.outputChannel.appendLine(msg);

        // Show our error dialog if desired
        if (showErrorDialog) {
            vscode.window.showErrorMessage(msg);
        }

        // Show our output channel
        this.show();
    }

    public static debug(msg: string): void {
        if (isDebuggingExtension()) {
            this.info(msg);
        }
    }
}

// As soon as this class is included, we initialize it.
Logger.initialize();